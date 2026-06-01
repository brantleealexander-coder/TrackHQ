-- TrackHQ Central Registry — Master schema.
-- One-time setup: create a new Supabase project named "trackhq-registry",
-- then run this in the SQL Editor.
--
-- The registry holds:
-- 1. customers — one row per provisioned customer fork. The master
--    deployment (trackhq.com) reads this to route /book/<slug> requests
--    to the right customer's Supabase project.
-- 2. leads — captured from the marketing site demo/contact form.
--
-- The fork_supabase_service_role_key column gives the master elevated
-- access to the customer's fork. Store registry credentials carefully;
-- they're the only thing that grants cross-tenant access.

-- ─────────────────────────────────────────────
-- 1. Customers
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  slug                            TEXT PRIMARY KEY,                   -- URL slug, e.g. 'crossmar'
  business_name                   TEXT NOT NULL,                      -- shown on /book/<slug>
  brand_color                     TEXT NOT NULL DEFAULT '#1e40af',    -- hex
  logo_url                        TEXT,
  fork_supabase_url               TEXT NOT NULL,                      -- customer's project URL
  fork_supabase_service_role_key  TEXT NOT NULL,                      -- service-role JWT
  vapi_assistant_id               TEXT,                               -- VAPI assistant for voice POS
  custom_domain                   TEXT,                               -- future: book.theircompany.com
  terminology_asset_plural        TEXT DEFAULT 'Assets',              -- UI label
  terminology_asset_singular      TEXT DEFAULT 'Asset',
  active                          BOOLEAN DEFAULT TRUE,
  created_at                      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active);

-- ─────────────────────────────────────────────
-- 2. Leads (demo / contact form submissions from /api/leads)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                BIGSERIAL PRIMARY KEY,
  kind              TEXT NOT NULL,                                    -- 'demo' | 'contact'
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  business_name     TEXT,
  rental_type       TEXT,
  current_software  TEXT,
  message           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_kind    ON leads(kind);

ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads     DISABLE ROW LEVEL SECURITY;
