# Migration Plan:從 JSON 儲存 + JavaScript → Supabase + TypeScript

**目的**:把遷移拆成可執行、可驗收的 Phase,讓 Coding Agent 能按部就班推進,不遺漏步驟。

**相關 ADR**:
- [ADR-002:Supabase 遷移](adr/ADR-002-supabase-migration.md)
- [ADR-003:TypeScript 全面遷移](adr/ADR-003-typescript-full-migration.md)

**相關文件**:
- [Database Schema](technical-spec/database-schema.md)
- [TypeScript Types](technical-spec/typescript-types.md)
- [OAuth Flows](technical-spec/oauth-flows.md)

---

## 總覽:Phase 與時程

| Phase | 主題 | 工時 |
|-------|------|------|
| Phase 0 | 基礎建設(Supabase 專案 + TypeScript 設定) | 1 天 |
| Phase 1 | 資料庫 Schema + 核心型別 | 1 天 |
| Phase 2 | Repository + Service 層(同步 TS + Supabase) | 2 天 |
| Phase 3 | Auth 遷移(自建 → Supabase Auth) | 0.5 天 |
| Phase 4 | OAuth 整合(Meta + TikTok + 真實 Adapter) | 2 天 |
| Phase 5 | 前端 TS 轉換 + 測試 + CLI 收尾 | 1 天 |
| Phase 6 | 部署 + 端到端測試 | 1 天 |
| **合計** | | **約 8.5 天** |

> TypeScript 遷移(ADR-003)**與 Supabase 遷移同步進行**,不是額外時間。

---

## Phase 0:基礎建設(1 天)

### 0.1 Supabase 專案設定(自架)

