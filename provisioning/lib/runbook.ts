/**
 * Renders the per-tenant runbook.md from the final provisioning state.
 *
 * The runbook is a checklist of manual steps that provisioning can't do
 * for the operator: link a phone number to VAPI, set up DNS, drop in
 * business_config.json + OAuth credentials, smoke-test the deploy, etc.
 *
 * Sections are conditional on the manifest's features + provisioning
 * blocks — if features.google_calendar is false, the OAuth section is
 * omitted, etc.
 */

import type { ResolvedManifest } from "./manifest.ts";
import type { State } from "./state.ts";

export function renderRunbook(manifest: ResolvedManifest, state: State): string {
  const fork = state.steps.github_fork;
  const supabase = state.steps.supabase_create;
  const vapi = state.steps.vapi_create;
  const vercel = state.steps.vercel_create;
  const railway = state.steps.railway_deploy;

  if (!fork || !supabase || !vapi || !vercel || !railway) {
    throw new Error(
      "renderRunbook: state is missing one or more of github_fork, supabase_create, vapi_create, vercel_create, railway_deploy"
    );
  }

  const features = manifest.features ?? {};
  const lines: string[] = [];
  const push = (s = ""): void => { lines.push(s); };

  push(`# Provisioning runbook — ${manifest.business_name}`);
  push();
  push(`**Slug:** \`${manifest.slug}\``);
  push(`**Generated:** ${new Date().toISOString()}`);
  push();
  push(`This file captures the manual steps that \`provision-customer.ts\` could not automate. Work through it top to bottom.`);
  push();

  push(`## What provisioning created`);
  push();
  push(`| Resource | Value |`);
  push(`| --- | --- |`);
  push(`| GitHub fork | ${fork.html_url} |`);
  push(`| Supabase project | \`${supabase.project_ref}\` (${supabase.supabase_url}) |`);
  push(`| Vercel project | \`${vercel.project_name}\` (https://${vercel.default_domain}) |`);
  push(`| Railway service URL | ${railway.public_url} |`);
  push(`| VAPI assistant | \`${vapi.assistant_id}\` |`);
  push();

  push(`## Manual steps`);
  push();

  push(`### 1. Enable GitHub Actions on the fork`);
  push();
  push(`Forked repos have Actions disabled by default. Open ${fork.html_url}/actions and click "I understand my workflows, go ahead and enable them" so future commits trigger CI.`);
  push();

  push(`### 2. Drop a business_config.json onto the Railway service`);
  push();
  push(`The receptionist's getBusinessInfo tool reads \`template-server/app/business_config.json\` to answer FAQs. The fork ships with the Acme example file — you need a real one.`);
  push();
  push(`Either:`);
  push();
  push(`- (Recommended) Commit \`template-server/app/business_config.json\` to the fork's main branch. Railway will auto-redeploy.`);
  push(`- Or, SSH into the Railway service and write the file directly (lost on redeploy).`);
  push();
  push(`Use \`examples/crossmar/business_config.json\` as a reference. The \`vapi\` block has already been baked into the VAPI assistant by provisioning — what business_config.json adds is FAQs, services list, booking hours, etc.`);
  push();

  push(`### 3. Link a phone number to the VAPI assistant`);
  push();
  push(`The assistant exists but has no inbound phone yet. Two options:`);
  push();
  push(`**a. Buy a number from VAPI directly** (fastest)`);
  push();
  push(`Visit https://dashboard.vapi.ai/phone-numbers, click "Buy Number"${manifest.resolved.twilio_area_code ? ` (area code \`${manifest.resolved.twilio_area_code}\` recommended)` : ""}, and on assignment pick assistant \`${vapi.assistant_id}\` (${manifest.business_name}).`);
  push();
  push(`**b. Import an existing Twilio number**`);
  push();
  push(`Buy or pick a Twilio number, then in VAPI: Phone Numbers → Import from Twilio → assistant = \`${vapi.assistant_id}\`.`);
  push();
  push(`Once linked, place a real call to the number and confirm the receptionist answers in ${manifest.business_name}'s voice.`);
  push();

  if (manifest.resolved.domain) {
    push(`### 4. DNS for ${manifest.resolved.domain}`);
    push();
    push(`The dashboard is currently at https://${vercel.default_domain}. To attach \`${manifest.resolved.domain}\`:`);
    push();
    push(`1. In Vercel project settings for \`${vercel.project_name}\` → Domains → Add → \`${manifest.resolved.domain}\`.`);
    push(`2. Vercel will show one or two DNS records to add at your registrar (typically a CNAME pointing at \`cname.vercel-dns.com\` or an A record).`);
    push(`3. Add the records, wait for propagation (usually <5 min, sometimes up to an hour).`);
    push();
  }

  if (features.google_calendar) {
    push(`### 5. Google Calendar OAuth (features.google_calendar is on)`);
    push();
    push(`The booking tools need OAuth credentials on the Railway service.`);
    push();
    push(`1. Create OAuth client at https://console.cloud.google.com/apis/credentials → "Desktop app".`);
    push(`2. Download \`credentials.json\`.`);
    push(`3. Locally, run \`python template-server/app/calendar_setup.py\` to generate \`token.json\`.`);
    push(`4. Upload both files to the Railway service's persistent volume (Project → Service → Settings → Volumes), mounted at \`/app/\`.`);
    push(`5. Set Railway env vars \`GOOGLE_CREDENTIALS_FILE=/app/credentials.json\` and \`GOOGLE_TOKEN_FILE=/app/token.json\`.`);
    push();
  }

  if (features.twilio_sms) {
    push(`### 6. Twilio SMS env vars (features.twilio_sms is on)`);
    push();
    push(`Add to the Railway service: \`TWILIO_ACCOUNT_SID\`, \`TWILIO_AUTH_TOKEN\`, \`TWILIO_PHONE_NUMBER\`. Then redeploy.`);
    push();
  }

  if (features.telegram_alerts) {
    push(`### 7. Telegram alerts (features.telegram_alerts is on)`);
    push();
    push(`Create a bot via @BotFather, get its token, and add a channel for alerts. Then on Railway: \`TELEGRAM_BOT_TOKEN\`, \`TELEGRAM_CHANNEL_ID\`. Redeploy.`);
    push();
  }

  push(`### Final smoke test`);
  push();
  push(`- [ ] Open https://${vercel.default_domain} — dashboard loads, branding is correct, map renders.`);
  push(`- [ ] Add an equipment row and verify it persists (refresh).`);
  push(`- [ ] Call the VAPI number — receptionist greets with ${manifest.business_name}.`);
  push(`- [ ] Watch Railway logs for \`POST /webhook/vapi\` hits when you exercise a tool.`);
  push();

  push(`## State file`);
  push();
  push(`The full provisioning state (including secrets — db password, service-role key) is at:`);
  push();
  push(`\`provisioning/state/${manifest.slug}.json\``);
  push();
  push(`Don't commit it. It's gitignored at the repo root.`);
  push();

  return lines.join("\n");
}
