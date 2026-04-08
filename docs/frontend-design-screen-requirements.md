# 前端設計頁面需求清單

## 1. 文件目的

本文件整理「只看需求文件與規劃文件」時，前端設計應補齊的頁面、區塊與狀態。

這份文件的用途是：

- 作為 `.pen` 設計稿的頁面待辦清單
- 幫助設計時區分「必畫頁面」與「第二階段延伸頁面」
- 明確列出每一頁必須放哪些元素，而不是只停留在頁名

本文件**不是** React 元件拆分說明，也**不是**僅依目前 `frontend/src/App.jsx` 的單頁實作來反推設計稿。

## 2. 參考文件

本文件主要依據以下資料整理：

- [社群行銷資料中台規格](../specs/001-social-data-hub/spec.md)
- [社群行銷資料中台資料模型](../specs/001-social-data-hub/data-model.md)
- [社群行銷資料中台 API contract](../specs/001-social-data-hub/contracts/api.openapi.yaml)
- [內部登入與註冊系統規格](../specs/002-user-auth/spec.md)
- [內部登入與註冊系統資料模型](../specs/002-user-auth/data-model.md)
- [內部登入與註冊系統 API contract](../specs/002-user-auth/contracts/api.openapi.yaml)
- [前端需求說明](./frontend-plan.md)
- [React + Vite 前端改造方案](./react-vite-frontend-plan.md)
- [角色能力與設定資訊架構](./role-capabilities-and-settings-ia.md)

## 3. 設計範圍與前提

### 3.1 系統前提

- Web 前端是受限入口，不是最終資料裁決者。
- Server 是唯一可信核心。
- 前端不得保存第三方平台 access token、refresh token、`API_SHARED_SECRET` 或任何同等敏感憑證。
- 第三方平台 API 呼叫不得由前端直接發送。

### 3.2 產品前提

- 系統有兩大主軸：
  - 社群資料中台與同步監看
  - 內部登入、註冊、管理員審核、忘記密碼
- `member` 與 `admin` 會共用主要產品框架，但 `admin` 需要額外看到審核與部分管理資訊。
- `member` 需要獨立的「個人設定」頁，用於管理語言、主題、時區、通知與帳號安全。
- `admin` 的設定頁應再拆成「使用者管理」與「系統設定」，不能與 `member` 的個人設定混在一起。
- 001 規格中的手動刷新，首版仍可由 Google Sheet 觸發；若未來要把操作遷到 Web，才需要補專屬操作畫面。

## 4. 頁面優先級總覽

### 4.1 第一階段必畫頁面

1. 登入頁
2. 註冊申請頁
3. 忘記密碼頁
4. 重設密碼頁
5. 總覽看板頁
6. 帳號列表頁
7. 單一帳號詳情頁
8. 管理員待審核頁
9. 同步任務 / 刷新狀態頁

### 4.2 第二階段建議頁面

1. 個人設定頁
2. 使用者管理頁
3. 平台授權 / 憑證管理頁
4. 排程與系統設定頁
5. 手動刷新操作頁或刷新彈窗

### 4.3 不必獨立成頁，但必須有設計狀態

1. 載入中
2. 空狀態
3. 錯誤提示
4. 無權限 / 尚未登入
5. 註冊待審核成功
6. 忘記密碼送出成功
7. 重設密碼成功
8. 非法 `refresh_days`
9. 重複刷新被拒絕
10. rate limit 提示

## 5. 頁面詳規

---

## 5.1 登入頁

### 目的

讓已核准的內部使用者透過 Email / 密碼登入，取得 HttpOnly session，進入受保護的 Dashboard。

### 主要依據

- [002 規格 User Story 2](../specs/002-user-auth/spec.md)
- [002 API contract: `/api/v1/auth/login`](../specs/002-user-auth/contracts/api.openapi.yaml)

### 必須新增的元素

- 頁面標題
  - 例：`登入社群資料中台`
- 說明文字
  - 說明登入後可查看 Dashboard
- Email 輸入欄位
- 密碼輸入欄位
- 主要 CTA：`登入`
- 次要導向：`註冊新帳號`
- 次要導向：`忘記密碼`
- 錯誤訊息區
  - 帳密錯誤
  - 帳號尚未核准
  - 帳號已停用
  - rate limited
- Session / 安全說明區
  - 可用簡短文字說明：使用 HttpOnly cookie，不在前端保存 token

### 建議互動

- 送出時按鈕進入 loading
- 成功登入後導向 Dashboard
- 若帳號 `pending`，應顯示待審核提示，而不是只寫「登入失敗」

### 不應新增的元素

- 第三方 OAuth 登入按鈕
- 任何 access token 顯示
- 手動輸入 API key

---

## 5.2 註冊申請頁

### 目的

