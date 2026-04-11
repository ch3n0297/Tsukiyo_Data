# Technical Specifications 索引

這些文件是 Coding Agent 實作時的**權威參考**。若程式碼與本文件不一致,應以此為準(或先向使用者確認)。

## 索引

| 文件 | 內容 | 相關 ADR |
|------|------|---------|
| [database-schema.md](database-schema.md) | PostgreSQL 資料表、RLS 政策、Auth middleware、欄位對應 | [ADR-002](../adr/ADR-002-supabase-migration.md) |
| [typescript-types.md](typescript-types.md) | 核心 interface、tsconfig 設定、repository 型別約束 | [ADR-003](../adr/ADR-003-typescript-full-migration.md) |
| [oauth-flows.md](oauth-flows.md) | Meta / TikTok / Google OAuth 端點、多租戶流程、state 防 CSRF | [ADR-001](../adr/ADR-001-oauth-multitenant.md) |
| [token-management.md](token-management.md) | Token 儲存流程、三平台刷新策略、雙層加密 | [ADR-001](../adr/ADR-001-oauth-multitenant.md) |
| [deployment-infrastructure.md](deployment-infrastructure.md) | Docker Compose、Caddyfile、Cloudflare 設定 | [ADR-004](../adr/ADR-004-self-hosted-deployment.md), [ADR-005](../adr/ADR-005-domain-cloudflare.md) |
| [environment-variables.md](environment-variables.md) | 所有 `.env` 變數清單、金鑰輪替策略 | — |

## 使用原則

- **實作前先查**:需要欄位、端點、環境變數時,先讀對應文件。
- **不可自創**:不要自己推測 API 端點或欄位名,寧可問使用者也不要幻想。
- **保持一致**:多個檔案提到同一個東西時,應彼此對齊。若發現不一致,先報告使用者。
