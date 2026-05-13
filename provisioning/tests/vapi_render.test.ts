import { strict as assert } from "node:assert";
import { test } from "node:test";
import { renderVapiTemplate, RenderError } from "../lib/vapi/render.ts";

test("renderVapiTemplate: substitutes single-brace placeholders", () => {
  const template = JSON.stringify({ name: "${assistant_name}", greeting: "${first_message}" });
  const out = renderVapiTemplate(template, {
    assistant_name: "Alex",
    first_message: "Hello!",
  });
  assert.deepEqual(out, { name: "Alex", greeting: "Hello!" });
});

test("renderVapiTemplate: leaves double-brace VAPI runtime tokens alone", () => {
  const template = JSON.stringify({
    prompt: "Today is {{ \"now\" | date: \"%Y-%m-%d\" }} for ${name}",
  });
  const out = renderVapiTemplate(template, { name: "Acme" }) as { prompt: string };
  assert.equal(out.prompt, 'Today is {{ "now" | date: "%Y-%m-%d" }} for Acme');
});

test("renderVapiTemplate: JSON-escapes values with quotes and newlines", () => {
  const template = JSON.stringify({ prompt: "${system_prompt}" });
  const out = renderVapiTemplate(template, {
    system_prompt: "Line 1\nLine \"quoted\"",
  }) as { prompt: string };
  assert.equal(out.prompt, 'Line 1\nLine "quoted"');
});

test("renderVapiTemplate: webhookUrl overrides webhook_url placeholder", () => {
  const template = JSON.stringify({ url: "${webhook_url}" });
  const out = renderVapiTemplate(template, {}, "https://real.example.com/webhook");
  assert.deepEqual(out, { url: "https://real.example.com/webhook" });
});

test("renderVapiTemplate: throws RenderError listing missing fields", () => {
  const template = JSON.stringify({ a: "${field_a}", b: "${field_b}", c: "${field_b}" });
  assert.throws(
    () => renderVapiTemplate(template, {}),
    (err) => {
      assert.ok(err instanceof RenderError);
      assert.match((err as Error).message, /field_a/);
      assert.match((err as Error).message, /field_b/);
      return true;
    }
  );
});
