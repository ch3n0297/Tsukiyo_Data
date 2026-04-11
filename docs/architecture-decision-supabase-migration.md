# 架構決策文件：OAuth 多租戶模式 + 全面遷移至 Supabase

> ⚠️ **已於 2026-04-05 拆分為分類文件**
>
> 本文件原為單一長文件，現已依類型（ADR / Technical Spec / Migration Plan / Security Playbook）拆分至 [`docs/architecture/`](architecture/README.md) 資料夾。
>
> **Coding Agent 請讀新結構**：[`docs/architecture/README.md`](architecture/README.md)
>
> 本檔案保留為歷史參考，不再更新。若有不一致，以 `docs/architecture/` 為準。

---

**撰寫日期**：2026-04-04
**狀態**：決策已確認，待進入實作規劃
**背景**：原系統以 JSON 檔案儲存、自建 Auth、Fixture Adapter 為基礎。本文件記錄為何與如何轉向 OAuth 多租戶 + Supabase 的完整架構決策。

---

## 一、OAuth 多租戶模式：你不需要「幫用戶拿 API」，你需要讓用戶「授權給你」

### 1.1 原本的誤解

「讓用戶帶自己的 API Key 來用」聽起來可以省掉後端串接，但實際上這條路只適合技術型用戶（例如給工程師用的工具）。對於行銷人員或一般業務，他們不知道什麼是 Meta Graph API，更不知道怎麼取得 Access Token。

### 1.2 正確的做法：OAuth 授權流程（你的 App，用戶的帳號）

你建立一個 Meta App，**所有用戶都透過你的 App 完成授權**。流程如下：

```
用戶在你的軟體點「連結 Instagram」
         ↓
跳轉至 Meta 官方授權頁（meta.com/dialog/oauth）
         ↓
用戶看到：「[你的軟體名稱] 想要存取你的 Instagram 帳號」
         ↓
用戶點「允許」
         ↓
Meta 把 Authorization Code 發回你的 callback URL
         ↓
你的後端換成 Access Token，加密後存入 Supabase
         ↓
之後所有 API 呼叫都用這個 token，用戶完全不需要知道 API 的存在
```

**這就是 Buffer、Hootsuite、Later 等所有社群管理工具的做法。**

### 1.3 後端還是需要「串接」，但你只做一次

| 工作 | 需要做嗎 | 說明 |
|------|---------|------|
| 申請 Meta/TikTok 開發者帳號 | 是，只做一次 | 你是 App 擁有者 |
| 建立 OAuth 路由（authorize / callback） | 是，只做一次 | 每個用戶都走同一條路 |
| 儲存各用戶的 token | 是，Supabase 處理 | 每個用戶有獨立一筆 |
| 呼叫 Meta/TikTok API | 是 | 用每個用戶自己的 token |
| Meta App Review | 是 | 需申請，但只需申請一次 |

**用戶端什麼都不用做**，他們只要點「連結帳號」，就像登入 Google 一樣自然。

### 1.4 多租戶意味著什麼

每個使用你軟體的「客戶」（租戶）有自己的：
- Supabase Auth 帳號（user_id）
- 帳號設定（account_configs）：只能看到自己的
- 平台 token（platform_tokens）：加密儲存，只能看到自己的
- Job 記錄、Raw/Normalized 資料：用 Row Level Security 隔離

---

## 二、為什麼換成 Supabase？現有系統的限制

### 2.1 現有問題

| 現有設計 | 問題 |
|---------|------|
| JSON 檔案儲存 | 無法多台伺服器同時讀寫；無法查詢過濾；檔案大了就慢 |
| 自建 Auth（session + bcrypt） | 需自己維護安全性；沒有 OAuth 登入（Google/GitHub）；沒有 email 驗證 |
| 本地檔案部署 | 換機器就要搬資料；無法水平擴展 |
| 無多租戶隔離 | 目前設計假設單一用戶或信任的內部系統 |

### 2.2 Supabase 解決的問題

| Supabase 功能 | 替換的現有元件 | 效益 |
|-------------|-------------|------|
| PostgreSQL 資料庫 | `fs-store.js` + 所有 JSON 檔案 | 可查詢、可索引、concurrent-safe |
| Supabase Auth | `user-auth-service.js`、`session-repository.js`、`password-reset-service.js` | 內建 email/password、Google 登入、JWT session |
| Row Level Security (RLS) | 無（目前沒有多租戶隔離） | 每個用戶只能存取自己的資料，從資料庫層保障 |
| Supabase Vault 或加密欄位 | `secret-box.js` + 手動加密 | 平台 token 的安全儲存 |
| 雲端託管 | 本機 JSON 檔案 | 任何地方部署都能連到同一個資料庫 |

---

## 三、新架構全貌

```
┌─────────────────────────────────────────────────────────┐
│                    使用者瀏覽器 / Dashboard               │
│              React + Vite（現有前端，不變）                │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP API
┌──────────────────────────▼──────────────────────────────┐
│                     Node.js Backend                      │
│                                                          │
│  Routes → Services → Adapters                           │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Auth Routes  │  │ OAuth Routes │  │ Data Routes    │ │
│  │ (Supabase   │  │ Meta/TikTok  │  │ accounts/jobs  │ │
│  │  Auth JWT)  │  │ callback     │  │ sync/refresh   │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│                                                          │
│  Repositories（介面不變，底層換 Supabase client）          │
└────────────────┬──────────────────────┬─────────────────┘
                 │                      │
    ┌────────────▼──────────┐  ┌────────▼─────────┐
    │     Supabase DB        │  │  Meta / TikTok   │
    │  (PostgreSQL + RLS)    │  │  Graph API       │
    │                        │  └──────────────────┘
    │  - users               │
    │  - account_configs     │
    │  - platform_tokens     │
    │  - jobs                │
    │  - raw_records         │
    │  - normalized_records  │
    │  - sheet_snapshots     │
    └────────────────────────┘
```

---

## 四、資料庫 Schema 設計（PostgreSQL）

### 4.1 核心資料表

