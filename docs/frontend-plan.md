# 前端需求說明

## 分析依據

本文件依據目前 repo 中已存在的實作與測試整理，主要參考：

- [`backend/src/app.js`](../backend/src/app.js)
- [`backend/src/routes/auth-routes.js`](../backend/src/routes/auth-routes.js)
- [`backend/src/routes/health-route.js`](../backend/src/routes/health-route.js)
- [`backend/src/routes/ui-accounts-route.js`](../backend/src/routes/ui-accounts-route.js)
- [`backend/src/services/ui-dashboard-service.js`](../backend/src/services/ui-dashboard-service.js)
- [`backend/src/services/user-auth-service.js`](../backend/src/services/user-auth-service.js)
- [`frontend/src/App.jsx`](../frontend/src/App.jsx)
- [`frontend/src/api/authApi.js`](../frontend/src/api/authApi.js)
- [`frontend/src/api/dashboardApi.js`](../frontend/src/api/dashboardApi.js)
- [`tests/integration/auth-session.test.js`](../tests/integration/auth-session.test.js)
- [`tests/integration/frontend-ui.test.js`](../tests/integration/frontend-ui.test.js)

## 1. 文件目的

這份文件是給前端夥伴的需求說明，重點是回答：

- 前端畫面真正要顯示什麼
- `member` 與 `admin` 看到的差異是什麼
- 什麼是理想體驗，什麼是目前後端第一版可落地的做法
- 哪些功能雖然後端有 route，但目前不應視為前端正式需求

本文件不是 React 元件拆分手冊，也不是單純的 API 列表。

## 2. 名詞與前提

### 2.1 帳號定義

本文件提到的「帳號列表」指的是**連結的社群媒體帳號**，不是登入這個系統的使用者帳號。

例如目前 [`/api/v1/ui/accounts`](../backend/src/app.js) 回來的資料，是：

- `instagram / acct-instagram-demo`
- `facebook / acct-facebook-demo`
- `tiktok / acct-tiktok-demo`

而系統登入帳號則是 [`admin` / `member`](../backend/src/services/user-auth-service.js) 角色。

### 2.2 產品前提

- 前端主體是內容檢視與基本管理，不是操作型後台。
- `sidebar` 必須保留，因為它是平台與社群帳號的切換入口，不是可有可無的裝飾。
- `member` 與 `admin` 共用同一個內容首頁。
- `admin` 比 `member` 多看到管理資訊，不代表需要做成兩套完全不同的前端。
- Server 仍是唯一可信核心，前端不得保存第三方平台 token，也不得直接持有 HMAC secret。

## 3. 畫面原則

### 3.1 Member / User 視角

`member` 進系統後，首頁核心應該是「內容總覽」，不是帳號設定資訊。

首頁體驗應偏向：

- 先看到 Instagram、TikTok 等平台的內容表現
- 先看內容，再決定是否切到某個平台或某個社群帳號
- `views` 是首頁最重要的成效指標
- `caption/title`、`url`、發布時間是輔助理解內容的必要資訊

### 3.2 Admin 視角

`admin` 與 `member` 共用內容首頁，但額外需要：

- 系統健康狀態 `health`
- 待審使用者清單 `pending users`

其中 `health` 是 **UI 顯示規則上的 admin-only**，不是目前後端權限保證。後端 [`GET /health`](../backend/src/app.js) 目前是公開 route，前端應自行限制只在 `admin` 畫面呈現。

## 4. 理想體驗

### 4.1 Member / User 首頁

理想中的 `member` 首頁應該長成以下結構：

- 左側保留 `sidebar`
- 右側主區是內容總覽
- 內容先依平台分區，例如 Instagram、TikTok
- 各平台區內以 `views` 由高到低排序
- 平台區首頁先顯示摘要，不直接把全部內容完整攤開
- 使用者可再透過平台篩選或帳號篩選，看完整內容列表

### 4.2 Member / User 主內容區

首頁內容總覽應以「平台摘要」為第一層，而不是帳號明細卡。

每個平台區塊建議至少包含：

- 平台名稱
- 平台下可見內容摘要
- 代表性內容的 `caption/title`
- `url`
- 發布時間
- `views`
- 好懂的來源名稱

「來源名稱」不應只露出技術欄位。建議顯示方式：

- 第一層顯示 `clientName`
- 第二層再補 `platform + accountId`

若前端需要「title」欄位，目前最接近的是內容列中的 `caption`。若 `caption` 為空，建議退回 `content_id` 作為備援顯示值。

