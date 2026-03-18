# PROMPT.md — Prompt 設計與成效報告

## 1. 專案概述

**Social Data Hub** 是一個社群行銷資料中台，負責定時抓取 Instagram、Facebook、TikTok 三個平台的帳號資料，將不同格式的原始資料標準化為統一結構，並同步到 Google Sheet 供內部團隊查看。系統同時支援從 Google Sheet 發送單一帳號的手動刷新請求，採非同步 job queue 架構處理，並具備 HMAC 簽章驗證、去重複、限流與狀態回寫等保護機制。

這個系統的複雜度來自多個面向的交互：

- **多平台資料整合**：三個社群平台各有不同的 API 回應格式與欄位名稱，需要統一的正規化管線。
- **非同步工作流程**：手動刷新不能讓 Google Apps Script 同步等待外部 API 回應，必須拆成「接受請求」與「背景執行」兩階段。
- **多層保護機制**：驗證、去重複、限流、帳號冷卻期、並行控制，每一層都有獨立邏輯但需要協同運作。
- **狀態一致性**：排程同步與手動刷新共用同一條 orchestration pipeline，確保不同觸發方式產出一致結果。
- **分層架構**：路由、服務、適配器、資料存取、持久化五層各有職責邊界，且適配器需要可替換（目前用 fixture 模擬，未來接真實 API）。

這樣的複雜度無法透過單一 prompt 完成——光是釐清責任邊界、定義資料流、設計保護機制就需要多輪討論與迭代。因此，採用 Orchestration 模式讓 AI 分階段規劃、逐步實作並自我審查是合理且必要的。

---

## 2. 開發工具與工作流

本專案採用 **spec-kit** 作為規格驅動的開發框架，搭配 **RooCode** 的 Orchestration 模式進行多階段任務拆解與實作。整體工作流程分為三個層次：

### 2.1 RooCode + Spec-kit（主要 Orchestration 工具）

Spec-kit 提供結構化的規格模板與工作流腳本，強制開發過程經歷：

1. **需求澄清** → `spec.md`（用戶故事、驗收條件、功能需求）
2. **技術研究** → `research.md`（設計決策與替代方案分析）
3. **架構設計** → `plan.md`（技術棧、專案結構、實作策略）
4. **任務拆解** → `tasks.md`（33+ 個細粒度任務，依 Phase 與 User Story 分組）
5. **API 契約** → `contracts/api.openapi.yaml`（端點定義）
6. **資料模型** → `data-model.md`（實體定義與關係）
7. **實作與測試** → `src/` + `tests/`

RooCode 在這個流程中擔任「系統架構師 + 專案經理 + 開發團隊」的角色，每個階段完成後都會自我審查，確認產出符合前一階段的約束。

### 2.2 Claude Code（品質把關與深度分析）

Claude Code 在以下環節發揮輔助作用：

- **架構報告生成**：分析完成後的 codebase，產出包含 Mermaid 圖表的 `docs/architecture-report.md`，涵蓋系統全域架構、資料流、狀態機、ER 圖等。
- **測試補強**：針對已實作的模組補充單元測試（`tests/unit/` 下的 8 個測試檔案）。
- **程式碼審查**：對關鍵服務（如 `fs-store.js` 的原子寫入、`auth-service.js` 的 timing-safe 比較）進行安全性審查。
- **前端整合設計**：基於後端 API 規格，產出 `docs/frontend-plan.md` 作為未來前端開發指南。

### 2.3 Codex（局部審查與重構）

Codex 用於：

- 初始化 spec-kit 專案模板（`.specify/init-options.json` 中 `"ai": "codex"`）。
- 局部程式碼重構建議，例如將重複的 repository 邏輯抽取為共用模式。
- 快速驗證 API 契約定義是否與實作一致。

---

## 3. 關鍵 Prompt 設計與分析

以下按開發階段列出實際使用的關鍵 Prompt，並逐條分析設計意圖與效果。

---

### Prompt 1：系統需求初始化

```
我有一份系統設計草稿 draft.md，描述了一個社群行銷資料中台的架構。
請根據這份草稿，使用 spec-kit 的 specify 流程，產出完整的 feature specification。

要求：
- 以 draft.md 的決策清單作為約束條件
- 產出至少 3 個有優先級的 User Story，每個都要有獨立測試方案
- Functional Requirements 使用 MUST/MAY 語義
- 定義 Key Entities 與 Success Criteria
- 邊界案例（Edge Cases）要涵蓋 refresh_days 邊界值、重複請求、外部 API 失敗等場景
```

