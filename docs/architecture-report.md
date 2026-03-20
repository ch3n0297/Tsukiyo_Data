# Social Data Hub — 架構報告

> 分支: `001-social-data-hub` | 報告日期: 2026-03-18

---

## 1. 專案概述

**Social Data Hub** 是一個社群行銷資料中台服務，用於從 Instagram、Facebook、TikTok 等平台自動抓取內容資料，經過正規化處理後同步至 Google Sheet（目前以本地 JSON 檔案模擬）。

### 技術棧

| 項目 | 選擇 |
|------|------|
| Runtime | Node.js >= 24 |
| 模組系統 | ESM (ECMAScript Modules) |
| 外部依賴 | **零** — 完全使用 Node 標準函式庫 |
| 持久化 | JSON 檔案（原子寫入） |
| 認證 | HMAC-SHA256 簽章驗證 + Cookie-based Session |
| 測試框架 | `node:test` (內建) |
| 平台資料來源 | Fixture JSON 檔案（模擬 API） |

---

## 2. 系統全域架構

```mermaid
graph TB
    subgraph External["外部觸發源"]
        DASH["React Dashboard<br/>(手動刷新 + 狀態展示)"]
        CRON["內部排程器<br/>(SchedulerService)"]
        CLI["CLI 工具<br/>(sign-request / seed-demo)"]
    end

    subgraph Server["HTTP Server (Node.js)"]
        direction TB
        Router["路由分發器<br/>http.createServer"]

        subgraph Routes["路由層"]
            HR["GET /health"]
            MR["POST /api/v1/refresh-jobs/manual"]
            SR["POST /api/v1/internal/scheduled-sync"]
        end

        subgraph Auth["認證層"]
            HMAC["HMAC-SHA256<br/>簽章驗證"]
            VAL["請求驗證<br/>ValidationService"]
        end

        subgraph Services["服務層"]
            MRS["ManualRefreshService"]
            SSS["ScheduledSyncService"]
            JQ["JobQueue<br/>(並行控制 max=3)"]
            RO["RefreshOrchestrator"]
            NS["NormalizationService"]
            SS["StatusService"]
            SCHED["SchedulerService<br/>(定時 Timer)"]
        end

        subgraph Adapters["適配器層"]
            PR["PlatformRegistry"]
            IG["InstagramAdapter"]
            FB["FacebookAdapter"]
            TT["TikTokAdapter"]
            SG["FileSheetGateway"]
        end

        subgraph Repositories["資料存取層"]
            ACR["AccountConfigRepository"]
            JR["JobRepository"]
            RRR["RawRecordRepository"]
            NRR["NormalizedRecordRepository"]
            SSR["SheetSnapshotRepository"]
        end

        subgraph Storage["持久化層"]
            FS["FileStore<br/>(JSON + 原子寫入 + 鎖)"]
        end
    end

    subgraph Data["檔案系統"]
        direction LR
        AC_FILE["account-configs.json"]
        JOB_FILE["jobs.json"]
        RAW_FILE["raw-platform-records.json"]
        NORM_FILE["normalized-content-records.json"]
        SS_FILE["sheet-status.json"]
        SO_FILE["sheet-output.json"]
        FIX["fixtures/platforms/*.json"]
    end

    DASH -->|Session Cookie + API call| MR
    CRON -->|內部觸發| SR
    CLI -->|產生簽章| DASH

    Router --> HR & MR & SR
    MR --> HMAC --> VAL --> MRS
    SR --> HMAC --> VAL --> SSS

    MRS --> JQ
    SSS --> JQ
    SCHED -->|setInterval| SSS
    JQ -->|processJob| RO

    RO --> PR
    PR --> IG & FB & TT
    RO --> NS
    RO --> SS

    SS --> SG
    SG --> SSR

    RO --> RRR & NRR
    MRS --> ACR & JR
    SSS --> ACR & JR

    ACR & JR & RRR & NRR & SSR --> FS
    FS --> AC_FILE & JOB_FILE & RAW_FILE & NORM_FILE & SS_FILE & SO_FILE
    IG & FB & TT --> FIX
```

