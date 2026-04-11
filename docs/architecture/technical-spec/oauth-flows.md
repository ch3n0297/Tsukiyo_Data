# Technical Spec:OAuth 流程(Meta / TikTok / Google)

**目的**:三個平台的 OAuth 授權端點、callback 流程、必要參數的**唯一權威參考**。Coding Agent 實作 OAuth routes / services 時,所有端點 URL 與欄位名以本文件為準。**不要**憑記憶推測。

**對應 ADR**:[ADR-001 OAuth 多租戶模式](../adr/ADR-001-oauth-multitenant.md)

---

## 通用流程(所有平台)

```
用戶在 Dashboard 點「連結 [平台]」
    ↓
後端 GET /api/oauth/{platform}/authorize
    ├─ 產生 state(存入 oauth_state 表,綁定 user_id)
    ├─ 組裝 authorize URL
    └─ 302 redirect 到 authorize URL
    ↓
用戶在平台官方頁授權
    ↓
平台 redirect 到 /api/oauth/{platform}/callback?code=...&state=...
    ↓
後端 callback:
    1. 驗證 state(防 CSRF,與 user_id 綁定)
    2. 用 code 換 access_token
    3. (Meta)交換 long-lived token
    4. (必要時)取得 account info(open_id, ig_user_id, page_id)
    5. 用 secret-box AES-256-GCM 加密 token
    6. UPSERT 到 platform_tokens
    7. 302 redirect 回 Dashboard(顯示「已連結」)
```

---

## TikTok OAuth

### 來源:`docs/tiktok-verify-site/server.py`(Python 原型)

已完成的前置工作:

| 項目 | 狀態 | 位置 |
|------|------|------|
| TikTok Developer App 申請 | ✅ 已完成 | Client Key: `sbawe3p2ylashwdxeb`(舊值,已須輪替) |
| 域名驗證檔案 | ✅ 已完成 | `tiktok2323K0O5...txt`、`tiktok4kQI4V...txt` |
| OAuth callback(Python 原型) | ✅ 可運作 | `server.py`(code → token 交換) |
| Redirect URI | ⚠️ 需更新 | 從 Tailscale tunnel 改為 `datatsukiyo.org` |

> ⚠️ **決策(來自 ADR-003):Python 版 `server.py` 僅作為流程驗證的歷史參考**,正式系統必須以 TypeScript + Fastify 實作,**不引入 Python runtime**。
>
> 理由:
> 1. 專案技術棧統一(Node.js + Supabase)
> 2. Token 儲存需要走 Supabase client + secret-box 加密,Python 版無法共用
> 3. Auth middleware(Supabase JWT 驗證)只在 Node.js 後端存在
> 4. 多租戶的 `user_id` 綁定只有在同一個 request context 裡才能拿到

### TikTok 已驗證的流程(Python 原型)

```
GET /auth/tiktok/callback?code=xxx&state=yyy&scopes=zzz
        ↓
POST https://open.tiktokapis.com/v2/oauth/token/
  Content-Type: application/x-www-form-urlencoded
  Body: client_key, client_secret, code, grant_type=authorization_code, redirect_uri
        ↓
回應:{ access_token, refresh_token, expires_in, open_id, scope, token_type }
```

### TikTok API 端點速查

| 用途 | 方法 | URL | 備註 |
|------|------|-----|------|
| 授權入口 | GET | `https://www.tiktok.com/v2/auth/authorize/?client_key={key}&scope={scopes}&redirect_uri={uri}&response_type=code&state={state}` | 用戶瀏覽器跳轉 |
| Token 交換 | POST | `https://open.tiktokapis.com/v2/oauth/token/` | `grant_type=authorization_code` |
| Token 刷新 | POST | `https://open.tiktokapis.com/v2/oauth/token/` | `grant_type=refresh_token` |
| Token 撤銷 | POST | `https://open.tiktokapis.com/v2/oauth/revoke/` | 用戶「解除連結」時呼叫 |
| 用戶資訊 | GET | `https://open.tiktokapis.com/v2/user/info/` | Header: `Authorization: Bearer {token}` |
| 影片列表 | POST | `https://open.tiktokapis.com/v2/video/list/` | Body: `{ max_count: 20 }` |

### 多租戶版本差異

```
                    Python 原型                    多租戶版本(Node.js + Supabase)
─────────────────────────────────────────────────────────────────────────────
誰發起授權?         手動拼 URL                     用戶在 Dashboard 點「連結 TikTok」
                                                   → 後端產生 authorize URL(含 state)

callback 做什麼?   印出 token JSON                 1. 驗證 state(防 CSRF)
                                                   2. 用 code 換 token
                                                   3. 呼叫 /v2/user/info/ 取得 open_id 與名稱
                                                   4. secret-box 加密 access_token + refresh_token
                                                   5. UPSERT 到 Supabase platform_tokens
                                                      WHERE user_id = 當前登入用戶
                                                      AND platform = 'tiktok'
                                                   6. 導回 Dashboard

token 存哪裡?      沒有存                          Supabase platform_tokens 表(加密)

過期怎麼辦?        手動重跑                        token-refresh-service 自動刷新
```

### TikTok 所需 Scopes

| Scope | 用途 | 是否需審查 |
|-------|------|---------|
| `user.info.basic` | 讀取帳號基本資料 | 否 |
| `user.info.stats` | 讀取粉絲數、獲讚數等統計 | 是 |
| `video.list` | 列出帳號影片 | 是 |

### Redirect URI(正式環境)

```
https://datatsukiyo.org/api/oauth/tiktok/callback
```

