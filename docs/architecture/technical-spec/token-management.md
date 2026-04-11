# Technical Spec:Token 管理(儲存、刷新、生命週期)

**目的**:三個平台 token 的儲存、刷新策略、生命週期規則。`token-refresh-service` 與 OAuth callback 實作以本文件為準。

**對應 ADR**:[ADR-001 OAuth 多租戶](../adr/ADR-001-oauth-multitenant.md)

---

## Token 三平台比較

| | TikTok | Meta(FB + IG) | Google(Sheet) |
|---|---|---|---|
| Access Token 有效期 | 24 小時 | Short-lived: 1-2 小時 / Long-lived: 60 天 | 1 小時 |
| 有 Refresh Token? | ✅(365 天) | ❌ | ✅(永久,除非撤銷) |
| 自動刷新可行? | ✅ 完全自動 | ❌ 需用戶重新授權 | ✅ 完全自動 |
| 用戶多久需重新授權? | 365 天 | 60 天 | 幾乎不需要 |
| Token 撤銷 API? | ✅ | ✅ | ✅ |

---

## Token 儲存流程(OAuth callback 後)

```
用戶授權後,callback 收到 code
          ↓
後端用 code 換 access_token(Meta 還要交換 long-lived)
          ↓
確認 token 有效(呼叫 /me 或 /v2/user/info/)
          ↓
用 secret-box.ts 加密 access_token (+ refresh_token)
          ↓
UPSERT 到 Supabase platform_tokens 表
  WHERE user_id = req.user.id(Supabase Auth 提供)
  AND platform = 'tiktok' | 'meta' | 'google'
  AND account_id = <platform-specific id>
          ↓
Adapter 執行時:
  從 platform_tokens 查出對應 token → 解密 → 呼叫平台 API
```

---

## TikTok Token 生命週期

```
                        access_token                 refresh_token
─────────────────────────────────────────────────────────────────────
有效期限               24 小時                       365 天
取得方式               OAuth callback                OAuth callback(一起發的)
用途                   呼叫所有 TikTok API            換新 access_token
刷新方式               POST /v2/oauth/token/          無法刷新,過期就要重新授權
                       grant_type=refresh_token
刷新後                 舊 access_token 失效           回傳新的 refresh_token(也要更新)
```

### TikTok 自動刷新流程(由 `token-refresh-service` 負責)

```
排程同步啟動前 → 檢查 platform_tokens WHERE platform = 'tiktok'
         ↓
if (access_token 過期 && refresh_token 未過期)
  → POST /v2/oauth/token/ { grant_type: refresh_token, refresh_token: ... }
  → 更新 access_token + refresh_token + expires_at
         ↓
if (refresh_token 也過期)
  → 標記此連線為 expired
  → Dashboard 顯示「TikTok 連結已過期,請重新授權」
  → 用戶點擊後重跑 OAuth 流程
```

---

## Meta Token 刷新策略

Meta 沒有 refresh_token,無法靜默刷新。所有使用 Meta API 的工具(Buffer、Hootsuite)都面臨同樣的問題,用戶必須每 60 天重新授權一次。

```
if (long-lived token 剩餘 < 7 天)
  → Dashboard 顯示「Meta 連結即將過期,請重新授權」
  → 用戶重新走 OAuth 流程

if (long-lived token 已過期)
  → 標記連線為 expired
  → 排程同步跳過此用戶的 Meta 帳號
  → 記錄錯誤:「Meta 授權已過期,請重新連結」
```

---

## Google Token 刷新

現有 `google-oauth-service.js` 已實作 refresh token 邏輯,遷移後保留。唯一改變:token 從原本的 `google-connections.json` 改存 `platform_tokens` 表(`platform='google'`)。

---

## `token-refresh-service` 的排程建議

每次排程同步執行前(或每小時一次)掃描 `platform_tokens` 表:

```sql
-- 找出需要刷新的 TikTok token(過期前 1 小時)
SELECT * FROM platform_tokens
WHERE platform = 'tiktok'
  AND expires_at < now() + interval '1 hour'
  AND refresh_token IS NOT NULL;

-- 找出即將過期的 Meta token(過期前 7 天,提醒用戶)
SELECT * FROM platform_tokens
WHERE platform IN ('instagram', 'facebook')
  AND expires_at < now() + interval '7 days';

-- 找出需要刷新的 Google token(過期前 5 分鐘)
SELECT * FROM platform_tokens
WHERE platform = 'google'
  AND expires_at < now() + interval '5 minutes'
  AND refresh_token IS NOT NULL;
```

---

## Token 加密雙層保護

| 層 | 機制 | 攻擊者模型 |
|---|---|---|
| Layer 1:Row Level Security(RLS) | 資料庫政策:`auth.uid() = user_id` | 其他租戶的合法使用者 |
| Layer 2:應用層 AES-256-GCM | `lib/secret-box.ts` 加密後才寫入 `access_token` 欄位 | 能直接查詢資料庫的內部人員或外洩備份 |

> ⚠️ **警告**:即使有 RLS,`access_token` / `refresh_token` **必須**先經 `secret-box` 加密再寫入。RLS 防不住資料庫管理員或資料庫備份外洩的情境。

### 加密金鑰

- 金鑰存在 `.env` 的 `TOKEN_ENCRYPTION_SECRET`(詳見 [Environment Variables](environment-variables.md))
- 金鑰輪替時需要:
  1. 用舊金鑰解密所有 `platform_tokens.access_token` / `refresh_token`
  2. 用新金鑰重新加密
  3. UPDATE 回資料庫
  4. 更新 `.env` 並重啟服務

## ⚠️ 安全性提醒:既有 `docs/tiktok-verify-site/server.py`

Python 原型將 `CLIENT_SECRET` 直接寫在原始碼中:

```python
CLIENT_SECRET = "vnYhenm8Hxz344t6vw18jV3vEjIq5bXY"  # ← 不可進入 git!
```

**立即行動**:

1. 將 `docs/tiktok-verify-site/` 加入 `.gitignore`(或從 repo 中移除)
2. 到 TikTok Developer Console **重新產生 Client Secret**
3. 正式系統改用環境變數 `TIKTOK_CLIENT_SECRET`

---

## 相關文件

- [Database Schema](database-schema.md):`platform_tokens` 表結構
- [OAuth Flows](oauth-flows.md):三平台授權流程
- [Environment Variables](environment-variables.md):`TOKEN_ENCRYPTION_SECRET`、各平台憑證
- [Security Playbook](../security-playbook.md):金鑰管理與輪替