```sql
-- 用戶（由 Supabase Auth 管理，這裡只是 reference）
-- auth.users 是 Supabase 內建的，不需自己建

-- 帳號設定（每個用戶可以有多個社群帳號）
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

-- 平台 token（加密儲存）
CREATE TABLE platform_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'google')),
  account_id      TEXT,                     -- 對應哪個社群帳號（nullable，連結時填入）
  access_token    TEXT NOT NULL,            -- 加密後的 token
  refresh_token   TEXT,                     -- 加密後（TikTok 有，Meta 無）
  expires_at      TIMESTAMPTZ,              -- token 過期時間
  scopes          TEXT[],                   -- 已授權的 scopes
  token_metadata  JSONB DEFAULT '{}',       -- 平台特有的額外資訊
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);

-- 刷新 Job
CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_config_id UUID NOT NULL REFERENCES account_configs(id),
  trigger_source  TEXT NOT NULL CHECK (trigger_source IN ('scheduled', 'manual')),
  refresh_days    INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'running', 'success', 'error')),
  system_message  TEXT,
  queued_at       TIMESTAMPTZ DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Raw 資料（平台原始回應）
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

-- Normalized 資料
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

-- Sheet 狀態快照
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

### 4.2 Row Level Security（RLS）政策

```sql
-- 啟用 RLS（所有資料表都要加）
ALTER TABLE account_configs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE normalized_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_snapshots    ENABLE ROW LEVEL SECURITY;

-- 每個資料表的政策（以 account_configs 為例）
CREATE POLICY "用戶只能看到自己的帳號設定"
  ON account_configs FOR ALL
  USING (auth.uid() = user_id);

-- 其他資料表套用相同模式
CREATE POLICY "用戶只能看到自己的 token"
  ON platform_tokens FOR ALL
  USING (auth.uid() = user_id);