### 4.3 Summary 與完整列表的切換

首頁不是直接展示所有內容全文量清單，而是：

- 首頁先顯示各平台摘要
- 點擊平台區或透過 `sidebar` 篩選後，才進入完整內容列表

預設假設：

- 各平台摘要區先顯示 `views` 最高的前 5 筆內容
- 完整列表再顯示該平台或該帳號的全部可見內容

### 4.4 Sidebar 角色

`sidebar` 必須保留，並且要被定義成**正式需求的一部分**。

`sidebar` 的角色不是帳號設定面板，而是：

- 平台篩選
- 社群媒體帳號篩選
- 顯示目前選取狀態
- 幫助使用者從「全平台內容總覽」切換到「單一平台 / 單一帳號內容」

`sidebar` 每個項目建議至少顯示：

- `clientName`
- `platform`
- `accountId`
- `refreshStatus` 或 `lastSuccessTime`

這樣使用者能知道自己切換的是哪個社群帳號，也能快速判斷資料是否新鮮。

### 4.5 Admin 額外需求

`admin` 在共用首頁之外，應額外看到兩塊：

1. **Health 區塊**
2. **Pending Users 區塊**

`Health` 區塊建議顯示：

- `status`
- `queue.pending`
- `queue.running`
- `queue.concurrency`
- `scheduler.running`
- `scheduler.intervalMs`
- `scheduler.tickInProgress`
- `now`

`Pending Users` 區塊建議顯示：

- `displayName`
- `email`
- `status`
- `createdAt`
- `approve`
- `reject`

## 5. 第一版可落地做法

### 5.1 目前後端已存在的讀取能力

目前後端其實已經有前端可直接使用的 read APIs：

