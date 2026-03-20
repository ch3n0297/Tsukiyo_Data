# API 行銷資料中台架構草案

## 1. 目標與定位

本系統的定位是**內部使用的資料中台**，不是直接給客戶操作的完整產品。

核心目標如下：

- 穩定取得 Instagram / Facebook / TikTok 等平台的原始資料（raw data）
- 將不同平台的欄位整理為統一格式
- 將結果輸出到 Google Sheet，作為內部與客戶熟悉的查看介面
- 支援固定排程更新，以及「單一帳號」的手動刷新
- 避免把核心商業邏輯與資料真實來源綁死在 Google Sheet

一句話總結：

> **Server 是資料真實來源與執行核心，React Dashboard 是內部操作台，Google Sheet 是客戶報表展示端。**

---

## 2. 設計原則

### 2.1 Google Sheet 不拿掉，但不作為主資料源

Google Sheet 仍然保留，原因是：

- 客戶習慣用 Sheet 看數據
- 客戶能快速理解、協作與報價
- 內部也容易檢查與人工覆核

但 Google Sheet 不應該承擔：

- 原始資料存放
- Token 管理
- 核心 API 邏輯
- 核心商業邏輯計算
- 任務控制與佇列管理

Google Sheet 應扮演的是：

- 查看資料
- 作為客戶的報表介面
- 顯示系統狀態與結果（由 Server 回寫）

### 2.2 Server 為唯一可信核心

Server 應負責：

- OAuth / token 管理
- API 呼叫
- raw data 存取
- normalized data 標準化
- 排程執行
- job queue / worker
- request 驗證
- rate limit 與防呆
- 寫回資料與狀態

### 2.3 Google Sheets API 直接整合

Server 透過 Google Cloud Service Account 直接存取 Google Sheets API，不需要 Apps Script 做中介。

Server 負責：

- 直接呼叫 Google Sheets API 讀寫資料
- 任務完成後將狀態與結果回寫至 Google Sheet
- 帳號設定管理

一句話：

> **Server 直接操作 Google Sheet，不經過任何中介層。**

---

## 3. 整體資料流

### 3.1 常態流程（固定排程）

1. Server 依排程執行抓取任務
2. 呼叫各平台 API 取得 raw data
3. 將資料寫入資料庫
4. 進行標準化與彙整
5. 將整理後結果同步到 Google Sheet

用途：

- 固定時間讓內部或客戶看到最新資料
- 作為常態更新流程

### 3.2 臨時流程（手動刷新）

1. 使用者在 React Dashboard 選擇帳號，按下刷新按鈕
2. Dashboard 透過後端 API 觸發手動刷新
3. Server 驗證請求後建立 job
4. Worker 在背景執行抓取與更新
5. 完成後更新 DB 與 Google Sheet 狀態

用途：

- 當天有新影片，想提早刷新最近一段期間資料
- 不追求 real-time，但要能快速補抓

---

## 4. 為什麼不能把流程設計成同步直接等待

不建議採用：

> 前端按一下 → 直接呼叫 Server → Server 立即 call 外部 API → 等結果回來

原因如下：

1. **外部 API 回應時間不穩定**
   - 社群平台 API 可能慢、失敗或暫時限制

2. **前端等待時間不可控**
   - 若等待外部 API，容易超時或使用者體驗不佳

3. **使用者可能連按或重複送出**
   - 會造成重複 request、浪費 quota、增加系統負擔

4. **後續需要更多控制規則**
   - 同帳號一次只能一個任務
   - 限制併發數
   - 重試機制
   - 狀態追蹤
   - 錯誤處理

因此，刷新請求與真正抓資料必須解耦。

> **提交 request 與執行任務是兩段式流程，而不是一次同步完成。**

---

## 5. 為什麼要做 Job Queue

Queue 的核心目的不是「系統比較高級」，而是為了**可控地處理請求**。

### 5.1 Queue 解決的問題

- 接請求與執行工作分離
- 避免前端一直等待
- 避免重複刷新同一帳號
- 限制同時執行的任務數
- 保護 API quota 與 server 資源
- 支援錯誤重試與狀態追蹤

### 5.2 自動重試機制

Queue 應支援可重試錯誤的自動重試：

