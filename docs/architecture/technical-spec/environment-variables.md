# Technical Spec:環境變數清單

**目的**:所有 `.env` 變數的**唯一權威清單**。Coding Agent 新增/引用環境變數時,名稱以本文件為準,不得自創縮寫。

**正式域名**:`datatsukiyo.org`(2026-04-04 確認申請)
所有 OAuth Redirect URI、CORS 白名單、Cloudflare DNS 設定皆以此域名為基準。

---

## `.env` 完整清單

```env
# ── 應用基本設定 ────────────────────────────
APP_DOMAIN=datatsukiyo.org
APP_BASE_URL=https://datatsukiyo.org
APP_ENV=production                            # production / development

# ── Supabase(自架,Docker Compose)────────
SUPABASE_URL=https://datatsukiyo.org/supabase  # 或內部 http://supabase-kong:8000
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # ← 後端專用,勿暴露給前端
SUPABASE_JWT_SECRET=                          # 自架 Supabase 的 JWT secret

# PostgreSQL 直連(後端 repository 層用)
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/postgres

# ── Meta(Facebook + Instagram)─────────────
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=https://datatsukiyo.org/api/oauth/meta/callback

# ── TikTok ─────────────────────────────────
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=                         # ← 請於 TikTok Developer Console 重新產生
TIKTOK_REDIRECT_URI=https://datatsukiyo.org/api/oauth/tiktok/callback

# ── Google(Sheet 整合,現有)────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_LOGIN_REDIRECT_URI=https://datatsukiyo.org/api/oauth/google/callback

# ── 加密與簽章 ──────────────────────────────
TOKEN_ENCRYPTION_SECRET=                      # AES-256-GCM 金鑰,高強度隨機字串
API_SHARED_SECRET=                            # HMAC 驗證用(Apps Script 請求)

# ── CORS 白名單 ────────────────────────────
CORS_ALLOWED_ORIGINS=https://datatsukiyo.org,https://www.datatsukiyo.org

# ── Feature Flags ─────────────────────────
USE_REAL_META_API=true
USE_REAL_TIKTOK_API=true
USE_REAL_GOOGLE_SHEET=true
```

---

## 檔案權限與 Git 管理

```bash
# .env 檔案權限(主機上)
chmod 600 .env
chown your-username:your-username .env

# 絕不把 .env 加入 git
echo ".env" >> .gitignore
```

另應確保 `docs/tiktok-verify-site/server.py`(含舊 CLIENT_SECRET)已加入 `.gitignore` 或從 repo 移除(詳見 [Token Management](token-management.md))。

---

## 對應需同步更新的外部設定

| 項目 | 設定位置 | 值 |
|------|---------|----|
| Cloudflare DNS A Record | Cloudflare Dashboard | `datatsukiyo.org` → 固定 IP(Proxy 開啟) |
| Cloudflare DNS A Record | Cloudflare Dashboard | `www.datatsukiyo.org` → 固定 IP(Proxy 開啟) |
| Cloudflare SSL/TLS | Cloudflare Dashboard | Full (Strict) |
| Caddy 反向代理 | `/etc/caddy/Caddyfile` | `datatsukiyo.org { ... }` |
| Meta App Redirect URI | developers.facebook.com | `https://datatsukiyo.org/api/oauth/meta/callback` |
| TikTok App Redirect URI | developers.tiktok.com | `https://datatsukiyo.org/api/oauth/tiktok/callback` |
| TikTok 域名驗證 | `https://datatsukiyo.org/tiktok{verify-code}.txt` | 沿用既有驗證檔 |
| Google Cloud Console | console.cloud.google.com | Authorized redirect URIs 加入正式域名 |

---

## 金鑰輪替策略

| 金鑰 | 輪替步驟 |
|------|---------|
| `TOKEN_ENCRYPTION_SECRET` | 寫一次性 migration:解密所有 `platform_tokens` → 用新金鑰重新加密 → UPDATE → 更新 `.env` → 重啟服務 |
| `META_APP_SECRET` / `TIKTOK_CLIENT_SECRET` | 只需更新 `.env` 並重啟;若是外洩導致輪替,舊 token 需強制用戶重新授權 |
| `SUPABASE_JWT_SECRET` | 變更需同步更新所有 client,所有現有 JWT 會失效 |
| `API_SHARED_SECRET` | 同步更新 Apps Script 端,允許舊新雙金鑰並存過渡期 |

---

## 相關文件

- [Database Schema](database-schema.md)
- [OAuth Flows](oauth-flows.md)
- [Token Management](token-management.md)
- [Deployment Infrastructure](deployment-infrastructure.md)
- [Security Playbook](../security-playbook.md)