讓內部使用者送出帳號申請，帳號建立後先進入 `pending`，等待管理員核准。

### 主要依據

- [002 規格 User Story 1](../specs/002-user-auth/spec.md)
- [002 API contract: `/api/v1/auth/register`](../specs/002-user-auth/contracts/api.openapi.yaml)
- [002 資料模型 User](../specs/002-user-auth/data-model.md)

### 必須新增的元素

- 頁面標題
  - 例：`建立內部帳號`
- 說明文字
  - 說明註冊後需等待管理員核准
- 顯示名稱輸入欄位
- Email 輸入欄位
- 密碼輸入欄位
- 密碼規則提示
  - 至少 12 字元
- 主要 CTA：`送出註冊申請`
- 返回登入連結
- 成功提示區
  - 顯示 `status: pending`
  - 說明已送出申請、待管理員核准
- 錯誤訊息區
  - email 已存在
  - 欄位驗證失敗
  - rate limited

### 建議互動

- 成功後切到「待審核成功狀態」
- 若使用者已存在，應明確提示，而不是只重置表單

---

## 5.3 忘記密碼頁

### 目的

讓已存在且可重設的使用者申請密碼重設流程。

### 主要依據

- [002 規格 User Story 4](../specs/002-user-auth/spec.md)
- [002 API contract: `/api/v1/auth/forgot-password`](../specs/002-user-auth/contracts/api.openapi.yaml)
- [002 資料模型 OutboxMessage](../specs/002-user-auth/data-model.md)

### 必須新增的元素

- 頁面標題
  - 例：`忘記密碼`
- 說明文字
  - 說明系統會送出重設指示
- Email 輸入欄位
- 主要 CTA：`送出重設指示`
- 返回登入連結
- 成功訊息區
  - 採安全導向文案：`若帳號存在且可重設，系統已送出重設指示。`
- 錯誤訊息區
  - 欄位驗證失敗
  - rate limited

### 建議互動

- 成功後不要回顯帳號是否存在
- 成功狀態可附「請至信件或系統 outbox stub 取得連結」的開發環境提示

---

## 5.4 重設密碼頁

### 目的

讓使用者使用一次性 token 設定新密碼。

### 主要依據

- [002 規格 User Story 4](../specs/002-user-auth/spec.md)
- [002 API contract: `/api/v1/auth/reset-password`](../specs/002-user-auth/contracts/api.openapi.yaml)
- [002 資料模型 PasswordResetToken](../specs/002-user-auth/data-model.md)

### 必須新增的元素

- 頁面標題
  - 例：`重設密碼`
- 新密碼輸入欄位
- 密碼規則提示
- 主要 CTA：`重設密碼`
- 成功訊息區
  - 提示重設完成，請重新登入
- 失敗訊息區
  - token 無效
  - token 已過期
  - token 已使用
  - 密碼不符合規則

### 建議互動

- 若網址內帶 token，頁面應明確顯示目前處於重設流程
- 成功後提供返回登入入口

---

## 5.5 總覽看板頁

### 目的

提供內部營運或分析人員一進系統就能看到的高層級摘要，包括整體健康度、關鍵數據、異常訊號與資料流狀況。

### 主要依據

- [001 規格 User Story 1](../specs/001-social-data-hub/spec.md)
- [001 API contract: `HealthResponse`](../specs/001-social-data-hub/contracts/api.openapi.yaml)
- [前端需求說明 4.1, 4.5](./frontend-plan.md)

### 必須新增的元素

- 頁首區
  - 使用者名稱 / 角色
  - `重新整理`
  - `登出`
  - `最後更新時間`
- 安全邊界提示 banner
  - 說明目前 UI 為唯讀入口
- 關鍵指標卡
  - 服務狀態
  - 工作佇列摘要
  - 併行上限
  - 排程器狀態
  - 排程週期
  - Tick 狀態
  - 伺服器時間
- 異常 / 通知區
  - 最近失敗或警告訊號
- 資料流摘要區
  - 排程、標準化、同步整體狀態
- 健康度摘要區
  - 可視覺化顯示不同層級健康度

### 可保留的品牌型元素

- 品牌標題
- 品牌色強調卡
- executive summary 文案

### 不應塞太多的內容

- 完整帳號明細表
- 原始資料 raw payload
- 大量逐列 output table
- 管理員審核清單

---

## 5.6 帳號列表頁

### 目的

讓使用者查看所有已設定的社群帳號，並快速掌握平台、狀態、新鮮度與最近同步結果。

### 主要依據

- [001 資料模型 AccountConfiguration](../specs/001-social-data-hub/data-model.md)
- [001 API contract: `UiAccount`](../specs/001-social-data-hub/contracts/api.openapi.yaml)
- [前端需求說明 4.4, 7.2](./frontend-plan.md)

### 必須新增的元素

