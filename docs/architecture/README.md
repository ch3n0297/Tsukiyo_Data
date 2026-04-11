# Architecture Documentation

**專案**:Social Data Hub (Tsukiyo_Data)
**正式域名**:`datatsukiyo.org`
**最後更新**:2026-04-05

---

## 文件導覽(給 Coding Agent 與人類讀者)

本資料夾將原本的單一長文件 `docs/architecture-decision-supabase-migration.md` 拆分為**三種類型**的文件。請依任務類型選擇對應的文件閱讀,避免混淆。

### 文件類型說明

| 類型 | 位置 | 用途 | 何時閱讀 |
|------|------|------|---------|
| **ADR (Architecture Decision Record)** | `adr/` | 記錄**為什麼**做某個決策(背景、選項、取捨) | 想了解「為什麼不用方案 X」時 |
| **Technical Spec** | `technical-spec/` | 記錄**要做什麼**的精確規範(schema、interface、API、部署) | 實作時查詢欄位、端點、設定 |
| **Migration Plan** | `migration-plan.md` | 記錄**如何執行**遷移(Phase、步驟、時程) | 執行遷移任務時 |
| **Security Playbook** | `security-playbook.md` | 記錄**如何防禦**(五層架構、checklist) | 部署或安全性審查時 |

### 目錄結構

```
docs/architecture/
├── README.md                             ← 你現在看的檔案
├── adr/                                  ← 為什麼做這些決策
│   ├── README.md                         ← ADR 索引
│   ├── ADR-001-oauth-multitenant.md      ← OAuth 多租戶模式
│   ├── ADR-002-supabase-migration.md     ← 遷移至 Supabase
│   ├── ADR-003-typescript-full-migration.md ← 全面改寫為 TypeScript
│   ├── ADR-004-self-hosted-deployment.md ← 自架 Linux 主機部署
│   └── ADR-005-domain-cloudflare.md      ← 域名與 Cloudflare
├── technical-spec/                       ← 實作規範
│   ├── README.md                         ← Tech Spec 索引
│   ├── database-schema.md                ← PostgreSQL Schema + RLS
│   ├── typescript-types.md               ← 核心 interface 定義
│   ├── oauth-flows.md                    ← Meta/TikTok/Google OAuth 流程
│   ├── token-management.md               ← Token 儲存、刷新、生命週期
│   ├── deployment-infrastructure.md      ← Docker Compose + Caddy 架構
│   └── environment-variables.md          ← 所有 .env 變數
├── migration-plan.md                     ← 分 Phase 的執行計畫
└── security-playbook.md                  ← 5 層防禦 + Checklist
```

---

## 如何使用本文件(給 Coding Agent 的指示)

1. **實作任務開始前**,先讀 `migration-plan.md` 確認目前在哪個 Phase。
2. **需要知道資料欄位**時,查 `technical-spec/database-schema.md` 與 `technical-spec/typescript-types.md`。**不要**憑記憶猜測欄位名。
3. **需要寫 OAuth 相關程式碼**時,查 `technical-spec/oauth-flows.md` 的端點與流程。**不要**自行捏造 Meta/TikTok API 端點。
4. **需要設定環境變數**時,查 `technical-spec/environment-variables.md`。所有變數名稱以此為準。
5. **遇到架構級問題**(「為什麼用 Supabase 不用 X?」)時,查 `adr/` 資料夾。
6. **部署或安全性設定**時,查 `security-playbook.md`。

**重要**:若本文件與實際程式碼不一致,應先向使用者確認哪一方為真,**不要**自行修改文件也不要依記憶行動。

---

## 未解決的問題(需後續決策)

以下問題尚未在本文件集中拍板,遇到相關任務時應先詢問使用者:

1. **Google Sheet 整合**:現有 `google-oauth-service.js` 遷移後,Google token 是否也改存入 `platform_tokens` 表。傾向:是。
2. **排程觸發機制**:`scheduler-service.js` 需要長駐進程。若日後改走 Serverless,需要改用 pg_cron 或外部 cron。目前決策:自架主機長駐即可。
3. **Meta App Review 進度**:正式對外服務前必須完成審查。未通過前只有測試用戶能授權。
4. **資料遷移**:若既有系統已有真實資料,需要一次性腳本把 JSON 寫入 Supabase。

---

## 版本歷程

| 日期 | 變更 |
|------|------|
| 2026-04-04 | 原始單一文件 `architecture-decision-supabase-migration.md` 完成 |
| 2026-04-05 | 拆分為分類文件結構,便於 Coding Agent 精準查詢 |