- 最多重試 **2-3 次**
- 採用**指數退避**策略（例如 5 秒 → 15 秒 → 45 秒）
- 只有**暫時性錯誤**才重試：
  - `RATE_LIMITED`（平台 API 頻率限制）
  - `NETWORK_ERROR`（網路連線失敗）
  - `TIMEOUT`（請求超時）
- **不可恢復錯誤**直接標記失敗，不重試：
  - `TOKEN_EXPIRED`（需要人工更新 Token）
  - `ACCOUNT_NOT_FOUND`（帳號設定已不存在）
  - `UNSUPPORTED_PLATFORM`（不支援的平台）
- Job 記錄中包含 `retryCount` 與 `maxRetries` 欄位

### 5.3 Queue 流程

第一段：**接請求**

- 驗證參數
- 建立 job
- 回覆「已送出請求」

第二段：**做工作**

- Worker 背景抓資料
- 存 raw data
- 做 normalized data
- 同步更新結果

一句話：

> **Queue 讓系統從「打一支 request」升級成「可控的任務處理流程」。**

---

## 6. 手動刷新設計

### 6.1 刷新粒度

手動刷新單位為：

- **單一帳號**

不做：

- 一次刷新整張表全部帳號
- 單次手動只刷新單一影片

### 6.2 刷新範圍

手動刷新邏輯為：

- 抓取該帳號最近 **N 天** 的所有內容

原因：

- 新內容不一定只有一篇，人工指定容易漏
- 既有內容的流量還會變動
- 工程邏輯單純且一致

### 6.3 refresh_days 規則

每個帳號可自行設定：

- `refresh_days`
- 範圍限制：`1 ~ 365`

不採用：

- 額外的自由日期區間 `start_date / end_date`

原因：

- 避免規則重疊與優先順序衝突
- 減少前端驗證與後端判斷複雜度
- 維持操作簡單

---

## 7. Google Sheet 的角色與設計

Google Sheet 的角色是**客戶報表展示端**：

1. **報表端**：顯示刷新結果與資料，供客戶查看
2. **狀態面板**：顯示帳號的最新狀態（由 Server 透過 Google Sheets API 回寫）

注意：手動刷新操作已移至 React Dashboard，Google Sheet 不再承擔操作台的角色。

### 7.1 帳號設定表建議欄位

可建立一張 `account_config` 或類似工作表，欄位如下：

- `client_name`
- `platform`
- `account_id`
- `refresh_days`
- `refresh_status`
- `system_message`
- `last_request_time`
- `last_success_time`
- `current_job_id`

### 7.2 操作方式

使用者在 React Dashboard 觸發手動刷新時：

1. 使用者在 Dashboard 選擇帳號
2. Dashboard 讀取該帳號的：
   - `account_id`
   - `platform`
   - `refresh_days`
3. 透過後端 API 送出刷新請求
4. Dashboard 立即顯示：
   - `queued`
   - `已送出請求，等待系統回應`

完成後由 Server 更新狀態，Dashboard 透過輪詢取得最新結果：

- `success` / `error`
- `last_success_time`
- `system_message`

同時，Server 也會透過 Google Sheets API 將結果回寫至 Google Sheet，供客戶查看。

---

## 8. 刷新狀態設計

至少需要以下狀態：

- `queued`
- `running`
- `success`
- `error`

不建議只做：

- 成功 / 失敗

因為實務上要區分：

- 任務是否只是剛送出
- 是否正在跑
- 是否已完成
- 是否真的失敗

### 8.1 系統訊息（system_message）

Sheet 應顯示簡單、可理解的系統訊息，例如：

- 已送出請求，等待系統回應
- 任務已排入佇列
- 正在抓取資料
- 已完成更新
- 失敗：Token 過期
- 失敗：請求過於頻繁
- 失敗：參數不合法

這能讓使用者理解目前發生什麼事，而不用自己猜。

---

## 9. 回寫策略

### 9.1 Server 直接回寫 Google Sheet

Server 在任務完成後，透過 Google Sheets API（Service Account）直接將結果回寫至 Google Sheet。

流程：

1. 任務完成（success 或 error）
2. Server 更新內部資料庫狀態
3. Server 呼叫 Google Sheets API 回寫狀態與結果
4. Dashboard 透過輪詢取得最新狀態

