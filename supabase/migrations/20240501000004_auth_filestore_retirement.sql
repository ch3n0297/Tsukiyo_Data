-- Migration 004: auth/FileStore retirement support
-- Adds app-owned profile and audit tables used by Supabase-only auth runtime.

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  actor_user_id UUID,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_audit_events" ON audit_events;
CREATE POLICY "users_read_own_audit_events" ON audit_events
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = actor_user_id);

CREATE INDEX IF NOT EXISTS profiles_email_idx
  ON profiles (email);

CREATE INDEX IF NOT EXISTS audit_events_user_id_created_at_idx
  ON audit_events (user_id, created_at DESC);
