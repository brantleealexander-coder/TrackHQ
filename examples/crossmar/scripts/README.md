# Crossmar seed scripts — historical reference

These scripts loaded Crossmar Rentals' real data from their Excel exports into the original `Dispatcher_Andy` Supabase project:

- `seed.ts` — one-time import from `CrossMar DC III Equipment.xlsx`
- `refresh-from-latest.ts` — refresh equipment + statuses from `latest equipment status report.xlsx`
- `update-serials.ts` — backfill `serial_number` from a serial-augmented spreadsheet

They are **not runnable** against a fresh TrackHQ deployment. They reference the pre-TrackHQ-Phase-2a schema (`divisions`, `home_yard`, no `home_location_id`), and they read Crossmar-specific xlsx files that aren't in the repo.

Kept here so the eventual Crossmar-to-TrackHQ migration project (separate from TrackHQ itself) has a starting point for re-importing Crossmar's data into the new schema. Bring them back to life by:

1. Renaming field references (`division_id` → `category_id`, `home_yard` → `home_location_id`, etc.) to match `template-dashboard/supabase_schema.sql`.
2. Mapping yard text addresses to the new `locations.id` PKs via a name lookup.
3. Mapping any literal status text like `"ON RENT"` to the new status keys (`"on_rent"`) defined in `customer-manifest.yaml`.

For onboarding new tenants (not migrating Crossmar), use [`../../../provisioning/seed-tenant.ts`](../../../provisioning/seed-tenant.ts) with a YAML manifest.