---

## 3. 分層架構

```mermaid
graph LR
    subgraph L1["第一層: 入口"]
        S["server.js"]
        A["app.js<br/>(組合根)"]
    end

    subgraph L2["第二層: 路由"]
        R1["health-route"]
        R2["manual-refresh-route"]
        R3["scheduled-sync-route"]
    end

    subgraph L3["第三層: 服務"]
        S1["AuthService"]
        S2["ValidationService"]
        S3["ManualRefreshService"]
        S4["ScheduledSyncService"]
        S5["SchedulerService"]
        S6["JobQueue"]
        S7["RefreshOrchestrator"]
        S8["NormalizationService"]
        S9["StatusService"]
        S10["JobFactory"]
    end

    subgraph L4["第四層: 適配器"]
        A1["PlatformRegistry"]
        A2["FixturePlatformAdapter"]
        A3["FileSheetGateway"]
    end

    subgraph L5["第五層: 資料存取"]
        D1["AccountConfigRepo"]
        D2["JobRepo"]
        D3["RawRecordRepo"]
        D4["NormalizedRecordRepo"]
        D5["SheetSnapshotRepo"]
    end

    subgraph L6["第六層: 基礎設施"]
        I1["FileStore"]
        I2["Logger"]
        I3["HTTP Utils"]
        I4["Error Types"]
    end

    L1 --> L2 --> L3 --> L4 --> L5 --> L6
```

---

## 4. 資料流 — 手動刷新 (Manual Refresh)

```mermaid
sequenceDiagram
    actor Client as React Dashboard
    participant Route as ManualRefreshRoute
    participant Auth as AuthService
    participant Valid as ValidationService
    participant MRS as ManualRefreshService
    participant JR as JobRepository
    participant SS as StatusService
    participant JQ as JobQueue
    participant RO as RefreshOrchestrator
    participant PA as PlatformAdapter
    participant NS as NormalizationService
    participant RR as RawRecordRepo
    participant NR as NormalizedRecordRepo
    participant SG as FileSheetGateway

    Client->>Route: POST /api/v1/refresh-jobs/manual<br/>{platform, account_id, refresh_days, request_source}<br/>Headers: x-client-id, x-timestamp, x-signature

    Route->>Route: readJsonRequest(req, maxBodyBytes)
    Route->>Auth: verifySignedRequest(headers, rawBody, sharedSecret, ...)
    Auth->>Auth: 驗證 client-id ∈ allowedClientIds
    Auth->>Auth: 驗證 timestamp 偏差 < signatureTtlMs
    Auth->>Auth: HMAC-SHA256(sharedSecret, timestamp.rawBody) === signature
    Auth-->>Route: {clientId, timestamp}

    Route->>MRS: enqueueManualRefresh({payload, clientId})
    MRS->>Valid: validateManualRefreshPayload(payload)
    Valid-->>MRS: {platform, accountId, refreshDays, requestSource}

    MRS->>MRS: 查詢帳號設定
    MRS->>MRS: 檢查是否已有 active job (409)
    MRS->>MRS: 來源頻率限制檢查 (429)
    MRS->>MRS: 帳號冷卻期檢查 (429)

    MRS->>JR: create(queuedJob)
    MRS->>SS: markQueued(accountConfig, job)
    SS->>SG: writeStatus(account, {refreshStatus: "queued"})
    MRS->>JQ: enqueue(job)

    Route-->>Client: 202 {job_id, status: "queued"}

    Note over JQ, RO: === 背景非同步處理 ===

    JQ->>RO: processJob(job)
    RO->>JR: updateById(job.id, {status: "running"})
    RO->>SS: markRunning(accountConfig, runningJob)

    RO->>PA: fetchAccountContent({accountConfig, refreshDays, now})
    PA-->>RO: rawItems[]

    RO->>RO: buildRawRecords(job, rawItems, fetchedAt)
    RO->>NS: normalizeBatch({platform, accountId, jobId, rawItems})
    NS-->>RO: normalizedRecords[]

    RO->>RR: appendMany(rawRecords)
    RO->>NR: replaceForAccount(accountKey, normalizedRecords)

    RO->>JR: updateById(job.id, {status: "success"})
    RO->>SS: markSuccess(accountConfig, job, normalizedRecords)
    SS->>SG: writeOutput(accountConfig, normalizedRecords)
    SS->>SG: writeStatus(account, {refreshStatus: "success"})
```

