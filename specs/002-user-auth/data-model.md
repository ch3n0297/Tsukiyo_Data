# Data Model: 內部登入與註冊系統

## User

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `email` | string | 唯一、lowercase |
| `displayName` | string | 顯示名稱 |
| `passwordHash` | string | scrypt 結果 |
| `role` | enum | `admin` / `member` |
| `status` | enum | `pending` / `active` / `rejected` / `disabled` |
| `approvedAt` | string\|null | 核准時間 |
| `approvedBy` | string\|null | 核准者 user id |
| `lastLoginAt` | string\|null | 最近登入時間 |
| `createdAt` | string | 建立時間 |
| `updatedAt` | string | 更新時間 |

## Session

| Field | Type | Notes |
|---|---|---|
| `id` | string | opaque session id |
| `userId` | string | 對應 `User.id` |
| `createdAt` | string | 建立時間 |
| `lastSeenAt` | string | 最後活動時間 |
| `expiresAt` | string | 過期時間 |

## PasswordResetToken

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `userId` | string | 對應 `User.id` |
| `tokenHash` | string | reset token 的 sha256 |
| `createdAt` | string | 建立時間 |
| `expiresAt` | string | 過期時間 |
| `usedAt` | string\|null | 已使用時間 |

## OutboxMessage

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `type` | string | `password-reset` / `user-approved` / `user-rejected` |
| `to` | string | 收件人 email |
| `subject` | string | 主旨 |
| `body` | string | 內文 |
| `createdAt` | string | 建立時間 |