**目的**：將已收斂的業務決策（draft.md 中 15 個章節的討論結果）轉換為結構化的工程規格，確保 AI 不是憑空想像需求，而是基於已有的設計共識。

**預期行為**：AI 應該讀取 draft.md，提取核心決策（如「Server 為唯一可信核心」、「非同步 queue 架構」、「refresh_days 限制 1-365」），然後按 spec-kit 模板產出 spec.md。

**實際回應**：RooCode 成功產出了 `specs/001-social-data-hub/spec.md`，包含 3 個 User Story（P1 排程同步、P2 手動刷新、P3 請求保護）、23 條 Functional Requirements、6 項 Success Criteria，以及 5 個邊界案例。User Story 的優先級排序合理：排程同步是核心價值所以 P1，手動刷新是補充能力所以 P2，保護機制是防護層所以 P3。

**是否需修正**：初版無需大幅修正。但後續發現 spec 中未明確定義帳號冷卻期（cooldown）的具體秒數，在 research.md 階段補充了 30 秒預設值的決策。

---

### Prompt 2：技術研究與設計決策

```
根據 spec.md 的需求，進行技術研究並產出 research.md。

需要決策的項目：
1. 技術棧選擇（為什麼用 Node.js 而不是其他？）
2. 持久化策略（為什麼用 JSON 檔案而不是 SQLite？）
3. Queue 實作方式（in-process 還是外部 queue？）
4. 認證機制（HMAC 還是 API key？）
5. 平台與 Sheet 整合方式（adapter 模式的理由）
6. 排程與手動刷新是否共用 pipeline
7. 前端安全邊界

每個決策必須列出：
- 最終選擇
- 選擇理由
- 被否決的替代方案及否決原因
```

**目的**：強制 AI 在動手寫 code 之前，先對每個技術選擇進行理性分析。這不是讓 AI「直覺選一個」，而是要求它像架構師一樣權衡利弊。

**預期行為**：AI 應該對每個決策點進行 trade-off 分析，特別是要解釋「為什麼不選更成熟的方案」（例如為什麼不用 Express、為什麼不用 SQLite）。

**實際回應**：research.md 產出了 7 個完整的決策記錄。比較有價值的是 Decision 2（JSON store vs SQLite）的分析——AI 指出「JSON store 能最快把完整資料流落地，且 repository 邊界清楚，後續替換成 SQLite/PostgreSQL 時不需重寫 route 與 service」。這體現了「先讓系統跑起來，再逐步替換」的務實策略。

**是否需修正**：無需修正。Decision 6 特別合理——排程與手動刷新共用 pipeline 是因為「規格要求不同觸發方式不可產出不一致結果」，這直接對應了 FR-018。

---

### Prompt 3：Orchestration 規劃——任務拆解

```
根據 spec.md、research.md 與 plan.md，產出 tasks.md。

規則：
- 按 Phase 分組：Setup → Foundational → User Story 1/2/3 → Polish
- Phase 2（Foundational）必須標記為 CRITICAL，完成前不可進入 user story
- 每個 User Story 的 test 要先於 implementation
- 標記可平行執行的任務 [P]
- 標記所屬 user story [US1]/[US2]/[US3]
- 每個任務都要帶明確的檔案路徑
- 建立 Phase 間的依賴關係圖
- 在每個 Phase 結束時設置 Checkpoint
```

**目的**：這是整個 Orchestration 的核心——將巨大的系統需求拆解為 33+ 個可獨立執行、有依賴關係的細粒度任務。Checkpoint 機制確保每個 Phase 完成後可以驗證，避免在錯誤的基礎上繼續堆疊。

**預期行為**：AI 應該理解 Phase 間的依賴：Setup 是一切基礎，Foundational 提供共用設施（repository、adapter、queue），User Story 依賴 Foundational 完成。平行標記 `[P]` 讓不同檔案的任務可以同時執行。

**實際回應**：tasks.md 的結構清楚，33 個任務按 6 個 Phase 分組。特別好的設計是「Foundational 阻擋機制」：Phase 2 標記為 `⚠️ CRITICAL: 完成前不可進入 user story 實作`。依賴關係圖也正確識別了 User Story 2 依賴 User Story 1 的 queue/orchestrator，User Story 3 依賴 User Story 2 的手動刷新入口。

**是否需修正**：有一次微調——原始版本將 T009（scheduled sync integration test）放在 implementation 之後。依據「測試先行」原則，調整為先寫 test 再寫 implementation，確保每個 User Story 都從驗證起點開始。

---

### Prompt 4：測試先行實作