- 頁面標題
  - 例：`帳號列表`
- 總數與摘要
  - 啟用中數量
  - 成功數量
  - 失敗數量
- 平台篩選
  - Instagram / Facebook / TikTok
- 狀態篩選
  - `idle` / `queued` / `running` / `success` / `error`
- 搜尋欄位
  - `clientName`
  - `accountId`
- 帳號列表卡片或表格
  - `clientName`
  - `platform`
  - `accountId`
  - `refreshDays`
  - `isActive`
  - `refreshStatus`
  - `systemMessage`
  - `lastSuccessTime`
  - `lastRequestTime`
- 點入詳情 CTA

### 建議狀態

- 無帳號資料
- 篩選後無結果
- 某帳號錯誤狀態 badge
- `queued` / `running` 的 loading 標記

---

## 5.7 單一帳號詳情頁

### 目的

讓使用者深入檢視單一帳號的同步狀態、最新輸出與內容級資料。

### 主要依據

- [001 API contract: `UiAccountDetail`](../specs/001-social-data-hub/contracts/api.openapi.yaml)
- [001 資料模型 AccountConfiguration](../specs/001-social-data-hub/data-model.md)
- [001 資料模型 NormalizedContentRecord](../specs/001-social-data-hub/data-model.md)

### 必須新增的元素

- 頁面標題
  - `clientName · platform · accountId`
- 基本資料區
  - `clientName`
  - `platform`
  - `accountId`
  - `refreshDays`
  - `sheetId`
  - `sheetRowKey`
  - `isActive`
- 狀態區
  - `refreshStatus`
  - `systemMessage`
  - `lastRequestTime`
  - `lastSuccessTime`
  - `currentJobId`
  - `statusUpdatedAt`
- 最新輸出摘要
  - `latestOutput.syncedAt`
  - `latestOutput.rowCount`
- 最新輸出表格
  - `content_id`
  - `content_type`
  - `published_at`
  - `caption`
  - `url`
  - `views`
  - `likes`
  - `comments`
  - `shares`
  - `data_status`

### 視覺建議

- 將基本資料與最新輸出分成上下兩區
- 表格需支援空狀態
- 狀態 badge 必須清楚區分 `queued/running/success/error`

---

## 5.8 管理員待審核頁

### 目的

讓 `admin` 查看待審註冊申請，並執行核准或拒絕。

### 主要依據

- [002 規格 User Story 3](../specs/002-user-auth/spec.md)
- [002 API contract: `/api/v1/admin/pending-users`](../specs/002-user-auth/contracts/api.openapi.yaml)
- [002 資料模型 User](../specs/002-user-auth/data-model.md)

### 必須新增的元素

- 頁面標題
  - 例：`待審註冊申請`
- 待審數量摘要
- 清單項目
  - `displayName`
  - `email`
  - `status`
  - `createdAt`
- 操作按鈕
  - `核准`
  - `拒絕`
- 操作後回饋
  - 成功訊息
  - 錯誤訊息
- 空狀態
  - `目前沒有待審核的註冊申請`

### 建議互動

- 核准 / 拒絕時按鈕應進入 submitting
- 已處理完的項目應從清單消失或轉成已處理狀態

---

## 5.9 同步任務 / 刷新狀態頁

### 目的

集中顯示同步工作與手動刷新工作的生命週期、錯誤原因與結果摘要。

### 主要依據

- [001 規格 User Story 2, User Story 3](../specs/001-social-data-hub/spec.md)
- [001 資料模型 RefreshJob](../specs/001-social-data-hub/data-model.md)
- [001 API contract: `ManualRefreshAccepted`](../specs/001-social-data-hub/contracts/api.openapi.yaml)

### 必須新增的元素

- 頁面標題
  - 例：`同步任務`
- 任務統計摘要
  - `queued`
  - `running`
  - `success`
  - `error`
- 篩選器
  - `triggerType`
  - `platform`
  - `status`
  - `requestSource`
- 任務列表或表格
  - `id`
  - `accountKey`
  - `platform`
  - `accountId`
  - `triggerType`
  - `requestSource`
  - `refreshDays`
  - `status`
  - `systemMessage`
  - `queuedAt`
  - `startedAt`
  - `finishedAt`
  - `errorCode`
- 任務詳情抽屜或詳情頁
  - `resultSummary`
  - `rawRecordCount`
  - `normalizedRecordCount`
  - `sheetSync`

### 建議狀態

- 進行中工作高亮
- 錯誤工作需顯示可理解訊息
- 同一帳號重複刷新被拒絕的提示

---

## 5.10 個人設定頁

### 定位

第二階段頁面。所有已登入角色都需要，專注在個人偏好與帳號安全。

### 主要依據

- [002 資料模型 User](../specs/002-user-auth/data-model.md)