---

## 5. 資料流 — 排程同步 (Scheduled Sync)

```mermaid
sequenceDiagram
    participant Timer as SchedulerService<br/>(setTimeout loop)
    participant SSS as ScheduledSyncService
    participant ACR as AccountConfigRepo
    participant JR as JobRepository
    participant SS as StatusService
    participant JQ as JobQueue
    participant RO as RefreshOrchestrator

    Note over Timer: 每 scheduleIntervalMs (預設 5 分鐘) 觸發一次

    Timer->>Timer: #runTick() [tickInProgress guard]
    Timer->>SSS: enqueueAllActiveAccounts({requestedBy: "scheduler"})

    SSS->>ACR: listActive()
    ACR-->>SSS: activeAccounts[]

    loop 每個 active account
        SSS->>SSS: 檢查 sheetId/sheetRowKey 是否齊全
        SSS->>JR: findActiveByAccountKey(accountKey)
        alt 已有 active job
            SSS->>SS: markRejected(account, "active_job_exists")
            SSS->>SSS: skippedAccounts.push(...)
        else 可以排程
            SSS->>SSS: createQueuedJob(...)
            SSS->>JR: create(job)
            SSS->>SS: markQueued(account, job)
            SSS->>JQ: enqueue(job)
        end
    end

    SSS-->>Timer: {acceptedJobs, skippedAccounts}

    Note over JQ, RO: 後續 Job 處理流程與手動刷新相同
```

---

## 6. 也可由 API 觸發排程同步

```mermaid
sequenceDiagram
    actor Admin as 管理員
    participant Route as ScheduledSyncRoute
    participant Auth as AuthService
    participant SSS as ScheduledSyncService

    Admin->>Route: POST /api/v1/internal/scheduled-sync<br/>{requested_by: "admin"}<br/>Headers: x-client-id, x-timestamp, x-signature
    Route->>Auth: verifySignedRequest(...)
    Auth-->>Route: OK
    Route->>SSS: enqueueAllActiveAccounts({requestedBy: "admin"})
    SSS-->>Route: {acceptedJobs, skippedAccounts}
    Route-->>Admin: 202 {accepted_jobs, skipped_accounts}
```

---

## 7. Job 狀態機

```mermaid
stateDiagram-v2
    [*] --> queued: createQueuedJob()

    queued --> running: processJob() 開始
    queued --> error: 帳號不存在 / 驗證失敗

    running --> success: 抓取 + 正規化 + 寫入成功
    running --> error: 平台 API 錯誤 / TOKEN_EXPIRED / RATE_LIMITED

    success --> [*]
    error --> [*]

    note right of queued
        每個 accountKey 同時
        只允許一個 queued/running job
    end note
```

---

## 8. 資料模型 (Entity Relationship)