```
開始實作 Phase 3（User Story 1 - 排程同步）。

執行順序：
1. 先實作 T009：寫 integration test (tests/integration/scheduled-sync.test.js)
   - 測試應覆蓋：建立 app → 觸發 scheduled sync → 驗證 jobs、raw records、normalized records、sheet output 都被正確建立
   - 使用 node:test 內建框架
   - 測試必須可獨立執行，不依賴外部服務

2. 確認測試結構合理後，再實作 T010-T013
3. 每實作一個任務後，執行 npm test 確認無迴歸
```

**目的**：強制「test-first」工作流程。寫測試時，AI 必須先思考「完整的排程同步應該產出什麼」，這比直接寫程式碼更能確保功能完整性。

**預期行為**：AI 先產出一個會失敗的 integration test，然後逐步實作 normalization service、scheduled sync service、route、app wiring，直到測試通過。

**實際回應**：integration test 正確覆蓋了完整的資料流：`createApp() → triggerSync() → 驗證 6 個 JSON 檔案都有正確內容`。特別好的是測試中包含了「部分帳號失敗不影響成功帳號」的場景（對應 spec.md 的 Acceptance Scenario 2）。

**是否需修正**：實作過程中發現 `normalization-service.js` 的 Instagram 欄位對應有誤（`metrics.plays` 應對應 `views` 而非 `impressions`），在 unit test 補強時修正。這正是測試先行的價值——先定義預期行為，實作時發現偏差立即修正。

---

### Prompt 5：保護機制實作與自我審查

```
實作 Phase 5（User Story 3 - 請求保護）。完成後進行自我審查。

實作要求：
- rate limit: 同源每分鐘最多 10 次請求
- dedup: 同帳號最多 1 個 active job（queued 或 running）
- cooldown: 同帳號 30 秒內不可重複刷新
- validation: refresh_days 必須為 1-365 整數，0/366/空值/小數/文字全部拒絕
- HMAC: timestamp 偏差超過 5 分鐘要拒絕（防重放）

完成後自我審查：
1. 檢查所有保護機制是否有遺漏的邊界條件
2. 確認錯誤回應包含使用者可理解的 system_message
3. 確認 timing-safe 比較是否正確使用
4. 執行完整測試套件，確認無迴歸
```

**目的**：保護機制是整個系統最容易出錯的部分——每一層保護都有自己的邊界條件，且需要在不同情境下正確觸發。要求 AI 實作後自我審查，是為了讓它跳出「實作者」角色，用「審查者」的角度重新檢視。

**預期行為**：AI 先實作各項保護機制，然後切換到 reviewer 角色檢查邊界條件。

**實際回應**：AI 在自我審查中發現了一個重要問題：原始的 rate limit 實作只檢查了手動刷新，但排程同步觸發的 job 也應該遵守 dedup 規則（同帳號不可有多個 active job）。這導致了 `scheduled-sync-service.js` 中加入 `findActiveByAccountKey` 檢查。

另外，審查還發現 `auth-service.js` 初版使用 `===` 比較 HMAC，改為 `crypto.timingSafeEqual` 防止 timing attack。這是一個安全性的提升。

**是否需修正**：自我審查本身就是修正過程。最終 `tests/integration/protections.test.js` 覆蓋了 6 個保護場景，全部通過。

---

### Prompt 6：架構報告與文件補完（Claude Code）

```
分析目前 codebase 的完整架構，產出 docs/architecture-report.md。

要求：
- 使用 Mermaid 語法繪製：系統全域架構圖、分層架構圖、手動刷新序列圖、排程同步序列圖、Job 狀態機、ER 圖、JobQueue 並行控制模型、FileStore 持久化機制、認證流程、正規化管線
- 列出所有組態參數與預設值
- 列出 API 端點摘要
- 分析設計優點與取捨
- 包含完整的目錄結構說明
```

**目的**：程式碼寫完後，需要一份從「鳥瞰視角」理解系統的文件。架構報告不是給寫程式的人看的，而是給需要理解「這個系統如何運作」的人看的。Mermaid 圖表讓結構可視化。

**預期行為**：Claude Code 應該讀取所有原始碼檔案，追蹤依賴關係，然後用 10+ 個 Mermaid 圖表呈現不同面向的架構。

**實際回應**：`docs/architecture-report.md` 產出了 19 個章節、12 個 Mermaid 圖表，涵蓋系統全域架構到單一 FileStore 的原子寫入流程。特別有價值的是第 4 節的「手動刷新序列圖」——完整追蹤了從 HTTP request 進入到背景 job 完成的每一步，包含中間的驗證、限流、去重複檢查。

