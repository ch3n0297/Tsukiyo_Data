# 架構決策：API 授權模式 × Supabase 遷移

**日期**：2026-04-04
**背景**：評估兩個策略性問題——
1. 是否能讓外部使用者自帶 API 憑證，讓後端不做平台串接？
2. 是否值得將後端改為 Supabase 架構？

---

## 問題一：「讓使用者自己拿 API」能省掉後端串接嗎？

### 核心釐清

**後端串接無法完全省掉**，但「誰擁有開發者 App」這個問題有三種不同選擇，工作量差很多。

```
你需要的永遠是：
使用者帳號 → OAuth 授權 → 後端儲存 token → 後端代為呼叫 API

差別只在：token 來自哪個 Meta App / TikTok App？
```

---

### 三種授權模式比較

#### 模式 A：你擁有 App，使用者連結帳號（原計畫）

```
[你的系統]
    ↓ 擁有
[一個 Meta App + 一個 TikTok App]
    ↓ 使用者透過 OAuth 連結
[每位使用者的 IG / FB / TikTok 帳號]
```

| 項目 | 說明 |
|------|------|
| 使用者體驗 | 最佳（點一下授權即可） |
| 後端工作量 | 最多（你負責 App 申請 + App Review） |
| App Review | **你需要通過審查**，才能存取分析數據 |
| 適合場景 | SaaS 產品、使用者數量多 |

#### 模式 B：每個客戶自帶 App 憑證（BYOA）

```
[客戶 A 的 Meta App] → 輸入 App ID / Secret 到你的系統
[客戶 B 的 Meta App] → 輸入 App ID / Secret 到你的系統
    ↓ 你的系統用他們的憑證走 OAuth 流程
[各自帳號的 token]
```

| 項目 | 說明 |
|------|------|
| 使用者體驗 | 較差（客戶需要自己去申請 Meta/TikTok App） |
| 後端工作量 | **中等**（你不需要申請 App，但 OAuth 流程程式碼仍需寫） |
| App Review | **客戶自己負責 App Review**，你完全不受限 |
| 適合場景 | **代理商工具、B2B 服務、內部系統**，客戶是有技術能力的企業 |

> **這個模式很適合你目前的場景**——如果你的客戶是行銷代理商，他們通常已經有自己的 Meta 商業帳號，申請一個 Meta App 對他們不是難事。你完全不需要等 Meta App Review。

#### 模式 C：使用者直接貼上 Token

```
使用者在 Meta Graph API Explorer 產生 token
    ↓ 貼到你的系統
後端直接用這個 token 呼叫 API
```

| 項目 | 說明 |
|------|------|
| 使用者體驗 | 最差（需要技術知識，token 有效期短需手動更新） |
| 後端工作量 | **最少**（不需要 OAuth 流程） |
| App Review | 不需要 |
| 適合場景 | 快速原型、內部自用、技術人員自己操作 |

> 短期可以用這個模式**最快跑通完整流程**，驗證 normalization 和資料落地是否正確。

---

### 建議策略：分兩個階段

**Phase 1（這幾天）：模式 C 快速驗通**
- 讓使用者在設定頁輸入 access token 字串
- 後端直接用這個 token 呼叫 API
- 目的：驗證整個資料流（fetch → normalize → Google Sheet）是正確的
- 工作量：最小，1 天可完成

**Phase 2（未來版本）：模式 B 正式上線**
- 讓每個客戶輸入自己的 App ID / App Secret
- 後端用這組憑證完成 OAuth 流程，自動管理 token 生命週期
- 好處：你不受 Meta App Review 綁架，每個客戶擁有獨立的 API 配額
- 工作量：需要寫 OAuth 路由，但不需要申請 Meta App

---

## 問題二：改用 Supabase 是否值得？

### 直接結論：值得，且時機正好

目前系統用 JSON 檔案模擬資料庫（`fs-store.js`），研究文件中已明確說「後續易於替換」。Supabase 是最合理的升級目標。

---

### Supabase 能替換哪些東西

```
現有程式碼                     →  Supabase 替代
─────────────────────────────────────────────────
fs-store.js（JSON 檔案）       →  PostgreSQL 資料庫
user-auth-service.js           →  Supabase Auth
session-repository.js          →  Supabase Auth（session 管理）
password-reset-service.js      →  Supabase Auth（內建密碼重設）
password-reset-token-repository→  Supabase Auth（內建 token）
google-oauth-service.js（登入）→  Supabase Auth（Google provider）
secret-box.js（token 加密）    →  Supabase Vault（專用加密儲存）
所有 *-repository.js 的讀寫    →  Supabase JS SDK 查詢
```

