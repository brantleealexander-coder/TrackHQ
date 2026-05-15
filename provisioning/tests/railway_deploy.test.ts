import { strict as assert } from "node:assert";
import { test } from "node:test";
import { railwayDeployStep } from "../lib/steps/railway_deploy.ts";
import { makeContext } from "./helpers/context.ts";
import { FetchMock, withMockedFetch } from "./helpers/fetch-mock.ts";

function withCreateState(ctx: ReturnType<typeof makeContext>) {
  ctx.state.steps.railway_create = {
    project_id: "prj_1",
    service_id: "svc_1",
    environment_id: "env_1",
    completed_at: new Date().toISOString(),
  };
  return ctx;
}

test("railway_deploy: polls for SUCCESS, then creates domain", async () => {
  const ctx = withCreateState(makeContext());

  const mock = new FetchMock();
  // Poll 1 — building
  mock.expect(
    "POST",
    /backboard\.railway\.app/,
    {
      status: 200,
      body: {
        data: {
          deployments: {
            edges: [{ node: { id: "dep_1", status: "BUILDING", staticUrl: null } }],
          },
        },
      },
    },
    (body) => assert.match((body as { query: string }).query, /deployments/)
  );
  // Poll 2 — success
  mock.expect("POST", /backboard\.railway\.app/, {
    status: 200,
    body: {
      data: {
        deployments: {
          edges: [{ node: { id: "dep_1", status: "SUCCESS", staticUrl: null } }],
        },
      },
    },
  });
  // serviceDomainCreate
  mock.expect(
    "POST",
    /backboard\.railway\.app/,
    {
      status: 200,
      body: { data: { serviceDomainCreate: { domain: "trackhq-acme.up.railway.app" } } },
    },
    (body) => {
      const q = (body as { query: string }).query;
      assert.match(q, /serviceDomainCreate/);
    }
  );

  const origTimeout = globalThis.setTimeout;
  // @ts-expect-error stub
  globalThis.setTimeout = (cb: () => void) => { cb(); return 0; };
  try {
    await withMockedFetch(mock, () => railwayDeployStep.execute(ctx));
  } finally {
    globalThis.setTimeout = origTimeout;
  }

  mock.assertAllConsumed();
  assert.equal(
    ctx.state.steps.railway_deploy?.public_url,
    "https://trackhq-acme.up.railway.app"
  );
  assert.ok(ctx.state.steps.railway_deploy?.completed_at);
});

test("railway_deploy: throws on terminal failure status (FAILED)", async () => {
  const ctx = withCreateState(makeContext());
  const mock = new FetchMock();
  mock.expect("POST", /backboard\.railway\.app/, {
    status: 200,
    body: {
      data: {
        deployments: { edges: [{ node: { id: "dep_x", status: "FAILED", staticUrl: null } }] },
      },
    },
  });

  await withMockedFetch(mock, async () => {
    await assert.rejects(
      () => railwayDeployStep.execute(ctx),
      /terminal status FAILED/
    );
  });
});

test("railway_deploy: falls back to deployment.staticUrl when domain create errors", async () => {
  const ctx = withCreateState(makeContext());
  const mock = new FetchMock();
  // Success on first poll
  mock.expect("POST", /backboard\.railway\.app/, {
    status: 200,
    body: {
      data: {
        deployments: {
          edges: [{
            node: {
              id: "dep_1",
              status: "SUCCESS",
              staticUrl: "https://existing-domain.up.railway.app",
            },
          }],
        },
      },
    },
  });
  // serviceDomainCreate fails (e.g., "domain already exists")
  mock.expect("POST", /backboard\.railway\.app/, {
    status: 200,
    body: { errors: [{ message: "domain already exists" }] },
  });

  await withMockedFetch(mock, () => railwayDeployStep.execute(ctx));
  assert.equal(
    ctx.state.steps.railway_deploy?.public_url,
    "https://existing-domain.up.railway.app"
  );
});

test("railway_deploy: fails fast if railway_create state is missing", async () => {
  const ctx = makeContext();
  await assert.rejects(() => railwayDeployStep.execute(ctx), /railway_create must complete first/);
});