**是否需修正**：初版缺少「啟動與關閉流程」的序列圖，補充了第 13 節說明 app 啟動時如何恢復中斷的 jobs（running → error、queued → re-enqueue）。

---

### Prompt 7：方向修正——適配器模式調整

```
目前平台 adapter 的設計有問題：三個平台的 adapter 都直接讀取 fixture JSON，
但它們的時間戳記欄位格式不同（Instagram 用 ISO 8601，Facebook 用 Unix timestamp，TikTok 用秒級 timestamp）。

請重構 adapter 層：
1. 建立共用的 fixture-platform-adapter.js 基類，處理共同的 fixture 讀取邏輯
2. 各平台 adapter 只需要提供自己的「時間戳記取得函式」
3. 讓 platform-registry.js 統一管理 adapter 實例
4. 確保 integration test 不受影響
```

**目的**：在實作過程中發現三個 adapter 有大量重複程式碼（讀 fixture、過濾日期範圍、回傳結果），差異只在時間戳記欄位名稱。這違反了 DRY 原則，且增加後續維護成本。

**預期行為**：AI 應該提取共用邏輯到基類，讓子類只關注差異點。

**實際回應**：重構後 `fixture-platform-adapter.js` 處理共用的 fixture 讀取與日期過濾，三個平台 adapter 各只有 10 行左右，僅提供 `getTimestamp(item)` 函式。`platform-registry.js` 在建構時註冊所有 adapter。重構後執行 `npm test` 全部通過，確認行為不變。

**是否需修正**：無需修正。這是一個成功的重構方向修正，程式碼量從約 150 行減少到約 80 行，且更容易新增平台支援。

---

### Prompt 8：單元測試補強（Claude Code + Codex）

```
目前只有 integration test 覆蓋主要流程。
請針對以下模組補充 unit test：

1. auth-service: HMAC 驗證的各種邊界條件（缺少 header、過期 timestamp、無效簽章、timing-safe 比較）
2. normalization-service: 三個平台的欄位對應正確性、缺失欄位的預設值處理
3. job-queue: 並行控制、重複入列保護、waitForIdle
4. fs-store: 原子寫入、集合名稱安全性、路徑穿越防護
5. scheduler-service: tick 重疊保護、start/stop 邏輯
6. config: 環境變數覆蓋、必填欄位驗證
7. logger: 結構化輸出、循環引用處理
8. file-sheet-gateway: 狀態寫入、輸出寫入

使用 node:test + assert。每個 test 都要能獨立執行。
```

**目的**：Integration test 驗證的是「完整流程是否正確」，但無法精確定位問題。Unit test 驗證的是「單一模組在各種邊界條件下是否正確」。兩者互補才能建立完整的測試防護網。

**預期行為**：AI 對每個模組的公開介面撰寫測試，特別關注邊界條件與錯誤路徑。

**實際回應**：產出了 8 個 unit test 檔案。比較有價值的發現包括：
- `fs-store.test.js` 測試路徑穿越防護時發現 `../../etc/passwd` 作為集合名稱會被正確拒絕。
- `job-queue.test.js` 測試重複入列時確認同一 job ID 不會被加入兩次。
- `config.test.js` 確認缺少 `API_SHARED_SECRET` 時會拋出明確錯誤。

**是否需修正**：`normalization-service.test.js` 初版未測試「原始資料缺少 `metrics` 欄位時應回傳 0」的情境，後續補充了缺失欄位的預設值測試。

---

## 4. 成效評估

### 4.1 顯著提升品質的 Prompt

- **Prompt 3（任務拆解）** 是影響最大的一個。將 33 個任務依 Phase 分組、標記依賴關係、設置 Checkpoint，讓 AI 不會跳過基礎設施直接寫業務邏輯。`⚠️ CRITICAL` 標記有效防止了「還沒有 repository 就開始寫 route」的問題。

- **Prompt 5（保護機制 + 自我審查）** 直接發現了兩個實作錯誤（排程同步的 dedup 遺漏、HMAC 的 timing-safe 比較），如果沒有明確要求「完成後自我審查」，這些問題可能要到生產環境才會暴露。

- **Prompt 2（技術研究）** 強制 AI 記錄設計決策的理由，讓後續開發有明確的參考依據。例如「為什麼不用 SQLite」的決策記錄，避免了後續反覆討論同一個問題。

### 4.2 失敗或偏離方向的 Prompt

