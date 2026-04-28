-- Migration 003: preserve dashboard status and output snapshots in Supabase mode

ALTER TABLE sheet_snapshots
  ADD COLUMN IF NOT EXISTS last_request_at TIMESTAMPTZ;

ALTER TABLE sheet_snapshots
  ADD COLUMN IF NOT EXISTS output_synced_at TIMESTAMPTZ;

ALTER TABLE sheet_snapshots
  ADD COLUMN IF NOT EXISTS output_rows JSONB DEFAULT '[]'::jsonb;
