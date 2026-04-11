# Technical Spec:Database Schema + RLS

**目的**:PostgreSQL 資料表結構、欄位、約束、RLS 政策的**唯一權威來源**。Coding Agent 在撰寫 repository、migration、Supabase 查詢時,一律以本文件為準。

**對應 ADR**:[ADR-002 Supabase 遷移](../adr/ADR-002-supabase-migration.md)

---

## 核心資料表

> 所有資料表皆有 `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`,這是 RLS 的關鍵。`auth.users` 由 Supabase Auth 管理,不需自己建。

### `account_configs` — 帳號設定

每個用戶可以有多個社群帳號。

```sql
CREATE TABLE account_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name   TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok')),
  account_id    TEXT NOT NULL,
  refresh_days  INTEGER NOT NULL DEFAULT 30 CHECK (refresh_days BETWEEN 1 AND 365),
  sheet_id      TEXT,
  sheet_tab     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);
```

### `platform_tokens` — 平台 Token(加密儲存)

```sql
CREATE TABLE platform_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'google')),
  account_id      TEXT,                     -- 對應哪個社群帳號(nullable,連結時填入)
  access_token    TEXT NOT NULL,            -- ⚠️ 應用層 AES-256-GCM 加密後的值
  refresh_token   TEXT,                     -- ⚠️ 加密後(TikTok/Google 有;Meta 無)
  expires_at      TIMESTAMPTZ,              -- token 過期時間
  scopes          TEXT[],                   -- 已授權的 scopes
  token_metadata  JSONB DEFAULT '{}',       -- 平台特有的額外資訊(如 open_id, page_id)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);
```

> ⚠️ **雙層保護**:即使有 RLS,`access_token` / `refresh_token` 仍必須在應用層用 `lib/secret-box.ts` 加密後再寫入。RLS 保護不了資料庫管理員的直接存取。

### `jobs` — 刷新 Job

```sql
CREATE TABLE jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_config_id UUID NOT NULL REFERENCES account_configs(id),
  trigger_source    TEXT NOT NULL CHECK (trigger_source IN ('scheduled', 'manual')),
  refresh_days      INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'running', 'success', 'error')),
  system_message    TEXT,
  queued_at         TIMESTAMPTZ DEFAULT now(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

### `raw_records` — 平台原始回應

```sql
CREATE TABLE raw_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id),
  platform        TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  post_id         TEXT NOT NULL,
  raw_data        JSONB NOT NULL,
  fetched_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform, account_id, post_id)
);
```

### `normalized_records` — 標準化資料

```sql
CREATE TABLE normalized_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
```

### `sheet_snapshots` — Sheet 狀態快照

```sql
CREATE TABLE sheet_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_config_id UUID NOT NULL REFERENCES account_configs(id),
  refresh_status    TEXT,
  system_message    TEXT,
  last_success_at   TIMESTAMPTZ,
  current_job_id    UUID REFERENCES jobs(id),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

---

## Row Level Security(RLS)政策

**所有資料表必須啟用 RLS**。這是多租戶隔離的第一道防線,不可省略。

```sql
-- 啟用 RLS
ALTER TABLE account_configs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE normalized_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_snapshots    ENABLE ROW LEVEL SECURITY;

-- 套用相同模式的政策
CREATE POLICY "用戶只能看到自己的帳號設定"
  ON account_configs FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "用戶只能看到自己的 token"
  ON platform_tokens FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "用戶只能看到自己的 job"
  ON jobs FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "用戶只能看到自己的 raw_records"
  ON raw_records FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "用戶只能看到自己的 normalized_records"
  ON normalized_records FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "用戶只能看到自己的 sheet_snapshots"
  ON sheet_snapshots FOR ALL
  USING (auth.uid() = user_id);
```

> ⚠️ 後端使用 `SUPABASE_SERVICE_ROLE_KEY` 時會 bypass RLS。Service role 查詢**必須**在應用層手動加上 `WHERE user_id = currentUserId`。TypeScript 的型別約束能幫你抓漏。

---

## Auth Middleware(Supabase JWT 驗證)<a id="auth-middleware"></a>

替換原有 `session-repository` 的中介層寫法:

```typescript
import { createClient } from '@supabase/supabase-js';
import { HttpError } from '../lib/errors.ts';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function requireAuth(req, reply) {
  const jwt = req.headers.authorization?.replace('Bearer ', '');
  if (!jwt) throw new HttpError(401, 'Missing JWT');

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new HttpError(401, 'Invalid token');

  req.user = user; // user.id 即 auth.uid(),對應 RLS
}
```

---

## 欄位對應表(平台 API → normalized_records)

### Instagram(Graph API → Normalized)

| Normalized 欄位 | Meta Graph API 欄位 | 備註 |
|----------------|---------------------|------|
| `post_id` | `id` | |
| `post_timestamp` | `timestamp` | ISO 8601 |
| `caption` | `caption` | 可能為空 |
| `media_type` | `media_type` | IMAGE / VIDEO / CAROUSEL_ALBUM |
| `like_count` | `like_count` | 需加 `like_count` 到 fields |
| `comment_count` | `comments_count` | |
| `view_count` | `video_views` | 僅影片有效,需另外查詢 |

### Facebook(Pages API → Normalized)

| Normalized 欄位 | Meta Graph API 欄位 | 備註 |
|----------------|---------------------|------|
| `post_id` | `id` | 格式:`{page-id}_{post-id}` |
| `post_timestamp` | `created_time` | ISO 8601 |
| `caption` | `message` | 可能為空 |
| `media_type` | 無直接對應 | 需自行推斷(有 `attachments` 的視為含媒體) |
| `like_count` | `likes.summary.total_count` | 需 `likes.summary(true)` |
| `comment_count` | `comments.summary.total_count` | 需 `comments.summary(true)` |

### TikTok(Video List API → Normalized)

| Normalized 欄位 | TikTok API 欄位 | 備註 |
|----------------|-----------------|------|
| `post_id` | `id` | |
| `post_timestamp` | `create_time` | Unix timestamp(秒),需轉 ISO 8601 |
| `caption` | `video_description` | |
| `media_type` | 固定為 `VIDEO` | |
| `like_count` | `like_count` | |
| `comment_count` | `comment_count` | |
| `view_count` | `view_count` | |
| `share_count` | `share_count` | |

---

## 相關文件

- [TypeScript Types](typescript-types.md):對應的 interface 定義
- [Token Management](token-management.md):token 儲存流程
- [ADR-002:Supabase 遷移](../adr/ADR-002-supabase-migration.md)
