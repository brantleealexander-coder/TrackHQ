-- TrackHQ Template Dashboard — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- These tables are added alongside existing call_logs, appointments, messages tables.

-- ─────────────────────────────────────────────
-- 1. Divisions reference
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS divisions (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO divisions VALUES
  (1,  'Dozers'),
  (2,  'Articulating Trucks'),
  (3,  'Excavators'),
  (4,  'Mini Excavators'),
  (5,  'Compactor'),
  (6,  'Wheel Loaders'),
  (7,  'Backhoe Loader'),
  (8,  'Skid Steer'),
  (9,  'Screeners'),
  (10, 'Telehandler'),
  (11, 'Lifts'),
  (12, 'Trailers'),
  (13, 'Grader'),
  (14, 'Attachments'),
  (15, 'Landscape'),
  (16, 'Concrete Equipment'),
  (17, 'Misc'),
  (18, 'Water Trucks'),
  (19, 'Specialty Equipment')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. Equipment master (one row per unit — changes rarely)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id              BIGSERIAL PRIMARY KEY,
  gl_code         TEXT UNIQUE NOT NULL,       -- e.g. "01-0162"
  division_id     INTEGER NOT NULL REFERENCES divisions(id),
  equipment_name  TEXT NOT NULL,              -- e.g. "CAT D6T (ZJB00162)"
  year            INTEGER,
  rate_daily      NUMERIC(10,2),
  rate_weekly     NUMERIC(10,2),
  rate_monthly    NUMERIC(10,2),
  home_yard       TEXT,
  is_cross_charge BOOLEAN DEFAULT FALSE,      -- GL codes with "CC" prefix
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_division ON equipment(division_id);
CREATE INDEX IF NOT EXISTS idx_equipment_gl_code  ON equipment(gl_code);

-- ─────────────────────────────────────────────
-- 3. Equipment status (one row per unit, updated in place)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_status (
  id            BIGSERIAL PRIMARY KEY,
  equipment_id  BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'AVAILABLE',
    -- values: 'ON RENT' | 'AVAILABLE' | 'DOWN' | 'RESERVED' | 'IN SERVICE' | 'OFF RENT PENDING'
  customer_name TEXT,
  job_po_notes  TEXT,
  rate_type     TEXT,    -- 'daily' | 'weekly' | 'monthly'
  rental_start  DATE,
  rental_end    DATE,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    TEXT DEFAULT 'system'
);

-- Enforce one status row per equipment unit
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_status_one_per_unit
  ON equipment_status(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_status_status
  ON equipment_status(status);

-- ─────────────────────────────────────────────
-- 4. Rental history (append-only log, revenue stored at write time)
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
  revenue_amount NUMERIC(10,2),   -- computed and stored at write time
  recorded_at    TIMESTAMPTZ DEFAULT NOW(),
  recorded_by    TEXT DEFAULT 'admin'
);

CREATE INDEX IF NOT EXISTS idx_rental_history_equipment ON rental_history(equipment_id);
CREATE INDEX IF NOT EXISTS idx_rental_history_date      ON rental_history(rental_start);
CREATE INDEX IF NOT EXISTS idx_rental_history_recorded  ON rental_history(recorded_at);

-- ─────────────────────────────────────────────
-- 5. Samsara devices (gateway-serial-keyed; can move between equipment)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS samsara_devices (
  id              BIGSERIAL PRIMARY KEY,
  samsara_id      TEXT UNIQUE NOT NULL,            -- Samsara's stable asset id; primary identity for sync
  gateway_serial  TEXT,                            -- real Samsara hardware serial (e.g. "G522-SBG-JT9"); null when not yet pulled
  samsara_name    TEXT,                            -- user-set asset name in the Samsara dashboard
  notes           TEXT,                            -- free-form: "On 08-1234, customer Tribus", "Battery dead", etc.
  equipment_id    BIGINT REFERENCES equipment(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT TRUE,            -- false = dead/inoperable; hidden from map
  last_seen_at    TIMESTAMPTZ,                     -- last time Samsara reported a GPS fix for this device
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_samsara_equipment ON samsara_devices(equipment_id);

-- Migration from the v1 schema that keyed on gateway_serial=name:
-- ALTER TABLE samsara_devices ADD COLUMN samsara_name TEXT;
-- UPDATE samsara_devices SET samsara_name = gateway_serial WHERE samsara_name IS NULL;
-- UPDATE samsara_devices SET gateway_serial = NULL;
-- ALTER TABLE samsara_devices DROP CONSTRAINT samsara_devices_gateway_serial_key;
-- ALTER TABLE samsara_devices ALTER COLUMN gateway_serial DROP NOT NULL;
-- ALTER TABLE samsara_devices ALTER COLUMN samsara_id SET NOT NULL;
-- ALTER TABLE samsara_devices ADD CONSTRAINT samsara_devices_samsara_id_key UNIQUE (samsara_id);

-- ─────────────────────────────────────────────
-- 6. Row Level Security
-- Disable RLS on all internal-tool tables (this app is behind our own password gate).
-- ─────────────────────────────────────────────
ALTER TABLE divisions        DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment        DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE rental_history   DISABLE ROW LEVEL SECURITY;
ALTER TABLE samsara_devices  DISABLE ROW LEVEL SECURITY;
