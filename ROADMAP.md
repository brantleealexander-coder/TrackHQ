# TrackHQ Roadmap

The phased build plan. The authoritative source of detail is the planning doc at `~/.claude/plans/for-unrelated-reasons-the-declarative-raccoon.md`; this file is a short pointer for anyone reading the repo.

## Phase 0 — Bootstrap

Lay out the repo, copy the Crossmar dashboard and server as template seeds, strip Crossmar from filenames and code comments. **Done when** `template-dashboard/` builds locally with no broken references.

## Phase 1 — Extract tenant config

Introduce `template-dashboard/src/lib/tenant-config.ts` and refactor every hardcoded Crossmar value (branding, logo, title, contact, transfer phone) to read from `TENANT_CONFIG_JSON` + DB-driven taxonomies. **Done when** changing only env vars + tenant config produces a deployment with different branding.

## Phase 2 — Generalize the data model

Replace the seeded 19 categories and 6-value status enum with customer-defined `categories`, `statuses`, and `locations` tables. Write `provisioning/seed-tenant.ts`. **Done when** a second deployment can use entirely different categories/statuses/locations without touching application code.

## Phase 3 — Templatize the receptionist

Move per-business values out of the VAPI assistant config into `business_config.json` placeholders; render on server startup. Make Google Calendar optional. **Done when** the same template renders as either Crossmar's Emma or a different business's persona by editing one JSON file.

## Phase 4 — Provisioning automation

`provisioning/provision-customer.ts` CLI that takes a `customer-manifest.yaml` and creates the Supabase project, runs the schema, seeds taxonomies, creates the Vercel project, sets env vars, creates the Railway service, and emits a runbook for manual steps. **Done when** provisioning a fake test customer takes under 60 min of operator time.

## Phase 5 — Operator control panel

Separate Next.js app (`control-panel/`) deployed only for Brantlee. Tabs: Customers, Health, Cost (per-tenant cost aggregation across Vercel/Supabase/Railway/Anthropic/VAPI/Twilio), Billing (Stripe). **Done when** cost-per-customer reports query in under 30 sec.

## Phase 6 — Customer self-service

Per-tenant `/admin/settings` so customers can edit hours, FAQs, transfer number, staff users, logo, brand color without messaging Brantlee. Defer until customers actually ask.

## Out of scope until later

Migrating the live Crossmar deployment onto TrackHQ. Happens as a separate 1–2 week project after Phases 0–4 are stable.
