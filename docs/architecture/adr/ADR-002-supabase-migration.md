# ADR-002:後端全面遷移至 Supabase

**狀態**:Accepted
**日期**:2026-04-04
**決策者**:專案擁有者

---

## 背景

原系統以 JSON 檔案儲存(`fs-store.js`)、自建 Auth(session + bcrypt)、無多租戶隔離。這種設計在 MVP 階段很快,但在進入 OAuth 多租戶模式後(見 [ADR-001](ADR-001-oauth-multitenant.md))遇到多個根本性問題。

## 決策

**汰換整個後端儲存與認證層,全面遷移至 Supabase**,包含:

- PostgreSQL 取代 JSON 檔案
- Supabase Auth(GoTrue)取代自建的 session 驗證
- Row Level Security(RLS)作為多租戶隔離的第一道防線
- 應用層 AES-256-GCM 加密(沿用 `secret-box.js`)作為 token 的第二道保護

## 現有系統的限制

| 現有設計 | 問題 |
|---------|------|
| JSON 檔案儲存 | 無法多台伺服器同時讀寫;無法查詢過濾;檔案大了就慢 |
| 自建 Auth(session + bcrypt) | 需自己維護安全性;沒有 OAuth 登入(Google/GitHub);沒有 email 驗證 |
| 本地檔案部署 | 換機器就要搬資料;無法水平擴展 |
| 無多租戶隔離 | 目前設計假設單一用戶或信任的內部系統 |

## Supabase 解決的問題

| Supabase 功能 | 替換的現有元件 | 效益 |
|-------------|-------------|------|
| PostgreSQL 資料庫 | `fs-store.js` + 所有 JSON 檔案 | 可查詢、可索引、concurrent-safe |
| Supabase Auth | `user-auth-service.js`、`session-repository.js`、`password-reset-service.js` | 內建 email/password、Google 登入、JWT session |
| Row Level Security(RLS) | 無(目前沒有多租戶隔離) | 每個用戶只能存取自己的資料,從資料庫層保障 |
| Supabase Vault 或加密欄位 | `secret-box.js` + 手動加密 | 平台 token 的安全儲存 |
| 雲端/自架一致 | 本機 JSON 檔案 | 任何地方部署都能連到同一個資料庫 |

## 考慮過的選項

### 選項 A:繼續 JSON 檔案 + 自建 Auth ❌
- **優點**:零遷移成本。
- **缺點**:無法支援多租戶(無 RLS)、無法水平擴展、安全性需自行維護。
- **結論**:與 [ADR-001](ADR-001-oauth-multitenant.md) 的 OAuth 多租戶模式根本不相容。

### 選項 B:PostgreSQL + 自建 Auth ❌
- **優點**:完全掌控。
- **缺點**:自建 Auth 要做的事太多(JWT、密碼重設、email 驗證、OAuth 登入),重複造輪子。
- **結論**:工作量與 Supabase 差距太大。

### 選項 C:Supabase(Hosted 或 Self-hosted)✅
- **優點**:PostgreSQL + Auth + RLS 一次到位;SDK TypeScript-first;可自架。
- **缺點**:學習曲線;需學會 RLS。
- **結論**:採用。自架版本見 [ADR-004](ADR-004-self-hosted-deployment.md)。

## 後果

### 保留的現有元件

| 現有元件 | 狀態 |
|---------|------|
| `lib/secret-box.js` | 保留,仍負責 token 應用層加密 |
| `lib/errors.js` | 保留 |
| `lib/logger.js` | 保留 |
| `services/normalization-service.js` | 保留(與儲存層無關) |
| `services/job-queue.js` | 保留(記憶體 queue) |
| `services/scheduler-service.js` | 保留 |
| `services/refresh-orchestrator.js` | 保留 |
| `adapters/platforms/` | 保留介面,但 fixture 會被替換 |

### 需要重寫的元件

| 現有元件 | 替換方案 |
|---------|---------|
| `lib/fs-store.js` | Supabase client wrapper |
| `repositories/*.js` | 底層改為 Supabase 查詢(介面不變) |
| `services/user-auth-service.js` | Supabase Auth SDK |
| `services/user-auth-validation-service.js` | Supabase JWT 驗證 |
| `services/password-reset-service.js` | Supabase 內建 `resetPasswordForEmail` |
| `repositories/session-repository.js` | 移除(Supabase 管理 session) |
| `repositories/user-repository.js` | 簡化為 `auth.users` reference |

### Auth 流程的改變

**現在(自建 Auth)**:
```
用戶送帳密 → bcrypt 比對 → 建立 session token → 存入 sessions.json → 回傳 cookie
```

**遷移後(Supabase Auth)**:
```
用戶送帳密 → Supabase Auth 驗證 → 發回 JWT(access + refresh)
→ 前端存入 localStorage(Supabase SDK 自動管理)
→ 後端 API 驗證 JWT(用 Supabase Admin SDK 或 JWT secret 直接驗)
```

Middleware 範例見 [Technical Spec:Database Schema](../technical-spec/database-schema.md#auth-middleware)。

## 相關文件

- [ADR-001:OAuth 多租戶模式](ADR-001-oauth-multitenant.md)
- [ADR-004:自架部署](ADR-004-self-hosted-deployment.md)(自架 Supabase)
- [Technical Spec:Database Schema](../technical-spec/database-schema.md)
- [Migration Plan](../migration-plan.md)
