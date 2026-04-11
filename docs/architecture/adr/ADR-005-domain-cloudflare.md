# ADR-005:採用正式域名 `datatsukiyo.org` + Cloudflare

**狀態**:Accepted
**日期**:2026-04-04
**決策者**:專案擁有者

---

## 背景

自架部署(見 [ADR-004](ADR-004-self-hosted-deployment.md))雖然有固定 IP,但對外服務不能只靠 IP:

- Meta 和 TikTok 的 OAuth App Review **不接受 IP 或 Tailscale subdomain**,要求正式域名。
- 用戶看到 `http://123.45.67.89:3000` 不會願意授權。
- 無域名就無法申請 Let's Encrypt / Cloudflare SSL,只能裸 HTTP。

## 決策

- **申請並使用正式域名**:`datatsukiyo.org`(已於 2026-04-04 確認申請)
- **DNS 與邊緣防護**:Cloudflare 免費方案
- **Proxy 模式開啟**(橘色雲朵):隱藏真實 IP
- **SSL/TLS 模式**:Full (Strict),搭配 Cloudflare Origin Certificate(15 年免費)

## 為什麼一定要買域名?

| 原因 | 說明 |
|------|------|
| OAuth 需求 | Meta 和 TikTok App Review 都要求正式域名,不接受 IP 或 Tailscale subdomain |
| HTTPS | Cloudflare 免費提供 SSL 證書,綁域名才能用 |
| 信任感 | 用戶看到 `https://datatsukiyo.org`,比看到 `http://123.45.67.89:3000` 更願意授權 |
| 未來擴展 | 換主機只要改 DNS,不用改所有 OAuth redirect URI |

## 為什麼是 Cloudflare 免費方案?

```
花費:
├─ 域名:~$10-15/年(Namecheap、Cloudflare Registrar、GoDaddy)
└─ Cloudflare:$0(免費方案就夠用)

你得到:
├─ DNS 代管
├─ 免費 SSL/TLS(Full Strict 模式)
├─ DDoS 防護(自動)
├─ WAF 基礎規則(免費方案含 Managed Ruleset)
├─ Rate Limiting(免費方案含基礎規則)
├─ 隱藏真實 IP(Proxy 模式下,攻擊者看不到你的固定 IP)
└─ CDN 快取(前端靜態資源自動加速)
```

## 考慮過的選項

### 選項 A:僅用 Tailscale subdomain ❌
- **缺點**:OAuth App Review 不接受,無法上線。
- **結論**:不可行。

### 選項 B:買域名 + 自行維護 Let's Encrypt ❌
- **優點**:完全掌控。
- **缺點**:需處理 certbot 續簽、無 DDoS 防護、真實 IP 暴露。
- **結論**:工作量大於 Cloudflare 免費方案帶來的效益。

### 選項 C:買域名 + Cloudflare 免費方案 ✅
- **優點**:DNS + SSL + DDoS + WAF + 隱藏 IP 一次到位,零月費。
- **缺點**:DNS 經過第三方(Cloudflare),但為業界標準做法。
- **結論**:採用。

## 設定步驟

```
1. 買域名 datatsukiyo.org(推薦直接在 Cloudflare Registrar 買)
2. 在 Cloudflare 加入你的域名
3. 設定 DNS Record:
   Type: A
   Name: @(或 datahub)
   Content: 你的固定 IP
   Proxy: ✅ 開啟(橘色雲朵)← 關鍵!這會隱藏你的真實 IP

4. SSL/TLS 設定:
   模式:Full (Strict)
   → Cloudflare ↔ 你的主機之間也走 HTTPS
   → 在主機上安裝 Cloudflare Origin Certificate(15 年免費)

5. 更新所有 OAuth Redirect URI:
   Meta:   https://datatsukiyo.org/api/oauth/meta/callback
   TikTok: https://datatsukiyo.org/api/oauth/tiktok/callback
   Google: https://datatsukiyo.org/api/oauth/google/callback
```

## 後果

- 所有 OAuth Redirect URI、CORS 白名單、Caddyfile 皆以 `datatsukiyo.org` 為基準(詳見 [Environment Variables](../technical-spec/environment-variables.md))。
- 外部 Developer Console(Meta、TikTok、Google)需同步更新 Redirect URI。
- 原本 `docs/tiktok-verify-site/` 的 TikTok 域名驗證檔案需放到新域名下的相同路徑。

## 相關文件

- [ADR-004:自架部署](ADR-004-self-hosted-deployment.md)
- [Technical Spec:Environment Variables](../technical-spec/environment-variables.md)
- [Technical Spec:Deployment Infrastructure](../technical-spec/deployment-infrastructure.md)
- [Security Playbook](../security-playbook.md)