**不會被替換的**（仍需自己實作）：
- Meta OAuth（Supabase Auth 不支援 Meta Graph API 授權）
- TikTok OAuth（同上）
- 所有業務邏輯 service（job-queue、scheduled-sync、normalization 等）

---

### Supabase 對這個系統的特別加分項

**Row Level Security（RLS）**
```sql
-- 每個使用者只能看到自己的帳號設定
CREATE POLICY "users_see_own_accounts"
ON account_configs
USING (auth.uid() = owner_id);
```
目前 JSON 檔案做不到多租戶隔離，Supabase 原生支援。

**Real-time 訂閱**
```js
// Dashboard 可以自動更新 job 狀態，不需要輪詢
supabase
  .channel('jobs')
  .on('postgres_changes', { event: 'UPDATE', table: 'jobs' }, (payload) => {
    updateJobStatus(payload.new)
  })
  .subscribe()
```

**Supabase Vault**（安全 token 儲存）
```sql
-- 儲存加密的 access token，比自己的 AES 實作更安全
SELECT vault.create_secret('meta_access_token_abc123', 'user-1-meta-token');
```

---

### 遷移工作量評估

| 層次 | 工作量 | 說明 |
|------|--------|------|
| 資料庫（Repository 層） | 中 | 13 個 repository 改成 Supabase 查詢 |
| Auth 層 | 中低 | 移除 user-auth-service、password-reset-service，改用 Supabase SDK |
| Google 登入 | 低 | Supabase Auth 原生支援 Google，比現在更簡單 |
| Schema 設計 | 低中 | 從 JSON 結構推導出 PostgreSQL schema |
| 業務邏輯 | **不需改動** | job-queue、normalization、scheduler 完全不受影響 |

整體遷移約 3-5 天，大部分是機械性工作（把 `store.readCollection()` 換成 `supabase.from().select()`）。

---

### 遷移後的目錄結構變化

```
backend/src/
├── adapters/
│   ├── platforms/         ← 不變
│   └── sheets/            ← 不變
├── lib/
│   ├── errors.js          ← 不變
│   ├── http.js            ← 不變
│   ├── logger.js          ← 不變
│   └── supabase.js        ← 新增（取代 fs-store.js）
├── repositories/          ← 所有 repo 改用 Supabase SDK
├── routes/                ← 不變（auth routes 稍微簡化）
└── services/
    ├── user-auth-service.js     ← 大幅簡化（移交給 Supabase Auth）
    ├── password-reset-service.js← 可能直接刪除
    ├── job-queue.js             ← 不變
    ├── normalization-service.js ← 不變
    ├── scheduled-sync-service.js← 不變
    └── ...其他 service          ← 不變
```

---

## 綜合建議：分三個階段執行

### 第一階段（這幾天）：用模式 C 快速打通資料流

目標是在最短時間內看到真實資料從 Instagram/TikTok 流進 Google Sheet。

```
新增「平台 token 輸入頁」
    ↓
使用者貼上從 Meta Graph API Explorer 取得的 token
    ↓
後端用這個 token 呼叫真實 API（替換 fixture adapter）
    ↓
資料正常 normalize、寫入 Google Sheet
```

預計工作量：1-2 天

### 第二階段（完成驗證後）：遷移到 Supabase

資料流確認正確後，進行基礎建設升級：

```
JSON 檔案 → Supabase PostgreSQL
自製 Auth → Supabase Auth
自製加密 → Supabase Vault
```

預計工作量：3-5 天

### 第三階段（正式對外）：加入模式 B 的 BYOA 授權流程

讓客戶輸入自己的 App 憑證，系統自動走 OAuth，不再需要手動貼 token。

```
客戶輸入 Meta App ID / Secret
    ↓
系統用客戶的 App 走 OAuth 拿到 access token
    ↓
Supabase Vault 儲存加密 token
    ↓
排程自動刷新 token
```

預計工作量：3-4 天

---

## 小結

| 問題 | 答案 |
|------|------|
| 讓使用者自帶 API 能省掉後端串接嗎？ | 不能省掉 OAuth 邏輯，但可以省掉你申請 Meta App + 等 App Review 的麻煩（用模式 B 或 C） |
| 現在改 Supabase 值得嗎？ | 值得，但建議先用模式 C 把資料流打通，再遷移，避免同時面對兩個變數 |
| 最快看到真實資料的路徑是？ | 模式 C（手動貼 token）→ 1-2 天就能看到真實資料流進 Google Sheet |