### 必須新增的元素

- 個人資料卡
  - `displayName`
  - `email`
  - `role`
  - `lastLoginAt`
- 介面偏好
  - `language`
  - `theme`
  - `timezone`
  - `datetimeFormat`
  - `defaultLandingPage`
- 帳號安全
  - 修改密碼入口
  - 目前 session
  - 登出其他裝置
- 通知偏好
  - 同步失敗通知
  - 摘要通知
  - 審核結果通知

### 注意

- 若後端尚未提供對應 write API，這頁可先畫成表單與偏好卡，但不應假設所有項目已可提交

---

## 5.11 使用者管理頁

### 定位

第二階段頁面。僅限 `admin`，用於管理其他使用者。

### 主要依據

- [002 資料模型 User](../specs/002-user-auth/data-model.md)
- [002 API contract: `/api/v1/admin/pending-users`](../specs/002-user-auth/contracts/api.openapi.yaml)

### 必須新增的元素

- 使用者統計摘要
  - `active`
  - `pending`
  - `disabled`
  - `admin`
- 使用者清單
  - `displayName`
  - `email`
  - `role`
  - `status`
  - `createdAt`
  - `lastLoginAt`
- 管理操作
  - 核准
  - 拒絕
  - 停用
  - 重新啟用
  - 調整角色

---

## 5.12 平台授權 / 憑證管理頁

### 定位

第二階段頁面。用於平台授權狀態監看與管理。

### 主要依據

- [001 資料模型 PlatformAuthorization](../specs/001-social-data-hub/data-model.md)

### 必須新增的元素

- 平台清單
  - `platform`
  - `authType`
  - `credentialRef`
  - `status`
  - `updatedAt`
- 授權狀態 badge
  - `active`
  - `expired`
  - `disabled`
- 失效或到期警示

### 不應新增的元素

- 明文 token 顯示
- 可複製的實際憑證內容

---

## 5.13 排程與系統設定頁

### 定位

第二階段頁面。用於可視化排程與系統運作參數。

### 主要依據

- [001 API contract: `HealthResponse`](../specs/001-social-data-hub/contracts/api.openapi.yaml)
- [001 規格 FR-015, FR-017](../specs/001-social-data-hub/spec.md)

### 必須新增的元素

- 排程器狀態
  - `running`
  - `intervalMs`
  - `tickInProgress`
- 佇列設定
  - `concurrency`
  - `pending`
  - `running`
- 限流與保護規則摘要
  - 同帳號 cooldown
  - request source rate limit
  - active job 限制

### 注意

- 若沒有 write API，這頁應設計成資訊型頁面，不要假設能在線修改設定

---

## 5.14 手動刷新操作頁或刷新彈窗

### 定位

第二階段頁面。只有在 Web 要承接 Google Sheet 的操作責任時才需要。

### 主要依據

- [001 規格 User Story 2](../specs/001-social-data-hub/spec.md)
- [001 API contract: `ManualRefreshRequest`](../specs/001-social-data-hub/contracts/api.openapi.yaml)

### 必須新增的元素

- 選擇帳號
- 顯示 `platform`
- 顯示 `account_id`
- 顯示或選擇 `refresh_days`
- 顯示 `request_source`
- 送出按鈕
- 受理成功訊息
  - `job_id`
  - `status: queued`
  - `system_message`
- 拒絕原因區
  - 非法 `refresh_days`
  - active job 已存在
  - rate limited
  - 帳號設定缺少 `sheetId` / `sheetRowKey`

### 注意

- 這頁不能讓前端直接保存 HMAC secret
- 若 Web 未承接此流程，則不必在第一階段設計成正式頁面

## 6. 所有頁面共用狀態清單

以下狀態不一定獨立成完整頁面，但每一類核心頁面至少要有對應設計：

- 載入中
- 空狀態
- 頁面層級錯誤
- 欄位驗證失敗
- 無權限
- Session 過期
- 成功提交
- 待審核
- 同步進行中
- 同步失敗

## 7. 建議繪製順序

1. 登入頁
2. 註冊申請頁
3. 忘記密碼頁
4. 重設密碼頁
5. 總覽看板頁
6. 帳號列表頁
7. 單一帳號詳情頁
8. 管理員待審核頁
9. 同步任務 / 刷新狀態頁
10. 第二階段管理頁面

## 8. 與目前設計稿的關係

如果對照目前的 `.pen` 設計稿，現階段可視為：

- `資料中台總覽 / Dark`、`資料中台總覽 / Light`、`資料中台總覽 / 純總覽`
  - 對應本文件的「總覽看板頁」
- `社群帳號接入與權杖管理`
  - 對應本文件的「平台授權 / 憑證管理頁」方向，但仍需再根據資料模型補齊欄位

其餘第一階段頁面仍建議補畫。