```mermaid
erDiagram
    AccountConfiguration {
        string id PK
        string clientName
        enum platform "instagram / facebook / tiktok"
        string accountId
        integer refreshDays "1-365"
        string sheetId
        string sheetRowKey
        boolean isActive
        string lastRequestTime
        string lastSuccessTime
        string currentJobId FK
        enum refreshStatus "idle / queued / running / success / error"
        string systemMessage
        string updatedAt
    }

    RefreshJob {
        string id PK
        string accountKey "platform:accountId"
        enum platform
        string accountId
        enum triggerType "scheduled / manual"
        string requestSource
        integer refreshDays
        enum status "queued / running / success / error"
        string systemMessage
        string queuedAt
        string startedAt
        string finishedAt
        string errorCode
        object resultSummary
    }

    RawPlatformRecord {
        string id PK
        string jobId FK
        string accountKey
        enum platform
        string accountId
        string fetchedAt
        object payload "原始平台資料"
    }

    NormalizedContentRecord {
        string id PK
        string jobId FK
        string accountKey
        enum platform
        string accountId
        string contentId
        string contentType
        string publishedAt
        string caption
        string url
        integer views
        integer likes
        integer comments
        integer shares
        string fetchTime
        enum dataStatus "fresh / stale / error"
    }

    SheetStatusSnapshot {
        string sheetId PK
        string sheetRowKey PK
        enum platform
        string accountId
        enum refreshStatus
        string systemMessage
        string lastRequestTime
        string lastSuccessTime
        string currentJobId
        string updatedAt
    }

    SheetOutputSnapshot {
        string sheetId PK
        string sheetRowKey PK
        enum platform
        string accountId
        string syncedAt
        array rows "正規化後的內容列表"
    }

    AccountConfiguration ||--o{ RefreshJob : "1:N 產生"
    RefreshJob ||--o{ RawPlatformRecord : "1:N 原始紀錄"
    RefreshJob ||--o{ NormalizedContentRecord : "1:N 正規化紀錄"
    AccountConfiguration ||--o| SheetStatusSnapshot : "1:1 最新狀態"
    AccountConfiguration ||--o| SheetOutputSnapshot : "1:1 最新輸出"
```

---

## 9. JobQueue 並行控制模型

```mermaid
graph TB
    subgraph Queue["JobQueue (concurrency: 3)"]
        direction TB

        subgraph Pending["等待佇列 (pending[])"]
            P1["Job A"]
            P2["Job B"]
            P3["Job C"]
        end

        subgraph Running["執行槽 (running ≤ 3)"]
            R1["Slot 1: Job X"]
            R2["Slot 2: Job Y"]
            R3["Slot 3: (空)"]
        end

        subgraph Guards["保護機制"]
            G1["pendingIds: Set<br/>防止重複入列"]
            G2["runningIds: Set<br/>防止執行中 job 被重新入列"]
        end
    end

    P1 -->|"#drain()"| R3
    R1 -->|"完成 → #run() finally"| R1_done["runningIds.delete<br/>running -= 1<br/>#drain()"]

    style Running fill:#e8f5e9
    style Pending fill:#fff3e0
    style Guards fill:#fce4ec
```

---

## 10. FileStore 持久化機制

```mermaid
graph TD
    subgraph FileStore["FileStore"]
        direction TB
        LOCK["Promise-based 串行鎖<br/>(#withLock)"]

        subgraph Operations["操作"]
            READ["readCollection"]
            WRITE["writeCollection"]
            UPDATE["updateCollection"]
            MULTI["updateCollections<br/>(多集合原子操作)"]
        end

        subgraph AtomicWrite["原子寫入流程"]
            W1["1. JSON.stringify(records)"]
            W2["2. writeFile → .tmp 暫存檔"]
            W3["3. rename → 正式檔名"]
            W4["失敗 → unlink .tmp 清理"]
        end

        subgraph Validation["安全驗證"]
            V1["集合名稱: /^[a-z0-9-]+$/"]
            V2["路徑穿越檢查:<br/>path.relative 不可以 .. 開頭"]
        end
    end

    LOCK --> Operations
    Operations --> AtomicWrite
    Operations --> Validation

    W1 --> W2 --> W3
    W2 -.->|"Error"| W4
```

---

## 11. 認證流程

