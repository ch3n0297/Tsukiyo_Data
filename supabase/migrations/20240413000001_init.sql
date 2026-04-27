-- account_configs
CREATE TABLE account_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  client_name   TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok')),
  account_id    TEXT NOT NULL,
  refresh_days  INTEGER NOT NULL DEFAULT 30 CHECK (refresh_days BETWEEN 1 AND 365),
  sheet_id      TEXT,
  sheet_tab     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);
ALTER TABLE account_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON account_configs FOR ALL USING (auth.uid() = user_id);

-- jobs
CREATE TABLE jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  account_config_id UUID NOT NULL REFERENCES account_configs(id),
  trigger_source    TEXT NOT NULL CHECK (trigger_source IN ('scheduled', 'manual')),
  refresh_days      INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'running', 'success', 'error')),
  system_message    TEXT,
  queued_at         TIMESTAMPTZ DEFAULT now(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  account_key       TEXT,
  request_source    TEXT,
  platform          TEXT,
  account_id        TEXT
);
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON jobs FOR ALL USING (auth.uid() = user_id);

-- raw_records
CREATE TABLE raw_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  job_id          UUID REFERENCES jobs(id),
  platform        TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  post_id         TEXT NOT NULL,
  raw_data        JSONB NOT NULL,
  fetched_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform, account_id, post_id)
);
ALTER TABLE raw_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON raw_records FOR ALL USING (auth.uid() = user_id);

-- normalized_records
CREATE TABLE normalized_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  job_id          UUID REFERENCES jobs(id),
  platform        TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  post_id         TEXT NOT NULL,
  post_timestamp  TIMESTAMPTZ,
  caption         TEXT,
  media_type      TEXT,
  like_count      INTEGER DEFAULT 0,
  comment_count   INTEGER DEFAULT 0,
  view_count      INTEGER DEFAULT 0,
  share_count     INTEGER DEFAULT 0,
  extra_data      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform, account_id, post_id)
);
ALTER TABLE normalized_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON normalized_records FOR ALL USING (auth.uid() = user_id);

-- sheet_snapshots
CREATE TABLE sheet_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  account_config_id UUID NOT NULL REFERENCES account_configs(id),
  refresh_status    TEXT,
  system_message    TEXT,
  last_success_at   TIMESTAMPTZ,
  current_job_id    UUID REFERENCES jobs(id),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, account_config_id)
);
ALTER TABLE sheet_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON sheet_snapshots FOR ALL USING (auth.uid() = user_id);

-- platform_tokens
CREATE TABLE platform_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'google')),
  account_id      TEXT,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  expires_at      TIMESTAMPTZ,
  scopes          TEXT[],
  token_metadata  JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);
ALTER TABLE platform_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON platform_tokens FOR ALL USING (auth.uid() = user_id);
