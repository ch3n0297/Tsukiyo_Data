# Implementation Plan: 內部登入與註冊系統

## Summary

新增一套與既有社群資料中台並存的 Web 身份系統，採 Email/密碼、HttpOnly Cookie Session、管理員核准制與本地 outbox 密碼重設流程。Apps Script 與 HMAC API 保持原狀。

## Technical Context

- Language: Node.js 24, ESM JavaScript
- Frontend: React 18 + Vite
- Storage: file-backed JSON store
- Auth model: server-side session + HttpOnly cookie
- Password hashing: Node `crypto.scrypt`
- Reset delivery: local outbox stub

## Structure

- Backend: `src/repositories/*`, `src/services/*`, `src/routes/*`
- Frontend: `frontend/src/*`
- Tests: `tests/integration/*`, `frontend/src/*.test.jsx`

## Decisions

- 角色固定為 `admin/member`
- 註冊後狀態為 `pending`
- `admin` 由環境變數在啟動時 seed
- `member` 僅可讀 Dashboard，不能審核使用者
