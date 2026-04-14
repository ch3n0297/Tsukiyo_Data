# Handoff
**To:** Main
**From:** Review
**Feature:** fix-supabase-review
**DocsPath:** .docs/fix-supabase-review
**Ready:** true
**Slice:** AC-01, AC-02, AC-03
**Task:** 修復 CodeRabbit 審查發現的 37 個問題（安全、資料一致性、品質）
**Context:** 全部 slice 已實作並測試，等待 Git commit
**Status:** committed
**Commit:** ebfdfe1

## 審查結論（CodeRabbit，37 findings）

### 🔴 Critical — 必須優先修復

1. **IDOR 跨用戶存取** — `backend/src/repositories/supabase/job-repository.ts` L99-107, L109-123
   - `findById` 和 `updateById` 缺少 `.eq('user_id', this.userId)` 過濾，任何用戶可讀/改他人 job
2. **RLS 缺少 `WITH CHECK`** — `supabase/migrations/20240413000001_init.sql` L15
   - `FOR ALL USING (...)` 不限制 INSERT，需補 `WITH CHECK (auth.uid() = user_id)`，所有同模式的 policy 都要修
3. **Token 明文儲存** — `supabase/migrations/20240413000001_init.sql` L97-98
   - `access_token` / `refresh_token` 為 `TEXT`，需加密（pgsodium 或應用層）
4. **前端寫入 `user_metadata` 含 role/status** — `frontend/src/api/authApi.ts` L40-52
   - client-side 設定 role/status，用戶可自行 `updateUser()` 提升權限，改用 DB trigger 或 `app_metadata`

### 🟠 Potential Issues — 資料一致性

5. **非原子 delete+insert** — `account-config-repository.ts` L47-71、`normalized-record-repository.ts` L47-76
   - insert 失敗後資料永久消失，改用 `upsert` 或 RPC transaction
6. **user-approval-service 非原子** — `user-approval-service.ts` L116-128
   - `updateById` 成功但 outbox `create` 失敗 → 狀態改了卻沒通知
7. **TOCTOU race** — `user-approval-service.ts` L107-120
   - `findById` → 檢查 → `updateById` 之間有競態，改為原子條件更新
8. **job-repository mapper 問題** — `job-repository.ts` L15-19
   - `queuedAt` 用 `new Date()` fallback（不純）；`errorCode`/`resultSummary` 硬編碼 `null` 丟棄 DB 值
9. **`create()` 回傳全部 jobs** — `job-repository.ts` L44-97
   - 應改為 `.insert(...).select('*').single()`，只回傳新建 job
10. **FK 缺少 ON DELETE** — migration L21/43/58/80/84
    - `current_job_id` → SET NULL；`job_id`（raw_records, normalized_records）→ SET NULL；`account_config_id`（sheet_snapshots）→ CASCADE

### 🟡 Suggestions — 品質

11. **`accountKey` 格式未驗證** — job-repo L48、account-config-repo L88、normalized-record-repo L44（三處都有）
12. **`updatedAt` 映射到 `created_at`** — `account-config-repository.ts` L21，改為 `row.updated_at ?? row.created_at`
13. **空 catch block 吞錯誤** — `httpClient.ts` L47-49
14. **`getUser()` 錯誤被靜默忽略** — `authApi.ts` L64-67
15. **`useAuthSession.ts` payload 型別斷言** — L98-107, L121-128，`payload ?? {}` 防止 null 存取
16. **重複建立 Supabase client** — `app.ts` L311-313，提升變數重複使用
17. **`supabase/config.toml`**：api_url 缺 port（應 `:54321`）；site_url/redirect_url 協定不一致
18. **`backend/data/jobs.json` L16142-32762** — scheduler 執行歷史不應 commit，加入 `.gitignore`
19. **`supabase-support.ts`**：hardcoded URL fallback（應 fail-fast）、truncateTables 缺錯誤處理、UUID 常數不一致
20. **`sheet-snapshot-repository.ts`**：platform 欄位缺 fallback；cfg 找不到時靜默跳過缺 log
21. **`raw-record-repository.ts`**：upsert 後呼叫 `listAll()`（效能浪費）；`as string ??` precedence 混淆
22. **nullable account_id 在 unique constraint** — migration L96-104，NULL 被視為不同值，需 partial unique index
