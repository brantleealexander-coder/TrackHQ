-- supabase_schema.sql
-- Run this in Supabase dashboard > SQL Editor
-- Creates all tables and indexes for the AI Receptionist

-- Call logs: one row per call
CREATE TABLE IF NOT EXISTS call_logs (
  id                BIGSERIAL PRIMARY KEY,
  vapi_call_id      TEXT UNIQUE,
  caller_phone      TEXT,
  caller_name       TEXT,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  duration_seconds  INTEGER,
  summary           TEXT,
  transcript        JSONB,
  outcome           TEXT DEFAULT 'inquiry',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments: one row per booked/rescheduled/cancelled slot
CREATE TABLE IF NOT EXISTS appointments (
  id               BIGSERIAL PRIMARY KEY,
  google_event_id  TEXT UNIQUE,
  caller_phone     TEXT,
  caller_name      TEXT,
  start_time       TIMESTAMPTZ,
  end_time         TIMESTAMPTZ,
  status           TEXT DEFAULT 'booked',
  call_log_id      BIGINT REFERENCES call_logs(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Messages: voicemails and after-hours messages taken by the AI
CREATE TABLE IF NOT EXISTS messages (
  id           BIGSERIAL PRIMARY KEY,
  caller_phone TEXT,
  caller_name  TEXT,
  message_text TEXT,
  urgency      TEXT DEFAULT 'normal',
  call_log_id  BIGINT REFERENCES call_logs(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_call_logs_phone       ON call_logs(caller_phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at  ON call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_phone    ON appointments(caller_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_status   ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_start    ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_messages_phone        ON messages(caller_phone);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON messages(created_at);
