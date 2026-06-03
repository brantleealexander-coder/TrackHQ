-- Phase 6a backfill — populate the new `customers` table from legacy
-- denormalized customer_name strings on existing forks.
--
-- Run order: AFTER applying the Phase 6a schema additions to the fork.
-- Idempotent: ON CONFLICT keeps the existing row.
--
-- For a brand-new fork (no equipment_status / rental_history history yet),
-- this is a no-op.

BEGIN;

-- 1. From current rentals (equipment_status)
INSERT INTO customers (name)
SELECT DISTINCT customer_name
FROM equipment_status
WHERE customer_name IS NOT NULL
  AND TRIM(customer_name) <> ''
ON CONFLICT DO NOTHING;

-- 2. From historical rentals (rental_history) — picks up customers whose
--    last rental is no longer reflected in equipment_status.
INSERT INTO customers (name)
SELECT DISTINCT customer_name
FROM rental_history
WHERE customer_name IS NOT NULL
  AND TRIM(customer_name) <> ''
  AND customer_name NOT IN (SELECT name FROM customers)
ON CONFLICT DO NOTHING;

-- 3. From any pending booking_requests (Phase 5e) — dedup by email when
--    available, otherwise insert by name.
INSERT INTO customers (name, email, phone)
SELECT
  br.renter_name,
  br.renter_email,
  br.renter_phone
FROM booking_requests br
LEFT JOIN customers c
  ON LOWER(c.email) = LOWER(br.renter_email)
WHERE c.id IS NULL
  AND br.renter_email IS NOT NULL
  AND TRIM(br.renter_email) <> '';

-- 4. Back-link those booking_requests to their (newly-or-already-existing)
--    customer row so the dashboard's CRM history stays accurate.
UPDATE booking_requests br
SET customer_id = c.id
FROM customers c
WHERE br.customer_id IS NULL
  AND LOWER(c.email) = LOWER(br.renter_email);

COMMIT;

-- Verification:
--   SELECT COUNT(*) FROM customers;
--   SELECT COUNT(*) FROM booking_requests WHERE customer_id IS NOT NULL;
