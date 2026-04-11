# Tsukiyo_Data Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-19

## Active Technologies

- Backend: Node.js 24, ESM JavaScript, Fastify, `@fastify/cors`, Node 標準函式庫 (`crypto`, `fs/promises`, `timers`, `node:test`)
- Frontend: React 18 + Vite 5 + Vitest
- Storage: file-backed JSON store（目前位於 `backend/data/`）

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

- 啟動後端：`npm start`
- 本機後端開發：`npm run dev:backend`
- 本機前端開發：`npm run dev:frontend`
- 建置前端：`npm run build:frontend`
- 執行後端測試：`npm run test:backend`
- 執行前端測試：`npm run test:frontend`
- 執行完整測試：`npm test`
- 建立示範資料：`npm run seed`
- 產生 HMAC 簽章：`npm run sign`

## Code Style

Node.js 24, ESM JavaScript: Follow standard conventions

## Recent Changes

- 001-social-data-hub: 建立社群資料中台、排程同步、手動刷新、HMAC 保護與 Google Sheet bridge 模擬流程
- 002-user-auth: 新增 Web Dashboard 的登入/註冊、管理員核准、HttpOnly session 與忘記密碼流程
- 2026-03-19: 完成前後端分離 migration，前端維持 React + Vite，後端改為 Fastify，後端不再提供前端靜態資產

<!-- MANUAL ADDITIONS START -->
## Branch Naming

- 功能開發分支一律使用 GitHub 慣例命名，採 `feat/*` 形式，例如 `feat/user-auth`。
- 修復類型分支應使用 `fix/*`，文件類型分支應使用 `docs/*`；避免再使用無前綴的自訂命名。

## Backend Structure

- 所有後端程式碼放在 `backend/src/`。
- 後端資料與 fixtures 放在 `backend/data/`、`backend/fixtures/`。
- 後端目前採 Fastify 作為 HTTP 層；新增 route、middleware、CORS、cookie/session 行為時，優先沿用 Fastify 的方式擴充。
- 後端不再負責提供 `frontend/dist`，僅提供 API。

## Frontend Structure

- 所有前端原始碼放在 `frontend/src/`，Vite 設定放在 `frontend/vite.config.js`。
- 前端應透過 `VITE_API_BASE_URL` 或 Vite proxy 連接後端 API，不得再依賴後端同站提供靜態資產。

## Frontend Security Boundary

- Frontend 僅作為受限操作與展示介面，不得保存任何第三方平台 access token 或 refresh token。
- Frontend 不得直接呼叫 Instagram、Facebook、TikTok 或其他第三方平台 API；所有外部 API 存取必須經由 Server 控制。
- Frontend 不得直接決定最終資料寫入結果；資料驗證、標準化、寫入與最終狀態裁決必須由 Server 完成。
<!-- MANUAL ADDITIONS END -->
