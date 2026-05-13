import { strict as assert } from "node:assert";
import { test } from "node:test";
import { vapiWebhookUpdateStep } from "../lib/steps/vapi_webhook_update.ts";
import { makeContext } from "./helpers/context.ts";
import { FetchMock, withMockedFetch } from "./helpers/fetch-mock.ts";

test("vapi_webhook_update: PATCHes assistant with re-rendered template using real URL", async () => {
  const ctx = makeContext();
  ctx.state.steps.vapi_create = {
    assistant_id: "asst_abc",
    completed_at: new Date().toISOString(),
  };
  ctx.state.steps.railway_deploy = {
    public_url: "https://acme-receptionist-production.up.railway.app",
    completed_at: new Date().toISOString(),
  };

  const mock = new FetchMock();
  mock.expect(
    "PATCH",
    "https://api.vapi.ai/assistant/asst_abc",
    { status: 200, body: { id: "asst_abc" } },
    (body) => {
      const b = body as Record<string, unknown>;
      // The serverUrl should now be the real Railway URL with /webhook/vapi
      assert.equal(
        b.serverUrl,
        "https://acme-receptionist-production.up.railway.app/webhook/vapi"
      );
      const tools = b.tools as Array<{ server?: { url: string } }>;
      const withServer = tools.find((t) => t.server?.url);
      assert.equal(
        withServer?.server?.url,
        "https://acme-receptionist-production.up.railway.app/webhook/vapi"
      );
    }
  );

  await withMockedFetch(mock, () => vapiWebhookUpdateStep.execute(ctx));
  mock.assertAllConsumed();
  assert.ok(ctx.state.steps.vapi_webhook_update?.completed_at);
});

test("vapi_webhook_update: fails when vapi_create state is missing", async () => {
  const ctx = makeContext();
  await assert.rejects(
    () => vapiWebhookUpdateStep.execute(ctx),
    /vapi_create must complete first/
  );
});

test("vapi_webhook_update: fails when railway_deploy state is missing", async () => {
  const ctx = makeContext();
  ctx.state.steps.vapi_create = {
    assistant_id: "asst_x",
    completed_at: new Date().toISOString(),
  };
  await assert.rejects(
    () => vapiWebhookUpdateStep.execute(ctx),
    /railway_deploy must complete first/
  );
});

test("vapi_webhook_update: strips trailing slash from Railway URL", async () => {
  const ctx = makeContext();
  ctx.state.steps.vapi_create = {
    assistant_id: "asst_x",
    completed_at: new Date().toISOString(),
  };
  ctx.state.steps.railway_deploy = {
    public_url: "https://foo.up.railway.app/",
    completed_at: new Date().toISOString(),
  };

  const mock = new FetchMock();
  mock.expect("PATCH", /api\.vapi\.ai\/assistant\/asst_x/, {
    status: 200,
    body: { id: "asst_x" },
  });

  await withMockedFetch(mock, () => vapiWebhookUpdateStep.execute(ctx));
  assert.equal(
    mock.calls[0].body && (mock.calls[0].body as { serverUrl: string }).serverUrl,
    "https://foo.up.railway.app/webhook/vapi"
  );
});