- [`GET /api/v1/ui/accounts`](../backend/src/app.js)
- [`GET /api/v1/ui/accounts/:platform/:accountId`](../backend/src/app.js)
- [`GET /health`](../backend/src/app.js)
- 認證與 admin APIs：
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/forgot-password`
  - `POST /api/v1/auth/reset-password`
  - `GET /api/v1/admin/pending-users`
  - `POST /api/v1/admin/pending-users/:userId/approve`
  - `POST /api/v1/admin/pending-users/:userId/reject`

舊文件中「缺少 UI 讀取 API」的描述已不符合目前 codebase。

### 5.2 第一版首頁建議

第一版仍建議維持單一 Dashboard shell，但做法要貼齊目前後端資料形狀：

1. 先用 [`GET /api/v1/auth/me`](../backend/src/app.js) 取得目前登入者
2. 用 [`GET /api/v1/ui/accounts`](../backend/src/app.js) 取得社群帳號清單與狀態摘要
3. 保留左側 `sidebar`，先完成平台篩選與帳號篩選
4. 主內容區預設先顯示平台摘要
5. 使用者切平台或帳號後，再用 [`GET /api/v1/ui/accounts/:platform/:accountId`](../backend/src/app.js) 載入完整內容列表

也就是說，第一版不必先做成「超大型多頁 SPA」，而是先把單一 Dashboard 內的內容檢視體驗做好。

### 5.3 理想首頁與目前後端的落差

你想要的理想首頁是「一進系統先看全平台內容總覽」。  
目前後端比較自然提供的是「以單一社群帳號為單位的 detail rows」。

因此第一版有兩種現實作法：

#### 作法 A：先走 account-based 首頁

- 首頁先顯示平台摘要與 `sidebar`
- 使用者再切入某個平台或帳號看完整列表

這是最穩定、最貼近現有後端的做法。

#### 作法 B：前端自行 fan-out 聚合

- 先讀 `/api/v1/ui/accounts`
- 再依可見帳號逐筆讀 detail endpoint
- 在前端把 `latestOutput.rows` 合併成平台摘要

這能更接近理想首頁，但前提是帳號數量不大。若未來帳號數增加，應評估在後端新增聚合 read API，而不是讓瀏覽器永遠 fan-out 多次請求。

## 6. 畫面清單

| 畫面 / 區塊 | 角色 | 是否正式需求 | 說明 |
|---|---|---|---|
| Login | 所有人 | 是 | 本版 auth 主流程之一 |
| Register | 所有人 | 是 | 本版 auth 主流程之一 |
| Logout / session restore | 所有人 | 是 | 需搭配 `me` 與 HttpOnly session |
| Forgot password | 所有人 | 次要 | 後端已支援，但不是這版首頁主體 |
| Reset password | 所有人 | 次要 | 後端已支援，但不是這版首頁主體 |
| 內容總覽首頁 | `member` / `admin` | 是 | 首頁主體 |
| Sidebar 平台 / 帳號篩選 | `member` / `admin` | 是 | 必留，不可省略 |
| 平台摘要區 | `member` / `admin` | 是 | 內容總覽第一層 |
| 單一平台 / 單一帳號完整內容列表 | `member` / `admin` | 是 | 摘要之後的深入檢視 |
| Health | `admin` | 是 | 只在 admin UI 顯示 |
| Pending users review | `admin` | 是 | 需支援 approve / reject |
| Manual refresh | `member` / `admin` | 否 | 現階段不列入正式前端需求 |
| Scheduled sync trigger | `member` / `admin` | 否 | 現階段不列入正式前端需求 |

## 7. 欄位對應建議

### 7.1 首頁內容欄位

| 前端顯示名稱 | 目前後端欄位 | 說明 |
|---|---|---|
| 標題 | `caption` | 目前最接近 title 的欄位 |
| 連結 | `url` | 點開原始貼文 / 影片 |
| 發布時間 | `published_at` | 內容時間排序與理解用 |
| 觀看數 | `views` | 首頁主 KPI |
| 來源名稱 | `clientName` | 使用者看得懂的主要來源文案 |
| 來源補充 | `platform` + `accountId` | 二層說明，避免只有技術代碼 |

### 7.2 Sidebar 欄位

| 欄位 | 來源 |
|---|---|
| `clientName` | `/api/v1/ui/accounts` |
| `platform` | `/api/v1/ui/accounts` |
| `accountId` | `/api/v1/ui/accounts` |
| `refreshStatus` | `/api/v1/ui/accounts` |
| `lastSuccessTime` | `/api/v1/ui/accounts` |

### 7.3 Admin 欄位

| 區塊 | 欄位來源 |
|---|---|
| Health | `/health` |
| Pending users | `/api/v1/admin/pending-users` |

## 8. 注意事項

### 8.1 安全與權限

- 前端所有受保護請求都要走 HttpOnly session cookie。
- 前端請求需使用 `credentials: "include"`，這和目前 [`frontend/src/api/httpClient.js`](../frontend/src/api/httpClient.js) 一致。
- 前端不應把 session token 存到 Local Storage / Session Storage。
- `manual refresh` 與 `scheduled sync` 的 route 目前受 HMAC 保護，不應被前端視為可直接呼叫的功能。
- 前端不得保存 `API_SHARED_SECRET`。

### 8.2 UI 能力邊界

目前 [`UiDashboardService`](../backend/src/services/ui-dashboard-service.js) 對 UI 明確回傳：

- `mode: "read-only"`
- `manualRefresh: false`
- `scheduledSync: false`

這表示目前前端正式需求應以唯讀內容檢視為主，而不是操作型控制台。

### 8.3 Health 與 Member 畫面

- `health` 是 admin 需要的資訊，不是 member 首頁核心。
- 即使後端 route 目前未做 admin-only 保護，前端畫面也應只在 `admin` 角色顯示。

### 8.4 Sidebar 不可被拿掉

即使首頁主體改成內容總覽，`sidebar` 仍是必要結構，原因如下：

- 使用者仍需要從「全部內容」切到「單一平台 / 單一帳號」
- 使用者需要知道目前看到的是哪個來源
- 若之後補更多平台，沒有 `sidebar` 會讓導覽失焦

### 8.5 不要混淆兩種帳號

文件與前端文案都要明確區分：

- 系統登入帳號：`admin` / `member`
- 社群媒體帳號：`instagram` / `tiktok` / `facebook` 等 account

避免在前端 UI 裡把兩者都叫做「帳號」卻沒有上下文。

## 9. 不在這版需求中的項目

以下項目先不要當成這版正式需求：

- Browser 直接呼叫手動刷新 API
- Browser 直接呼叫 scheduled sync API
- 前端儲存第三方平台 access token / refresh token
- 獨立的帳號設定後台
- 以系統健康資訊作為 member 首頁主體
- 把首頁主體做成單純帳號清單，而非內容總覽

## 10. 後續可再討論的議題

若第一版上線後發現「首頁要看全平台內容」是高頻需求，下一階段可再評估：

- 後端新增聚合內容 read API
- 平台摘要加入更多成效欄位，例如 `likes`、`comments`、`shares`
- 平台摘要加入搜尋、排序、分頁
- 將 forgot / reset password 從次要流程提升成首頁同等完整流程