```mermaid
graph TD
    REQ["HTTP Request"] --> H1{"Headers 齊全?<br/>x-client-id<br/>x-timestamp<br/>x-signature"}

    H1 -->|否| E1["401 AUTH_HEADERS_MISSING"]
    H1 -->|是| H2{"clientId ∈<br/>allowedClientIds?"}

    H2 -->|否| E2["401 CLIENT_NOT_ALLOWED"]
    H2 -->|是| H3{"timestamp 有效?<br/>可解析為日期"}

    H3 -->|否| E3["401 INVALID_TIMESTAMP"]
    H3 -->|是| H4{"|now - timestamp|<br/>≤ signatureTtlMs?<br/>(預設 5 分鐘)"}

    H4 -->|否| E4["401 TIMESTAMP_EXPIRED"]
    H4 -->|是| H5{"HMAC-SHA256 驗證<br/>timingSafeEqual"}

    H5 -->|否| E5["401 SIGNATURE_INVALID"]
    H5 -->|是| OK["✓ 認證通過<br/>回傳 {clientId, timestamp}"]

    style OK fill:#c8e6c9
    style E1 fill:#ffcdd2
    style E2 fill:#ffcdd2
    style E3 fill:#ffcdd2
    style E4 fill:#ffcdd2
    style E5 fill:#ffcdd2
```

**簽章演算法:**

```
signature = HMAC-SHA256(sharedSecret, "{timestamp}.{rawBody}")
```

---

## 12. 正規化管線

```mermaid
graph LR
    subgraph Input["平台原始資料"]
        IG_RAW["Instagram<br/>{id, media_type, timestamp,<br/>caption, permalink, metrics}"]
        FB_RAW["Facebook<br/>{post_id, type, created_time,<br/>message, permalink_url, insights}"]
        TT_RAW["TikTok<br/>{aweme_id, content_type, create_time,<br/>desc, share_url, analytics}"]
    end

    subgraph Normalizers["NORMALIZERS Map"]
        IG_N["normalizeInstagramItem"]
        FB_N["normalizeFacebookItem"]
        TT_N["normalizeTiktokItem"]
    end

    subgraph Output["統一格式 NormalizedContentRecord"]
        UNIFIED["contentId<br/>contentType<br/>publishedAt<br/>caption<br/>url<br/>views / likes / comments / shares"]
    end

    subgraph Metadata["自動附加元資料"]
        META["id (UUID)<br/>jobId<br/>accountKey<br/>platform<br/>accountId<br/>fetchTime<br/>dataStatus: 'fresh'"]
    end

    IG_RAW --> IG_N --> UNIFIED
    FB_RAW --> FB_N --> UNIFIED
    TT_RAW --> TT_N --> UNIFIED
    UNIFIED --> META
```

**欄位對應表:**

| 統一欄位 | Instagram | Facebook | TikTok |
|----------|-----------|----------|--------|
| `contentId` | `id` | `post_id` | `aweme_id` |
| `contentType` | `media_type.toLowerCase()` | `type.toLowerCase()` | `content_type.toLowerCase()` |
| `publishedAt` | `timestamp` | `created_time` | `create_time` |
| `caption` | `caption` | `message` | `desc` |
| `url` | `permalink` | `permalink_url` | `share_url` |
| `views` | `metrics.plays` | `insights.video_views` | `analytics.play_count` |
| `likes` | `metrics.likes` | `insights.reactions` | `analytics.digg_count` |
| `comments` | `metrics.comments` | `insights.comments` | `analytics.comment_count` |
| `shares` | `metrics.shares` | `insights.shares` | `analytics.share_count` |

---

## 13. 啟動與關閉流程

