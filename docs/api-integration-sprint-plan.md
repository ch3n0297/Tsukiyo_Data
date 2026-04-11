# API 整合衝刺計畫：串接 Meta & TikTok 真實 API

**撰寫日期**：2026-04-04
**目標**：在數天內將三個平台的 Fixture Adapter 替換為真實 API 串接，建立完整的 OAuth 授權與 Token 管理流程。

---

## 一、現況盤點

### 已完成（可直接沿用）
| 元件 | 位置 | 說明 |
|------|------|------|
| OAuth 流程框架 | `google-oauth-service.js` | PKCE + state + 加密 token 儲存，Meta/TikTok 可複製同樣模式 |
| Token 加密工具 | `lib/secret-box.js` | AES-256-GCM，可直接用於儲存三方平台 token |
| Adapter 介面 | `fixture-platform-adapter.js` | `fetchAccountContent({ accountConfig, refreshDays, now })` 是唯一需要實作的方法 |
| Platform Registry | `adapters/platforms/platform-registry.js` | 只需替換注入的 adapter 實例，不需改 orchestrator |
| OAuth State 管理 | `oauth-state-repository.js` | 防 CSRF state 生成與消費機制已就緒 |
| Connection 儲存模式 | `google-connection-repository.js` | 可直接複製為 meta-connection、tiktok-connection |

### 尚未完成（本次目標）
- Meta（Facebook + Instagram）OAuth 流程與真實 Adapter
- TikTok OAuth 流程與真實 Adapter
- Token 過期自動刷新機制
- 平台連線狀態 UI

---

## 二、API 申請前置作業（**開始寫程式前必須完成**）

> ⚠️ 這些步驟需要在瀏覽器操作開發者後台，無法自動化。建議第一天上午完成。

### 2.1 Meta（Instagram + Facebook）

**申請網址**：https://developers.facebook.com/

**步驟**：

1. 登入 Meta for Developers，建立新 App（類型選 **Business**）
2. 在 App 後台加入以下產品：
   - **Facebook Login**（必須）
   - **Instagram Graph API**（Instagram 資料用）
3. 設定 OAuth 重定向 URI：
   ```
   http://localhost:3000/api/oauth/meta/callback   ← 開發環境
   https://your-domain.com/api/oauth/meta/callback ← 生產環境
   ```
4. 記錄以下資訊備用：
   - App ID（即 Client ID）
   - App Secret（即 Client Secret）
5. 在 App 設定 → 進階 → 將測試用的 Facebook 帳號加為「測試使用者」或「開發者」

**需要申請的 Permissions（Scopes）**：

| Permission | 用途 | 是否需 App Review |
|------------|------|-----------------|
| `pages_show_list` | 列出管理的 Facebook Pages | 否（開發模式可用） |
| `pages_read_engagement` | 讀取 Page 貼文互動數據 | 否（開發模式可用） |
| `read_insights` | 讀取 Page Insights | **是**（需審查） |
| `instagram_basic` | 讀取 IG 基本個人資料 | 否 |
| `instagram_manage_insights` | 讀取 IG 媒體分析數據 | **是**（需審查） |
| `business_management` | 管理業務帳號 | **是**（需審查） |

> ⚠️ **重要**：Meta App Review 需要數天到數週。在審查通過前，`read_insights` 與 `instagram_manage_insights` 只能用你自己的帳號（已加為開發者）測試。建議**現在就送出審查申請**，同時用基本 scope 先開發測試。

**Instagram 帳號要求**：
- 必須是**專業帳號**（Business 或 Creator），才能使用 Instagram Graph API
- 個人帳號只能用 Instagram Basic Display API（功能較少）
- 可在 Instagram App → 設定 → 帳號 → 切換為「專業帳號」

---

### 2.2 TikTok

**申請網址**：https://developers.tiktok.com/

**步驟**：

1. 登入 TikTok for Developers，建立新 App
2. 填寫 App 基本資訊（名稱、描述、網站 URL）
3. 加入以下產品：
   - **Login Kit**（OAuth 授權用）
   - **Research API** 或 **Content Posting API**（依需求選擇）
4. 設定 Redirect URI：
   ```
   http://localhost:3000/api/oauth/tiktok/callback
   ```
5. 記錄：
   - Client Key（即 Client ID）
   - Client Secret

**需要申請的 Scopes**：

| Scope | 用途 | 是否需審查 |
|-------|------|---------|
| `user.info.basic` | 讀取帳號基本資料 | 否 |
| `user.info.stats` | 讀取粉絲數、獲讚數等統計 | **是** |
| `video.list` | 列出帳號影片 | **是** |

> ⚠️ TikTok 的 App 審查週期約 3-7 個工作天。開發期間可在 Sandbox 模式測試基本流程。

