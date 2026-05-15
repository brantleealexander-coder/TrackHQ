# TrackHQ

A productized fleet/asset tracking + AI receptionist platform sold as a managed deployment to small B2B fleet operators (rental, construction, landscaping, trucking, and similar businesses).

Each customer gets:
- A dashboard for tracking assets, statuses, rentals, and maintenance
- An AI receptionist that answers their business line, handles common requests, schedules call-backs, and escalates when needed
- A configurable taxonomy (categories, statuses, locations) so the same template fits very different operations

## Distribution model

Fork-per-customer. The operator (Brantlee) hosts every customer deployment under his accounts and bills monthly + a setup fee. Customers get a private dashboard URL and a phone line; they never touch the infrastructure.

## Repo layout

| Path | Purpose | Deployed to customers? |
|---|---|---|
| `template-dashboard/` | Next.js dashboard template | Yes (per customer) |
| `template-server/` | FastAPI receptionist server template | Yes (per customer) |
| `control-panel/` | Operator-only admin UI | No |
| `provisioning/` | Scripts to spin up new customers | No |
| `examples/` | Reference tenant configurations | No |
| `docs/` | Architecture, onboarding, deployment, pricing | No |

See [ROADMAP.md](ROADMAP.md) for the phased build plan.

## Running the dashboard locally

For a quick end-to-end smoke test against a fresh Supabase project (no Vercel/Railway needed):

1. Create a free-tier Supabase project at https://supabase.com
2. Paste `template-dashboard/supabase_schema.sql` into Supabase → SQL Editor → New query → Run
3. From the Project Settings → API page, copy your URL, anon key, and service-role key
4. Seed taxonomies + fake equipment + emit your `.env.local`:
   ```powershell
   $env:SUPABASE_URL = "https://yourref.supabase.co"
   $env:SUPABASE_SERVICE_KEY = "eyJ..."        # service_role
   $env:SUPABASE_ANON_KEY = "eyJ..."           # anon
   cd provisioning
   npm install
   npm run dev-bootstrap
   ```
5. Paste the printed env block into `template-dashboard/.env.local`
6. `cd template-dashboard && npm install && npm run dev` — open http://localhost:3000

## Reference codebase

The TrackHQ template is derived from the Crossmar Dispatcher Andy deployment (at `../Dispatcher_Andy/`). That deployment remains the first paying customer and continues to run independently until a separate migration project moves it onto TrackHQ.
