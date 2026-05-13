-- TrackHQ Template Dashboard — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- This is the canonical per-tenant schema. After running it, seed the
-- categories / statuses / locations tables with the tenant's specific
-- values via provisioning/seed-tenant.ts (Phase 2c) or manually.

-- ─────────────────────────────────────────────
-- 1. Categories (e.g. "Excavators", "Dozers", "Trucks")
--    Customer-defined. No seed rows in the template.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- ─────────────────────────────────────────────
-- 2. Statuses (e.g. "On Rent", "Available", "In Shop")
--    `key` is the lookup PK used by equipment_status.status and
--    rental_history.status_*.
--    `behavior` tells application code what this status means
--    semantically — customers can rename "On Rent" to "Leased" without
--    breaking the revenue-tracking logic.
--    Allowed behaviors: rented | available | out_of_service | reserved
--                     | pending_return
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS statuses (
  key      TEXT PRIMARY KEY,                -- e.g. 'on_rent'
  name     TEXT NOT NULL,                   -- e.g. 'On Rent'
  color    TEXT NOT NULL,                   -- hex, e.g. '#22c55e'
  behavior TEXT NOT NULL,                   -- see enum above
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT statuses_behavior_check CHECK (
    behavior IN ('rented','available','out_of_service','reserved','pending_return')
  )
);

CREATE INDEX IF NOT EXISTS idx_statuses_behavior ON statuses(behavior);

-- ─────────────────────────────────────────────
-- 3. Locations (yards, depots, shops)
--    Customer-defined. Equipment.home_location_id references this.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id        BIGSERIAL PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,           -- e.g. 'Bentonville Yard'
  address   TEXT,                           -- street address (optional)
  latitude  DOUBLE PRECISION,               -- WGS84
  longitude DOUBLE PRECISION
);

-- ─────────────────────────────────────────────
-- 4. Equipment master (one row per tracked asset — changes rarely)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id                BIGSERIAL PRIMARY KEY,
  gl_code           TEXT UNIQUE NOT NULL,                       -- customer's internal id
  serial_number     TEXT,                                       -- manufacturer serial
  category_id       BIGINT NOT NULL REFERENCES categories(id),
  equipment_name    TEXT NOT NULL,                              -- e.g. 'CAT D6T Dozer'
  year              INTEGER,
  rate_daily        NUMERIC(10,2),
  rate_weekly       NUMERIC(10,2),
  rate_monthly      NUMERIC(10,2),
  home_location_id  BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  current_address   TEXT,                                       -- manual override of map position
  current_lat       DOUBLE PRECISION,
  current_lng       DOUBLE PRECISION,
  is_cross_charge   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_gl_code  ON equipment(gl_code);
CREATE INDEX IF NOT EXISTS idx_equipment_location ON equipment(home_location_id);

-- ─────────────────────────────────────────────
-- 5. Equipment status (one row per unit, updated in place)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_status (
  id            BIGSERIAL PRIMARY KEY,
  equipment_id  BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  status        TEXT NOT NULL REFERENCES statuses(key),
  customer_name TEXT,
  job_po_notes  TEXT,
  rate_type     TEXT,                       -- 'daily' | 'weekly' | 'monthly'
  rental_start  DATE,
  rental_end    DATE,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    TEXT DEFAULT 'system'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_status_one_per_unit
  ON equipment_status(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_status_status
  ON equipment_status(status);

-- ─────────────────────────────────────────────
-- 6. Rental history (append-only log, revenue stored at write time)
--    status_before / status_after are TEXT (not FK) so history survives
--    if a tenant later deletes/renames a status.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rental_history (
  id             BIGSERIAL PRIMARY KEY,
  equipment_id   BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  status_before  TEXT,
  status_after   TEXT NOT NULL,
  customer_name  TEXT,
  job_po_notes   TEXT,
  rate_type      TEXT,
  rental_start   DATE,
  rental_end     DATE,
  revenue_amount NUMERIC(10,2),
  recorded_at    TIMESTAMPTZ DEFAULT NOW(),
  recorded_by    TEXT DEFAULT 'admin'
);

CREATE INDEX IF NOT EXISTS idx_rental_history_equipment ON rental_history(equipment_id);
CREATE INDEX IF NOT EXISTS idx_rental_history_date      ON rental_history(rental_start);
CREATE INDEX IF NOT EXISTS idx_rental_history_recorded  ON rental_history(recorded_at);

-- ─────────────────────────────────────────────
-- 7. Maintenance logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id             BIGSERIAL PRIMARY KEY,
  equipment_id   BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  cost           NUMERIC(10,2) NOT NULL DEFAULT 0,
  description    TEXT NOT NULL,
  vendor         TEXT,
  category       TEXT,                       -- free-text maintenance category (Preventive, Repair, ...)
  invoice_number TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     TEXT DEFAULT 'admin'
);

CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON maintenance_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date      ON maintenance_logs(date);

-- ─────────────────────────────────────────────
-- 8. Samsara devices (optional, only used when features.samsara is on)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS samsara_devices (
  id              BIGSERIAL PRIMARY KEY,
  samsara_id      TEXT UNIQUE NOT NULL,
  gateway_serial  TEXT,
  samsara_name    TEXT,
  notes           TEXT,
  equipment_id    BIGINT REFERENCES equipment(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_samsara_equipment ON samsara_devices(equipment_id);

-- ─────────────────────────────────────────────
-- 9. Row Level Security
-- Disable RLS on all internal-tool tables (this app is behind its own
-- password gate; the receptionist server uses the service-role key).
-- ─────────────────────────────────────────────
ALTER TABLE categories       DISABLE ROW LEVEL SECURITY;
ALTER TABLE statuses         DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations        DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment        DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE rental_history   DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE samsara_devices  DISABLE ROW LEVEL SECURITY;