- 初期嘗試過一次「直接產出完整 API 路由程式碼」的 prompt，結果 AI 跳過了 service 層直接在 route handler 裡寫業務邏輯，完全違反分層架構。修正方式是回到 tasks.md 的執行順序，先實作 service 再實作 route。

- 一次要求 AI「同時實作三個平台的 adapter」時，它產出了大量重複程式碼。這促成了 Prompt 7 的重構方向修正。

- 曾嘗試讓 AI 在沒有 spec.md 的情況下直接從 draft.md 寫程式碼，結果產出的系統缺少去重複和限流機制——因為 draft.md 只提到概念，沒有轉換為具體的功能需求。這驗證了「先寫 spec 再寫 code」的重要性。

### 4.3 Orchestration 的實際效果

Orchestration 模式在以下方面確實有幫助：

1. **強制分階段**：spec → research → plan → tasks → implementation → test → review，每個階段的產出是下一階段的輸入。如果某階段產出有問題，可以在早期發現並修正，而不是等到實作完才發現方向錯誤。

2. **任務平行化**：tasks.md 標記了 `[P]` 可平行的任務（如 T003 與 T001-T002、T005 與 T006 與 T008），讓 AI 可以在不衝突的前提下同時處理多個檔案。

3. **中間檢查**：每個 Phase 的 Checkpoint 機制有效。例如 Phase 2 完成後，驗證所有 repository 都能正確讀寫 JSON 檔案，才進入 User Story 實作。

4. **角色切換**：同一個 AI 在不同階段扮演不同角色——研究員（research.md）、架構師（plan.md）、開發者（src/）、審查者（自我審查）、技術寫作者（architecture-report.md）。角色切換讓每個階段的產出更專注。

### 4.4 若不使用 Orchestration 會卡在哪

- **需求遺漏**：沒有 spec.md 的結構化需求，AI 容易漏掉保護機制（去重複、限流、冷卻期）這類「不明顯但必要」的功能。
- **架構紊亂**：沒有 plan.md 的分層設計，AI 會把業務邏輯散落在路由、適配器、甚至 test helper 裡。
- **回歸風險**：沒有 tasks.md 的依賴管理，可能在 repository 還沒完成時就開始寫 orchestrator，導致大量的假依賴與臨時 mock。
- **一致性問題**：沒有 research.md 的決策記錄，排程同步和手動刷新可能被設計成兩條獨立管線，造成結果不一致。

---

## 5. Commit 歷程與開發階段對應

| Commit | 訊息 | 對應階段 | 內容概述 |
|--------|------|---------|---------|
| `327f4f8` | Initial commit from Specify template | 初始化 | Spec-kit 模板建立，包含 `.specify/` 配置與腳本 |
| `c38dd52` | Add initial project specifications | 規格階段 | 產出 `spec.md`、`plan.md`、`tasks.md`、`research.md`、`data-model.md`、`quickstart.md`、`api.openapi.yaml` |
| `ec43c5b` | Implement initial social data hub service | 實作階段 | 完整實作 6 個 Phase、33+ 個任務、8 個單元測試、4 個整合測試、架構報告 |
| `4afbeb1` | Ignore TikTok site verification directory | 修正 | 清理 `.gitignore` |

Commit 歷程反映了 spec-kit 的工作流特性：先產出完整規格（第 2 個 commit），再一次性實作所有程式碼（第 3 個 commit）。規格階段的產出為實作階段提供了明確的邊界約束，避免了「寫到一半才發現需求沒想清楚」的情況。

---

## 6. 總結

這個專案從 draft.md 的業務討論開始，經過 spec-kit 的結構化規格流程，最終產出了一個具備完整資料流、多層保護、分層架構的中型服務。整個過程中，Prompt 設計的核心策略是：

1. **先約束再放手**：每個 Prompt 都基於前一階段的產出，AI 的自由度隨著約束的增加而收斂到正確方向。
2. **強制分離角色**：不同階段讓 AI 扮演不同角色，避免「架構師寫到一半跑去寫程式碼」的問題。
3. **要求自我審查**：每完成一個 Phase 就要求 AI 審查自己的產出，比讓人工審查更快且更容易在上下文中發現問題。
4. **測試驅動方向**：先寫 integration test 定義預期行為，再實作程式碼讓測試通過，確保功能完整性。

如果只用單一 prompt 讓 AI「寫一個社群資料中台」，得到的結果大概是一個缺少驗證、沒有限流、將業務邏輯堆在 route handler 裡的原型。Orchestration 模式的價值不在於「讓 AI 寫更多程式碼」，而在於「讓 AI 在正確的約束下做正確的事」。
