import { strict as assert } from "node:assert";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { railwayCreateStep } from "../lib/steps/railway_create.ts";
import { makeContext, makeState } from "./helpers/context.ts";
import { FetchMock, withMockedFetch } from "./helpers/fetch-mock.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, "..", "state");
function cleanState(slug: string): void {
  const path = resolve(STATE_DIR, `${slug}.json`);
  if (existsSync(path)) rmSync(path);
}

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
  ctx.state.steps.vapi_create = {
    assistant_id: "asst_xyz",
    completed_at: new Date().toISOString(),
  };
  return ctx;
}

test("railway_create: creates project, service, sets root dir, upserts env vars", async () => {
  const slug = "__test_rw_create_happy";
  cleanState(slug);
  const ctx = withFullPriors(makeContext({ state: makeState(slug) }));
  ctx.manifest.slug = slug;

  const mock = new FetchMock();
  // 1. projectCreate
  mock.expect(
    "POST",
    "https://backboard.railway.app/graphql/v2",
    {
      status: 200,
      body: {
        data: {
          projectCreate: {
            id: "prj_1",
            environments: { edges: [{ node: { id: "env_prod", name: "production" } }] },
          },
        },
      },
    },
    (body) => {
      const b = body as { query: string; variables: { input: { name: string } } };
      assert.match(b.query, /projectCreate/);
      assert.equal(b.variables.input.name, `trackhq-${slug}`);
    }
  );
  // 2. serviceCreate
  mock.expect(
    "POST",
    "https://backboard.railway.app/graphql/v2",
    {
      status: 200,
      body: { data: { serviceCreate: { id: "svc_1" } } },
    },
    (body) => {
      const b = body as { query: string; variables: { input: Record<string, unknown> } };
      assert.match(b.query, /serviceCreate/);
      assert.equal(b.variables.input.projectId, "prj_1");
      const source = b.variables.input.source as { repo: string };
      assert.equal(source.repo, "test-owner/trackhq-acme");
    }
  );
  // 3. serviceInstanceUpdate (rootDirectory)
  mock.expect(
    "POST",
    "https://backboard.railway.app/graphql/v2",
    { status: 200, body: { data: { serviceInstanceUpdate: true } } },
    (body) => {
      const b = body as { query: string; variables: { input: { rootDirectory?: string } } };
      assert.match(b.query, /serviceInstanceUpdate/);
      assert.equal(b.variables.input.rootDirectory, "template-server");
    }
  );
  // 4. variableCollectionUpsert
  mock.expect(
    "POST",
    "https://backboard.railway.app/graphql/v2",
    { status: 200, body: { data: { variableCollectionUpsert: true } } },
    (body) => {
      const b = body as { query: string; variables: { input: { variables: Record<string, string> } } };
      assert.match(b.query, /variableCollectionUpsert/);
      const v = b.variables.input.variables;
      assert.equal(v.SUPABASE_URL, "https://ref.supabase.co");
      assert.equal(v.SUPABASE_KEY, "service-key");
      assert.equal(v.VAPI_API_KEY, "vapi_test");
      assert.equal(v.VAPI_ASSISTANT_ID, "asst_xyz");
      assert.match(v.VAPI_WEBHOOK_URL, /placeholder\.invalid/);
    }
  );

  await withMockedFetch(mock, () => railwayCreateStep.execute(ctx));
  mock.assertAllConsumed();
  const result = ctx.state.steps.railway_create!;
  assert.equal(result.project_id, "prj_1");
  assert.equal(result.environment_id, "env_prod");
  assert.equal(result.service_id, "svc_1");
  assert.ok(result.completed_at);

  cleanState(slug);
});

test("railway_create: persists project_id before serviceCreate (resume-safe)", async () => {
  const slug = "__test_rw_create_persist";
  cleanState(slug);
  const ctx = withFullPriors(makeContext({ state: makeState(slug) }));
  ctx.manifest.slug = slug;

  const mock = new FetchMock();
  mock.expect("POST", "https://backboard.railway.app/graphql/v2", {
    status: 200,
    body: {
      data: {
        projectCreate: {
          id: "prj_persisted",
          environments: { edges: [{ node: { id: "env_persisted", name: "production" } }] },
        },
      },
    },
  });
  // serviceCreate fails — simulating a mid-step crash
  mock.expect("POST", "https://backboard.railway.app/graphql/v2", {
    status: 500,
    body: { errors: [{ message: "transient" }] },
  });

  await withMockedFetch(mock, async () => {
    await assert.rejects(() => railwayCreateStep.execute(ctx), /Railway GraphQL 500/);
  });

  // State should have project_id + environment_id but no service_id and no completed_at
  const result = ctx.state.steps.railway_create!;
  assert.equal(result.project_id, "prj_persisted");
  assert.equal(result.environment_id, "env_persisted");
  assert.equal(result.service_id, "");
  assert.equal(result.completed_at, undefined);
  // Confirm state file was written
  assert.ok(existsSync(resolve(STATE_DIR, `${slug}.json`)));

  cleanState(slug);
});

test("railway_create: includes teamId in projectCreate when set", async () => {
  const ctx = withFullPriors(makeContext());
  ctx.manifest.slug = "acme";
  ctx.manifest.resolved.railway_team_id = "team_zzz";

  const mock = new FetchMock();
  mock.expect(
    "POST",
    /backboard\.railway\.app/,
    {
      status: 200,
      body: {
        data: {
          projectCreate: {
            id: "p", environments: { edges: [{ node: { id: "e", name: "production" } }] },
          },
        },
      },
    },
    (body) => {
      const input = (body as { variables: { input: Record<string, unknown> } }).variables.input;
      assert.equal(input.teamId, "team_zzz");
    }
  );
  mock.expect("POST", /backboard\.railway\.app/, {
    status: 200, body: { data: { serviceCreate: { id: "s" } } },
  });
  mock.expect("POST", /backboard\.railway\.app/, {
    status: 200, body: { data: { serviceInstanceUpdate: true } },
  });
  mock.expect("POST", /backboard\.railway\.app/, {
    status: 200, body: { data: { variableCollectionUpsert: true } },
  });

  await withMockedFetch(mock, () => railwayCreateStep.execute(ctx));
});

test("railway_create: fails fast if prior state is incomplete", async () => {
  const ctx = makeContext();
  await assert.rejects(() => railwayCreateStep.execute(ctx), /github_fork must complete first/);
});

test("railway_create: fails fast if RAILWAY_TOKEN is missing", async () => {
  const ctx = withFullPriors(makeContext());
  ctx.env.railway_token = null;
  await assert.rejects(() => railwayCreateStep.execute(ctx), /RAILWAY_TOKEN is required/);
});
