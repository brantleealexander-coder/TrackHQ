# Provisioning (Phase 4)

Scripts that spin up a new TrackHQ tenant from a `customer-manifest.yaml`.

Operator-only. Never deployed to customers.

Planned entry points:
- `provision-customer.ts` — end-to-end CLI
- `seed-tenant.ts` — seed categories/statuses/locations into a new Supabase project
- `customer-manifest.example.yaml` — input format reference
- `runbook.template.md` — generated per-customer manual-step checklist

See [../ROADMAP.md](../ROADMAP.md) Phase 4 for scope.
