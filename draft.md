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

> **Server 是資料真實來源與執行核心，Google Sheet 是操作台與展示端。**

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
- 送出刷新請求
- 顯示系統狀態
- 作為客戶的使用介面

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

### 2.3 Apps Script 為輕量控制層

Apps Script 不作為系統核心，只做輕量功能：

- 從 Google Sheet 讀取帳號設定
- 使用者按鈕觸發後，送 request 到 Server
- 在 Sheet 顯示狀態與訊息
- 視需要將整理好的資料寫入指定工作表

一句話：

> **Apps Script 是控制器，不是資料引擎。**

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

1. 使用者在 Google Sheet 針對單一帳號按下刷新
2. Apps Script 讀取該列的帳號設定
3. Apps Script 將請求送到 Server
4. Server 驗證請求後建立 job
5. Worker 在背景執行抓取與更新
6. 完成後更新 DB 與 Google Sheet 狀態

用途：

- 當天有新影片，想提早刷新最近一段期間資料
- 不追求 real-time，但要能快速補抓

---

## 4. 為什麼不能把流程設計成同步直接等待

不建議採用：

> Sheet 按一下 → Apps Script 呼叫 Server → Server 立即 call 外部 API → 等結果回來

原因如下：

1. **外部 API 回應時間不穩定**
   - 社群平台 API 可能慢、失敗或暫時限制

2. **Apps Script 執行時間有限**
   - 若等待外部 API，容易超時或中斷

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

### 5.2 Queue 流程

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

Google Sheet 主要扮演兩種角色：

1. **操作台**：送出單一帳號刷新請求
2. **狀態面板 / 報表端**：顯示刷新結果與資料

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

使用者在某列觸發刷新時：

1. Apps Script 讀取該列
2. 取得：
   - `account_id`
   - `platform`
   - `refresh_days`
3. 驗證後送至 Server
4. 先在 Sheet 顯示：
   - `queued`
   - `已送出請求，等待系統回應`

完成後再由 Server 或同步流程回寫：

- `success` / `error`
- `last_success_time`
- `system_message`

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

## 9. Trigger 與回寫策略

### 9.1 不用 onTime 持續輪詢等待

不建議做成：

- Apps Script 送請求後一直開計時器輪詢等待結果

原因：

- 容易浪費執行資源
- 不穩定
- 不必要地增加複雜度

### 9.2 建議做法

- 送出請求時先更新 Sheet 狀態為 `queued`
- 由 Server 在任務完成後，透過安全同步流程將結果回寫至 Sheet
- Sheet 只負責顯示狀態與結果，不負責長時間等待

也就是：

> **Sheet 是狀態展示端，不是長輪詢引擎。**

---

## 10. 防呆與保護機制

由於前端可能會有不合格的呼叫方式，甚至重複送出大量請求，因此必須加入多層防護。

### 10.1 三層驗證 refresh_days

#### 第一層：Sheet 端

使用資料驗證限制：

- 必須為整數
- 範圍 1–365

#### 第二層：Apps Script 端

送 request 前再檢查：

- 是否為數字
- 是否為整數
- 是否介於 1–365

不合法則不送到 Server，直接回寫錯誤訊息到 Sheet。

#### 第三層：Server 端

Server 必須再次驗證，不能信任前端。

> **真正可信任的驗證只在 Server。**

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

Apps Script 呼叫 Server 時，應帶有安全驗證資訊，例如：

- API key
- timestamp
- request signature

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
- `fetch_time`
- `data_status`

這能避免後續因平台差異造成資料結構混亂。

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

#### DB

- 存 raw data
- 存 normalized data
- 存 job logs
- 存 account mapping / token / refresh records

#### Apps Script

- 從 Sheet 讀設定
- 發送刷新請求
- 顯示狀態
- 做輕量同步

#### Google Sheet

- 操作台
- 狀態面板
- 客戶與內部查看報表的介面

### 12.2 一句話架構

> **Google Sheet 是任務提交器與狀態面板，Server 是唯一的任務執行者與資料來源。**

---

## 13. 已收斂的決策清單

目前已明確收斂如下：

- 系統定位為 **內部使用的資料中台**
- Google Sheet 保留，但不作為主資料源
- 資料應存於 Server / DB
- Apps Script 只作為輕量控制與介面橋接
- 支援固定排程與手動刷新
- 手動刷新單位為 **單一帳號**
- 手動刷新範圍為 **最近 N 天所有內容**
- `refresh_days` 由使用者直接在 Sheet 填寫
- `refresh_days` 範圍限制為 **1–365**
- 不採用自由日期區間 `time_range`
- 刷新請求採 **非同步 queue 架構**
- 送出請求後先顯示 `queued`
- 不用 Apps Script 長時間等待或 onTime 輪詢
- 必須做防呆、rate limit、去重複與 request 驗證

---

## 14. 下一步可實作項目

下一階段可依序展開：

1. 定義 `account_config` 的 Sheet 欄位
2. 定義 Server 的 refresh request payload 格式
3. 設計 job table / queue model
4. 設計 Apps Script 送出請求的流程
5. 設計 Server 完成後的同步回寫機制
6. 定義 `system_message` 與 `refresh_status` 的標準字典
7. 再往下補 token、platform adapter、normalized schema

---

## 15. 最終摘要

本次討論的核心不是某個單一技術，而是先把責任邊界切清楚。

如果邊界不清楚，就會出現以下問題：

- Sheet 同時想當資料庫、控制器、報表、商業邏輯中心
- Apps Script 過重
- Server 只剩 API 代理，無法真正控管流程
- 前端誤觸就可能造成大量 request

因此最終收斂出的方向是：

> **以 Server 為核心，將抓取、標準化、保護與任務處理集中管理；以 Google Sheet 作為熟悉的操作與展示介面；以 Apps Script 作為二者之間的輕量橋接。**

這樣的架構既保留了商務與客戶端的使用習慣，也為後續多平台擴充、指標整合、風險控制與分析能力打下基礎。

