# ADR-004:部署於自架 Linux 主機(非雲端 PaaS)

**狀態**:Accepted
**日期**:2026-04-04
**決策者**:專案擁有者

---

## 背景

Supabase 遷移(見 [ADR-002](ADR-002-supabase-migration.md))有兩種部署路徑:
1. 使用 Supabase 官方 Hosted 服務 + 雲端 PaaS(Railway / Render / Fly.io)部署 Node.js backend
2. 在自有 Linux 主機上用 Docker Compose 自架全套服務

專案擁有者擁有**小型主機與固定 IP**,希望用此主機部署而非走雲端。

## 決策

**採用自架方案**:

- **作業系統**:Ubuntu / Debian(Linux)
- **容器化**:Docker Compose
- **Supabase**:自架版本(非 supabase.com hosted)
- **反向代理**:Caddy(因自動 HTTPS 設定簡單)
- **外部入口**:正式域名 + Cloudflare(見 [ADR-005](ADR-005-domain-cloudflare.md))
- **內部管理通道**:Tailscale(SSH + Supabase Studio)

## 考慮過的選項

### 選項 A:Supabase Hosted + 雲端 PaaS ❌
- **優點**:零維運、自動擴展、內建備份。
- **缺點**:持續月費、資料放在第三方、已經有自有主機未使用。
- **結論**:使用者明確表態不放雲端。

### 選項 B:自架 Supabase + Linux 主機 ✅
- **優點**:完全掌控資料、零月費、已有主機資源。
- **缺點**:需自行負責備份、監控、安全維護。
- **結論**:採用,需搭配完整的安全防禦架構(見 [Security Playbook](../security-playbook.md))。

## 服務架構

```
                  Internet
                     │
              ┌──────▼──────┐
              │  Cloudflare  │  ← DNS + SSL 終止 + DDoS 防護 + WAF
              │  (Proxy 模式) │
              └──────┬──────┘
                     │ HTTPS(Cloudflare → 主機,Origin Certificate)
                     │
            ┌────────▼────────┐
            │   Caddy          │  ← 反向代理,HTTPS 終止(backup)
            │   Port 443/80    │     路由分流:
            │                  │     /  → frontend (static)
            │                  │     /api/* → Node.js backend
            │                  │     /supabase/* → Supabase Studio(可選)
            └───┬────────┬────┘
                │        │
     ┌──────────▼──┐  ┌──▼──────────────────────────┐
     │  Node.js     │  │  Docker: Supabase 自架       │
     │  Backend     │  │  ├─ PostgreSQL (port 5432)   │
     │  (port 3000) │  │  ├─ Auth (GoTrue)           │
     │              │  │  ├─ REST (PostgREST)        │
     │              │  │  ├─ Realtime                │
     │              │  │  └─ Studio Dashboard        │
     └──────────────┘  └─────────────────────────────┘
```

## 為什麼是 Caddy 而非 Nginx?

| | Caddy | Nginx |
|---|---|---|
| 自動 HTTPS | ✅ 自動申請 Let's Encrypt | 需手動設定 certbot |
| 設定複雜度 | 極簡(5 行搞定) | 較冗長 |
| 反向代理 | 內建 | 內建 |
| 效能 | 足夠(中小流量) | 更高(大流量) |

預期流量為中小型,Caddy 的維運成本優勢大於 Nginx 的效能優勢。

## 後果

- **需要自行維護**:安全更新、備份、監控告警。具體作法見 [Security Playbook](../security-playbook.md)。
- **只有 Caddy 暴露 80/443**:其他所有服務綁 `127.0.0.1`。
- **Tailscale 角色轉換**:從「對外入口」變成「內部管理通道」。
  | 用途 | 工具 |
  |------|------|
  | 正式環境(用戶存取) | 域名 + Cloudflare + 固定 IP |
  | 開發 / 遠端管理 | Tailscale(SSH 進主機、存取 Supabase Studio) |
  | 緊急備用 | Tailscale Funnel(主域名出問題時臨時用) |

## 相關文件

- [ADR-005:域名與 Cloudflare](ADR-005-domain-cloudflare.md)
- [Technical Spec:Deployment Infrastructure](../technical-spec/deployment-infrastructure.md)
- [Security Playbook](../security-playbook.md)