### 9.2 Dashboard 輪詢展示

- Dashboard 以固定間隔（例如 15 秒）輪詢後端 API
- 取得帳號最新的 `refreshStatus` 和 `systemMessage`
- 展示即時狀態給操作人員

也就是：

> **Server 主動回寫 Google Sheet，Dashboard 以輪詢展示即時狀態。兩者平行運作，不互相依賴。**

---

## 10. 防呆與保護機制

由於前端可能會有不合格的呼叫方式，甚至重複送出大量請求，因此必須加入多層防護。

### 10.1 Server 端驗證

所有驗證集中在 Server，不依賴前端或中介層：

#### refresh_days 驗證

Server 必須驗證：

- 必須為整數
- 範圍 1–365

#### 請求來源驗證

- Dashboard 操作需要有效的 Session Cookie
- 外部 API 呼叫需要 HMAC 簽章驗證

> **所有驗證只在 Server 執行。前端（Dashboard / Google Sheet）不承擔驗證責任。**

### 10.2 去重複（Deduplication）

同一帳號同一時間只能有一個 `queued` 或 `running` 的 job。

避免：

- 使用者連按
- 重複 request
- 重複抓同資料

### 10.3 Rate Limit

至少應限制：

- 單一帳號多久內不能重複刷新
- 單一使用者多久內不能大量送出請求
- 全系統同時最多可執行多少 job

### 10.4 Request 驗證

呼叫 Server 寫入 API 時，應帶有安全驗證資訊：

- Dashboard 操作：Session Cookie
- 外部系統 API 呼叫：HMAC 簽章（API key + timestamp + request signature）

避免知道 endpoint 的人可以任意亂打。

### 10.5 權限隔離

前端只能做：

- 發請求
- 顯示狀態

前端不能決定：

- 最終資料內容
- 核心計算邏輯
- DB 寫入結果

真正資料應由 Server 取得、驗證、計算並寫回。

---

## 11. 資料分層與統一欄位觀念

雖然本次重點在資料流與刷新機制，但系統仍應維持資料分層：

### 11.1 Raw Data

由 Server 保存各平台 API 原始回傳資料，供：

- debug
- 回查
- 問題追蹤

### 11.2 Normalized Data

將不同平台欄位整理為統一格式，例如：

- `platform`
- `account_id`
- `content_id`
- `content_type`
- `publish_time`
- `ig_views`
- `fb_views`
- `tiktok_views`
- `total_views`
- `likes`
- `comments`
- `shares`
- `fetch_time`
- `data_status`

每筆內容只屬於一個平台，因此只填其中一個平台的 views 值，其餘為 0。`total_views` 為所有平台 views 的加總（實質上等於有值的那個欄位）。

這樣設計是為了讓 Google Sheet 輸出時，客戶可以一目了然看到各平台的分項數據。

### 11.3 Google Sheet Output

Google Sheet 顯示的是整理後、可讀性高的輸出資料，而不是 raw data 主體。

---

## 12. 目前架構結論

### 12.1 最終角色分工

#### Server

- 系統核心
- 儲存資料
- API 呼叫
- 任務排程
- Job queue / worker
- 驗證與保護機制
- 資料標準化
- 同步結果
- 透過 Google Sheets API 回寫資料至 Google Sheet

#### DB

- 存 raw data
- 存 normalized data
- 存 job logs
- 存 account mapping / token / refresh records

#### React Dashboard

- 內部操作台
- 帳號狀態展示
- 手動觸發刷新
- 管理員核准使用者

#### Google Sheet

- 客戶查看報表的介面
- 由 Server 直接回寫資料
- 不承擔操作或控制功能

### 12.2 一句話架構

> **React Dashboard 是內部操作台，Google Sheet 是客戶報表介面，Server 是唯一的任務執行者與資料來源。**

---

## 13. 已收斂的決策清單

目前已明確收斂如下：

