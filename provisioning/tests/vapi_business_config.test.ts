import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildVapiSubstitutions } from "../lib/vapi/business-config.ts";
import { makeManifest } from "./helpers/context.ts";

test("buildVapiSubstitutions: applies defaults when receptionist block is absent", () => {
  const m = makeManifest({
    receptionist: undefined,
    contact: { phone: "+15551234567", email: "a@b", website: "x" },
  });
  const subs = buildVapiSubstitutions(m);
  assert.equal(subs.assistant_display_name, "Alex — Acme Test");
  assert.equal(subs.voice_provider, "11labs");
  assert.equal(subs.voice_id, "21m00Tcm4TlvDq8ikWAM");
  assert.equal(subs.transfer_phone, "+15551234567");
  assert.match(subs.first_message, /Acme Test/);
  assert.match(subs.system_prompt, /America\/Chicago/);
});

test("buildVapiSubstitutions: receptionist block overrides defaults", () => {
  const m = makeManifest({
    business_name: "Beta Logistics",
    receptionist: {
      name: "Robin",
      voice_id: "custom-voice",
      timezone: "America/New_York",
      first_message: "Howdy partner.",
      transfer_phone: "+19998887777",
      transfer_message: "Hang on.",
    },
  });
  const subs = buildVapiSubstitutions(m);
  assert.equal(subs.assistant_display_name, "Robin — Beta Logistics");
  assert.equal(subs.voice_id, "custom-voice");
  assert.equal(subs.first_message, "Howdy partner.");
  assert.equal(subs.transfer_phone, "+19998887777");
  assert.equal(subs.transfer_message, "Hang on.");
  assert.match(subs.system_prompt, /America\/New_York/);
});

test("buildVapiSubstitutions: throws if no transfer phone is available", () => {
  const m = makeManifest({ contact: undefined, receptionist: { transfer_phone: null } });
  assert.throws(
    () => buildVapiSubstitutions(m),
    /no transfer phone/
  );
});
