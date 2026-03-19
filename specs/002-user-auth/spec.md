# Feature Specification: 內部登入與註冊系統

**Feature Branch**: `002-user-auth`  
**Created**: 2026-03-19  
**Status**: Implemented  
**Input**: 新增 Web Dashboard 專用的登入/註冊系統，採 Email/密碼、管理員核准制、HttpOnly Cookie Session，並納入忘記密碼流程。

## User Scenarios & Testing

### User Story 1 - 註冊與待審核

作為內部使用者，我需要能送出註冊申請，等待管理員核准後再登入系統。

**Independent Test**: 使用未存在的 email 註冊，確認帳號進入 `pending`，且尚未核准前無法登入。

### User Story 2 - 登入後查看 Dashboard

作為已核准的內部使用者，我需要登入後才能查看受保護的 Dashboard 與帳號資料。

**Independent Test**: 使用 active 使用者登入，確認取得 session cookie，且可讀取 `/api/v1/ui/accounts`。

### User Story 3 - 管理員審核帳號

作為管理員，我需要在 Dashboard 上查看待審核使用者並核准或拒絕。

**Independent Test**: 以 admin 登入，列出 pending 使用者，核准後該使用者可登入。

### User Story 4 - 忘記密碼

作為已核准的內部使用者，我需要能申請重設密碼並以新密碼登入。

**Independent Test**: 申請忘記密碼後產出 outbox 訊息，使用其中 token 重設密碼，確認舊密碼失效。

## Functional Requirements

- 系統 MUST 提供 `register/login/logout/me/forgot-password/reset-password` API。
- Web Dashboard 的 `/api/v1/ui/*` MUST 需要已登入的 active 使用者。
- Session MUST 使用 HttpOnly cookie，不可把 token 暴露給前端 JavaScript 持久保存。
- 新註冊使用者 MUST 先進入 `pending` 狀態，由 admin 核准後才能登入。
- 管理員 MUST 可以查看待審核清單並執行核准或拒絕。
- 忘記密碼流程 MUST 使用 server 產生的一次性 token。
- 忘記密碼與核准通知首版 MUST 寫入本地 outbox stub，不直接整合真實寄信商。
- 系統 MUST 保留既有 Apps Script / HMAC 流程，不以 Web session 取代。

## Key Entities

- `User`
- `Session`
- `PasswordResetToken`
- `OutboxMessage`

## Success Criteria

- 未登入存取 Dashboard API 時，100% 回傳 `401`。
- 已核准使用者可登入並成功查看 Dashboard。
- 管理員可在 Web 介面完成待審核帳號核准。
- 忘記密碼流程可在不依賴外部寄信服務下完成測試。
