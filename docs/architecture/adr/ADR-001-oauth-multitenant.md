# ADR-001:採用 OAuth 多租戶模式(而非 BYOK)

**狀態**:Accepted
**日期**:2026-04-04
**決策者**:專案擁有者

---

## 背景

原本考慮過「讓用戶帶自己的 API Key 來用」(BYOK, Bring Your Own Key)來省掉後端串接成本。但使用者的目標受眾是行銷人員或一般業務,他們不知道什麼是 Meta Graph API,更不知道如何取得 Access Token。

## 決策

採用**標準 OAuth 2.0 多租戶授權流程**:建立一個 Meta App / TikTok App,讓所有終端使用者透過你的 App 完成授權。這是 Buffer、Hootsuite、Later 等社群管理工具的標準做法。

### 授權流程

```
用戶在你的軟體點「連結 Instagram」
         ↓
跳轉至 Meta 官方授權頁(meta.com/dialog/oauth)
         ↓
用戶看到:「[你的軟體名稱] 想要存取你的 Instagram 帳號」
         ↓
用戶點「允許」
         ↓
Meta 把 Authorization Code 發回你的 callback URL
         ↓
你的後端換成 Access Token,加密後存入 Supabase
         ↓
之後所有 API 呼叫都用這個 token,用戶完全不需要知道 API 的存在
```

## 考慮過的選項

### 選項 A:BYOK(Bring Your Own Key)❌

- **優點**:後端不需處理授權流程,法遵風險較低。
- **缺點**:
  - 目標使用者(行銷人員)無能力取得 API token。
  - 使用者必須自行申請 Developer App,完全不可行。
- **結論**:只適合工程師工具,與產品定位不符。

### 選項 B:OAuth 多租戶 ✅

- **優點**:
  - 使用者體驗與 Buffer/Hootsuite 相同,點「允許」即可。
  - 後端只需實作一次授權流程,所有租戶共用。
  - App Review 只申請一次。
- **缺點**:
  - 必須申請 Meta/TikTok Developer App 並通過審查。
  - 後端需處理 token 加密、刷新、多租戶隔離。
- **結論**:符合產品定位,採用此方案。

## 後果

### 後端還是需要「串接」,但你只做一次

| 工作 | 需要做嗎 | 說明 |
|------|---------|------|
| 申請 Meta/TikTok 開發者帳號 | 是,只做一次 | 你是 App 擁有者 |
| 建立 OAuth 路由(authorize / callback) | 是,只做一次 | 每個用戶都走同一條路 |
| 儲存各用戶的 token | 是,Supabase 處理 | 每個用戶有獨立一筆 |
| 呼叫 Meta/TikTok API | 是 | 用每個用戶自己的 token |
| Meta App Review | 是 | 需申請,但只需申請一次 |

**用戶端什麼都不用做**,他們只要點「連結帳號」,就像登入 Google 一樣自然。

### 多租戶意味著什麼

每個使用你軟體的「客戶」(租戶)有自己的:

- Supabase Auth 帳號(`user_id`)
- 帳號設定(`account_configs`):只能看到自己的
- 平台 token(`platform_tokens`):加密儲存,只能看到自己的
- Job 記錄、Raw/Normalized 資料:用 Row Level Security 隔離

## 相關文件

- [ADR-002:Supabase 遷移](ADR-002-supabase-migration.md)(RLS 是實現多租戶的關鍵)
- [Technical Spec:OAuth Flows](../technical-spec/oauth-flows.md)
- [Technical Spec:Database Schema + RLS](../technical-spec/database-schema.md)