- [ ] 在主機安裝 Docker + Docker Compose
- [ ] 取得 Supabase self-hosting `docker-compose.yml`(https://supabase.com/docs/guides/self-hosting/docker)
- [ ] 設定 `.env`:產生 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_JWT_SECRET`、`DATABASE_URL`
- [ ] `docker compose up -d`,確認 Supabase Studio 可開(透過 Tailscale 或 `127.0.0.1:3100`)
- [ ] 安裝 Supabase CLI:`npm install -g supabase`
- [ ] 專案初始化:`supabase init`,建立 `supabase/migrations/` 目錄

### 0.2 TypeScript 基礎建設

- [ ] 後端:安裝 `typescript`、`@types/node`、`tsx`
- [ ] 建立 `backend/tsconfig.json`(strict 設定見 [typescript-types.md](technical-spec/typescript-types.md))
- [ ] 建立 `backend/src/types/` 目錄
- [ ] 前端:Vite 5 原生支援 TS,確認 `frontend/tsconfig.json` 存在
- [ ] 驗證:`npm run dev` 與 `npm run build` 能跑

**驗收**:Supabase Studio 可開;後端與前端的 TypeScript 環境可跑 `dev` 與 `build`。

---

## Phase 1:資料庫 Schema + 核心型別(1 天)

### 1.1 撰寫 Migration SQL

依照 [database-schema.md](technical-spec/database-schema.md),建立 `supabase/migrations/0001_init.sql`:

- [ ] `account_configs`
- [ ] `platform_tokens`
- [ ] `jobs`
- [ ] `raw_records`
- [ ] `normalized_records`
- [ ] `sheet_snapshots`
- [ ] `oauth_states`(新表,CSRF 防護用,詳見 oauth-flows.md)
- [ ] 所有表啟用 RLS 與 policy

### 1.2 執行 Migration

- [ ] `supabase db push`
- [ ] 在 Supabase Studio 確認所有資料表與 RLS 都已建立

### 1.3 核心型別定義

依照 [typescript-types.md](technical-spec/typescript-types.md),建立:

- [ ] `types/platform.ts`
- [ ] `types/job.ts`
- [ ] `types/account-config.ts`
- [ ] `types/adapter.ts`
- [ ] `types/normalized.ts`
- [ ] `types/index.ts`(re-export)

### 1.4 `lib/` 層 TypeScript 轉換

- [ ] `lib/errors.js` → `lib/errors.ts`
- [ ] `lib/logger.js` → `lib/logger.ts`
- [ ] `lib/secret-box.js` → `lib/secret-box.ts`
- [ ] `lib/http.js` → `lib/http.ts`
- [ ] 建立新的 `lib/supabase-client.ts`(server 端 Supabase client)
- [ ] 移除 `lib/fs-store.js`(不再需要)

**驗收**:資料庫 schema 在 Supabase 中正確建立,RLS 啟用;後端核心 `lib/` 全部為 `.ts`。

---

## Phase 2:Repository + Service 層(2 天)

> 原則:**先轉 TypeScript,再把底層從 JSON 檔案換成 Supabase**。同一個檔案一次完成。

### 2.1 Repository 層(依複雜度由簡到繁)

- [ ] `repositories/account-config-repository.ts`
- [ ] `repositories/job-repository.ts`
- [ ] `repositories/raw-record-repository.ts`
- [ ] `repositories/normalized-record-repository.ts`
- [ ] `repositories/sheet-snapshot-repository.ts`
- [ ] `repositories/platform-token-repository.ts`(新,取代各 `*-connection-repository`)
- [ ] `repositories/oauth-state-repository.ts`(新,CSRF state)
- [ ] 移除 `repositories/session-repository.js`(Supabase Auth 管理)
- [ ] `repositories/user-repository.ts` 改為對 `auth.users` 的唯讀 wrapper

> Repository 方法**必須**在簽名中接 `userId: string`(見 typescript-types.md 的型別約束)。

### 2.2 Service 層

- [ ] `services/normalization-service.ts`
- [ ] `services/job-queue.ts`
- [ ] `services/scheduler-service.ts`
- [ ] `services/refresh-orchestrator.ts`
- [ ] 新建 `services/meta-oauth-service.ts`
- [ ] 新建 `services/tiktok-oauth-service.ts`
- [ ] 新建 `services/token-refresh-service.ts`

**驗收**:所有 repository 可通過單元測試,且無任何 `any`。

---

## Phase 3:Auth 遷移(0.5 天)

### 3.1 前端

- [ ] 安裝 `@supabase/supabase-js`
- [ ] 用 `supabase.auth.signInWithPassword()` 取代原登入 API
- [ ] JWT 由 SDK 自動管理

### 3.2 後端

- [ ] 撰寫新的 Fastify middleware `requireAuth`(見 database-schema.md 的 Auth Middleware 範例)
- [ ] 移除舊 session 驗證、password-reset 相關路由(改用 Supabase `resetPasswordForEmail`)
- [ ] 更新所有 route 掛上新 middleware

**驗收**:用 Supabase Auth 登入後,可透過 JWT 存取所有 `/api/*`;舊 session 程式碼完全移除。

---

## Phase 4:OAuth 整合(2 天)

### 4.1 Meta OAuth

- [ ] `routes/meta-oauth-routes.ts`(authorize + callback)
- [ ] `services/meta-oauth-service.ts`:code → short-lived → long-lived → Pages list → IG business accounts
- [ ] `adapters/platforms/real-instagram-adapter.ts`(Instagram Graph API)
- [ ] `adapters/platforms/real-facebook-adapter.ts`(Facebook Pages API)

### 4.2 TikTok OAuth(必須為 Node.js/TypeScript,不引入 Python)

- [ ] `routes/tiktok-oauth-routes.ts`
- [ ] `services/tiktok-oauth-service.ts`(對照 `server.py` 已驗證的流程,改寫為 TS)
- [ ] `adapters/platforms/real-tiktok-adapter.ts`(`/v2/video/list/`)

### 4.3 Token 刷新

- [ ] `services/token-refresh-service.ts`:
  - TikTok 過期前 1 小時自動刷新
  - Meta 剩餘 < 7 天在 Dashboard 顯示警告
  - Google 過期前 5 分鐘刷新

### 4.4 Platform Registry Feature Flag

- [ ] 更新 `platform-registry.ts`:`USE_REAL_META_API` / `USE_REAL_TIKTOK_API` 為 true 時注入 real adapter

**驗收**:用測試帳號可完整走完 Meta 與 TikTok 授權,token 落入 `platform_tokens`(加密),Adapter 能抓到真實資料。

---

## Phase 5:前端 TS + 測試 + CLI 收尾(1 天)

- [ ] `frontend/src/**/*.jsx` → `*.tsx`
- [ ] `frontend/src/**/*.js` → `*.ts`
- [ ] 在 Dashboard 加入「連結 Instagram / Facebook / TikTok」按鈕
- [ ] 在 Dashboard 顯示平台連線狀態(正常 / 即將過期 / 已過期)
- [ ] 測試檔案:`tests/**/*.test.js` → `*.test.ts`
- [ ] CLI 工具:`cli/*.js` → `cli/*.ts`
- [ ] `tsconfig strict: true` 全開,零 `any` / `@ts-ignore`

**驗收**:`git ls-files | grep -E '\.(js|jsx)$'` 只剩 config 類檔案(如 `vite.config` 等),無業務邏輯 JS。

---

## Phase 6:部署 + 端到端測試(1 天)

- [ ] 主機加固(ufw、SSH、fail2ban,見 [Security Playbook](security-playbook.md))
- [ ] Cloudflare 設定(DNS、Proxy、SSL Full Strict、Origin Certificate)
- [ ] Caddyfile 部署(見 [deployment-infrastructure.md](technical-spec/deployment-infrastructure.md))
- [ ] 更新三個平台 Developer Console 的 Redirect URI 為 `datatsukiyo.org`
- [ ] 端到端測試:
  - [ ] 註冊新用戶(Supabase Auth)
  - [ ] 連結 Instagram → 授權成功 → token 加密儲存
  - [ ] 連結 TikTok → 授權成功
  - [ ] 手動觸發排程同步 → 資料落入 `normalized_records`
  - [ ] Google Sheet 更新成功
  - [ ] 模擬 token 過期 → 自動刷新(TikTok)或顯示警告(Meta)

**驗收**:從 `https://datatsukiyo.org` 可以完成完整使用者旅程;Security Playbook 的 Checklist 全部勾選。

---

## 資料遷移(若現行系統已有真實資料)

若既有 `data/*.json` 已有真實資料,需要一次性腳本:

1. 讀取所有 JSON 檔案
2. 建立或對應 `auth.users`(可能需要重新邀請用戶重設密碼)
3. 把 `account_configs`、`platform_tokens`(重新加密)、`jobs`、`normalized_records` 逐筆 INSERT

此步驟若需要,列為 Phase 6 之後的補充工作。
