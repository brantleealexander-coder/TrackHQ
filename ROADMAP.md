# TrackHQ Roadmap

The phased build plan. The authoritative source of detail is the planning doc at `~/.claude/plans/for-unrelated-reasons-the-declarative-raccoon.md`; this file is a short pointer for anyone reading the repo.

## Phase 0 — Bootstrap

Lay out the repo, copy the Crossmar dashboard and server as template seeds, strip Crossmar from filenames and code comments. **Done when** `template-dashboard/` builds locally with no broken references.

## Phase 1 — Extract tenant config

Introduce `template-dashboard/src/lib/tenant-config.ts` and refactor every hardcoded Crossmar value (branding, logo, title, contact, transfer phone) to read from `TENANT_CONFIG_JSON` + DB-driven taxonomies. **Done when** changing only env vars + tenant config produces a deployment with different branding.

## Phase 2 — Generalize the data model

Replace the seeded 19 categories and 6-value status enum with customer-defined `categories`, `statuses`, and `locations` tables. Write `provisioning/seed-tenant.ts`. **Done when** a second deployment can use entirely different categories/statuses/locations without touching application code.

- **2a (done):** Schema rewrite — `categories`, `statuses` (text key + `behavior` column), `locations`, `maintenance_logs` tables, plus the previously-missing `equipment.serial_number` / `current_address` / `current_lat` / `current_lng` columns. Types refactored, `queries.ts` joins updated, API routes use status `behavior` instead of hardcoded status names. Field renames (`division_*` → `category_*`, `home_yard` → `home_location_*`) applied throughout.
- **2b (done):** UI now reads statuses / categories / locations from DB. `StatusBadge` derives color and name from a `statusInfo` prop; `fleet-map.tsx` builds its color map and yard pins from `statuses[]` + `locations[]` props; `status-form.tsx` populates the dropdown from `statuses[]` and switches `showCustomer` / `showRentalFields` / `showRentalEnd` on `behavior`. `add-equipment-form.tsx` takes `categories[]` and `locations[]` props and gained a location dropdown. `computeFleetSummary` and `findOverdueRentals` aggregate by behavior.
- **2c (done):** `provisioning/seed-tenant.ts` CLI reads a YAML manifest and upserts categories / statuses / locations into a tenant's Supabase project. Supports `--dry-run` for verification. Crossmar's real taxonomy lives at `examples/crossmar/customer-manifest.yaml` for use by the eventual migration project. The pre-2a Crossmar seed scripts moved to `examples/crossmar/scripts/` with a README explaining they need updating to run against the post-2a schema. Phase 2's full done-criterion is now hit: a second deployment can use entirely different categories / statuses / locations without touching application code.

## Phase 3 — Templatize the receptionist  (done)

Move per-business values out of the VAPI assistant config into `business_config.json` placeholders; render on demand. Make Google Calendar optional. **Done when** the same template renders as either Crossmar's Emma or a different business's persona by editing one JSON file.

- `template-server/vapi_assistant_config.example.json` is the committed template; `${field}` placeholders are filled from `business_config.vapi.*` plus `VAPI_WEBHOOK_URL` from env. VAPI's own runtime `{{ }}` tokens are preserved.
- `template-server/app/business_config.example.json` is the committed reference; per-deploy `business_config.json` is gitignored.
- `template-server/app/render_vapi.py` performs the substitution; `patch_vapi.py` wraps it with a CLI that reads `VAPI_API_KEY` / `VAPI_ASSISTANT_ID` from env and supports `--dry-run`.
- Google Calendar tools (`checkAvailability`, `bookAppointment`, `rescheduleAppointment`, `cancelAppointment`) return a polite "appointments not available" message when `features.google_calendar` is false in business_config.
- Verified by rendering the same template against `examples/crossmar/business_config.json` and `template-server/app/business_config.example.json` — produces "Emma — Crossmar Rentals" vs "Alex — Acme Excavators" correctly.

## Phase 4 — Provisioning automation

`provisioning/provision-customer.ts` CLI that takes a `customer-manifest.yaml` and creates the Supabase project, runs the schema, seeds taxonomies, creates the Vercel project, sets env vars, creates the Railway service, and emits a runbook for manual steps. **Done when** provisioning a fake test customer takes under 60 min of operator time.

- **4a (done):** Foundation — manifest extension (`provisioning:` block), state machinery (`provisioning/state/<slug>.json`), `.env` loader with operator-level defaults, ordered step registry, `provision-customer.ts` orchestrator with `--dry-run` / `--resume` / `--only=...` flags. Every step stubbed with a real `describe()` for dry-run; `execute()` throws `NotYetImplementedError`. Dry-run against any manifest prints the full 14-step plan.
- **4b–4f (pending):** Fill in `execute()` for each step in turn — GitHub fork, Supabase, VAPI, Vercel, Railway, runbook generator.

## Phase 5 — Operator control panel

Separate Next.js app (`control-panel/`) deployed only for Brantlee. Tabs: Customers, Health, Cost (per-tenant cost aggregation across Vercel/Supabase/Railway/Anthropic/VAPI/Twilio), Billing (Stripe). **Done when** cost-per-customer reports query in under 30 sec.

## Phase 6 — Customer self-service

Per-tenant `/admin/settings` so customers can edit hours, FAQs, transfer number, staff users, logo, brand color without messaging Brantlee. Defer until customers actually ask.

## Out of scope until later

Migrating the live Crossmar deployment onto TrackHQ. Happens as a separate 1–2 week project after Phases 0–4 are stable.
