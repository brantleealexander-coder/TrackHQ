import { strict as assert } from "node:assert";
import { test } from "node:test";
import { vapiCreateStep } from "../lib/steps/vapi_create.ts";
import { makeContext } from "./helpers/context.ts";
import { FetchMock, withMockedFetch } from "./helpers/fetch-mock.ts";

test("vapi_create: lists assistants, creates new one when none match", async () => {
  const ctx = makeContext();
  ctx.manifest.slug = "acme";

  const mock = new FetchMock();
  mock.expect("GET", /api\.vapi\.ai\/assistant\?limit=/, {
    status: 200,
    body: [],
  });
  mock.expect(
    "POST",
    "https://api.vapi.ai/assistant",
    { status: 201, body: { id: "asst_123" } },
    (body) => {
      const b = body as Record<string, unknown>;
      assert.equal(b.name, "trackhq-acme-receptionist");
      // The rendered config must contain the tools array from the template
      assert.ok(Array.isArray(b.tools));
      // Placeholder webhook URL is present, not the real one yet
      const tools = b.tools as Array<{ server?: { url: string } }>;
      const withServer = tools.find((t) => t.server?.url);
      assert.ok(withServer?.server?.url.includes("placeholder.invalid"));
      // Voice + display name were rendered
      const voice = b.voice as { provider: string; voiceId: string };
      assert.equal(voice.provider, "11labs");
      assert.equal(voice.voiceId, "21m00Tcm4TlvDq8ikWAM");
    }
  );

  await withMockedFetch(mock, () => vapiCreateStep.execute(ctx));
  mock.assertAllConsumed();
  assert.equal(ctx.state.steps.vapi_create?.assistant_id, "asst_123");
  assert.ok(ctx.state.steps.vapi_create?.completed_at);
});

test("vapi_create: reuses + re-PATCHes an existing assistant by name", async () => {
  const ctx = makeContext();
  ctx.manifest.slug = "acme";

  const mock = new FetchMock();
  mock.expect("GET", /api\.vapi\.ai\/assistant\?limit=/, {
    status: 200,
    body: [{ id: "asst_existing", name: "trackhq-acme-receptionist" }],
  });
  // PATCH instead of POST
  mock.expect("PATCH", "https://api.vapi.ai/assistant/asst_existing", {
    status: 200,
    body: { id: "asst_existing" },
  });

  await withMockedFetch(mock, () => vapiCreateStep.execute(ctx));
  mock.assertAllConsumed();
  assert.equal(ctx.state.steps.vapi_create?.assistant_id, "asst_existing");
});

test("vapi_create: fails fast when VAPI_API_KEY is missing", async () => {
  const ctx = makeContext();
  ctx.env.vapi_api_key = null;
  await assert.rejects(
    () => vapiCreateStep.execute(ctx),
    /VAPI_API_KEY is required/
  );
});
