import { strict as assert } from "node:assert";
import { test } from "node:test";
import { vercelCreateStep } from "../lib/steps/vercel_create.ts";
import { makeContext } from "./helpers/context.ts";
import { FetchMock, withMockedFetch } from "./helpers/fetch-mock.ts";

function withFullPriors(ctx: ReturnType<typeof makeContext>) {
  ctx.state.steps.github_fork = {
    repo_full_name: "test-owner/trackhq-acme",
    clone_url: "https://github.com/test-owner/trackhq-acme.git",
    html_url: "https://github.com/test-owner/trackhq-acme",
    completed_at: new Date().toISOString(),
  };
  ctx.state.steps.supabase_create = {
    project_ref: "ref",
    db_password: "x".repeat(24),
    supabase_url: "https://ref.supabase.co",
    anon_key: "anon-key",
    service_role_key: "service-key",
    completed_at: new Date().toISOString(),
  };
  return ctx;
}

test("vercel_create: POSTs project with full env vars when none exists", async () => {
  const ctx = withFullPriors(makeContext());
  ctx.manifest.slug = "acme";

  const mock = new FetchMock();
  // 1. getProject → 404
  mock.expect("GET", "https://api.vercel.com/v9/projects/trackhq-acme", {
    status: 404,
  });
  // 2. createProject
  mock.expect(
    "POST",
    "https://api.vercel.com/v9/projects",
    { status: 200, body: { id: "prj_123", name: "trackhq-acme" } },
    (body) => {
      const b = body as Record<string, unknown>;
      assert.equal(b.name, "trackhq-acme");
      assert.equal(b.rootDirectory, "template-dashboard");
      assert.equal(b.framework, "nextjs");
      const git = b.gitRepository as { type: string; repo: string };
      assert.equal(git.repo, "test-owner/trackhq-acme");
      const envs = b.environmentVariables as Array<{ key: string; value: string }>;
      const byKey = Object.fromEntries(envs.map((e) => [e.key, e.value]));
      assert.equal(byKey.NEXT_PUBLIC_SUPABASE_URL, "https://ref.supabase.co");
      assert.equal(byKey.SUPABASE_SERVICE_ROLE_KEY, "service-key");
      assert.equal(byKey.NEXT_PUBLIC_MAPBOX_TOKEN, "pk.test");
      const tenantConfig = JSON.parse(byKey.NEXT_PUBLIC_TENANT_CONFIG_JSON);
      assert.equal(tenantConfig.slug, "acme");
      assert.equal(tenantConfig.business_name, "Acme Test");
    }
  );

  await withMockedFetch(mock, () => vercelCreateStep.execute(ctx));
  mock.assertAllConsumed();
  assert.equal(ctx.state.steps.vercel_create?.project_id, "prj_123");
  assert.equal(ctx.state.steps.vercel_create?.default_domain, "trackhq-acme.vercel.app");
  assert.ok(ctx.state.steps.vercel_create?.completed_at);
});

test("vercel_create: upserts env vars when project already exists", async () => {
  const ctx = withFullPriors(makeContext());
  ctx.manifest.slug = "acme";

  const mock = new FetchMock();
  // getProject → 200
  mock.expect("GET", "https://api.vercel.com/v9/projects/trackhq-acme", {
    status: 200,
    body: { id: "prj_existing", name: "trackhq-acme" },
  });
  // upsertEnvVars — POST /v10/projects/{id}/env?upsert=true
  mock.expect(
    "POST",
    /api\.vercel\.com\/v10\/projects\/prj_existing\/env\?upsert=true/,
    { status: 200, body: { created: [] } },
    (body) => {
      const envs = body as Array<{ key: string }>;
      assert.equal(envs.length, 5);
      assert.ok(envs.some((e) => e.key === "NEXT_PUBLIC_TENANT_CONFIG_JSON"));
    }
  );

  await withMockedFetch(mock, () => vercelCreateStep.execute(ctx));
  mock.assertAllConsumed();
  assert.equal(ctx.state.steps.vercel_create?.project_id, "prj_existing");
});

test("vercel_create: includes teamId in query when set", async () => {
  const ctx = withFullPriors(makeContext());
  ctx.manifest.slug = "acme";
  ctx.manifest.resolved.vercel_team_id = "team_xyz";

  const mock = new FetchMock();
  mock.expect("GET", /\/v9\/projects\/trackhq-acme\?teamId=team_xyz/, { status: 404 });
  mock.expect("POST", /\/v9\/projects\?teamId=team_xyz/, {
    status: 200,
    body: { id: "prj_x", name: "trackhq-acme" },
  });

  await withMockedFetch(mock, () => vercelCreateStep.execute(ctx));
  mock.assertAllConsumed();
});

test("vercel_create: fails fast if supabase_create state is missing", async () => {
  const ctx = makeContext();
  ctx.state.steps.github_fork = {
    repo_full_name: "test-owner/trackhq-acme-test",
    clone_url: "x",
    html_url: "x",
    completed_at: new Date().toISOString(),
  };
  await assert.rejects(
    () => vercelCreateStep.execute(ctx),
    /supabase_create must complete first/
  );
});

test("vercel_create: fails fast if github_fork state is missing", async () => {
  const ctx = makeContext();
  await assert.rejects(
    () => vercelCreateStep.execute(ctx),
    /github_fork must complete first/
  );
});

test("vercel_create: fails fast if MAPBOX_PUBLIC_TOKEN is missing", async () => {
  const ctx = withFullPriors(makeContext());
  ctx.env.mapbox_public_token = null;
  await assert.rejects(
    () => vercelCreateStep.execute(ctx),
    /MAPBOX_PUBLIC_TOKEN is required/
  );
});
