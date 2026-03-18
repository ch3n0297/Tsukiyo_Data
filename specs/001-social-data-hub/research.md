# Research: 社群行銷資料中台

## Decision 1: 採用 Node.js 24 ESM 與標準函式庫作為首版技術棧

- **Decision**: 以 Node.js 24 ESM 建立單體 HTTP service，runtime 只依賴標準函式庫。
- **Rationale**: 目前 repo 沒有既有框架或 build pipeline；用標準函式庫可以直接落地，不引入額外升級風險，也讓 queue、排程、簽章驗證、檔案儲存與測試可在同一語境完成。
- **Alternatives considered**:
  - Fastify/Express: 開發體驗較佳，但首版沒有必要先引入外部依賴。
  - TypeScript: 型別更完整，但會增加 build/tsconfig/執行鏈設定成本。

## Decision 2: 首版使用 file-backed JSON store，透過 repository 隔離持久層

- **Decision**: 將 `Account Configuration`、`Refresh Job`、`Raw Platform Record`、`Normalized Content Record` 與 `Sheet Status Snapshot` 分別保存為 `data/` 下的 JSON 集合檔，寫入採原子覆蓋。
- **Rationale**: 專案目前完全空白，JSON store 能最快把完整資料流落地，且 repository 邊界清楚，後續替換成 SQLite/PostgreSQL 時不需重寫 route 與 service。
- **Alternatives considered**:
  - SQLite: 單機資料庫更接近正式環境，但需要額外依賴或仰賴實驗性內建模組。
  - 記憶體 store: 開發更快，但無法支援 job 稽核、raw data 保存與狀態回查。

## Decision 3: 使用 in-process queue + persisted jobs 的 worker 模式

- **Decision**: 請求進入後只建立 job 並回覆 `queued`，背景 worker 依可配置併發度執行抓取、標準化與同步。
- **Rationale**: 這符合規格的非同步處理要求，並能以最小複雜度實現 dedup、限流、狀態追蹤與排程共用同一條處理管線。
- **Alternatives considered**:
  - HTTP request 內同步抓取: 會違反 Apps Script 與外部 API 不可長時間等待的約束。
  - 外部 queue（Redis/BullMQ 等）: 更可擴充，但目前 repo 沒有任何基礎設施，首版先不引入。

## Decision 4: 手動刷新驗證採 HMAC SHA256 + timestamp

- **Decision**: Apps Script 或其他允許來源在 header 帶 `x-client-id`、`x-timestamp`、`x-signature`，Server 以共享密鑰驗證。
- **Rationale**: 這比單純 API key 更能防止重放與偽造請求，同時不需要外部身分服務。
- **Alternatives considered**:
  - 單純 API key: 實作簡單，但無 timestamp/signature 的重放防護。
  - OAuth/JWT: 安全性更完整，但對內部 bridge 而言過重。

## Decision 5: 平台與 Sheet 整合採 adapter 介面，首版提供 fixture/file 實作

- **Decision**: 平台抓取以 `fixtures/platforms/*.json` 模擬 Instagram/Facebook/TikTok 原始資料；Google Sheet 同步以 file-backed gateway 生成狀態與報表快照。
- **Rationale**: 目前沒有正式 token、Google API 憑證與欄位字典，直接硬接外部服務會造成不可驗證的半成品；先把核心流程與資料契約實作完整，保留清楚的替換點。
- **Alternatives considered**:
  - 直接接正式平台 API: 缺少憑證與商務邊界，無法在 repo 內可靠驗證。
  - 略過 adapter 直接寫死 mock: 測試雖可通，但未來更換真實整合時會污染核心服務。

## Decision 6: 排程同步與手動刷新共用同一個 orchestration pipeline

- **Decision**: 排程與手動刷新都建立 `Refresh Job`，之後交由同一套 `RefreshOrchestrator` 執行抓取、標準化、持久化與 Sheet 回寫。
- **Rationale**: 規格要求不同觸發方式不可產出不一致結果；共用 pipeline 才能保證狀態、去重複與錯誤處理一致。
- **Alternatives considered**:
  - 排程與手動刷新分開實作: 初期看似簡單，但會快速造成規則漂移與維運負擔。

## Decision 7: 前端維持 thin client，所有敏感能力收斂在 Server

- **Decision**: 將任何前端介面限定為操作與展示層，不保存第三方平台 token、不直接呼叫第三方平台 API，也不直接決定最終資料寫入。
- **Rationale**: 這符合「Server 為唯一可信核心」的系統邊界，可避免憑證外洩、客戶端繞過驗證與多入口寫入不一致。
- **Alternatives considered**:
  - 前端直連第三方 API: 會把授權資料暴露到不可信環境，且難以統一稽核與限流。
  - 前端直接寫入最終資料: 會破壞 Server 作為唯一可信來源的設計，增加資料競爭與一致性風險。
