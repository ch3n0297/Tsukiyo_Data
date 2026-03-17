# Data Model: 社群行銷資料中台

## AccountConfiguration

代表一個可由排程或手動刷新處理的帳號設定。

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | 系統內部識別碼 |
| `clientName` | string | yes | 顯示給內部操作人的客戶名稱 |
| `platform` | enum | yes | `instagram` / `facebook` / `tiktok` |
| `accountId` | string | yes | 平台帳號識別 |
| `refreshDays` | integer | yes | 1 到 365 |
| `sheetId` | string | yes | 目的工作表或快照識別 |
| `sheetRowKey` | string | yes | 對應列識別 |
| `isActive` | boolean | yes | 是否參與排程 |
| `lastRequestTime` | string\|null | no | 最近一次受理或拒絕請求時間 |
| `lastSuccessTime` | string\|null | no | 最近一次成功刷新時間 |
| `currentJobId` | string\|null | no | 目前 active job |
| `refreshStatus` | enum | yes | `idle` / `queued` / `running` / `success` / `error` |
| `systemMessage` | string | yes | 使用者可理解訊息 |

### Validation

- `platform` 僅允許支援平台。
- `refreshDays` 必須為 1 到 365 的整數。
- `sheetId`、`sheetRowKey` 不可為空。

## RefreshJob

代表一次排程帳號同步或手動刷新請求。

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | job 識別碼 |
| `accountKey` | string | yes | `platform:accountId` |
| `platform` | enum | yes | 與帳號設定一致 |
| `accountId` | string | yes | 與帳號設定一致 |
| `triggerType` | enum | yes | `scheduled` / `manual` |
| `requestSource` | string | yes | 例如 `apps-script` |
| `refreshDays` | integer | yes | 實際抓取天數 |
| `status` | enum | yes | `queued` / `running` / `success` / `error` |
| `systemMessage` | string | yes | 狀態訊息 |
| `queuedAt` | string | yes | 建立時間 |
| `startedAt` | string\|null | no | 開始執行時間 |
| `finishedAt` | string\|null | no | 結束時間 |
| `errorCode` | string\|null | no | 錯誤分類 |
| `resultSummary` | object\|null | no | raw/normalized 數量與同步結果 |

### State Transitions

`queued -> running -> success`

`queued -> running -> error`

`queued -> error`

### Validation

- 同一 `accountKey` 任一時間僅允許一個 `queued` 或 `running` job。
- `refreshDays` 由請求或帳號設定決定，但仍必須符合 1 到 365。

## RawPlatformRecord

保存平台抓取的原始回應。

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | 原始紀錄識別碼 |
| `jobId` | string | yes | 對應的 RefreshJob |
| `platform` | enum | yes | 平台名稱 |
| `accountId` | string | yes | 帳號識別 |
| `fetchedAt` | string | yes | 抓取時間 |
| `payload` | object | yes | 原始平台內容 |

## NormalizedContentRecord

將不同平台內容整理成統一格式。

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | 標準化紀錄識別碼 |
| `jobId` | string | yes | 對應的 RefreshJob |
| `platform` | enum | yes | 平台名稱 |
| `accountId` | string | yes | 帳號識別 |
| `contentId` | string | yes | 平台內容識別 |
| `contentType` | string | yes | `video` / `reel` / `post` 等 |
| `publishedAt` | string | yes | 發布時間 |
| `caption` | string | yes | 內容摘要 |
| `url` | string | yes | 內容連結 |
| `views` | integer | yes | 統一觀看數欄位 |
| `likes` | integer | yes | 統一按讚欄位 |
| `comments` | integer | yes | 統一留言欄位 |
| `shares` | integer | yes | 統一分享欄位 |
| `fetchTime` | string | yes | 這次整理時間 |
| `dataStatus` | enum | yes | `fresh` / `stale` / `error` |

## SheetStatusSnapshot

代表 Google Sheet 某一列目前應呈現的狀態。

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `sheetId` | string | yes | 工作表識別 |
| `sheetRowKey` | string | yes | 列識別 |
| `platform` | enum | yes | 平台 |
| `accountId` | string | yes | 帳號識別 |
| `refreshStatus` | enum | yes | `queued` / `running` / `success` / `error` |
| `systemMessage` | string | yes | 顯示訊息 |
| `lastRequestTime` | string\|null | no | 最近送出時間 |
| `lastSuccessTime` | string\|null | no | 最近成功時間 |
| `currentJobId` | string\|null | no | 目前工作 |
| `updatedAt` | string | yes | 狀態寫回時間 |

## PlatformAuthorization

由 Server 管理的平台授權設定。

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `platform` | enum | yes | 平台名稱 |
| `authType` | string | yes | `fixture`, `oauth`, `token` 等 |
| `credentialRef` | string | yes | 憑證參照，不直接暴露憑證內容 |
| `status` | enum | yes | `active` / `expired` / `disabled` |
| `updatedAt` | string | yes | 最後更新時間 |

## Relationships

- `AccountConfiguration` 1:N `RefreshJob`
- `RefreshJob` 1:N `RawPlatformRecord`
- `RefreshJob` 1:N `NormalizedContentRecord`
- `AccountConfiguration` 1:1 最新 `SheetStatusSnapshot`
- `PlatformAuthorization` 1:N `AccountConfiguration`（同平台多帳號可共用授權設定）
