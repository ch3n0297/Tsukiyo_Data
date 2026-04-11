# Security Playbook:五層防禦架構 + Checklist

**目的**:自架部署下的網路安全與資訊安全防禦策略。部署 / 安全性審查時以本文件為據。

**對應 ADR**:
- [ADR-004:自架部署](adr/ADR-004-self-hosted-deployment.md)
- [ADR-005:域名 + Cloudflare](adr/ADR-005-domain-cloudflare.md)

---

## 防禦架構總覽

```
威脅來源(Internet)
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ Layer 1: Cloudflare(邊緣防禦)                        │
│  ├─ DDoS 自動緩解(L3/L4/L7)                         │
│  ├─ WAF Managed Ruleset(OWASP Top 10)              │
│  ├─ Rate Limiting(API 限流)                         │
│  ├─ Bot Management(基礎版,免費方案含)               │
│  └─ 真實 IP 隱藏(Proxy 模式)                        │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ Layer 2: 主機防火牆(ufw / iptables)                  │
│  ├─ 只開放 80、443(僅接受 Cloudflare IP 範圍)        │
│  ├─ SSH 只允許 Tailscale 網段                         │
│  └─ 其他所有 port 預設 DROP                           │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ Layer 3: 反向代理(Caddy)                             │
│  ├─ TLS 終止 + HSTS                                  │
│  ├─ 只轉發到 localhost 服務                           │
│  └─ Request header 清洗                              │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ Layer 4: 應用層(Node.js Backend)                     │
│  ├─ Supabase Auth JWT 驗證                           │
│  ├─ CORS 白名單(只允許你的域名)                      │
│  ├─ Rate Limiting(fastify-rate-limit,二次限流)      │
│  ├─ Input Validation(Zod / AJV)                    │
│  ├─ HMAC 簽章驗證(Apps Script 請求)                 │
│  └─ CSP / X-Frame-Options / X-Content-Type-Options   │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ Layer 5: 資料層(Supabase / PostgreSQL)               │
│  ├─ Row Level Security(多租戶隔離)                   │
│  ├─ Token 應用層加密(secret-box AES-256-GCM)        │
│  ├─ 資料庫連線只綁 127.0.0.1                          │
│  └─ 定期自動備份                                      │
└──────────────────────────────────────────────────────┘
```

---

## Layer 2:主機加固

