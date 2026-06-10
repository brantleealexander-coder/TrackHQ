-- Phase 8a — scope call_logs by company + capture VAPI recording URL.
--
-- Run this once against the production Supabase (SQL Editor).
-- Idempotent and safe to re-run:
--   - If call_logs doesn't exist yet (multi-tenant deployments that never
--     applied template-server/supabase_schema.sql), this creates it.
--   - If call_logs exists but is missing the new columns, this adds them
--     and backfills company_id to 1 (the demo tenant) before dropping the
--     default.

-- 1. Create the table if it's missing.
CREATE TABLE IF NOT EXISTS call_logs (
  id                BIGSERIAL PRIMARY KEY,
  company_id        BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vapi_call_id      TEXT UNIQUE,
  caller_phone      TEXT,
  caller_name       TEXT,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  duration_seconds  INTEGER,
  summary           TEXT,
  transcript        JSONB,
  recording_url     TEXT,
  outcome           TEXT DEFAULT 'inquiry',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. If the table existed already (pre-Phase 8), make sure it has the new
-- columns. The DEFAULT lets existing rows backfill to company 1 (Sunset
-- Rentals demo) in one shot; we drop the default afterward so future
-- inserts have to be explicit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE call_logs
      ADD COLUMN company_id BIGINT NOT NULL DEFAULT 1
        REFERENCES companies(id) ON DELETE CASCADE;
    ALTER TABLE call_logs ALTER COLUMN company_id DROP DEFAULT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE call_logs ADD COLUMN recording_url TEXT;
  END IF;
END $$;

-- 3. Indexes for the per-tenant /app/calls list query.
CREATE INDEX IF NOT EXISTS idx_call_logs_phone      ON call_logs(caller_phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_company    ON call_logs(company_id, created_at DESC);