---

## 三、開發階段規劃

### Day 1：Meta OAuth 基礎建設

**目標**：能讓使用者透過 Dashboard 完成 Facebook 授權，並安全儲存 token。

**任務清單**：

- [ ] 建立 `meta-connection-repository.js`（複製自 google-connection-repository，欄位調整）
- [ ] 建立 `meta-oauth-service.js`（複製自 google-oauth-service，替換端點 URL）
  - 授權端點：`https://www.facebook.com/v21.0/dialog/oauth`
  - Token 端點：`https://graph.facebook.com/v21.0/oauth/access_token`
  - 長效 token 交換：`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token`
- [ ] 建立 `meta-oauth-routes.js`（`/api/oauth/meta/authorize`、`/api/oauth/meta/callback`）
- [ ] 更新 `config.js` 加入 Meta 環境變數：
  ```
  META_APP_ID
  META_APP_SECRET
  META_REDIRECT_URI
  ```
- [ ] 在 Dashboard UI 加入「連結 Facebook」按鈕

**驗收標準**：點擊「連結 Facebook」→ 跳轉 Meta 授權頁 → 授權後回到 Dashboard，token 已加密儲存至 `data/meta-connections.json`。

---

### Day 2：Instagram & Facebook 真實 Adapter

**目標**：排程同步與手動刷新能用真實 Meta API 抓取資料。

**任務清單**：

**Instagram Adapter**（使用 Instagram Graph API）：
- [ ] 建立 `real-instagram-adapter.js`
  - 取得帳號 Media：`GET /v21.0/{ig-user-id}/media?fields=id,caption,media_type,timestamp,like_count,comments_count`
  - 注意：`ig-user-id` 需先透過 `GET /me?fields=id,name` 取得
- [ ] 處理 Pagination（`after` cursor）
- [ ] 處理 rate limit（Meta Graph API：每小時 200 次 / per token）

**Facebook Adapter**（使用 Pages API）：
- [ ] 建立 `real-facebook-adapter.js`
  - 取得 Page Posts：`GET /v21.0/{page-id}/posts?fields=id,message,created_time,likes.summary(true),comments.summary(true)`
  - 取得 Page ID：`GET /me/accounts`（回傳管理的所有 Pages）
- [ ] 處理 Page access token（由 User token 換取）

**Platform Registry 更新**：
- [ ] 更新 `platform-registry.js`，根據環境變數決定使用 real adapter 或 fixture adapter
  ```js
  // 若 USE_REAL_META_API=true 則使用真實 adapter，否則 fallback 到 fixture
  ```

---

### Day 2（下午）/ Day 3（上午）：TikTok OAuth & Adapter

**目標**：完成 TikTok 授權流程與真實資料抓取。

**TikTok OAuth**（流程與 Meta 相似，但細節不同）：
- [ ] 建立 `tiktok-connection-repository.js`
- [ ] 建立 `tiktok-oauth-service.js`
  - 授權端點：`https://www.tiktok.com/v2/auth/authorize/`
  - Token 端點：`https://open.tiktokapis.com/v2/oauth/token/`
  - 刷新端點：`https://open.tiktokapis.com/v2/oauth/token/`（grant_type: refresh_token）
- [ ] 建立 `tiktok-oauth-routes.js`
- [ ] 更新 config 加入：`TIKTOK_CLIENT_KEY`、`TIKTOK_CLIENT_SECRET`、`TIKTOK_REDIRECT_URI`

**TikTok Adapter**：
- [ ] 建立 `real-tiktok-adapter.js`
  - 取得影片列表：`POST https://open.tiktokapis.com/v2/video/list/`（body: `{ max_count: 20 }`）
  - 欄位：`id, create_time, title, video_description, duration, like_count, comment_count, share_count, view_count`

---

### Day 3：Token 刷新機制

**目標**：token 過期時自動刷新，不讓排程同步因 token 失效而中斷。

**Meta token 特性**：
- Short-lived token：1-2 小時
- Long-lived token：60 天（需交換）
- Page access token：永久有效（只要 User token 不撤銷）
- **沒有** refresh token 機制（需引導使用者重新授權）

**TikTok token 特性**：
- Access token：24 小時
- Refresh token：365 天
- 可用 refresh token 換新 access token（不需重新授權）

**任務清單**：
- [ ] 建立 `token-refresh-service.js`
  - 啟動時檢查所有連線的 token 有效期
  - TikTok：自動 refresh
  - Meta：token 剩餘 < 7 天時，在 Dashboard 顯示「需要重新授權」警告
- [ ] 在排程同步前，加入 token 有效性預檢（避免 job 執行到一半才發現 token 過期）

