import { strict as assert } from "node:assert";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { supabaseCreateStep } from "../lib/steps/supabase_create.ts";
import { makeContext, makeState } from "./helpers/context.ts";
import { FetchMock, withMockedFetch } from "./helpers/fetch-mock.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, "..", "state");

function cleanState(slug: string): void {
  const path = resolve(STATE_DIR, `${slug}.json`);
  if (existsSync(path)) rmSync(path);
}

test("supabase_create: POSTs project, polls, captures keys, saves state with completed_at", async () => {
  const slug = "__test_sb_create_happy";
  cleanState(slug);
  const ctx = makeContext({ state: makeState(slug) });
  ctx.manifest.slug = slug;

  const mock = new FetchMock();
  // 1. POST /v1/projects
  mock.expect(
    "POST",
    "https://api.supabase.com/v1/projects",
    {
      status: 201,
      body: {
        id: "uuid-123",
        ref: "abcdef1234567890",
        name: `trackhq-${slug}`,
        organization_id: "org_test",
        region: "us-east-1",
        status: "COMING_UP",
      },
    },
    (body) => {
      const b = body as Record<string, unknown>;
      assert.equal(b.name, `trackhq-${slug}`);
      assert.equal(b.organization_id, "org_test");
      assert.equal(b.region, "us-east-1");
      assert.equal(b.plan, "free");
      assert.ok(typeof b.db_pass === "string" && (b.db_pass as string).length >= 24);
    }
  );
  // 2. First poll — still coming up
  mock.expect("GET", "https://api.supabase.com/v1/projects/abcdef1234567890", {
    status: 200,
    body: { ref: "abcdef1234567890", status: "COMING_UP", id: "u", name: "n", organization_id: "o", region: "us-east-1" },
  });
  // 3. Second poll — healthy
  mock.expect("GET", "https://api.supabase.com/v1/projects/abcdef1234567890", {
    status: 200,
    body: { ref: "abcdef1234567890", status: "ACTIVE_HEALTHY", id: "u", name: "n", organization_id: "o", region: "us-east-1" },
  });
  // 4. GET api-keys
  mock.expect(
    "GET",
    "https://api.supabase.com/v1/projects/abcdef1234567890/api-keys",
    {
      status: 200,
      body: [
        { name: "anon", api_key: "eyJ.anon" },
        { name: "service_role", api_key: "eyJ.service" },
      ],
    }
  );

  // Mock setTimeout so the poll loop doesn't actually wait
  const origTimeout = globalThis.setTimeout;
  // @ts-expect-error stubbing setTimeout — return type is intentionally minimal
  globalThis.setTimeout = (cb: () => void) => { cb(); return 0; };

  try {
    await withMockedFetch(mock, () => supabaseCreateStep.execute(ctx));
  } finally {
    globalThis.setTimeout = origTimeout;
  }

  mock.assertAllConsumed();
  const result = ctx.state.steps.supabase_create!;
  assert.equal(result.project_ref, "abcdef1234567890");
  assert.equal(result.supabase_url, "https://abcdef1234567890.supabase.co");
  assert.equal(result.anon_key, "eyJ.anon");
  assert.equal(result.service_role_key, "eyJ.service");
  assert.ok(result.db_password && result.db_password.length >= 24);
  assert.ok(result.completed_at);

  cleanState(slug);
});

test("supabase_create: persists project_ref before waiting (so a mid-wait crash can resume)", async () => {
  const slug = "__test_sb_create_persist";
  cleanState(slug);
  const ctx = makeContext({ state: makeState(slug) });
  ctx.manifest.slug = slug;

  const mock = new FetchMock();
  mock.expect("POST", "https://api.supabase.com/v1/projects", {
    status: 201,
    body: {
      ref: "newref",
      id: "u", name: "n", organization_id: "o", status: "COMING_UP", region: "us-east-1",
    },
  });
  // Poll throws — simulating a network blip mid-wait
  mock.expect("GET", "https://api.supabase.com/v1/projects/newref", {
    status: 500,
    body: { error: "transient" },
  });

  const origTimeout = globalThis.setTimeout;
  // @ts-expect-error stubbing setTimeout — return type is intentionally minimal
  globalThis.setTimeout = (cb: () => void) => { cb(); return 0; };

  try {
    await withMockedFetch(mock, async () => {
      await assert.rejects(() => supabaseCreateStep.execute(ctx), /failed: 500/);
    });
  } finally {
    globalThis.setTimeout = origTimeout;
  }

  // State should have the project_ref + db_password but no completed_at
  const result = ctx.state.steps.supabase_create!;
  assert.equal(result.project_ref, "newref");
  assert.ok(result.db_password);
  assert.equal(result.completed_at, undefined);
  // Confirm state file was written to disk
  assert.ok(existsSync(resolve(STATE_DIR, `${slug}.json`)));

  cleanState(slug);
});

test("supabase_create: resume skips POST when project_ref already present", async () => {
  const slug = "__test_sb_create_resume";
  cleanState(slug);
  const ctx = makeContext({ state: makeState(slug) });
  ctx.manifest.slug = slug;
  // Simulate a previous run that left a partial result
  ctx.state.steps.supabase_create = {
    project_ref: "existingref",
    db_password: "existing-password-1234567890",
    supabase_url: "https://existingref.supabase.co",
    anon_key: "",
    service_role_key: "",
    completed_at: "",
  };

  const mock = new FetchMock();
  // No POST — straight to polling
  mock.expect("GET", "https://api.supabase.com/v1/projects/existingref", {
    status: 200,
    body: { ref: "existingref", status: "ACTIVE_HEALTHY", id: "u", name: "n", organization_id: "o", region: "us-east-1" },
  });
  mock.expect(
    "GET",
    "https://api.supabase.com/v1/projects/existingref/api-keys",
    {
      status: 200,
      body: [
        { name: "anon", api_key: "anon-key" },
        { name: "service_role", api_key: "service-key" },
      ],
    }
  );

  await withMockedFetch(mock, () => supabaseCreateStep.execute(ctx));
  mock.assertAllConsumed();
  assert.equal(ctx.state.steps.supabase_create?.anon_key, "anon-key");
  assert.equal(ctx.state.steps.supabase_create?.service_role_key, "service-key");
  assert.ok(ctx.state.steps.supabase_create?.completed_at);

  cleanState(slug);
});