```mermaid
sequenceDiagram
    participant Main as server.js
    participant App as createApp()
    participant FS as FileStore
    participant Seed as seedDemoData
    participant SS as StatusService
    participant Recover as recoverJobs
    participant Sched as SchedulerService
    participant HTTP as HTTP Server

    Main->>App: createApp()
    App->>App: loadConfig(overrides)
    App->>FS: new FileStore(dataDir)
    App->>FS: init(6 collections)

    Note over FS: 建立 data/ 目錄<br/>確保 6 個 JSON 檔案存在

    App->>Seed: seedDemoData(accountRepo, clock)
    Note over Seed: 若無帳號資料<br/>寫入 3 個 Demo 帳號<br/>(IG/FB/TT)

    App->>App: 建構所有 Services & Repositories

    App->>SS: bootstrapAccountSnapshots()
    Note over SS: 將所有帳號狀態<br/>同步至 sheet-status.json

    App->>Recover: recoverJobs(...)
    Note over Recover: 1. 找出 status=running 的 jobs<br/>   → 標記為 error (PROCESS_RESTARTED)<br/>2. 找出 status=queued 的 jobs<br/>   → 重新 enqueue 到 JobQueue

    App->>HTTP: http.createServer(handler)
    App-->>Main: {server, start(), stop()}

    Main->>App: start()
    App->>HTTP: server.listen(port, host)
    App->>Sched: start() [若 autoStartScheduler]
    Note over Sched: setTimeout loop 啟動

    Main->>Main: 監聽 SIGINT / SIGTERM

    Note over Main: === 收到關閉信號 ===
    Main->>App: stop()
    App->>Sched: stop()
    App->>HTTP: server.close()
    App->>App: jobQueue.waitForIdle()
    Note over App: 等待執行中的 jobs 完成
```

---

## 14. 目錄結構

```
social-media-fetcher-spec-kit/
├── package.json                          # Node.js >= 24, ESM, 零外部依賴
├── src/
│   ├── server.js                         # 程式入口，信號處理
│   ├── app.js                            # 組合根：依賴注入 + HTTP server
│   ├── config.js                         # 環境變數 + 預設值 + 驗證
│   ├── adapters/
│   │   ├── platforms/
│   │   │   ├── platform-registry.js      # 平台適配器註冊表
│   │   │   ├── fixture-platform-adapter.js  # 基於 JSON fixture 的通用適配器
│   │   │   ├── instagram-adapter.js      # IG 時間戳取得器
│   │   │   ├── facebook-adapter.js       # FB 時間戳取得器
│   │   │   └── tiktok-adapter.js         # TT 時間戳取得器
│   │   └── sheets/
│   │       └── file-sheet-gateway.js     # Sheet 寫入閘道 (檔案版)
│   ├── cli/
│   │   ├── seed-demo.js                  # 植入 Demo 帳號資料
│   │   └── sign-request.js              # 產生 HMAC 簽章
│   ├── lib/
│   │   ├── errors.js                     # HttpError + toErrorResponse
│   │   ├── fs-store.js                   # JSON 檔案儲存 (原子寫入 + 鎖)
│   │   ├── http.js                       # readJsonRequest + sendJson
│   │   └── logger.js                     # 結構化 JSON logger
│   ├── repositories/
│   │   ├── account-config-repository.js  # 帳號設定 CRUD
│   │   ├── job-repository.js             # Job CRUD + 查詢
│   │   ├── raw-record-repository.js      # 原始紀錄 (append-only)
│   │   ├── normalized-record-repository.js  # 正規化紀錄 (replace per account)
│   │   └── sheet-snapshot-repository.js  # Sheet 快照 (status + output)
│   ├── routes/
│   │   ├── health-route.js               # GET /health
│   │   ├── manual-refresh-route.js       # POST /api/v1/refresh-jobs/manual
│   │   └── internal-scheduled-sync-route.js  # POST /api/v1/internal/scheduled-sync
│   └── services/
│       ├── auth-service.js               # HMAC 簽章 + 驗證
│       ├── job-factory.js                # Job 物件工廠
│       ├── job-queue.js                  # 並行佇列 (bounded concurrency)
│       ├── manual-refresh-service.js     # 手動刷新業務邏輯
│       ├── normalization-service.js      # 多平台正規化
│       ├── refresh-orchestrator.js       # Job 執行編排器
│       ├── scheduled-sync-service.js     # 排程同步業務邏輯
│       ├── scheduler-service.js          # 定時器 (setTimeout loop)
│       ├── status-service.js             # 帳號狀態 + Sheet 同步
│       └── validation-service.js         # 請求參數驗證
├── data/                                 # 執行時 JSON 資料 (gitignored)
├── fixtures/platforms/                   # 模擬平台 API 回應
│   ├── instagram--acct-instagram-demo.json
│   ├── facebook--acct-facebook-demo.json
│   └── tiktok--acct-tiktok-demo.json
├── tests/
│   ├── unit/                             # 單元測試 (8 檔)
│   └── integration/                      # 整合測試 (4 檔)
└── specs/001-social-data-hub/            # 規格文件
    ├── spec.md                           # 功能需求規格
    ├── data-model.md                     # 資料模型定義
    ├── plan.md                           # 實作計畫
    ├── tasks.md                          # 任務追蹤
    ├── quickstart.md                     # 快速開始指南
    ├── research.md                       # 技術研究
    └── contracts/api.openapi.yaml        # OpenAPI 規格
```