-- 以此類推...
```

> ⚠️ **Token 加密說明**：即使有 RLS，`platform_tokens` 裡的 token 仍建議在應用層加密後再寫入（沿用現有的 `secret-box.js`），或使用 Supabase Vault（PostgreSQL 的 `pgsodium` 擴充）。雙層保護，避免資料庫管理員直接看到明文 token。

---

## 五、現有程式碼的遷移對應

### 5.1 哪些可以直接沿用

| 現有元件 | 狀態 | 說明 |
|---------|------|------|
| `lib/secret-box.js` | ✅ 保留 | token 加密邏輯不變 |
| `lib/errors.js` | ✅ 保留 | HTTP 錯誤定義不變 |
| `lib/logger.js` | ✅ 保留 | 日誌邏輯不變 |
| `services/normalization-service.js` | ✅ 保留 | 正規化邏輯與儲存層無關 |
| `services/job-queue.js` | ✅ 保留 | 記憶體內 queue，不涉及持久化 |
| `services/scheduler-service.js` | ✅ 保留 | 排程邏輯不變 |
| `services/refresh-orchestrator.js` | ✅ 保留 | 協調邏輯不變 |
| `adapters/platforms/` | ✅ 保留（待替換 fixture） | Adapter 介面不變 |
| Route 層 | ✅ 大部分保留 | 只需調整 Auth middleware |

### 5.2 需要重寫的元件

| 現有元件 | 替換方案 | 工作量 |
|---------|---------|--------|
| `lib/fs-store.js` | Supabase client wrapper | 中（建立 `supabase-store.js`） |
| 所有 `repositories/*.js` | 更新底層為 Supabase 查詢 | 中（模式重複，可批次處理） |
| `services/user-auth-service.js` | Supabase Auth SDK | 小（API 呼叫替換） |
| `services/user-auth-validation-service.js` | Supabase JWT 驗證 | 小 |
| `services/password-reset-service.js` | Supabase Auth 內建 resetPasswordForEmail | 極小 |
| `repositories/session-repository.js` | 移除（Supabase 管理 session） | 移除 |
| `repositories/user-repository.js` | Supabase Auth 管理 users | 簡化 |
| `services/google-oauth-service.js` | 部分調整（改存 Supabase） | 小 |

### 5.3 需要新增的元件

| 新元件 | 說明 |
|--------|------|
| `lib/supabase-client.js` | Supabase JS SDK 初始化（server-side） |
| `adapters/platforms/real-instagram-adapter.js` | 真實 Meta Graph API |
| `adapters/platforms/real-facebook-adapter.js` | 真實 Meta Pages API |
| `adapters/platforms/real-tiktok-adapter.js` | 真實 TikTok Video List API |
| `services/meta-oauth-service.js` | Meta OAuth 流程 |
| `services/tiktok-oauth-service.js` | TikTok OAuth 流程 |
| `services/token-refresh-service.js` | TikTok token 自動刷新 |
| `routes/meta-oauth-routes.js` | Meta callback 路由 |
| `routes/tiktok-oauth-routes.js` | TikTok callback 路由 |
| Supabase migrations（`supabase/migrations/`） | 資料庫 schema 版本管理 |

---

## 六、Auth 流程的改變

### 現在（自建 Auth）
```
用戶送帳密 → bcrypt 比對 → 建立 session token → 存入 sessions.json → 回傳 cookie
```

### 遷移後（Supabase Auth）
```
用戶送帳密 → Supabase Auth 驗證 → 發回 JWT（access token + refresh token）
→ 前端存入 localStorage（Supabase SDK 自動管理）
→ 後端 API 驗證 JWT（用 Supabase Admin SDK 或 JWT secret 直接驗）
```

**後端 middleware 的改變**：
```js
// 現在（簡化版）
async function requireAuth(req, res, next) {
  const sessionToken = req.cookies.session;
  const session = await sessionRepository.findByToken(sessionToken);
  if (!session) throw new HttpError(401, ...);
  req.user = await userRepository.findById(session.userId);
  next();
}

// 遷移後
import { createClient } from '@supabase/supabase-js';

async function requireAuth(req, res, next) {
  const jwt = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new HttpError(401, ...);
  req.user = user;  // 包含 user.id（即 auth.uid()，對應 RLS）
  next();
}
```

---

## 七、OAuth 多租戶下的 Token 儲存流程

```
用戶授權 Meta 後，callback 收到 code
          ↓
後端用 code 換 access_token（+ long-lived token 交換）
          ↓
確認 token 有效（呼叫 /me 取得 ig_user_id）
          ↓
用 secret-box.js 加密 access_token
          ↓
UPSERT 到 Supabase platform_tokens 表
  WHERE user_id = req.user.id（Supabase Auth 提供）
  AND platform = 'instagram'
  AND account_id = ig_user_id
          ↓
Adapter 執行時：
  從 platform_tokens 查出對應 token → 解密 → 呼叫 Meta API
```

---

## 八、TikTok OAuth 實作參考（基於現有 `docs/tiktok-verify-site/`）

### 8.1 已完成的前置工作

你已經在 `docs/tiktok-verify-site/` 完成了以下基礎建設：

| 項目 | 狀態 | 位置 |
|------|------|------|
| TikTok Developer App 申請 | ✅ 已完成 | Client Key: `sbawe3p2ylashwdxeb` |
| 域名驗證檔案 | ✅ 已完成 | `tiktok2323K0O5...txt`、`tiktok4kQI4V...txt` |
| OAuth callback（Python 原型） | ✅ 可運作 | `server.py`（code → token 交換） |
| Redirect URI | ✅ 已設定 | Tailscale tunnel 開發環境 |

### 8.2 Python 原型的關鍵流程（⚠️ 必須遷移至 Node.js）

> **決策：Python 版 `server.py` 僅作為流程驗證的歷史參考，不會進入正式系統。**
> 正式系統的 TikTok OAuth callback 必須以 Node.js（TypeScript）實作，整合進現有的 Fastify 路由體系。
> 理由：
> 1. 專案技術棧統一（Node.js + Supabase），不引入 Python runtime 的維運負擔
> 2. Token 儲存需要走 Supabase client + secret-box 加密，Python 版無法直接共用
> 3. Auth middleware（Supabase JWT 驗證）只在 Node.js 後端存在
> 4. 多租戶的 `user_id` 綁定只有在同一個 request context 裡才能拿到

你的 `server.py` 已驗證了完整的 TikTok OAuth token 交換流程：

```
GET /auth/tiktok/callback?code=xxx&state=yyy&scopes=zzz
        ↓
POST https://open.tiktokapis.com/v2/oauth/token/
  Content-Type: application/x-www-form-urlencoded
  Body: client_key, client_secret, code, grant_type=authorization_code, redirect_uri
        ↓
回應：{ access_token, refresh_token, expires_in, open_id, scope, token_type }
```

### 8.3 從單人使用 → 多租戶的改變

你目前的 `server.py` 是「拿到 token 就印出來」。多租戶版本需要以下改變：

```
                    現在（Python 原型）              多租戶版本（Node.js + Supabase）
─────────────────────────────────────────────────────────────────────────────
誰發起授權？         你自己手動拼 URL               用戶在 Dashboard 點「連結 TikTok」
                                                   → 後端產生 authorize URL（含 state + PKCE）

callback 做什麼？   印出 token JSON                 1. 驗證 state（防 CSRF）
                                                   2. 用 code 換 token
                                                   3. 呼叫 /v2/user/info/ 取得 open_id 與顯示名稱
                                                   4. secret-box 加密 access_token + refresh_token
                                                   5. UPSERT 到 Supabase platform_tokens
                                                      WHERE user_id = 當前登入用戶
                                                      AND platform = 'tiktok'
                                                   6. 導回 Dashboard（顯示「TikTok 已連結」）

token 存哪裡？      沒有存（只在 HTTP response）     Supabase platform_tokens 表（加密）

過期怎麼辦？        手動重跑流程                     token-refresh-service 自動用 refresh_token 換新
```

### 8.4 TikTok Token 生命週期（多租戶必須處理）

```
                        access_token                 refresh_token
─────────────────────────────────────────────────────────────────────
有效期限               24 小時                       365 天
取得方式               OAuth callback                OAuth callback（一起發的）
用途                   呼叫所有 TikTok API            換新 access_token
刷新方式               POST /v2/oauth/token/          無法刷新，過期就要重新授權
                       grant_type=refresh_token
刷新後                 舊 access_token 失效           回傳新的 refresh_token（也要更新）
```

**自動刷新流程**（token-refresh-service 負責）：

```
排程同步啟動前 → 檢查 platform_tokens WHERE platform = 'tiktok'
         ↓
if (access_token 過期 && refresh_token 未過期)
  → POST /v2/oauth/token/ { grant_type: refresh_token, refresh_token: ... }
  → 更新 access_token + refresh_token + expires_at
         ↓
if (refresh_token 也過期)
  → 標記此連線為 expired
  → Dashboard 顯示「TikTok 連結已過期，請重新授權」
  → 用戶點擊後重跑 OAuth 流程
```

### 8.5 TikTok API 端點速查

| 用途 | 方法 | URL | 備註 |
|------|------|-----|------|
| 授權入口 | GET | `https://www.tiktok.com/v2/auth/authorize/?client_key={key}&scope={scopes}&redirect_uri={uri}&response_type=code&state={state}` | 用戶瀏覽器跳轉 |
| Token 交換 | POST | `https://open.tiktokapis.com/v2/oauth/token/` | `grant_type=authorization_code` |
| Token 刷新 | POST | `https://open.tiktokapis.com/v2/oauth/token/` | `grant_type=refresh_token` |
| Token 撤銷 | POST | `https://open.tiktokapis.com/v2/oauth/revoke/` | 用戶「解除連結」時呼叫 |
| 用戶資訊 | GET | `https://open.tiktokapis.com/v2/user/info/` | Header: `Authorization: Bearer {token}` |
| 影片列表 | POST | `https://open.tiktokapis.com/v2/video/list/` | Body: `{ max_count: 20 }` |

### 8.6 ⚠️ 安全性提醒

目前 `docs/tiktok-verify-site/server.py` 將 `CLIENT_SECRET` 直接寫在原始碼裡：

```python
CLIENT_SECRET = "vnYhenm8Hxz344t6vw18jV3vEjIq5bXY"  # ← 不可進入 git！
```

**立即行動**：
1. 將 `docs/tiktok-verify-site/` 加入 `.gitignore`（或從 repo 中移除）
2. 到 TikTok Developer Console 重新產生 Client Secret
3. 正式系統改用環境變數 `TIKTOK_CLIENT_SECRET`

---

## 九、Meta OAuth 實作參考（Facebook + Instagram 共用）

### 9.1 與 TikTok 的差異

Meta 的 OAuth 在流程上相似，但有幾個重要差異需要特別處理：

```
                        TikTok                      Meta（FB + IG）
─────────────────────────────────────────────────────────────────────
Token 交換              POST form-urlencoded          GET query string（也可 POST）
有 refresh_token？      ✅ 有（365 天）               ❌ 沒有
延長 token 方式         用 refresh_token              交換 long-lived token（60 天）
Long-lived 過期後？     用 refresh_token 換新          必須重新授權
一個 token 取多帳號？   否（一對一）                    是（User token → 可取所有管理的 Pages + IG）
```

### 9.2 Meta 授權後的多步驟 Token 處理

Meta 的 callback 比 TikTok 多了幾個步驟，因為一個 User Token 可以存取該用戶管理的所有 Facebook Pages 和 Instagram Professional 帳號：

```
callback 收到 code
    ↓
1. 用 code 換 short-lived access_token（1-2 小時）
    POST https://graph.facebook.com/v21.0/oauth/access_token
    ↓
2. 立即交換為 long-lived token（60 天）
    GET https://graph.facebook.com/v21.0/oauth/access_token
      ?grant_type=fb_exchange_token
      &client_id={app_id}
      &client_secret={app_secret}
      &fb_exchange_token={short_lived_token}
    ↓
3. 用 long-lived token 列出該用戶管理的所有 Pages
    GET /me/accounts → 回傳 [{ id, name, access_token（Page token）}, ...]
    ↓
4. 對每個 Page，取得其關聯的 Instagram Business 帳號
    GET /{page-id}?fields=instagram_business_account
    ↓
5. 儲存到 Supabase：
   - platform_tokens: user_id + platform='meta' + user-level long-lived token
   - 另外建立 account_configs: 每個 Page / IG 帳號各一筆
   - Dashboard 顯示「已找到 N 個 Facebook 頁面 + M 個 Instagram 帳號」
```

### 9.3 Meta Token 刷新策略

```
if (long-lived token 剩餘 < 7 天)
  → Dashboard 顯示「Meta 連結即將過期，請重新授權」
  → 用戶重新走 OAuth 流程

if (long-lived token 已過期)
  → 標記連線為 expired
  → 排程同步跳過此用戶的 Meta 帳號
  → 記錄錯誤：「Meta 授權已過期，請重新連結」
```

> 注意：Meta 沒有 refresh_token，所以無法靜默刷新。這是 Meta OAuth 設計的限制，所有使用 Meta API 的工具（Buffer、Hootsuite）都面臨同樣的問題，用戶必須每 60 天重新授權一次。

---

## 十、JavaScript → TypeScript 遷移評估

### 10.1 為什麼現在是 JavaScript？

`research.md` Decision 1 記錄了原始決策：

> *TypeScript: 型別更完整，但會增加 build/tsconfig/執行鏈設定成本。*

這在「從零快速落地 MVP」的情境下是合理的——先用最少的工具把核心流程跑通。但現在情境已經不同了。

### 10.2 為什麼現在應該換成 TypeScript？

| 因素 | 說明 |
|------|------|
| **你已經要大改了** | Supabase 遷移會重寫所有 repository + auth，與其改完再轉 TS，不如直接用 TS 寫新版 |
| **多租戶需要型別安全** | `user_id` 貫穿所有查詢，忘記加 `WHERE user_id = ...` 就是資料洩漏。TypeScript 的型別約束能在編譯期抓到 |
| **Supabase SDK 是 TS-first** | `@supabase/supabase-js` 提供完整型別推導，用 JS 等於放棄一半功能 |
| **OAuth token 結構複雜** | Meta/TikTok/Google 三套 token 格式不同，interface 定義能防止欄位搞混 |
| **團隊擴展** | 如果未來有其他人加入，TypeScript 就是活文件 |

### 10.3 現有程式碼規模

```
後端：55 個 .js 檔案，約 4,578 行
前端：31 個 .jsx/.js 檔案
測試：整合測試 + 單元測試
框架：Fastify 5 + React 18 + Vite 5
模組：ESM（已用 import/export）
```

### 10.4 遷移策略：完整遷移，不留 JavaScript

> **✅ 決策確認（2026-04-04）：執行完整的 TypeScript 遷移。**
> 專案擁有者確認願意投入時間，將所有 `.js` / `.jsx` 檔案全面轉換為 `.ts` / `.tsx`。
> 遷移完成後，專案不保留任何 JavaScript 原始碼。

**執行方式：先建基礎建設，再分層全面轉換**

```
Phase 0（0.5 天）：TypeScript 基礎建設
  ├─ 安裝 typescript、@types/node、tsx
  ├─ 建立 tsconfig.json（後端 + 前端各一份）
  ├─ 設定 Vite TypeScript 支援（前端本來就支援，幾乎零成本）
  ├─ 建立 types/ 目錄，定義所有核心 interface
  └─ 確認 npm run dev / npm run build 能跑

Phase 1（1 天）：核心層全面轉換
  ├─ lib/*.js → lib/*.ts（errors, logger, secret-box, http, fs-store）
  ├─ types/*.ts（Platform, Job, AccountConfig, PlatformToken, NormalizedRecord 等）
  └─ 這是其他所有檔案的型別基礎，必須先完成

Phase 2（1-1.5 天）：Repository + Service 層（與 Supabase 遷移同步）
  ├─ repositories/*.js → repositories/*.ts（底層同步換成 Supabase 查詢）
  ├─ services/*.js → services/*.ts
  └─ 每轉一個就跑測試確認

Phase 3（0.5-1 天）：Route + Adapter 層
  ├─ routes/*.js → routes/*.ts
  ├─ adapters/**/*.js → adapters/**/*.ts
  └─ 新增的 OAuth routes 直接用 TypeScript 撰寫

