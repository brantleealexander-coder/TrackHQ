-- Phase 8a — scope call_logs by company + capture VAPI recording URL.
--
-- Run this once against the production Supabase (SQL Editor).
-- Idempotent: safe to re-run; the DO blocks no-op if the column already
-- exists.
--
-- Pattern mirrors Phase 7c: add the column with a DEFAULT so existing
-- rows backfill instantly, then drop the default so future inserts are
-- forced to specify a company explicitly.

-- 1. Add company_id (default 1 = Sunset Rentals demo) and recording_url.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE call_logs
      ADD COLUMN company_id BIGINT NOT NULL DEFAULT 1
        REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_logs' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE call_logs ADD COLUMN recording_url TEXT;
  END IF;
END $$;

-- 2. Drop the temporary default so future inserts must pick a company.
ALTER TABLE call_logs ALTER COLUMN company_id DROP DEFAULT;

-- 3. Index for the per-tenant /app/calls list query.
CREATE INDEX IF NOT EXISTS idx_call_logs_company
  ON call_logs(company_id, created_at DESC);
