-- =============================================================================
-- Migration 002: 安全性與完整性修補
-- 修復 CodeRabbit 審查發現的 RLS、FK、Schema 問題
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. 修正 RLS policy：補 WITH CHECK（防止 INSERT 繞過 USING 條件）
--    FOR ALL USING (...) 只過濾 SELECT/UPDATE/DELETE；
--    INSERT 需要獨立的 WITH CHECK 才能限制寫入者
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_own_data" ON account_configs;
DROP POLICY IF EXISTS "users_own_data" ON jobs;
DROP POLICY IF EXISTS "users_own_data" ON raw_records;
DROP POLICY IF EXISTS "users_own_data" ON normalized_records;
DROP POLICY IF EXISTS "users_own_data" ON sheet_snapshots;
DROP POLICY IF EXISTS "users_own_data" ON platform_tokens;

CREATE POLICY "users_own_data" ON account_configs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON jobs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON raw_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON normalized_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON sheet_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON platform_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. 修正 FK 缺少 ON DELETE 行為
-- ---------------------------------------------------------------------------

-- sheet_snapshots.account_config_id → CASCADE（刪帳號設定時連同快照一起刪）
ALTER TABLE sheet_snapshots
  DROP CONSTRAINT IF EXISTS sheet_snapshots_account_config_id_fkey;
ALTER TABLE sheet_snapshots
  ADD CONSTRAINT sheet_snapshots_account_config_id_fkey
  FOREIGN KEY (account_config_id) REFERENCES account_configs(id) ON DELETE CASCADE;

-- sheet_snapshots.current_job_id → SET NULL（job 刪除後快照保留，job 欄位清空）
ALTER TABLE sheet_snapshots
  DROP CONSTRAINT IF EXISTS sheet_snapshots_current_job_id_fkey;
ALTER TABLE sheet_snapshots
  ADD CONSTRAINT sheet_snapshots_current_job_id_fkey
  FOREIGN KEY (current_job_id) REFERENCES jobs(id) ON DELETE SET NULL;

-- raw_records.job_id → SET NULL（job 刪除後原始資料保留）
ALTER TABLE raw_records
  DROP CONSTRAINT IF EXISTS raw_records_job_id_fkey;
ALTER TABLE raw_records
  ADD CONSTRAINT raw_records_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;

-- normalized_records.job_id → SET NULL（job 刪除後正規化資料保留）
ALTER TABLE normalized_records
  DROP CONSTRAINT IF EXISTS normalized_records_job_id_fkey;
ALTER TABLE normalized_records
  ADD CONSTRAINT normalized_records_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. 修正 platform_tokens nullable account_id unique constraint
--    SQL 標準：NULL != NULL，原有 UNIQUE(user_id, platform, account_id)
--    在 account_id IS NULL 時允許重複記錄
-- ---------------------------------------------------------------------------
ALTER TABLE platform_tokens
  DROP CONSTRAINT IF EXISTS platform_tokens_user_id_platform_account_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS platform_tokens_user_platform_nonnull
  ON platform_tokens (user_id, platform, account_id)
  WHERE account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS platform_tokens_user_platform_null
  ON platform_tokens (user_id, platform)
  WHERE account_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4. 補 account_configs.updated_at 欄位（mapper 需要正確更新時間）
-- ---------------------------------------------------------------------------
ALTER TABLE account_configs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ---------------------------------------------------------------------------
-- 5. 補 jobs.error_code / result_summary 欄位（Job type 已有，DB 缺失）
-- ---------------------------------------------------------------------------
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS result_summary JSONB;

-- ---------------------------------------------------------------------------
-- NOTE: Token 加密（platform_tokens.access_token / refresh_token）
--   目前明文儲存，建議使用 pgsodium vault 或應用層加密
--   需獨立規劃，本 migration 不實作（避免影響現有資料）
-- ---------------------------------------------------------------------------
