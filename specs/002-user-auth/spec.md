# Feature Specification: 內部登入與註冊系統

**Feature Branch**: `feat/user-auth`  
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
- Session MUST 使用 server-side session + HttpOnly cookie，不可把 token 暴露給前端 JavaScript 持久保存。
- Session MUST 具備可設定的絕對過期與閒置逾時策略；目前預設以 `sessionTtlMs` 控制 7 天滑動續期。
- Cookie-based 認證流程 MUST 搭配 CSRF 防護；首版至少要求 `SameSite=Lax` 與受信任 frontend origin 驗證，後續可升級為 double-submit token。
- 新註冊使用者 MUST 先進入 `pending` 狀態，由 admin 核准後才能登入。
- 管理員 MUST 可以查看待審核清單並執行核准或拒絕。
- 密碼 MUST 使用記憶體強化雜湊演算法保存；目前指定為 Node `crypto.scrypt`，並要求 email 正規化與密碼長度上下限。
- 驗證相關端點 MUST 有 rate limiting 與暴力破解防護，至少涵蓋 `register/login/forgot-password/reset-password`。
- 忘記密碼流程 MUST 使用 server 產生的一次性 token，且 token 在儲存時只能保留雜湊值。
- Password reset token MUST 有明確過期時間；目前預設以 `passwordResetTtlMs` 控制 60 分鐘。
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
- 文件需明確標示哪些安全控制已實作、哪些是生產環境升級項目，避免把本地 JSON store 誤當成正式部署架構。
