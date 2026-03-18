# Tasks: 社群行銷資料中台

**Input**: Design documents from `/specs/001-social-data-hub/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 依 feature spec 的獨立驗證場景建立 integration 與 unit tests。

**Organization**: Tasks 依 user story 分組，讓每個故事可獨立驗證。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立 Node.js 專案骨架與基本執行入口

- [X] T001 Create project manifest and ignore rules in `package.json` and `.gitignore`
- [X] T002 Create runtime bootstrap and configuration loading in `src/config.js`, `src/app.js`, and `src/server.js`
- [X] T003 [P] Create shared utility modules in `src/lib/http.js`, `src/lib/logger.js`, and `src/lib/fs-store.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 先建立所有 user story 共用的資料層、adapter 與背景工作基礎設施

**⚠️ CRITICAL**: 完成前不可進入 user story 實作

- [X] T004 Create file-backed repositories in `src/repositories/account-config-repository.js`, `src/repositories/job-repository.js`, `src/repositories/raw-record-repository.js`, `src/repositories/normalized-record-repository.js`, and `src/repositories/sheet-snapshot-repository.js`
- [X] T005 [P] Implement request authentication and payload validation in `src/services/auth-service.js` and `src/services/validation-service.js`
- [X] T006 [P] Implement platform and sheet adapters in `src/adapters/platforms/instagram-adapter.js`, `src/adapters/platforms/facebook-adapter.js`, `src/adapters/platforms/tiktok-adapter.js`, `src/adapters/platforms/platform-registry.js`, and `src/adapters/sheets/file-sheet-gateway.js`
- [X] T007 Create queue, orchestration, and scheduler services in `src/services/job-queue.js`, `src/services/refresh-orchestrator.js`, `src/services/manual-refresh-service.js`, and `src/services/scheduler-service.js`
- [X] T008 [P] Seed demo data and fixtures in `src/cli/seed-demo.js` and `fixtures/platforms/*.json`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 排程同步與統一報表 (Priority: P1) 🎯 MVP

**Goal**: 排程能抓取支援平台帳號、保存 raw data、產出 normalized data，並同步狀態與報表快照

**Independent Test**: 啟動服務後觸發一次 scheduled sync，確認 `data/jobs.json`、`data/raw-platform-records.json`、`data/normalized-content-records.json`、`data/sheet-output.json` 都被更新

### Tests for User Story 1

- [X] T009 [P] [US1] Add scheduled sync integration test in `tests/integration/scheduled-sync.test.js`

### Implementation for User Story 1

- [X] T010 [P] [US1] Implement normalization pipeline in `src/services/normalization-service.js`
- [X] T011 [US1] Implement scheduled sync service in `src/services/scheduled-sync-service.js`
- [X] T012 [US1] Implement scheduled sync route in `src/routes/internal-scheduled-sync-route.js`
- [X] T013 [US1] Wire scheduled sync flow into `src/app.js`

**Checkpoint**: User Story 1 應可獨立完成並驗證

---

## Phase 4: User Story 2 - 單一帳號手動刷新 (Priority: P2)

**Goal**: Google Sheet bridge 可提交單一帳號刷新，Server 立即回覆 `queued`，背景工作完成後回寫結果

**Independent Test**: 對有效帳號送出手動刷新，確認 HTTP 立即回傳 `202`，之後 job 轉為 `success` 或 `error`

### Tests for User Story 2

- [X] T014 [P] [US2] Add manual refresh integration test in `tests/integration/manual-refresh.test.js`

### Implementation for User Story 2

- [X] T015 [US2] Implement manual refresh route in `src/routes/manual-refresh-route.js`
- [X] T016 [US2] Add request signing helper in `src/cli/sign-request.js`
- [X] T017 [US2] Wire manual refresh flow into `src/app.js` and `specs/001-social-data-hub/quickstart.md`

**Checkpoint**: User Stories 1 and 2 應可並存且各自可驗證

---

## Phase 5: User Story 3 - 請求保護與狀態可視化 (Priority: P3)

**Goal**: 非法參數、重複 active job、來源過量請求與外部失敗都要被保護並清楚顯示狀態

**Independent Test**: 送出非法 `refresh_days`、重複手動刷新與模擬平台失敗，確認 system message、狀態與 job 行為符合規格

### Tests for User Story 3

- [X] T018 [P] [US3] Add protections integration test in `tests/integration/protections.test.js`

### Implementation for User Story 3

- [X] T019 [US3] Implement rate limit and dedup guards in `src/services/manual-refresh-service.js`
- [X] T020 [US3] Implement status write-back and failure propagation in `src/services/status-service.js` and `src/adapters/sheets/file-sheet-gateway.js`
- [X] T021 [US3] Implement health/status route in `src/routes/health-route.js`

**Checkpoint**: 所有 user stories 應可獨立工作

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 補齊跨故事測試、文件與驗證

- [X] T022 [P] Add unit tests for auth and normalization in `tests/unit/auth-service.test.js` and `tests/unit/normalization-service.test.js`
- [X] T023 Validate quickstart and command flow in `specs/001-social-data-hub/quickstart.md` and `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): 無相依，可立即開始
- Foundational (Phase 2): 依賴 Setup 完成，且會阻擋所有 user story
- User Stories (Phase 3+): 依賴 Foundational 完成
- Polish (Phase 6): 依賴所有 user story 完成

### User Story Dependencies

- User Story 1 (P1): Foundational 完成後即可開始
- User Story 2 (P2): 依賴 Foundation 與 User Story 1 的 queue/orchestrator
- User Story 3 (P3): 依賴 User Story 2 的手動刷新入口

### Within Each User Story

- 先寫 integration test，再補 story 專屬實作
- shared service 先於 route
- route 先於 app wiring

### Parallel Opportunities

- T003 可與 T001-T002 並行
- T005、T006、T008 可在 T004 前後分段並行，但 T007 需等待資料層與 adapter 就緒
- T009、T014、T018、T022 彼此可平行撰寫
- 每個 story 中標記 `[P]` 的任務可並行執行

---

## Parallel Example: User Story 1

```bash
Task: "Add scheduled sync integration test in tests/integration/scheduled-sync.test.js"
Task: "Implement normalization pipeline in src/services/normalization-service.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Setup
2. 完成 Foundational
3. 完成 User Story 1
4. 驗證 scheduled sync 的完整資料流

### Incremental Delivery

1. Setup + Foundational
2. 交付 User Story 1
3. 交付 User Story 2
4. 交付 User Story 3
5. 補齊 cross-cutting tests 與 quickstart 驗證

---

## Notes

- `[P]` 代表不同檔案、可平行執行
- 每個 user story 都保留獨立驗證方式
- 所有任務都帶有實際檔案路徑，方便直接實作
