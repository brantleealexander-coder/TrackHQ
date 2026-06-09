-- Phase 7c — Multi-tenant migration
--
-- Adds companies / memberships / super_admins / leads tables and
-- attaches a company_id FK to every per-tenant data table. Every
-- existing row in this deployment becomes part of company id=1
-- ("Sunset Rentals (Demo)") so the running app keeps working.
--
-- This script is IDEMPOTENT — re-running it is a no-op. Run once
-- against the live Supabase via SQL Editor → New Query.
--
-- AFTER RUNNING, also enable Email/Password sign-in in:
--   Supabase Dashboard → Authentication → Providers → Email
-- and (optionally) configure a custom SMTP under
--   Authentication → SMTP Settings
-- The built-in SMTP works for low-volume invite emails in v1.

BEGIN;

-- ─────────────────────────────────────────────
-- 1. New tables
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  brand_color  TEXT,
  logo_url     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

CREATE TABLE IF NOT EXISTS memberships (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT memberships_role_check CHECK (role IN ('owner','admin','member')),
  UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user    ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON memberships(company_id);

CREATE TABLE IF NOT EXISTS super_admins (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id                BIGSERIAL PRIMARY KEY,
  kind              TEXT NOT NULL DEFAULT 'contact',
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  business_name     TEXT NOT NULL,
  rental_type       TEXT,
  current_software  TEXT,
  message           TEXT,
  status            TEXT NOT NULL DEFAULT 'new',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT leads_kind_check   CHECK (kind   IN ('demo','contact')),
  CONSTRAINT leads_status_check CHECK (status IN ('new','contacted','converted','declined'))
);

CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- ─────────────────────────────────────────────
-- 2. Seed the demo company at id=1
-- All existing data attaches to this row.
-- ─────────────────────────────────────────────

INSERT INTO companies (id, name, slug, brand_color)
VALUES (1, 'Sunset Rentals (Demo)', 'demo', '#F37535')
ON CONFLICT (id) DO NOTHING;

-- Keep the sequence ahead of any future manual inserts.
SELECT setval(
  pg_get_serial_sequence('companies', 'id'),
  GREATEST((SELECT MAX(id) FROM companies), 1)
);

-- ─────────────────────────────────────────────
-- 3. Add company_id to every per-company data table.
-- Default 1 lets the ADD COLUMN succeed without a separate UPDATE;
-- we drop the default at the end so new INSERTs must specify it.
-- ─────────────────────────────────────────────

ALTER TABLE categories        ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE locations         ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE equipment         ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE equipment_status  ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE rental_history    ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE maintenance_logs  ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE samsara_devices   ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE booking_requests  ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE customers         ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE orders            ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE order_lines       ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE documents         ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE order_attachments ADD COLUMN IF NOT EXISTS company_id BIGINT NOT NULL DEFAULT 1 REFERENCES companies(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────
-- 4. Convert single-tenant UNIQUE constraints into per-company.
-- ─────────────────────────────────────────────

-- categories.name was UNIQUE globally; becomes UNIQUE per company.
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_company_name_key' AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_company_name_key UNIQUE (company_id, name);
  END IF;
END $$;

-- locations.name was UNIQUE globally; becomes UNIQUE per company.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_name_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'locations_company_name_key' AND conrelid = 'locations'::regclass
  ) THEN
    ALTER TABLE locations ADD CONSTRAINT locations_company_name_key UNIQUE (company_id, name);
  END IF;
END $$;

-- equipment.gl_code was UNIQUE globally; becomes UNIQUE per company.
ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_gl_code_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'equipment_company_gl_code_key' AND conrelid = 'equipment'::regclass
  ) THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_company_gl_code_key UNIQUE (company_id, gl_code);
  END IF;
END $$;

-- samsara_devices.samsara_id was UNIQUE globally; becomes UNIQUE per company.
ALTER TABLE samsara_devices DROP CONSTRAINT IF EXISTS samsara_devices_samsara_id_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'samsara_devices_company_samsara_id_key' AND conrelid = 'samsara_devices'::regclass
  ) THEN
    ALTER TABLE samsara_devices ADD CONSTRAINT samsara_devices_company_samsara_id_key UNIQUE (company_id, samsara_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 5. Indexes on company_id (or composite where useful for queries).
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_categories_company        ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_locations_company         ON locations(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_company         ON equipment(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status_company  ON equipment_status(company_id);
CREATE INDEX IF NOT EXISTS idx_rental_history_company    ON rental_history(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_company       ON maintenance_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_samsara_company           ON samsara_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_company  ON booking_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company         ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company            ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_company       ON order_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company         ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_order_attachments_company ON order_attachments(company_id);

-- Refresh customer-dedup indexes onto a per-company key.
DROP INDEX IF EXISTS idx_customers_email_lower;
DROP INDEX IF EXISTS idx_customers_phone;
DROP INDEX IF EXISTS idx_customers_name;
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers(company_id, LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone       ON customers(company_id, phone)        WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name        ON customers(company_id, name);

-- Refresh the orders status-by-start filter to be per-company.
DROP INDEX IF EXISTS idx_orders_status_start;
CREATE INDEX IF NOT EXISTS idx_orders_status_start ON orders(company_id, status, rental_start);

-- ─────────────────────────────────────────────
-- 6. Drop the per-table DEFAULT 1 — new INSERTs must specify company_id.
-- ─────────────────────────────────────────────

ALTER TABLE categories        ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE locations         ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE equipment         ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE equipment_status  ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE rental_history    ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE maintenance_logs  ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE samsara_devices   ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE booking_requests  ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE customers         ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE orders            ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE order_lines       ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE documents         ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE order_attachments ALTER COLUMN company_id DROP DEFAULT;

ALTER TABLE companies    DISABLE ROW LEVEL SECURITY;
ALTER TABLE memberships  DISABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads        DISABLE ROW LEVEL SECURITY;

COMMIT;

-- One-shot post-migration sanity:
-- SELECT 'companies' AS t, COUNT(*) FROM companies
-- UNION ALL SELECT 'memberships',      COUNT(*) FROM memberships
-- UNION ALL SELECT 'orders no company', COUNT(*) FROM orders WHERE company_id IS NULL
-- UNION ALL SELECT 'equipment no company', COUNT(*) FROM equipment WHERE company_id IS NULL;
