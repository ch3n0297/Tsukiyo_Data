# Technical Spec:部署基礎設施(Docker Compose + Caddy)

**目的**:自架 Linux 主機的完整部署架構、Docker Compose 設定、Caddy 反向代理、Cloudflare 邊緣設定。

**對應 ADR**:[ADR-004 自架部署](../adr/ADR-004-self-hosted-deployment.md)、[ADR-005 域名與 Cloudflare](../adr/ADR-005-domain-cloudflare.md)

---

## 主機環境

| 項目 | 規格 |
|------|------|
| 作業系統 | Ubuntu / Debian(Linux) |
| 網路 | 固定 IP |
| 開發網路 | Tailscale(開發 / 內部管理通道,正式流量走域名) |
| 正式域名 | `datatsukiyo.org` |

---

## 整體拓撲

```
                  Internet
                     │
              ┌──────▼──────┐
              │  Cloudflare  │  ← DNS + SSL 終止 + DDoS + WAF
              │  (Proxy 模式) │
              └──────┬──────┘
                     │ HTTPS(Origin Certificate)
                     │
            ┌────────▼────────┐
            │      Caddy       │  ← 反向代理(Port 443/80)
            │                  │     /  → frontend (static)
            │                  │     /api/* → Node.js backend
            │                  │     /supabase/* → Supabase Studio(可選)
            └───┬────────┬────┘
                │        │
     ┌──────────▼──┐  ┌──▼──────────────────────────┐
     │  Node.js     │  │  Docker: Supabase 自架       │
     │  Backend     │  │  ├─ PostgreSQL (port 5432)   │
     │  (port 3000) │  │  ├─ Auth (GoTrue)            │
     │              │  │  ├─ REST (PostgREST)         │
     │              │  │  ├─ Realtime                 │
     │              │  │  └─ Studio Dashboard          │
     └──────────────┘  └──────────────────────────────┘
```

**核心原則:只有 Caddy 暴露 80/443 到外網,其他所有服務綁 `127.0.0.1`。**

---

## Docker Compose(概要)

```yaml
# docker-compose.yml
services:
  # ── Supabase 核心 ──────────────────────
  supabase-db:
    image: supabase/postgres:15
    ports: ["127.0.0.1:5432:5432"]       # 只綁 localhost
    volumes: ["./volumes/db:/var/lib/postgresql/data"]
    restart: unless-stopped

  supabase-auth:
    image: supabase/gotrue:latest
    depends_on: [supabase-db]
    restart: unless-stopped

  supabase-rest:
    image: postgrest/postgrest:latest
    depends_on: [supabase-db]
    restart: unless-stopped

  supabase-studio:                       # 管理用 Dashboard(只走 Tailscale)
    image: supabase/studio:latest
    ports: ["127.0.0.1:3100:3000"]
    restart: unless-stopped

  # ── 應用服務 ────────────────────────────
  backend:
    build: ./backend
    ports: ["127.0.0.1:3000:3000"]
    env_file: .env
    depends_on: [supabase-db, supabase-auth]
    restart: unless-stopped

  # ── 反向代理 ────────────────────────────
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]          # 唯一暴露到外網的容器
    volumes:
      - "./Caddyfile:/etc/caddy/Caddyfile"
      - "caddy_data:/data"
      - "caddy_config:/config"
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

> 完整 `docker-compose.yml` 會在 Phase 0(Supabase 設定階段)依照官方自架指南補齊:https://supabase.com/docs/guides/self-hosting/docker

---

## Caddyfile(最小化設定)

```
datatsukiyo.org {
    handle /api/* {
        reverse_proxy localhost:3000
    }

    handle /supabase/* {
        # 只在內網使用;正式對外可省略
        reverse_proxy localhost:3100
    }

    handle {
        root * /srv/frontend/dist
        file_server
    }

    # Security Headers(詳見 security-playbook.md)
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
}
```

> Caddy 會在 Cloudflare Proxy 後以 Origin Certificate 提供 HTTPS(見下一節)。如果需要,也可改用 Caddy 內建的 Let's Encrypt 自動簽發(但要先把 Cloudflare Proxy 關掉做 challenge,較麻煩)。

---

## Cloudflare 設定

### DNS

```
Type: A
Name: @
Content: <你的固定 IP>
Proxy: ✅ 開啟(橘色雲朵)

Type: A
Name: www
Content: <你的固定 IP>
Proxy: ✅ 開啟
```

### SSL/TLS

- 模式:**Full (Strict)**
- 在主機上安裝 Cloudflare **Origin Certificate**(15 年免費)
- 把 Origin Certificate 放到 Caddy 的 TLS 設定中,取代自動 Let's Encrypt

### 其他建議

- Always Use HTTPS:開啟
- Automatic HTTPS Rewrites:開啟
- Minimum TLS Version:TLS 1.2 以上
- HSTS:開啟(Caddy 也會加 header)
- WAF Managed Ruleset:套用 OWASP Core Rule Set(免費方案含)

---

## Tailscale 的角色

| 用途 | 工具 |
|------|------|
| **正式環境(用戶存取)** | 域名 + Cloudflare + 固定 IP |
| **開發 / 遠端管理** | Tailscale(SSH 進主機、存取 Supabase Studio) |
| **緊急備用** | Tailscale Funnel(主域名出問題時臨時用) |

Tailscale 不退場,但從「對外入口」變成「內部管理通道」。

---

## 部署順序(搭配 Migration Plan)

1. **主機準備**:安裝 Docker、Docker Compose、ufw、fail2ban(詳見 [Security Playbook](../security-playbook.md))
2. **Cloudflare 設定**:買域名、DNS、Origin Certificate
3. **Docker Compose 啟動**:先只啟 Supabase stack,確認可連線
4. **套用 Migration**:執行 schema SQL(見 [database-schema.md](database-schema.md))
5. **啟動 backend + caddy**:驗證 `https://datatsukiyo.org/api/health` 可通
6. **OAuth 連線測試**:用測試帳號完整走一次 TikTok / Meta 授權流程

---

## 相關文件

- [ADR-004:自架部署](../adr/ADR-004-self-hosted-deployment.md)
- [ADR-005:域名與 Cloudflare](../adr/ADR-005-domain-cloudflare.md)
- [Environment Variables](environment-variables.md)
- [Security Playbook](../security-playbook.md)
- [Migration Plan](../migration-plan.md)