---

### Day 4：整合測試與收尾

**目標**：用真實帳號跑完完整流程，確認資料正確落地。

**測試清單**：
- [ ] 用自己的 Instagram 帳號跑一次完整排程同步
- [ ] 驗證 normalized record 欄位對應正確
- [ ] 手動刷新一個 IG 帳號，確認 Google Sheet 狀態更新
- [ ] 模擬 token 過期，確認錯誤訊息友善
- [ ] 確認 raw data 有正確保存

---

## 四、資料欄位對應表（Normalized Record）

> 這是確保 normalization-service.js 能正確處理真實 API 回應的關鍵參考。

### Instagram（Graph API 回應 → Normalized）

| Normalized 欄位 | Meta Graph API 欄位 | 備註 |
|----------------|---------------------|------|
| `postId` | `id` | |
| `timestamp` | `timestamp` | ISO 8601 |
| `caption` | `caption` | 可能為空 |
| `mediaType` | `media_type` | IMAGE / VIDEO / CAROUSEL_ALBUM |
| `likeCount` | `like_count` | 需加 `like_count` 到 fields |
| `commentCount` | `comments_count` | |
| `viewCount` | `video_views` | 僅影片有效，需另外查詢 |

### Facebook（Pages API 回應 → Normalized）

| Normalized 欄位 | Meta Graph API 欄位 | 備註 |
|----------------|---------------------|------|
| `postId` | `id` | 格式：`{page-id}_{post-id}` |
| `timestamp` | `created_time` | ISO 8601 |
| `caption` | `message` | 可能為空 |
| `mediaType` | 無直接對應 | 需自行推斷（有 `attachments` 的視為含媒體） |
| `likeCount` | `likes.summary.total_count` | 需 `likes.summary(true)` |
| `commentCount` | `comments.summary.total_count` | 需 `comments.summary(true)` |

### TikTok（Video List API 回應 → Normalized）

| Normalized 欄位 | TikTok API 欄位 | 備註 |
|----------------|-----------------|------|
| `postId` | `id` | |
| `timestamp` | `create_time` | Unix timestamp（秒），需轉 ISO 8601 |
| `caption` | `video_description` | |
| `mediaType` | 固定為 `VIDEO` | |
| `likeCount` | `like_count` | |
| `commentCount` | `comment_count` | |
| `viewCount` | `view_count` | |
| `shareCount` | `share_count` | |

---

## 五、風險清單

| 風險 | 嚴重程度 | 因應方式 |
|------|---------|---------|
| Meta App Review 尚未通過 | 高 | 先用自己帳號（列為 Developer）測試；立即送出審查申請 |
| Instagram 帳號非專業帳號 | 中 | 在 Instagram App 切換為 Professional Account |
| TikTok Sandbox 資料不真實 | 低 | 用 Sandbox 驗證 OAuth 流程，換真實 token 後再測資料 |
| Meta token 需重新授權 | 中 | Day 3 的刷新機制 + Dashboard 警告可解決 |
| API Rate Limit 超過 | 低 | 排程設計已有冷卻機制；初期帳號數量少，不易觸發 |
| TikTok `video.list` 需 App Review | 中 | 送出後立即申請，預計 3-7 天；期間用 `user.info.basic` 驗測流程 |

---

## 六、環境變數整理

完成後，`.env` 需新增以下變數：

```env
# Meta（Facebook + Instagram）
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=http://localhost:3000/api/oauth/meta/callback

# TikTok
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=http://localhost:3000/api/oauth/tiktok/callback

# Feature flags（可在開發期間用 fixture，上線後切換）
USE_REAL_META_API=false
USE_REAL_TIKTOK_API=false
```

---

## 七、建議開發順序（四天衝刺）

```
Day 1 上午  申請 Meta App + TikTok App（開發者後台操作）
Day 1 下午  Meta OAuth 流程（authorize → callback → 儲存 token）
Day 2 上午  Instagram 真實 Adapter（fetchAccountContent 實作）
Day 2 下午  Facebook 真實 Adapter + TikTok OAuth 流程
Day 3 上午  TikTok 真實 Adapter
Day 3 下午  Token 刷新機制 + Platform Registry feature flag
Day 4       端到端整合測試 + 錯誤處理補強
```

---

## 八、參考連結

- Meta Graph API Explorer：https://developers.facebook.com/tools/explorer/
- Instagram Graph API 文件：https://developers.facebook.com/docs/instagram-api
- Meta API Changelog（目前最新版本：v21.0）：https://developers.facebook.com/docs/graph-api/changelog
- TikTok API 文件：https://developers.tiktok.com/doc/overview
- TikTok Sandbox 說明：https://developers.tiktok.com/doc/sandbox
