import { strict as assert } from "node:assert";
import { test } from "node:test";
import { githubForkStep } from "../lib/steps/github_fork.ts";
import { makeContext, makeManifest } from "./helpers/context.ts";
import { FetchMock, withMockedFetch } from "./helpers/fetch-mock.ts";

test("github_fork: forks into authenticated user's account when target matches login", async () => {
  const ctx = makeContext({
    manifest: makeManifest({
      slug: "acme",
      resolved: {
        github_owner: "test-owner",
        supabase_org_id: "org_test",
        supabase_region: "us-east-1",
        vercel_team_id: null,
        railway_team_id: null,
        domain: null,
        twilio_area_code: null,
      },
    }),
  });

  const mock = new FetchMock();
  // 1. Check if fork already exists → 404
  mock.expect("GET", "https://api.github.com/repos/test-owner/trackhq-acme", {
    status: 404,
    body: { message: "Not Found" },
  });
  // 2. Get authenticated user
  mock.expect("GET", "https://api.github.com/user", {
    status: 200,
    body: { login: "test-owner" },
  });
  // 3. Fork — target_owner === authedLogin so no `organization` field
  mock.expect(
    "POST",
    "https://api.github.com/repos/brantlee-alexander/TrackHQ/forks",
    {
      status: 202,
      body: {
        full_name: "test-owner/trackhq-acme",
        html_url: "https://github.com/test-owner/trackhq-acme",
        clone_url: "https://github.com/test-owner/trackhq-acme.git",
      },
    },
    (body) => {
      assert.deepEqual(body, {
        name: "trackhq-acme",
        default_branch_only: true,
      });
    }
  );

  await withMockedFetch(mock, () => githubForkStep.execute(ctx));

  mock.assertAllConsumed();
  assert.equal(ctx.state.steps.github_fork?.repo_full_name, "test-owner/trackhq-acme");
  assert.equal(
    ctx.state.steps.github_fork?.clone_url,
    "https://github.com/test-owner/trackhq-acme.git"
  );
  assert.ok(ctx.state.steps.github_fork?.completed_at);
});

test("github_fork: passes organization field when target is an org", async () => {
  const ctx = makeContext({
    manifest: makeManifest({
      slug: "acme",
      resolved: {
        github_owner: "my-org",
        supabase_org_id: "org_test",
        supabase_region: "us-east-1",
        vercel_team_id: null,
        railway_team_id: null,
        domain: null,
        twilio_area_code: null,
      },
    }),
  });

  const mock = new FetchMock();
  mock.expect("GET", "https://api.github.com/repos/my-org/trackhq-acme", {
    status: 404,
  });
  mock.expect("GET", "https://api.github.com/user", {
    status: 200,
    body: { login: "test-owner" }, // != my-org
  });
  mock.expect(
    "POST",
    "https://api.github.com/repos/brantlee-alexander/TrackHQ/forks",
    {
      status: 202,
      body: {
        full_name: "my-org/trackhq-acme",
        html_url: "https://github.com/my-org/trackhq-acme",
        clone_url: "https://github.com/my-org/trackhq-acme.git",
      },
    },
    (body) => {
      assert.deepEqual(body, {
        name: "trackhq-acme",
        organization: "my-org",
        default_branch_only: true,
      });
    }
  );

  await withMockedFetch(mock, () => githubForkStep.execute(ctx));
  mock.assertAllConsumed();
  assert.equal(ctx.state.steps.github_fork?.repo_full_name, "my-org/trackhq-acme");
});

test("github_fork: reuses existing fork without calling forks endpoint", async () => {
  const ctx = makeContext();
  const mock = new FetchMock();
  // Fork already exists — no /forks call should happen
  mock.expect("GET", "https://api.github.com/repos/test-owner/trackhq-acme-test", {
    status: 200,
    body: {
      full_name: "test-owner/trackhq-acme-test",
      html_url: "https://github.com/test-owner/trackhq-acme-test",
      clone_url: "https://github.com/test-owner/trackhq-acme-test.git",
    },
  });

  await withMockedFetch(mock, () => githubForkStep.execute(ctx));
  mock.assertAllConsumed();
  assert.equal(
    ctx.state.steps.github_fork?.repo_full_name,
    "test-owner/trackhq-acme-test"
  );
});

test("github_fork: fails fast when GITHUB_TOKEN is missing", async () => {
  const ctx = makeContext();
  ctx.env.github_token = null;
  await assert.rejects(
    () => githubForkStep.execute(ctx),
    /GITHUB_TOKEN is required/
  );
});

test("github_fork: propagates non-404 errors from getRepo", async () => {
  const ctx = makeContext();
  const mock = new FetchMock();
  mock.expect("GET", /repos\/test-owner\/trackhq-acme-test/, {
    status: 500,
    body: { message: "Server Error" },
  });

  await withMockedFetch(mock, async () => {
    await assert.rejects(
      () => githubForkStep.execute(ctx),
      /failed: 500/
    );
  });
});
