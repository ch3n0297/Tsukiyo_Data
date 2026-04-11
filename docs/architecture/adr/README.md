# Architecture Decision Records (ADR) 索引

ADR 記錄專案中**不可輕易回頭的架構決策**,以及背後的理由。每份 ADR 聚焦單一決策,方便未來回顧「當時為什麼這樣選」。

## 索引

| 編號 | 標題 | 狀態 | 日期 |
|------|------|------|------|
| [ADR-001](ADR-001-oauth-multitenant.md) | 採用 OAuth 多租戶模式(而非 BYOK) | Accepted | 2026-04-04 |
| [ADR-002](ADR-002-supabase-migration.md) | 後端全面遷移至 Supabase | Accepted | 2026-04-04 |
| [ADR-003](ADR-003-typescript-full-migration.md) | 全面改寫為 TypeScript,不保留任何 .js | Accepted | 2026-04-04 |
| [ADR-004](ADR-004-self-hosted-deployment.md) | 部署於自架 Linux 主機(非雲端 PaaS) | Accepted | 2026-04-04 |
| [ADR-005](ADR-005-domain-cloudflare.md) | 採用正式域名 `datatsukiyo.org` + Cloudflare | Accepted | 2026-04-04 |

## 撰寫 ADR 的原則

- **單一主題**:一份 ADR 只處理一個決策。
- **記錄取捨**:列出考慮過的選項與為何落選。
- **不可逆性高**:若是能隨時改回去的選擇,不需要寫 ADR。
- **狀態追蹤**:Proposed / Accepted / Deprecated / Superseded。