---

## 15. 組態參數

| 參數 | 環境變數 | 預設值 | 說明 |
|------|---------|--------|------|
| `host` | `HOST` | `127.0.0.1` | 監聽位址 |
| `port` | `PORT` | `3000` | 監聽埠號 |
| `dataDir` | `DATA_DIR` | `./data` | JSON 資料目錄 |
| `fixturesDir` | `FIXTURES_DIR` | `./fixtures/platforms` | Fixture 檔案目錄 |
| `sharedSecret` | `API_SHARED_SECRET` | **必填** (無預設) | HMAC 共享密鑰 |
| `allowedClientIds` | `ALLOWED_CLIENT_IDS` | `["demo-sheet"]` | 允許的 client ID 列表 |
| `signatureTtlMs` | `SIGNATURE_TTL_MS` | `300,000` (5min) | 簽章有效期 |
| `maxRequestBodyBytes` | `MAX_REQUEST_BODY_BYTES` | `1,048,576` (1MB) | 請求 body 大小上限 |
| `maxConcurrentJobs` | `MAX_CONCURRENT_JOBS` | `3` | 最大同時執行 job 數 |
| `sourceRateLimitWindowMs` | `SOURCE_RATE_LIMIT_WINDOW_MS` | `60,000` (1min) | 來源頻率限制窗口 |
| `sourceRateLimitMax` | `SOURCE_RATE_LIMIT_MAX` | `10` | 窗口內最大請求數 |
| `accountCooldownMs` | `ACCOUNT_COOLDOWN_MS` | `30,000` (30s) | 帳號冷卻期 |
| `scheduleIntervalMs` | `SCHEDULE_INTERVAL_MS` | `300,000` (5min) | 排程觸發間隔 |

---

## 16. API 端點摘要

| Method | Path | 認證 | 說明 |
|--------|------|------|------|
| `GET` | `/health` | 無 | 健康檢查，回傳 queue/scheduler 狀態 |
| `GET` | `/api/v1/ui/accounts` | Session | 帳號列表（Dashboard 用） |
| `GET` | `/api/v1/ui/accounts/:platform/:accountId` | Session | 帳號詳情（Dashboard 用） |
| `POST` | `/api/v1/auth/register` | 無 | 用戶註冊 |
| `POST` | `/api/v1/auth/login` | 無 | 用戶登入 |
| `POST` | `/api/v1/auth/logout` | Session | 用戶登出 |
| `GET` | `/api/v1/auth/me` | Session | 取得當前用戶 |
| `POST` | `/api/v1/auth/forgot-password` | 無 | 忘記密碼 |
| `POST` | `/api/v1/auth/reset-password` | Token | 重設密碼 |
| `GET` | `/api/v1/admin/pending-users` | Session + Admin | 列出待審核用戶 |
| `POST` | `/api/v1/admin/pending-users/:userId/approve` | Session + Admin | 核准用戶 |
| `POST` | `/api/v1/admin/pending-users/:userId/reject` | Session + Admin | 拒絕用戶 |
| `POST` | `/api/v1/refresh-jobs/manual` | HMAC | 觸發單一帳號手動刷新 |
| `POST` | `/api/v1/internal/scheduled-sync` | HMAC | 觸發所有 active 帳號排程同步 |