```bash
# ── 防火牆(ufw)──────────────────────
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 只接受 Cloudflare IP 範圍的 443
sudo ufw allow from 173.245.48.0/20 to any port 443
sudo ufw allow from 103.21.244.0/22 to any port 443
sudo ufw allow from 103.22.200.0/22 to any port 443
sudo ufw allow from 103.31.4.0/22 to any port 443
sudo ufw allow from 141.101.64.0/18 to any port 443
sudo ufw allow from 108.162.192.0/18 to any port 443
sudo ufw allow from 190.93.240.0/20 to any port 443
sudo ufw allow from 188.114.96.0/20 to any port 443
sudo ufw allow from 197.234.240.0/22 to any port 443
sudo ufw allow from 198.41.128.0/17 to any port 443
sudo ufw allow from 162.158.0.0/15 to any port 443
sudo ufw allow from 104.16.0.0/13 to any port 443
sudo ufw allow from 104.24.0.0/14 to any port 443
sudo ufw allow from 172.64.0.0/13 to any port 443
sudo ufw allow from 131.0.72.0/22 to any port 443

# SSH 只走 Tailscale
sudo ufw allow in on tailscale0 to any port 22
sudo ufw enable

# ── SSH 加固 ──────────────────────────
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no          # 只用 SSH key
PubkeyAuthentication yes
MaxAuthTries 3
AllowUsers your-username

# ── 自動安全更新 ─────────────────────
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# ── fail2ban(防暴力破解)────────────
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

> Cloudflare IP 範圍會變動,定期至 https://www.cloudflare.com/ips/ 更新。

---

## Layer 4:應用層安全設定

### CORS 白名單

```typescript
app.register(cors, {
  origin: [
    'https://datatsukiyo.org',
    'https://www.datatsukiyo.org',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
```

### Security Headers(Caddy 或 Fastify 層加)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

> 註:`X-XSS-Protection` 已被主流瀏覽器棄用,用 CSP 取代即可。

### Rate Limiting(應用層二次防護)

```typescript
// 即使 Cloudflare 已有 rate limit,應用層也要加
app.register(import('@fastify/rate-limit'), {
  global: true,
  max: 100,            // 每個 IP 每分鐘 100 次
  timeWindow: '1 minute',
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
});

// OAuth callback 更嚴格
app.register(import('@fastify/rate-limit'), {
  max: 10,             // 每個 IP 每分鐘 10 次
  timeWindow: '1 minute',
  routeConfig: { rateLimit: { prefix: '/api/oauth/' } },
});
```

### Input Validation

所有 API 端點使用 Zod(或 AJV)驗證 request body / query / params。

---

## Layer 5:資料層安全

### PostgreSQL 設定

```sql
-- docker-compose 已綁 127.0.0.1,再在 pg_hba.conf 加強:
-- host all all 0.0.0.0/0 reject
-- host all all 127.0.0.1/32 scram-sha-256

-- 定期備份(加入 crontab)
-- 0 3 * * * docker exec supabase-db pg_dump -U postgres > /backup/db-$(date +\%Y\%m\%d).sql
```

### Token 雙層保護

| 層 | 機制 |
|---|---|
| Row Level Security | `auth.uid() = user_id`(每張表) |
| 應用層加密 | `lib/secret-box.ts` AES-256-GCM |

詳見 [Token Management](technical-spec/token-management.md)。

---

## 機密管理

| 機密 | 儲存方式 | 存取控制 |
|------|---------|---------|
| 用戶的平台 Token | `platform_tokens` 表 + AES-256-GCM 加密 | RLS(只有 token 擁有者) |
| Meta App Secret | `.env` 檔案 | 主機 filesystem 權限 600 |
| TikTok Client Secret | `.env` 檔案 | 主機 filesystem 權限 600 |
| Supabase Service Role Key | `.env` 檔案 | 絕不暴露給前端 |
| `TOKEN_ENCRYPTION_SECRET` | `.env` 檔案 | 加密所有 token 的主金鑰 |

```bash
chmod 600 .env
chown your-username:your-username .env
echo ".env" >> .gitignore
```

### 金鑰輪替策略

見 [Environment Variables](technical-spec/environment-variables.md) 的「金鑰輪替策略」表。

---

## 備份策略

| 備份項目 | 頻率 | 保留 | 方式 |
|---------|------|------|------|
| PostgreSQL 完整備份 | 每日凌晨 3 點 | 30 天 | `pg_dump` → 本地 + 異地一份 |
| `.env` + Docker 設定 | 每次變更時 | 永久 | 手動複製到安全位置(不放 git) |
| Docker volumes | 每週 | 4 週 | `tar` 打包 |
| Caddy 設定 | 每次變更時 | Git 管理 | 可進 repo(無機密) |

---

## 監控與告警

```bash
# 1. 系統資源
sudo apt install htop iotop

# 2. Docker 容器
docker stats --no-stream
# 或安裝 ctop: https://github.com/bcicen/ctop

# 3. 日誌集中
docker logs -f backend --since 1h

# 4. 簡易告警(推薦 UptimeRobot 免費版)
#    監控 https://datatsukiyo.org/api/health
#    每 5 分鐘檢查,失敗就發 email / Telegram 通知
```

可視規模再加上 Prometheus + Node Exporter + Grafana,初期不必要。

---

## 安全 Checklist(部署前必過)

| 類別 | 項目 | 狀態 |
|------|------|------|
| **網路** | Cloudflare Proxy 模式(隱藏真實 IP) | ☐ |
| | ufw 只開 443,限 Cloudflare IP 範圍 | ☐ |
| | SSH 只走 Tailscale | ☐ |
| **TLS** | Cloudflare SSL Full (Strict) | ☐ |
| | Origin Certificate 安裝到主機 | ☐ |
| | HSTS 啟用 | ☐ |
| **應用** | CORS 白名單設定 | ☐ |
| | Security Headers 完整 | ☐ |
| | Rate Limiting(Cloudflare + 應用層雙重) | ☐ |
| | Input Validation(所有 API 端點) | ☐ |
| **認證** | Supabase Auth JWT 驗證 | ☐ |
| | OAuth state 防 CSRF | ☐ |
| | HMAC timestamp 防重放(±5 分鐘) | ☐ |
| **資料** | RLS 啟用(所有資料表) | ☐ |
| | Token AES-256-GCM 加密 | ☐ |
| | PostgreSQL 只綁 127.0.0.1 | ☐ |
| | `.env` 權限 600 | ☐ |
| **運維** | 自動安全更新(unattended-upgrades) | ☐ |
| | fail2ban 啟用 | ☐ |
| | 每日資料庫備份 | ☐ |
| | Health check 監控(UptimeRobot) | ☐ |
| **機密** | TikTok Client Secret 從原始碼移除 | ☐ |
| | 所有機密只存在 `.env`,不進 git | ☐ |

---

## 相關文件

- [ADR-004:自架部署](adr/ADR-004-self-hosted-deployment.md)
- [ADR-005:域名 + Cloudflare](adr/ADR-005-domain-cloudflare.md)
- [Deployment Infrastructure](technical-spec/deployment-infrastructure.md)
- [Token Management](technical-spec/token-management.md)
- [Environment Variables](technical-spec/environment-variables.md)
