# ADR-003:全面改寫為 TypeScript,不保留任何 .js

**狀態**:Accepted
**日期**:2026-04-04
**決策者**:專案擁有者

---

## 背景

專案原本選擇 JavaScript 而非 TypeScript,`specs/001-social-data-hub/research.md` Decision 1 記錄原因為:

> *TypeScript: 型別更完整,但會增加 build/tsconfig/執行鏈設定成本。*

這在「從零快速落地 MVP」的情境下是合理的。但現在情境已經改變:
1. 要做 Supabase 遷移(見 [ADR-002](ADR-002-supabase-migration.md)),本來就會重寫所有 repository 與 auth
2. 要做 OAuth 多租戶(見 [ADR-001](ADR-001-oauth-multitenant.md)),`user_id` 貫穿所有查詢,型別安全至關重要

## 決策

**執行完整的 TypeScript 遷移,遷移完成後專案不保留任何 JavaScript 原始碼**。

- 後端所有 `.js` → `.ts`
- 前端所有 `.jsx` / `.js` → `.tsx` / `.ts`
- 測試、CLI 工具一併遷移
- `tsconfig` 啟用 `strict: true`,零 `any` 殘留
- 移除所有 `@ts-ignore` / `@ts-nocheck`

## 為什麼現在應該換成 TypeScript?

| 因素 | 說明 |
|------|------|
| **你已經要大改了** | Supabase 遷移會重寫所有 repository + auth,與其改完再轉 TS,不如直接用 TS 寫新版 |
| **多租戶需要型別安全** | `user_id` 貫穿所有查詢,忘記加 `WHERE user_id = ...` 就是資料洩漏。TypeScript 的型別約束能在編譯期抓到 |
| **Supabase SDK 是 TS-first** | `@supabase/supabase-js` 提供完整型別推導,用 JS 等於放棄一半功能 |
| **OAuth token 結構複雜** | Meta/TikTok/Google 三套 token 格式不同,interface 定義能防止欄位搞混 |
| **團隊擴展** | 如果未來有其他人加入,TypeScript 就是活文件 |

## 現有程式碼規模

```
後端:55 個 .js 檔案,約 4,578 行
前端:31 個 .jsx/.js 檔案
測試:整合測試 + 單元測試
框架:Fastify 5 + React 18 + Vite 5
模組:ESM(已用 import/export)
```

## 遷移策略:分層全面轉換

```
Phase 0(0.5 天):TypeScript 基礎建設
  ├─ 安裝 typescript、@types/node、tsx
  ├─ 建立 tsconfig.json(後端 + 前端各一份)
  ├─ 設定 Vite TypeScript 支援(前端本來就支援,幾乎零成本)
  ├─ 建立 types/ 目錄,定義所有核心 interface
  └─ 確認 npm run dev / npm run build 能跑

Phase 1(1 天):核心層全面轉換
  ├─ lib/*.js → lib/*.ts(errors, logger, secret-box, http, fs-store)
  ├─ types/*.ts(Platform, Job, AccountConfig, PlatformToken, NormalizedRecord 等)
  └─ 這是其他所有檔案的型別基礎,必須先完成

Phase 2(1-1.5 天):Repository + Service 層(與 Supabase 遷移同步)
  ├─ repositories/*.js → repositories/*.ts(底層同步換成 Supabase 查詢)
  ├─ services/*.js → services/*.ts
  └─ 每轉一個就跑測試確認

Phase 3(0.5-1 天):Route + Adapter 層
  ├─ routes/*.js → routes/*.ts
  ├─ adapters/**/*.js → adapters/**/*.ts
  └─ 新增的 OAuth routes 直接用 TypeScript 撰寫

Phase 4(0.5 天):前端
  ├─ frontend/src/**/*.jsx → *.tsx
  ├─ frontend/src/**/*.js → *.ts
  └─ Vite + React 對 TypeScript 原生支援,轉換成本最低

Phase 5(0.5 天):收尾
  ├─ 測試檔案轉換(tests/**/*.test.js → *.test.ts)
  ├─ CLI 工具轉換(cli/*.js → cli/*.ts)
  ├─ 確認 tsconfig strict mode 全開,零 any 殘留
  └─ 移除所有 @ts-ignore / @ts-nocheck
```

## 時間成本估算

| 工作項目 | 時間 | 說明 |
|---------|------|------|
| tsconfig + 建置設定 | 2-3 小時 | 一次性,ESM 專案已滿足大部分條件 |
| 核心型別定義(types/) | 3-4 小時 | Token、Job、AccountConfig 等共用 interface |
| 後端 55 個檔案轉換 | 2-3 天 | 與 Supabase 遷移同步進行,不是純粹重新命名,而是加上完整型別 |
| 前端 31 個檔案轉換 | 0.5-1 天 | React + Vite 對 TS 支援成熟,轉換最順 |
| 測試 + CLI 轉換 | 0.5 天 | 測試檔案型別要求較鬆,可快速處理 |
| **合計** | **約 4-5 天**(與 Supabase 遷移重疊) | 不是額外 4-5 天,而是融入遷移週期 |

## 考慮過的選項

### 選項 A:保持 JavaScript ❌
- **優點**:零遷移成本。
- **缺點**:放棄 Supabase SDK 的完整型別,多租戶查詢無法在編譯期檢查。
- **結論**:風險太高。

### 選項 B:漸進式遷移(部分 .js + 部分 .ts 共存)❌
- **優點**:每次改動少。
- **缺點**:混合狀態會長期存在,型別邊界模糊,無法啟用 strict mode。
- **結論**:使用者明確表態願意投入時間做完整遷移。

### 選項 C:完整遷移 ✅
- **優點**:型別一致性、可啟用 strict、與 Supabase SDK 完美整合。
- **缺點**:需要 4-5 天(融入 Supabase 遷移週期)。
- **結論**:採用。

## 相關文件

- [ADR-002:Supabase 遷移](ADR-002-supabase-migration.md)(同步進行)
- [Technical Spec:TypeScript Types](../technical-spec/typescript-types.md)
- [Migration Plan](../migration-plan.md)
