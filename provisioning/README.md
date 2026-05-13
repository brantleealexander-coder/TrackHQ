# Provisioning (Phase 4)

Operator-only scripts for spinning up a new TrackHQ tenant from a single
`customer-manifest.yaml`. Never deployed to customers.

## Entry points

- `provision-customer.ts` — end-to-end: GitHub fork + Supabase + Vercel + Railway + VAPI, plus a generated runbook for the manual steps that remain (DNS, Twilio number, OAuth, VAPI phone link).
- `seed-tenant.ts` — just the Supabase taxonomy seed step. Useful for re-seeding an existing tenant after editing their manifest.
- `customer-manifest.example.yaml` — input format reference.

## Setup (one time, per operator)

```bash
cd provisioning
npm install
cp .env.example .env
# Fill in tokens (GitHub PAT, Supabase Management, Vercel, Railway, VAPI, Mapbox)
# and DEFAULT_* values (your GitHub username, Supabase org ID, etc).
```

## Provisioning a tenant

```bash
# 1. Validate the manifest + see the plan without contacting any service:
npx tsx provision-customer.ts ../examples/acme/customer-manifest.yaml --dry-run

# 2. Run it for real:
npx tsx provision-customer.ts ../examples/acme/customer-manifest.yaml

# 3. If a step fails partway through, fix the issue and resume:
npx tsx provision-customer.ts ../examples/acme/customer-manifest.yaml --resume
```

Progress is persisted to `provisioning/state/<slug>.json` after every successful
step. **That file contains secrets** (db password, service role key) — it's
gitignored.

## Step list

The orchestrator runs these in order. Each step writes its result to the state
file before the next runs, so `--resume` can pick up after a failure.

1. `github_fork` — fork the template repo to `<github_owner>/trackhq-<slug>`
2. `supabase_create` — create the Supabase project, poll until healthy, capture keys
3. `supabase_schema` — run `template-dashboard/supabase_schema.sql`
4. `supabase_seed` — seed categories / statuses / locations
5. `vapi_create` — create the VAPI assistant (placeholder webhook URL)
6. `vapi_patch` — render + PATCH the template into it
7. `vercel_create` — create the Vercel project linked to the fork
8. `vercel_envs` — set NEXT_PUBLIC_TENANT_CONFIG_JSON + Supabase + Mapbox vars
9. `vercel_deploy` — trigger the first deploy
10. `railway_create` — create the Railway project + service from the fork
11. `railway_envs` — set Supabase + VAPI env vars
12. `railway_deploy` — trigger the first deploy, capture the public URL
13. `vapi_webhook_update` — PATCH the assistant with the real Railway URL
14. `runbook` — emit per-tenant `provisioning/state/<slug>.runbook.md`

## Implementation status

Phase 4 is being built incrementally. Run `--dry-run` to see the full plan;
attempting to actually execute a step that hasn't been implemented yet exits
with a clear "not yet implemented" message so the state file can be picked
back up later.
