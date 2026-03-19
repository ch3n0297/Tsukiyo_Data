# Social-Media-Fetcher_spec-kit Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-18

## Active Technologies

- Node.js 24, ESM JavaScript + 無外部 runtime dependency，使用 Node 標準函式庫 (`http`, `crypto`, `fs/promises`, `timers`, `node:test`) (001-social-data-hub)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

# Add commands for Node.js 24, ESM JavaScript

## Code Style

Node.js 24, ESM JavaScript: Follow standard conventions

## Recent Changes

- 001-social-data-hub: Added Node.js 24, ESM JavaScript + 無外部 runtime dependency，使用 Node 標準函式庫 (`http`, `crypto`, `fs/promises`, `timers`, `node:test`)

<!-- MANUAL ADDITIONS START -->
## Branch Naming

- 功能開發分支一律使用 GitHub 慣例命名，採 `feat/*` 形式，例如 `feat/user-auth`。
- 修復類型分支應使用 `fix/*`，文件類型分支應使用 `docs/*`；避免再使用無前綴的自訂命名。

## Frontend Security Boundary

- Frontend 僅作為受限操作與展示介面，不得保存任何第三方平台 access token 或 refresh token。
- Frontend 不得直接呼叫 Instagram、Facebook、TikTok 或其他第三方平台 API；所有外部 API 存取必須經由 Server 控制。
- Frontend 不得直接決定最終資料寫入結果；資料驗證、標準化、寫入與最終狀態裁決必須由 Server 完成。
<!-- MANUAL ADDITIONS END -->
