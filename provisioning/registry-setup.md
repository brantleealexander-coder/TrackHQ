# TrackHQ Central Registry — One-time Setup

The master deployment at **trackhq.com** maintains a small Supabase project called **trackhq-registry**. It powers:

- `/book/<slug>` — looks up the customer's fork, then queries their Supabase server-side
- `/api/leads` — captures demo + contact form submissions
- The voice POS (Phase 5f) — same registry lookup, different entrypoint

Customer forks never touch the registry directly. Only `trackhq.com` (the master role) has the registry's service-role key.

## 1. Create the Supabase project

1. Supabase dashboard → **New project**
   - Name: `trackhq-registry`
   - Region: closest to your master Vercel deployment
   - Postgres password: store in 1Password
2. Copy the **Project URL** and **service_role key** from Project Settings → API.

## 2. Run the schema

Supabase dashboard → SQL Editor → **New query** → paste the contents of [registry-schema.sql](./registry-schema.sql) → Run.

You should see the `customers` and `leads` tables in the Table Editor.

## 3. Set env vars on the master deployment

In the master Vercel project (the one serving trackhq.com), set:

```
REGISTRY_SUPABASE_URL=https://<ref>.supabase.co
REGISTRY_SUPABASE_SERVICE_ROLE_KEY=<service_role JWT>
TRACKHQ_ROLE=master
```

Customer-fork deployments (e.g. `crossmar.trackhq.com`) **do not** get these env vars — they're master-only.

## 4. Local dev

When `REGISTRY_SUPABASE_URL` is unset, [src/lib/registry.ts](../template-dashboard/src/lib/registry.ts) falls back to using whatever Supabase is configured via `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (i.e. the dev's single test project). This lets `/book/<anything>` work on `localhost:3001` without standing up a registry first.

To stand up a real registry for local testing, just point `REGISTRY_SUPABASE_URL` at a registry project and seed it with one row pointing back at your dev customer.

## 5. Adding a customer manually (until Phase 4's `registry_register` step lands)

After provisioning a new customer fork via `provision-customer.ts`, manually insert a row in the registry:

```sql
INSERT INTO customers (
  slug, business_name, brand_color, logo_url,
  fork_supabase_url, fork_supabase_service_role_key,
  vapi_assistant_id,
  terminology_asset_plural, terminology_asset_singular
) VALUES (
  'crossmar',
  'Crossmar',
  '#f97316',
  null,
  'https://abc123.supabase.co',
  'eyJ...service-role-jwt...',
  'asst_abc123',
  'Fleet',
  'Unit'
);
```

The slug becomes the URL: `trackhq.com/book/crossmar`.
