-- TrackHQ Template Dashboard — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Multi-tenant since Phase 7: every data table carries company_id.
-- Statuses are shared across companies (code-level taxonomy: the
-- `behavior` enum drives application logic; companies override the
-- display name in tenant config if they want different terms).

-- ─────────────────────────────────────────────
-- 0. Companies (Phase 7 — one row per customer using TrackHQ)
-- The single source of truth for tenancy. Every data row anywhere in
-- this schema carries company_id; auth.users get linked to companies
-- via memberships below.
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

-- Memberships link Supabase auth users to companies + a role.
-- A single user can belong to multiple companies (rare but allowed —
-- e.g. an operator helping out a sister rental yard).
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

-- Super admins (TrackHQ-internal — gates /super-admin/* routes).
-- A handful of rows, manually managed.
CREATE TABLE IF NOT EXISTS super_admins (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Leads from the marketing site /demo and /contact forms. Phase 7g
-- inserts a row and fires a Resend notification email.
CREATE TABLE IF NOT EXISTS leads (
  id                BIGSERIAL PRIMARY KEY,
  kind              TEXT NOT NULL DEFAULT 'contact', -- 'demo' | 'contact'
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  business_name     TEXT NOT NULL,
  rental_type       TEXT,
  current_software  TEXT,
  message           TEXT,
  status            TEXT NOT NULL DEFAULT 'new',
                    -- new | contacted | converted | declined
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT leads_kind_check   CHECK (kind   IN ('demo','contact')),
  CONSTRAINT leads_status_check CHECK (status IN ('new','contacted','converted','declined'))
);

CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- ─────────────────────────────────────────────
-- 1. Categories (e.g. "Excavators", "Dozers", "Trucks")
--    Per-company.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          BIGSERIAL PRIMARY KEY,
  company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_company ON categories(company_id);

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
-- 3. Locations (yards, depots, shops). Per-company.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id          BIGSERIAL PRIMARY KEY,
  company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_locations_company ON locations(company_id);

-- ─────────────────────────────────────────────
-- 4. Equipment master (one row per tracked asset — changes rarely)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id                BIGSERIAL PRIMARY KEY,
  company_id        BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gl_code           TEXT NOT NULL,                              -- customer's internal id (unique per company)
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
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, gl_code)
);

CREATE INDEX IF NOT EXISTS idx_equipment_company  ON equipment(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_gl_code  ON equipment(gl_code);
CREATE INDEX IF NOT EXISTS idx_equipment_location ON equipment(home_location_id);

-- ─────────────────────────────────────────────
-- 5. Equipment status (one row per unit, updated in place)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_status (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_equipment_status_company ON equipment_status(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status_status  ON equipment_status(status);

-- ─────────────────────────────────────────────
-- 6. Rental history (append-only log, revenue stored at write time)
--    status_before / status_after are TEXT (not FK) so history survives
--    if a tenant later deletes/renames a status.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rental_history (
  id             BIGSERIAL PRIMARY KEY,
  company_id     BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_rental_history_company   ON rental_history(company_id);
CREATE INDEX IF NOT EXISTS idx_rental_history_equipment ON rental_history(equipment_id);
CREATE INDEX IF NOT EXISTS idx_rental_history_date      ON rental_history(rental_start);
CREATE INDEX IF NOT EXISTS idx_rental_history_recorded  ON rental_history(recorded_at);

-- ─────────────────────────────────────────────
-- 7. Maintenance logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id             BIGSERIAL PRIMARY KEY,
  company_id     BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_maintenance_company   ON maintenance_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON maintenance_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date      ON maintenance_logs(date);

-- ─────────────────────────────────────────────
-- 8. Samsara devices (optional, only used when features.samsara is on)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS samsara_devices (
  id              BIGSERIAL PRIMARY KEY,
  company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  samsara_id      TEXT NOT NULL,
  gateway_serial  TEXT,
  samsara_name    TEXT,
  notes           TEXT,
  equipment_id    BIGINT REFERENCES equipment(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, samsara_id)
);

CREATE INDEX IF NOT EXISTS idx_samsara_company   ON samsara_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_samsara_equipment ON samsara_devices(equipment_id);

-- ─────────────────────────────────────────────
-- 9. Booking requests (Phase 5e — hosted POS at trackhq.tech/book/<slug>)
-- Public renters request a rental; an operator confirms/rejects later.
-- The voice agent (Phase 5f) also writes here with source='voice'.
-- Not the same as rental_history — that's the source-of-truth log of
-- *confirmed* rentals. Booking requests are pending until acted on.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_requests (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  equipment_id  BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  renter_name   TEXT NOT NULL,
  renter_email  TEXT NOT NULL,
  renter_phone  TEXT,
  rental_start  DATE NOT NULL,
  rental_end    DATE NOT NULL,
  rate_type     TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | rejected
  source        TEXT NOT NULL DEFAULT 'web',      -- 'web' (POS) | 'voice' (VAPI)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_company   ON booking_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_equipment ON booking_requests(equipment_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status    ON booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_created   ON booking_requests(created_at);

-- ─────────────────────────────────────────────
-- 10. Customers (Phase 6 — CRM source of truth)
-- One row per real-world renter. The hosted POS, voice agent, and
-- operator's New Order flow all dedupe/insert here by email (or phone
-- when email is empty). Replaces the denormalized customer_name TEXT
-- pattern on equipment_status / rental_history (those columns stay for
-- back-compat; new writes set customer_id and copy name for legacy reads).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          BIGSERIAL PRIMARY KEY,
  company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Dedupe lookups go through lower(email) so case doesn't matter; nullable
-- partial-unique would be cleaner but we leave dedup to application code
-- so the voice flow can still insert when email is empty.
CREATE INDEX IF NOT EXISTS idx_customers_company     ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers(company_id, LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone       ON customers(company_id, phone)        WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name        ON customers(company_id, name);

-- ─────────────────────────────────────────────
-- 11. Orders (Phase 6 — Booqable-style multi-asset orders)
-- One order = one customer + dates + many assets (order_lines).
-- Distinct from booking_requests: requests are pending intent from the
-- public POS / voice; orders are committed bookings (status changes
-- equipment_status to 'on_rent' on activation).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                   BIGSERIAL PRIMARY KEY,
  company_id           BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id          BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status               TEXT NOT NULL DEFAULT 'upcoming',
                       -- upcoming | active | completed | cancelled
  rental_start         DATE NOT NULL,
  rental_end           DATE NOT NULL,
  total                NUMERIC(10,2),
  source               TEXT NOT NULL DEFAULT 'operator',
                       -- operator | web | voice
  booking_request_id   BIGINT REFERENCES booking_requests(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT orders_status_check CHECK (
    status IN ('upcoming','active','completed','cancelled')
  ),
  CONSTRAINT orders_dates_check CHECK (rental_end >= rental_start)
);

CREATE INDEX IF NOT EXISTS idx_orders_company         ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer        ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_start    ON orders(company_id, status, rental_start);
CREATE INDEX IF NOT EXISTS idx_orders_booking_request ON orders(booking_request_id) WHERE booking_request_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 12. Order lines (one row per asset on an order)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_lines (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id      BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  equipment_id  BIGINT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  rate_type     TEXT NOT NULL,                       -- daily | weekly | monthly
  rate_amount   NUMERIC(10,2),                       -- snapshot of rate at booking time
  line_total    NUMERIC(10,2),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_lines_company   ON order_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_order     ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_equipment ON order_lines(equipment_id);

-- ─────────────────────────────────────────────
-- 13. Documents (Phase 6 — tenant-wide template library + per-order attachments)
-- File lives in Supabase Storage (bucket: tenant-documents); this table
-- holds metadata + the storage_path. order_attachments joins documents
-- to orders so the same template (e.g. rental_agreement.pdf) can be
-- attached to many orders.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  storage_path  TEXT NOT NULL,                       -- key inside tenant-documents bucket
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by   TEXT DEFAULT 'admin'
);

CREATE INDEX IF NOT EXISTS idx_documents_company     ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at);

CREATE TABLE IF NOT EXISTS order_attachments (
  id           BIGSERIAL PRIMARY KEY,
  company_id   BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id     BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  document_id  BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  attached_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (order_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_order_attachments_company ON order_attachments(company_id);
CREATE INDEX IF NOT EXISTS idx_order_attachments_order   ON order_attachments(order_id);

-- ─────────────────────────────────────────────
-- 14. Backward-compat additions
-- booking_requests gains an optional customer_id so Phase 6 can dedupe
-- web/voice bookings against the CRM without breaking Phase 5e inserts.
-- ─────────────────────────────────────────────
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_booking_requests_customer ON booking_requests(customer_id) WHERE customer_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 15. Row Level Security
-- Disabled on every table for v1. Tenancy is app-enforced: each
-- query takes company_id from the current membership and filters by
-- it. Defence-in-depth RLS lands in a later phase.
-- ─────────────────────────────────────────────
ALTER TABLE companies         DISABLE ROW LEVEL SECURITY;
ALTER TABLE memberships       DISABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins      DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads             DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories        DISABLE ROW LEVEL SECURITY;
ALTER TABLE statuses          DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations         DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment         DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_status  DISABLE ROW LEVEL SECURITY;
ALTER TABLE rental_history    DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs  DISABLE ROW LEVEL SECURITY;
ALTER TABLE samsara_devices   DISABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests  DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers         DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders            DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines       DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents         DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_attachments DISABLE ROW LEVEL SECURITY;