- 系統定位為 **內部使用的資料中台**
- Google Sheet 保留，但只作為客戶報表展示端
- 資料應存於 Server / DB
- **不使用 Apps Script**，Server 透過 Google Sheets API 直接回寫 Sheet
- React Dashboard 作為內部操作台與狀態展示端
- 支援固定排程與手動刷新
- 手動刷新由 **Dashboard** 觸發（非 Google Sheet）
- 手動刷新單位為 **單一帳號**
- 手動刷新範圍為 **最近 N 天所有內容**
- `refresh_days` 由帳號設定管理
- `refresh_days` 範圍限制為 **1–365**
- 不採用自由日期區間 `time_range`
- 刷新請求採 **非同步 queue 架構**
- 送出請求後先顯示 `queued`
- Job 失敗後支援**自動重試**（指數退避，最多 2-3 次）
- 必須做防呆、rate limit、去重複與 request 驗證
- 驗證全部集中在 **Server 端**
- Normalized 資料使用**分平台 views 欄位**（ig_views / fb_views / tiktok_views / total_views）
- 系統包含 **用戶認證**（註冊 → 管理員審核 → 登入）

---

## 14. 下一步可實作項目

下一階段可依序展開：

1. 實作 Google Sheets API 整合（替換 FileSheetGateway）
2. 實作 OAuth 2.0 授權流程（Instagram / TikTok）
3. 實作 Access Token / Refresh Token 管理與自動刷新
4. 實作真正的平台 API 呼叫（替換 fixture）
5. 實作 JobQueue 自動重試機制（指數退避）
6. 修正 normalization-service 改為分平台 views 欄位
7. Dashboard 加入手動刷新觸發功能
8. 定義 `system_message` 與 `refresh_status` 的標準字典

---

## 15. 最終摘要

本次討論的核心不是某個單一技術，而是先把責任邊界切清楚。

如果邊界不清楚，就會出現以下問題：

- Sheet 同時想當資料庫、控制器、報表、商業邏輯中心
- 前端誤觸就可能造成大量 request
- Server 只剩 API 代理，無法真正控管流程

因此最終收斂出的方向是：

> **以 Server 為核心，將抓取、標準化、保護與任務處理集中管理；以 React Dashboard 作為內部操作台；以 Google Sheet 作為客戶熟悉的報表介面，由 Server 直接透過 Google Sheets API 回寫資料。**

這樣的架構既保留了客戶端的使用習慣，也為後續多平台擴充、指標整合、風險控制與分析能力打下基礎。

---

## 16. 用戶認證系統

### 16.1 定位

系統需要用戶認證機制保護 Dashboard 和 API 存取，避免未授權存取內部資料。

### 16.2 認證方式

採用 Cookie-based Session 認證：

- Session Cookie（HttpOnly, Secure, SameSite）
- Session TTL 預設 7 天
- 密碼使用 scrypt 加鹽雜湊

### 16.3 用戶生命週期

1. **註冊** — 使用者提交 email + 密碼 + 姓名，建立 `pending` 狀態帳號
2. **管理員審核** — Admin 查看待審核清單，決定核准或拒絕
3. **啟用** — 核准後狀態變為 `active`，可以登入
4. **登入 / 登出** — 使用 Session Cookie 管理會話
5. **忘記密碼** — 發送重設令牌，限時更換密碼

### 16.4 角色

- `admin` — 可核准/拒絕使用者、觸發排程同步
- `member` — 可查看 Dashboard、觸發手動刷新

### 16.5 初始管理員

透過環境變數 `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` 在首次啟動時建立初始管理員帳號。

---

## 17. React Dashboard

### 17.1 定位

React Dashboard 是系統的**內部操作台與狀態展示端**，取代原本 Apps Script 的操作台角色。

### 17.2 核心功能

- **唯讀展示** — 帳號列表、刷新狀態、內容結果表格
- **手動刷新觸發** — 選擇帳號後觸發刷新（透過後端 API）
- **管理員功能** — 用戶核准/拒絕

### 17.3 安全邊界

- Dashboard 為 read-only 展示 + 受控的操作觸發
- 不保存第三方 tokens 或 API secrets
- 不直接呼叫外部平台 API
- 所有寫入操作透過後端 API 完成

### 17.4 技術選型

- React + Vite
- CSS Modules 樣式管理
- 原生 fetch API 呼叫後端
- 輪詢機制取得即時狀態（預設 15 秒間隔）