Phase 4（0.5 天）：前端
  ├─ frontend/src/**/*.jsx → *.tsx
  ├─ frontend/src/**/*.js → *.ts
  └─ Vite + React 對 TypeScript 原生支援，轉換成本最低

Phase 5（0.5 天）：收尾
  ├─ 測試檔案轉換（tests/**/*.test.js → *.test.ts）
  ├─ CLI 工具轉換（cli/*.js → cli/*.ts）
  ├─ 確認 tsconfig strict mode 全開，零 any 殘留
  └─ 移除所有 @ts-ignore / @ts-nocheck
```

### 10.5 時間成本估算

| 工作項目 | 時間 | 說明 |
|---------|------|------|
| tsconfig + 建置設定 | 2-3 小時 | 一次性，ESM 專案已滿足大部分條件 |
| 核心型別定義（types/） | 3-4 小時 | Token、Job、AccountConfig 等共用 interface |
| 後端 55 個檔案轉換 | 2-3 天 | 與 Supabase 遷移同步進行，不是純粹重新命名，而是加上完整型別 |
| 前端 31 個檔案轉換 | 0.5-1 天 | React + Vite 對 TS 支援成熟，轉換最順 |
| 測試 + CLI 轉換 | 0.5 天 | 測試檔案型別要求較鬆，可快速處理 |
| **合計** | **約 4-5 天**（與 Supabase 遷移重疊） | 不是額外 4-5 天，而是融入遷移週期 |

### 10.6 核心型別定義（預覽）

這些 interface 會在 Supabase 遷移時建立，所有 repository 和 service 共用：

```typescript
// types/platform.ts
export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'google';

export interface PlatformToken {
  id: string;
  userId: string;
  platform: Platform;
  accountId: string | null;
  accessToken: string;        // 加密後的值
  refreshToken: string | null; // TikTok、Google 有；Meta 無
  expiresAt: Date | null;
  scopes: string[];
  tokenMetadata: Record<string, unknown>;
}

// types/job.ts
export type JobStatus = 'queued' | 'running' | 'success' | 'error';
export type TriggerSource = 'scheduled' | 'manual';

export interface Job {
  id: string;
  userId: string;
  accountConfigId: string;
  triggerSource: TriggerSource;
  refreshDays: number;
  status: JobStatus;
  systemMessage: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

// types/account-config.ts
export interface AccountConfig {
  id: string;
  userId: string;
  clientName: string;
  platform: Platform;
  accountId: string;
  refreshDays: number;
  sheetId: string | null;
  sheetTab: string | null;
}

// types/adapter.ts
export interface PlatformAdapter {
  fetchAccountContent(params: {
    accountConfig: AccountConfig;
    refreshDays: number;
    now: Date;
    accessToken: string;  // 解密後的 token
  }): Promise<RawPlatformRecord[]>;
}
```

### 10.7 決策

> **✅ 確認（2026-04-04）：執行完整 TypeScript 遷移，遷移完成後不保留任何 .js 原始碼。**
> 與 Supabase 遷移同步進行，分層轉換（lib → types → repo → service → route → frontend → test）。
> 轉換完成後啟用 `strict: true`，確保型別安全覆蓋整個專案。

---

## 十一、Token 管理總覽（三平台比較）

| | TikTok | Meta（FB + IG） | Google（Sheet 整合） |
|---|---|---|---|
| Access Token 有效期 | 24 小時 | Short-lived: 1-2 小時 / Long-lived: 60 天 | 1 小時 |
| 有 Refresh Token？ | ✅（365 天） | ❌ | ✅（永久，除非撤銷） |
| 自動刷新可行？ | ✅ 完全自動 | ❌ 需用戶重新授權 | ✅ 完全自動 |
| 用戶多久需重新授權？ | 365 天 | 60 天 | 幾乎不需要 |
| Token 撤銷 API？ | ✅ | ✅ | ✅ |

**token-refresh-service 的排程建議**：

每次排程同步執行前（或每小時一次）掃描 `platform_tokens` 表：

```sql
-- 找出需要刷新的 TikTok token（過期前 1 小時）
SELECT * FROM platform_tokens
WHERE platform = 'tiktok'
  AND expires_at < now() + interval '1 hour'
  AND refresh_token IS NOT NULL;

-- 找出即將過期的 Meta token（過期前 7 天，提醒用戶）
SELECT * FROM platform_tokens
WHERE platform = 'meta'
  AND expires_at < now() + interval '7 days';

-- 找出需要刷新的 Google token（過期前 5 分鐘）
SELECT * FROM platform_tokens
WHERE platform = 'google'
  AND expires_at < now() + interval '5 minutes'
  AND refresh_token IS NOT NULL;
```

---

## 十二、遷移執行計畫

### Phase 0：Supabase 專案設置（0.5 天）
- [ ] 在 supabase.com 建立新專案
- [ ] 取得 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
- [ ] 安裝 Supabase CLI：`npm install -g supabase`
- [ ] 初始化：`supabase init`，建立 `supabase/migrations/` 目錄

### Phase 1：資料庫 Schema 建立（0.5 天）
- [ ] 撰寫 migration SQL（參考第四節 Schema）
- [ ] 執行 `supabase db push` 部署 Schema
- [ ] 在 Supabase Dashboard 確認資料表和 RLS 政策

### Phase 2：Repository 層替換（1-2 天）
- [ ] 建立 `lib/supabase-client.js`
- [ ] 逐一替換 repository：先換最簡單的（account-config, job），再換複雜的（raw-record, normalized-record）
- [ ] 每換一個就寫測試確認行為一致

### Phase 3：Auth 替換（0.5 天）
- [ ] 前端：接入 `@supabase/supabase-js`，用 `supabase.auth.signInWithPassword()`
- [ ] 後端：middleware 改為驗 Supabase JWT
- [ ] 移除舊有 session / password-reset 相關元件

### Phase 4：OAuth 整合（2 天）
- [ ] 建立 Meta OAuth routes（利用已建立的 platform_tokens 表）
- [ ] 建立 TikTok OAuth routes
- [ ] 替換 Fixture Adapter 為真實 Adapter

### Phase 5：部署（1 天）
- [ ] 設定環境變數（Supabase URL/Key + Meta/TikTok App 憑證）
- [ ] 選擇 Node.js 部署平台（Railway / Render / Fly.io 都與 Supabase 搭配良好）
- [ ] 設定 Supabase 連線 Pooler（生產環境用 PgBouncer）

---

## 十三、部署架構：自架主機（Linux + Docker）

> **決策確認（2026-04-04）：不使用雲端 PaaS，在自有 Linux 主機上部署全套服務。**

### 13.1 主機環境

| 項目 | 規格 |
|------|------|
| 作業系統 | Ubuntu / Debian（Linux） |
| 網路 | 固定 IP |
| 開發網路 | Tailscale（目前開發用，正式環境改走固定 IP + 域名） |

### 13.2 服務架構

```
                  Internet
                     │
              ┌──────▼──────┐
              │  Cloudflare  │  ← DNS + SSL 終止 + DDoS 防護 + WAF
              │  (Proxy 模式) │
              └──────┬──────┘
                     │ HTTPS（Cloudflare → 你的主機，走 Origin Certificate）
                     │
            ┌────────▼────────┐
            │   Caddy / Nginx  │  ← 反向代理，HTTPS 終止（backup）
            │   Port 443/80    │     路由分流：
            │                  │     /  → frontend (static)
            │                  │     /api/* → Node.js backend
            │                  │     /supabase/* → Supabase Studio（可選）
            └───┬────────┬────┘
                │        │
     ┌──────────▼──┐  ┌──▼──────────────────────────┐
     │  Node.js     │  │  Docker: Supabase 自架       │
     │  Backend     │  │  ├─ PostgreSQL (port 5432)   │
     │  (port 3000) │  │  ├─ Auth (GoTrue)           │
     │              │  │  ├─ REST (PostgREST)        │
     │              │  │  ├─ Realtime                │
     │              │  │  └─ Studio Dashboard        │
     └──────────────┘  └─────────────────────────────┘
```

### 13.3 Docker Compose 架構

```yaml
# docker-compose.yml 概要
services:
  # ── Supabase 核心 ──────────────────────
  supabase-db:
    image: supabase/postgres:15
    ports: ["5432:5432"]           # 只綁 127.0.0.1，不暴露到外網
    volumes: ["./volumes/db:/var/lib/postgresql/data"]

  supabase-auth:
    image: supabase/gotrue:latest
    depends_on: [supabase-db]

  supabase-rest:
    image: postgrest/postgrest:latest
    depends_on: [supabase-db]

  supabase-studio:                 # 可選，管理用 Dashboard
    image: supabase/studio:latest
    ports: ["127.0.0.1:3100:3000"] # 只綁 localhost

  # ── 應用服務 ────────────────────────────
  backend:
    build: ./backend
    ports: ["127.0.0.1:3000:3000"]
    env_file: .env
    depends_on: [supabase-db, supabase-auth]

  # ── 反向代理 ────────────────────────────
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile"]
```

> 關鍵原則：**只有 Caddy（反向代理）暴露 80/443 到外網**。所有其他服務都綁 `127.0.0.1`。

### 13.4 為什麼推薦 Caddy 而不是 Nginx？

| | Caddy | Nginx |
|---|---|---|
| 自動 HTTPS | ✅ 自動申請 Let's Encrypt | 需手動設定 certbot |
| 設定複雜度 | 極簡（5 行搞定） | 較冗長 |
| 反向代理 | 內建 | 內建 |
| 效能 | 足夠（中小流量） | 更高（大流量） |

```
# Caddyfile（完整設定，只有 5 行）
datatsukiyo.org {
    handle /api/* {
        reverse_proxy localhost:3000
    }
    handle {
        root * /srv/frontend/dist
        file_server
    }
}
```

---

## 十四、域名與 Cloudflare 設定

### 14.1 為什麼一定要買域名？

| 原因 | 說明 |
|------|------|
| OAuth 需求 | Meta 和 TikTok App Review 都要求正式域名，不接受 IP 或 Tailscale subdomain |
| HTTPS | Cloudflare 免費提供 SSL 證書，綁域名才能用 |
| 信任感 | 用戶看到 `https://datahub.yourbrand.com`，比看到 `http://123.45.67.89:3000` 更願意授權 |
| 未來擴展 | 換主機只要改 DNS，不用改所有 OAuth redirect URI |

### 14.2 推薦方案：買域名 + Cloudflare（免費方案）

```
花費：
├─ 域名：~$10-15/年（Namecheap、Cloudflare Registrar、GoDaddy）
└─ Cloudflare：$0（免費方案就夠用）

你得到：
├─ DNS 代管
├─ 免費 SSL/TLS（Full Strict 模式）
├─ DDoS 防護（自動）
├─ WAF 基礎規則（免費方案含 Managed Ruleset）
├─ Rate Limiting（免費方案含基礎規則）
├─ 隱藏真實 IP（Proxy 模式下，攻擊者看不到你的固定 IP）
└─ CDN 快取（前端靜態資源自動加速）
```

### 14.3 設定步驟

```
1. 買域名（推薦直接在 Cloudflare Registrar 買，省去 DNS 轉移）
2. 在 Cloudflare 加入你的域名
3. 設定 DNS Record：
   Type: A
   Name: @（或 datahub）
   Content: 你的固定 IP
   Proxy: ✅ 開啟（橘色雲朵）← 關鍵！這會隱藏你的真實 IP

4. SSL/TLS 設定：
   模式：Full (Strict)
   → Cloudflare ↔ 你的主機之間也走 HTTPS
   → 在主機上用 Cloudflare Origin Certificate（15 年免費）

5. 更新所有 OAuth Redirect URI：
   Meta:   https://datatsukiyo.org/api/oauth/meta/callback
   TikTok: https://datatsukiyo.org/api/oauth/tiktok/callback
   Google: https://datatsukiyo.org/api/oauth/google/callback
```

### 14.4 Tailscale 的定位

| 用途 | 工具 |
|------|------|
| **正式環境（用戶存取）** | 域名 + Cloudflare + 固定 IP |
| **開發 / 遠端管理** | Tailscale（SSH 進主機、存取 Supabase Studio） |
| **緊急備用** | Tailscale Funnel（主域名出問題時臨時用） |

Tailscale 不退場，但角色從「對外入口」變成「內部管理通道」。

---

## 十五、網路安全與資訊安全防禦

### 15.1 防禦架構總覽

```
威脅來源（Internet）
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ Layer 1: Cloudflare（邊緣防禦）                        │
│  ├─ DDoS 自動緩解（L3/L4/L7）                         │
│  ├─ WAF Managed Ruleset（OWASP Top 10）              │
│  ├─ Rate Limiting（API 限流）                         │
│  ├─ Bot Management（基礎版，免費方案含）               │
│  └─ 真實 IP 隱藏（Proxy 模式）                        │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ Layer 2: 主機防火牆（ufw / iptables）                  │
│  ├─ 只開放 80、443（僅接受 Cloudflare IP 範圍）        │
│  ├─ SSH 只允許 Tailscale 網段                         │
│  └─ 其他所有 port 預設 DROP                           │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ Layer 3: 反向代理（Caddy）                             │
│  ├─ TLS 終止 + HSTS                                  │
│  ├─ 只轉發到 localhost 服務                            │
│  └─ Request header 清洗                               │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ Layer 4: 應用層（Node.js Backend）                     │
│  ├─ Supabase Auth JWT 驗證                            │
│  ├─ CORS 白名單（只允許你的域名）                      │
│  ├─ Rate Limiting（fastify-rate-limit，應用層二次限流）│
│  ├─ Input Validation（Zod / AJV）                    │
│  ├─ HMAC 簽章驗證（Apps Script 請求）                 │
│  └─ CSP / X-Frame-Options / X-Content-Type-Options   │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ Layer 5: 資料層（Supabase / PostgreSQL）               │
│  ├─ Row Level Security（多租戶隔離）                   │
│  ├─ Token 應用層加密（secret-box AES-256-GCM）        │
│  ├─ 資料庫連線只綁 127.0.0.1                          │
│  └─ 定期自動備份                                      │
└──────────────────────────────────────────────────────┘
```

### 15.2 主機加固 Checklist

```bash
# ── 防火牆（ufw）──────────────────────
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 173.245.48.0/20 to any port 443  # Cloudflare IP 範圍
sudo ufw allow from 103.21.244.0/22 to any port 443
sudo ufw allow from 103.22.200.0/22 to any port 443
sudo ufw allow from 103.31.4.0/22 to any port 443
sudo ufw allow from 141.101.64.0/18 to any port 443
sudo ufw allow from 108.162.192.0/18 to any port 443
sudo ufw allow from 190.93.240.0/20 to any port 443
sudo ufw allow from 188.114.96.0/20 to any port 443
sudo ufw allow from 197.234.240.0/22 to any port 443
sudo ufw allow from 198.41.128.0/17 to any port 443
sudo ufw allow from 162.158.0.0/15 to any port 443
sudo ufw allow from 104.16.0.0/13 to any port 443
sudo ufw allow from 104.24.0.0/14 to any port 443
sudo ufw allow from 172.64.0.0/13 to any port 443
sudo ufw allow from 131.0.72.0/22 to any port 443
# SSH 只走 Tailscale
sudo ufw allow in on tailscale0 to any port 22
sudo ufw enable

# ── SSH 加固 ──────────────────────────
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no          # 只用 SSH key
PubkeyAuthentication yes
MaxAuthTries 3
AllowUsers your-username

# ── 自動安全更新 ─────────────────────
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# ── fail2ban（防暴力破解）────────────
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 15.3 應用層安全設定

**CORS 設定**（只允許你的域名）：
```typescript
// Fastify CORS 設定
app.register(cors, {
  origin: [
    'https://datatsukiyo.org',
    'https://www.datatsukiyo.org',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
```

**Security Headers**（Caddy 或 Fastify 層加）：
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0                          # 已棄用，用 CSP 取代
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Rate Limiting（應用層二次防護）**：
```typescript
// 即使 Cloudflare 已有 rate limit，應用層也要加
app.register(import('@fastify/rate-limit'), {
  global: true,
  max: 100,            // 每個 IP 每分鐘 100 次
  timeWindow: '1 minute',
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
});

// OAuth callback 更嚴格
app.register(import('@fastify/rate-limit'), {
  max: 10,             // 每個 IP 每分鐘 10 次
  timeWindow: '1 minute',
  routeConfig: { rateLimit: { prefix: '/api/oauth/' } },
});
```

### 15.4 Token 與機密管理

| 機密 | 儲存方式 | 存取控制 |
|------|---------|---------|
| 用戶的平台 Token | `platform_tokens` 表 + AES-256-GCM 加密 | RLS（只有 token 擁有者） |
| Meta App Secret | `.env` 檔案 | 主機 filesystem 權限 600 |
| TikTok Client Secret | `.env` 檔案 | 主機 filesystem 權限 600 |
| Supabase Service Role Key | `.env` 檔案 | 絕不暴露給前端 |
| TOKEN_ENCRYPTION_SECRET | `.env` 檔案 | 加密所有 token 的主金鑰 |

```bash
# .env 檔案權限
chmod 600 .env
chown your-username:your-username .env

# 絕不把 .env 加入 git
echo ".env" >> .gitignore
```

**金鑰輪替策略**：
- `TOKEN_ENCRYPTION_SECRET` 變更時，需要解密所有 token 後用新 key 重新加密（寫一次性 migration script）
- Meta / TikTok App Secret 變更時，只需更新 `.env` 並重啟服務
- Supabase JWT Secret 變更需同步更新所有 client

### 15.5 PostgreSQL 安全

```sql
-- 只允許本地連線（在 docker-compose 已綁 127.0.0.1）
-- 額外在 pg_hba.conf 加強：
-- host all all 0.0.0.0/0 reject
-- host all all 127.0.0.1/32 scram-sha-256

-- 定期備份（加入 crontab）
-- 0 3 * * * docker exec supabase-db pg_dump -U postgres > /backup/db-$(date +\%Y\%m\%d).sql
```

### 15.6 備份策略

| 備份項目 | 頻率 | 保留 | 方式 |
|---------|------|------|------|
| PostgreSQL 完整備份 | 每日凌晨 3 點 | 30 天 | `pg_dump` → 本地 + 異地一份 |
| `.env` + Docker 設定 | 每次變更時 | 永久 | 手動複製到安全位置（不放 git） |
| Docker volumes | 每週 | 4 週 | `tar` 打包 |
| Caddy 設定 | 每次變更時 | Git 管理 | 可進 repo（無機密） |

### 15.7 監控與告警

```bash
# ── 基礎監控：安裝 Prometheus + Node Exporter（可選）──
# 或用更輕量的方案：

# 1. 系統資源監控
sudo apt install htop iotop

# 2. Docker 容器監控
docker stats --no-stream  # 手動查看
# 或安裝 ctop: https://github.com/bcicen/ctop

# 3. 日誌集中管理
# Node.js 的 logger.js 已輸出結構化 JSON log
# 搭配 journalctl 或 Docker logs 即可查看：
docker logs -f backend --since 1h

# 4. 簡易告警（推薦：UptimeRobot 免費版）
#    監控 https://datatsukiyo.org/api/health
#    每 5 分鐘檢查，失敗就發 email / Telegram 通知
```

### 15.8 安全 Checklist 總覽

| 類別 | 項目 | 狀態 |
|------|------|------|
| **網路** | Cloudflare Proxy 模式（隱藏真實 IP） | ☐ |
| | ufw 只開 443，限 Cloudflare IP 範圍 | ☐ |
| | SSH 只走 Tailscale | ☐ |
| **TLS** | Cloudflare SSL Full (Strict) | ☐ |
| | Origin Certificate 安裝到主機 | ☐ |
| | HSTS 啟用 | ☐ |
| **應用** | CORS 白名單設定 | ☐ |
| | Security Headers 完整 | ☐ |
| | Rate Limiting（Cloudflare + 應用層雙重） | ☐ |
| | Input Validation（所有 API 端點） | ☐ |
| **認證** | Supabase Auth JWT 驗證 | ☐ |
| | OAuth state 防 CSRF | ☐ |
| | HMAC timestamp 防重放（±5 分鐘） | ☐ |
| **資料** | RLS 啟用（所有資料表） | ☐ |
| | Token AES-256-GCM 加密 | ☐ |
| | PostgreSQL 只綁 127.0.0.1 | ☐ |
| | `.env` 權限 600 | ☐ |
| **運維** | 自動安全更新（unattended-upgrades） | ☐ |
| | fail2ban 啟用 | ☐ |
| | 每日資料庫備份 | ☐ |
| | Health check 監控（UptimeRobot） | ☐ |
| **機密** | TikTok Client Secret 從原始碼移除 | ☐ |
| | 所有機密只存在 `.env`，不進 git | ☐ |

---

## 十六、未解決的問題（需後續決策）

1. **Google Sheet 整合**：目前有 `google-oauth-service.js`，在遷移後應繼續保留，但 Google token 也要改存入 `platform_tokens` 表。

2. **排程觸發機制**：現有的 `scheduler-service.js` 需要長駐進程（interval-based）。如果部署到 Serverless 環境，需要改用 Supabase Edge Functions + pg_cron，或外部 cron 服務（如 Render Cron Jobs）。

3. **Meta App Review 進度**：正式多租戶（服務非開發者用戶）前，必須完成 Meta App Review。未通過前，只有列為測試用戶的帳號能授權。

4. **資料遷移**：若現有系統已有真實資料（JSON 檔案中），需要一次性遷移腳本把 JSON 資料寫入 Supabase。

---

## 附錄：關鍵環境變數清單

> **正式域名**：`datatsukiyo.org`（已申請，2026-04-04 確認）
> 所有 OAuth Redirect URI、CORS 白名單、Cloudflare DNS 設定皆以此域名為基準。

```env
# ── 應用基本設定 ────────────────────────────
APP_DOMAIN=datatsukiyo.org
APP_BASE_URL=https://datatsukiyo.org
APP_ENV=production                            # production / development

# ── Supabase（自架，Docker Compose）────────
SUPABASE_URL=https://datatsukiyo.org/supabase   # 或內部 http://supabase-kong:8000
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # ← 後端專用，勿暴露給前端
SUPABASE_JWT_SECRET=                          # 自架 Supabase 的 JWT secret

# PostgreSQL 直連（後端 repository 層用）
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/postgres

# ── Meta（Facebook + Instagram）─────────────
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=https://datatsukiyo.org/api/oauth/meta/callback

# ── TikTok ─────────────────────────────────
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=                         # ← 請於 TikTok Developer Console 重新產生
TIKTOK_REDIRECT_URI=https://datatsukiyo.org/api/oauth/tiktok/callback

# ── Google（Sheet 整合，現有）────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_LOGIN_REDIRECT_URI=https://datatsukiyo.org/api/oauth/google/callback

# ── 加密與簽章 ──────────────────────────────
TOKEN_ENCRYPTION_SECRET=                      # AES-256-GCM 金鑰，高強度隨機字串
API_SHARED_SECRET=                            # HMAC 驗證用（Apps Script 請求）

# ── CORS 白名單 ────────────────────────────
CORS_ALLOWED_ORIGINS=https://datatsukiyo.org,https://www.datatsukiyo.org

# ── Feature Flags ─────────────────────────
USE_REAL_META_API=true
USE_REAL_TIKTOK_API=true
USE_REAL_GOOGLE_SHEET=true
```

### 對應需同步更新的外部設定

| 項目 | 設定位置 | 值 |
|------|---------|----|
| Cloudflare DNS A Record | Cloudflare Dashboard | `datatsukiyo.org` → 固定 IP（Proxy 開啟） |
| Cloudflare DNS A Record | Cloudflare Dashboard | `www.datatsukiyo.org` → 固定 IP（Proxy 開啟） |
| Cloudflare SSL/TLS | Cloudflare Dashboard | Full (Strict) |
| Caddy 反向代理 | `/etc/caddy/Caddyfile` | `datatsukiyo.org { ... }` |
| Meta App Redirect URI | developers.facebook.com | `https://datatsukiyo.org/api/oauth/meta/callback` |
| TikTok App Redirect URI | developers.tiktok.com | `https://datatsukiyo.org/api/oauth/tiktok/callback` |
| TikTok 域名驗證 | `https://datatsukiyo.org/tiktok{verify-code}.txt` | 沿用既有驗證檔 |
| Google Cloud Console | console.cloud.google.com | Authorized redirect URIs 加入正式域名 |