---

## 17. 保護機制

```mermaid
graph TD
    subgraph RateLimiting["頻率限制"]
        RL1["來源頻率限制<br/>每分鐘 10 次/client"]
        RL2["帳號冷卻期<br/>同帳號 30 秒內不可重複"]
        RL3["Active Job 檢查<br/>同帳號僅允許一個 queued/running"]
    end

    subgraph Security["安全機制"]
        SEC1["HMAC-SHA256 簽章驗證"]
        SEC2["Timing-safe 比較"]
        SEC3["Timestamp 有效期 (防重放)"]
        SEC4["Client ID 白名單"]
        SEC5["Request Body 大小限制 (1MB)"]
        SEC6["Collection 名稱白名單驗證"]
        SEC7["路徑穿越防護"]
    end

    subgraph Resilience["容錯機制"]
        RES1["啟動時 Job 恢復<br/>(running→error, queued→re-enqueue)"]
        RES2["原子檔案寫入<br/>(write→tmp→rename)"]
        RES3["Promise-based 串行鎖"]
        RES4["Tick 重疊保護<br/>(tickInProgress guard)"]
        RES5["JobQueue 重複入列保護<br/>(pendingIds + runningIds)"]
        RES6["優雅關閉<br/>(SIGINT/SIGTERM → waitForIdle)"]
    end
```

---

## 18. 測試覆蓋

| 類型 | 檔案 | 測試對象 |
|------|------|----------|
| Unit | `auth-service.test.js` | HMAC 簽章 + 驗證流程 |
| Unit | `config.test.js` | 組態載入 + 驗證 |
| Unit | `file-sheet-gateway.test.js` | Sheet 閘道寫入 |
| Unit | `fs-store.test.js` | FileStore 讀寫 + 原子性 + 安全性 |
| Unit | `job-queue.test.js` | 佇列並行 + 重複保護 |
| Unit | `logger.test.js` | 結構化日誌 + 循環引用 |
| Unit | `normalization-service.test.js` | 三平台正規化 |
| Unit | `scheduler-service.test.js` | 定時器 + tick 重疊保護 |
| Integration | `http-safety.test.js` | HTTP 安全性 (body 大小等) |
| Integration | `manual-refresh.test.js` | 手動刷新端對端流程 |
| Integration | `protections.test.js` | 頻率限制 + 冷卻期 |
| Integration | `scheduled-sync.test.js` | 排程同步端對端流程 |

---

## 19. 設計特點與取捨

### 優點

1. **零外部依賴** — 完全使用 Node.js 標準函式庫，無 npm install 需求
2. **乾淨的分層架構** — Routes → Services → Repositories → FileStore，單向依賴
3. **依賴注入** — 透過 `app.js` 組合根集中管理，便於測試替換
4. **原子寫入** — FileStore 使用 tmp + rename 策略，避免部分寫入
5. **多層保護** — 頻率限制、冷卻期、重複 job 檢查、HMAC 認證
6. **啟動恢復** — 行程重啟後自動恢復 queued jobs、標記 running jobs 為錯誤
7. **Platform Adapter 模式** — 可輕鬆擴充新平台支援

### 取捨

1. **JSON 檔案儲存** — 適合小規模 Demo，不適合生產高併發場景
2. **Fixture 取代真實 API** — 目前平台適配器讀取本地 JSON，未實作真正的 API 呼叫
3. **File-based Sheet Gateway** — 模擬 Google Sheets API，寫入本地 JSON
4. **記憶體內頻率限制** — 行程重啟後計數器歸零
5. **無持久化的排程器** — `SchedulerService` 基於 `setTimeout`，重啟後重新開始計時
