import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FetchMock, withMockedFetch } from "./helpers/fetch-mock.ts";
import { makeContext, makeEnv, makeManifest } from "./helpers/context.ts";

test("FetchMock matches in order and records calls", async () => {
  const mock = new FetchMock();
  mock.expect("GET", /example\.com\/a/, { status: 200, body: { ok: 1 } });
  mock.expect("POST", "https://example.com/b", { status: 201, body: { id: "x" } });

  const out = await withMockedFetch(mock, async () => {
    const r1 = await fetch("https://example.com/a");
    const r2 = await fetch("https://example.com/b", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    return [await r1.json(), await r2.json()];
  });

  assert.deepEqual(out, [{ ok: 1 }, { id: "x" }]);
  assert.equal(mock.calls.length, 2);
  assert.equal(mock.calls[1].method, "POST");
  assert.deepEqual(mock.calls[1].body, { name: "test" });
  mock.assertAllConsumed();
});

test("context helpers produce a valid StepContext", () => {
  const ctx = makeContext();
  assert.equal(ctx.manifest.slug, "acme-test");
  assert.equal(ctx.env.github_token, "ghp_test");
  assert.deepEqual(ctx.state.steps, {});
});

test("makeEnv and makeManifest accept overrides", () => {
  const env = makeEnv({ github_token: null });
  assert.equal(env.github_token, null);
  const m = makeManifest({ slug: "different-slug" });
  assert.equal(m.slug, "different-slug");
});
