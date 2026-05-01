-- Migration 004: auth/FileStore retirement support
-- Adds app-owned profile and audit tables used by Supabase-only auth runtime.

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_approval_state_check CHECK (
    NOT (approved_at IS NOT NULL AND rejected_at IS NOT NULL)
  )
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_role_manage_profiles" ON profiles;
CREATE POLICY "service_role_manage_profiles" ON profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

DROP POLICY IF EXISTS "Admins can read all audit events" ON audit_events;
CREATE POLICY "Admins can read all audit events" ON audit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role can insert audit events" ON audit_events;
CREATE POLICY "Service role can insert audit events" ON audit_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS profiles_email_idx
  ON profiles (email);

CREATE INDEX IF NOT EXISTS profiles_approved_at_idx
  ON profiles (approved_at)
  WHERE approved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_rejected_at_idx
  ON profiles (rejected_at)
  WHERE rejected_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id
  ON audit_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_user_id
  ON audit_events (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_type
  ON audit_events (event_type);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
  ON audit_events (created_at DESC);
