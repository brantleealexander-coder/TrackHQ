import { strict as assert } from "node:assert";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { renderRunbook } from "../lib/runbook.ts";
import { runbookStep } from "../lib/steps/runbook.ts";
import { makeContext, makeState } from "./helpers/context.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, "..", "state");
function cleanArtifacts(slug: string): void {
  for (const ext of [".json", ".runbook.md"]) {
    const p = resolve(STATE_DIR, `${slug}${ext}`);
    if (existsSync(p)) rmSync(p);
  }
}

function fullyProvisionedContext(slug: string) {
  const ctx = makeContext({ state: makeState(slug) });
  ctx.manifest.slug = slug;
  const now = new Date().toISOString();
  ctx.state.steps.github_fork = {
    repo_full_name: "test-owner/trackhq-" + slug,
    clone_url: `https://github.com/test-owner/trackhq-${slug}.git`,
    html_url: `https://github.com/test-owner/trackhq-${slug}`,
    completed_at: now,
  };
  ctx.state.steps.supabase_create = {
    project_ref: "supref",
    db_password: "x".repeat(24),
    supabase_url: "https://supref.supabase.co",
    anon_key: "anon",
    service_role_key: "service",
    completed_at: now,
  };
  ctx.state.steps.vapi_create = { assistant_id: "asst_xxx", completed_at: now };
  ctx.state.steps.vercel_create = {
    project_id: "prj_v",
    project_name: `trackhq-${slug}`,
    default_domain: `trackhq-${slug}.vercel.app`,
    completed_at: now,
  };
  ctx.state.steps.railway_create = {
    project_id: "p", service_id: "s", environment_id: "e", completed_at: now,
  };
  ctx.state.steps.railway_deploy = {
    public_url: `https://trackhq-${slug}.up.railway.app`,
    completed_at: now,
  };
  return ctx;
}

test("renderRunbook: includes core resource table + always-present sections", () => {
  const ctx = fullyProvisionedContext("acme");
  ctx.manifest.business_name = "Acme Excavators";
  const out = renderRunbook(ctx.manifest, ctx.state);

  assert.match(out, /# Provisioning runbook — Acme Excavators/);
  assert.match(out, /github\.com\/test-owner\/trackhq-acme/);
  assert.match(out, /supref\.supabase\.co/);
  assert.match(out, /trackhq-acme\.vercel\.app/);
  assert.match(out, /trackhq-acme\.up\.railway\.app/);
  assert.match(out, /asst_xxx/);
  assert.match(out, /Enable GitHub Actions on the fork/);
  assert.match(out, /Link a phone number to the VAPI assistant/);
  assert.match(out, /Drop a business_config\.json/);
  assert.match(out, /Final smoke test/);
});

test("renderRunbook: omits feature-gated sections when flags are off", () => {
  const ctx = fullyProvisionedContext("noflags");
  ctx.manifest.features = { google_calendar: false, twilio_sms: false, telegram_alerts: false };
  const out = renderRunbook(ctx.manifest, ctx.state);
  assert.doesNotMatch(out, /Google Calendar OAuth/);
  assert.doesNotMatch(out, /Twilio SMS env vars/);
  assert.doesNotMatch(out, /Telegram alerts/);
});

test("renderRunbook: includes feature sections when flags are on", () => {
  const ctx = fullyProvisionedContext("allflags");
  ctx.manifest.features = { google_calendar: true, twilio_sms: true, telegram_alerts: true };
  const out = renderRunbook(ctx.manifest, ctx.state);
  assert.match(out, /Google Calendar OAuth/);
  assert.match(out, /Twilio SMS env vars/);
  assert.match(out, /Telegram alerts/);
});

test("renderRunbook: includes DNS section when domain is set", () => {
  const ctx = fullyProvisionedContext("withdns");
  ctx.manifest.resolved.domain = "acme.trackhq.com";
  const out = renderRunbook(ctx.manifest, ctx.state);
  assert.match(out, /DNS for acme\.trackhq\.com/);
});

test("renderRunbook: omits DNS section when domain is null", () => {
  const ctx = fullyProvisionedContext("nodns");
  ctx.manifest.resolved.domain = null;
  const out = renderRunbook(ctx.manifest, ctx.state);
  assert.doesNotMatch(out, /^### \d\. DNS/m);
});

test("renderRunbook: throws when prior state is missing", () => {
  const ctx = makeContext();
  assert.throws(
    () => renderRunbook(ctx.manifest, ctx.state),
    /state is missing/
  );
});

test("runbook step: writes file to provisioning/state and records its path", async () => {
  const slug = "__test_runbook_writes";
  cleanArtifacts(slug);
  const ctx = fullyProvisionedContext(slug);

  await runbookStep.execute(ctx);

  const expectedPath = resolve(STATE_DIR, `${slug}.runbook.md`);
  assert.equal(ctx.state.steps.runbook?.path, expectedPath);
  assert.ok(existsSync(expectedPath));
  const content = readFileSync(expectedPath, "utf8");
  assert.match(content, new RegExp(slug));
  assert.ok(ctx.state.steps.runbook?.completed_at);

  cleanArtifacts(slug);
});