TikTok 域名驗證檔案需放在 `https://datatsukiyo.org/tiktok{code}.txt`(沿用既有驗證檔)。

---

## Meta OAuth(Facebook + Instagram 共用)

### 與 TikTok 的差異

```
                        TikTok                      Meta(FB + IG)
─────────────────────────────────────────────────────────────────────
Token 交換              POST form-urlencoded          GET query string(也可 POST)
有 refresh_token?      ✅ 有(365 天)                ❌ 沒有
延長 token 方式         用 refresh_token               交換 long-lived token(60 天)
Long-lived 過期後?     用 refresh_token 換新           必須重新授權
一個 token 取多帳號?   否(一對一)                     是(User token → 可取所有管理的 Pages + IG)
```

### Meta 授權後的多步驟 Token 處理

Meta 的 callback 比 TikTok 多了幾個步驟,因為一個 User Token 可以存取該用戶管理的所有 Facebook Pages 和 Instagram Professional 帳號:

```
callback 收到 code
    ↓
1. 用 code 換 short-lived access_token(1-2 小時)
    POST https://graph.facebook.com/v21.0/oauth/access_token
    ↓
2. 立即交換為 long-lived token(60 天)
    GET https://graph.facebook.com/v21.0/oauth/access_token
      ?grant_type=fb_exchange_token
      &client_id={app_id}
      &client_secret={app_secret}
      &fb_exchange_token={short_lived_token}
    ↓
3. 用 long-lived token 列出該用戶管理的所有 Pages
    GET /me/accounts → 回傳 [{ id, name, access_token(Page token)}, ...]
    ↓
4. 對每個 Page,取得其關聯的 Instagram Business 帳號
    GET /{page-id}?fields=instagram_business_account
    ↓
5. 儲存到 Supabase:
   - platform_tokens: user_id + platform='meta' + user-level long-lived token
   - 另外建立 account_configs: 每個 Page / IG 帳號各一筆
   - Dashboard 顯示「已找到 N 個 Facebook 頁面 + M 個 Instagram 帳號」
```

### Meta API 端點速查

| 用途 | 方法 | URL |
|------|------|-----|
| 授權入口 | GET | `https://www.facebook.com/v21.0/dialog/oauth?client_id=...&redirect_uri=...&scope=...&state=...` |
| Token 交換 | POST | `https://graph.facebook.com/v21.0/oauth/access_token` |
| Long-lived 交換 | GET | `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&...` |
| 使用者 Pages | GET | `https://graph.facebook.com/v21.0/me/accounts` |
| Page 關聯 IG | GET | `https://graph.facebook.com/v21.0/{page-id}?fields=instagram_business_account` |
| IG Media | GET | `https://graph.facebook.com/v21.0/{ig-user-id}/media?fields=id,caption,media_type,timestamp,like_count,comments_count` |
| FB Page Posts | GET | `https://graph.facebook.com/v21.0/{page-id}/posts?fields=id,message,created_time,likes.summary(true),comments.summary(true)` |

### Meta 所需 Permissions(Scopes)

| Permission | 用途 | 是否需 App Review |
|------------|------|-----------------|
| `pages_show_list` | 列出管理的 Facebook Pages | 否(開發模式可用) |
| `pages_read_engagement` | 讀取 Page 貼文互動數據 | 否(開發模式可用) |
| `read_insights` | 讀取 Page Insights | **是**(需審查) |
| `instagram_basic` | 讀取 IG 基本個人資料 | 否 |
| `instagram_manage_insights` | 讀取 IG 媒體分析數據 | **是**(需審查) |
| `business_management` | 管理業務帳號 | **是**(需審查) |

### Instagram 帳號要求

- 必須是**專業帳號**(Business 或 Creator),才能使用 Instagram Graph API
- 個人帳號只能用 Instagram Basic Display API(功能較少)
- 可在 Instagram App → 設定 → 帳號 → 切換為「專業帳號」

### Redirect URI(正式環境)

```
https://datatsukiyo.org/api/oauth/meta/callback
```

---

## Google OAuth(Sheet 整合,現有)

現有 `google-oauth-service.js` 保留,但:
- Token 改存 `platform_tokens` 表(`platform='google'`),而非獨立 `google-connection-repository`
- Auth middleware 改為 Supabase JWT

### Redirect URI(正式環境)

```
https://datatsukiyo.org/api/oauth/google/callback
```

---

## OAuth State 防 CSRF

無論哪個平台,authorize URL 都必須帶 `state` 參數。後端流程:

```typescript
// /api/oauth/{platform}/authorize
const state = crypto.randomUUID();
await oauthStateRepository.create({
  state,
  userId: req.user.id,
  platform: 'tiktok', // 或 'meta' / 'google'
  createdAt: new Date(),
});
const url = buildAuthorizeUrl({ state, ... });
reply.redirect(url);

// /api/oauth/{platform}/callback
const stored = await oauthStateRepository.findByState(req.query.state);
if (!stored || stored.platform !== 'tiktok') {
  throw new HttpError(400, 'Invalid state');
}
await oauthStateRepository.delete(stored.id); // 一次性使用
// ... 繼續 token 交換流程,userId = stored.userId
```

---

## 相關文件

- [Token Management](token-management.md):token 儲存與刷新策略
- [Database Schema](database-schema.md):`platform_tokens` 表結構
- [Environment Variables](environment-variables.md):各平台的 Client ID/Secret 變數名
- [ADR-001:OAuth 多租戶](../adr/ADR-001-oauth-multitenant.md)
