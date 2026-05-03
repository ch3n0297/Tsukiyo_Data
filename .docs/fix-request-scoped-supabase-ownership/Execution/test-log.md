# Test Log

## 2026-05-03 Baseline

- `npm run typecheck && npm test`: pass.
  - Backend and frontend typecheck passed.
  - Backend: 41 tests passed.
  - Frontend: 21 test files passed, 138 tests passed.
  - Frontend test run emitted the existing Node `--localstorage-file` warning.

## 2026-05-03 AC-01

- `test -f .docs/fix-request-scoped-supabase-ownership/api.md && test -f .docs/fix-request-scoped-supabase-ownership/data-model.md && test -f .docs/fix-request-scoped-supabase-ownership/Execution/slice-tracker.md`: pass.

## 2026-05-03 Red Tests

- `node --experimental-strip-types --test tests/integration/frontend-ui.test.ts`: red before implementation.
  - The admin JWT could still see a member-owned account row.
- `node --experimental-strip-types --test tests/integration/manual-refresh.test.ts`: red before implementation.
  - Missing `owner_user_id` still returned `202`.
  - Enqueued manual jobs had no `ownerUserId`.
- `node --experimental-strip-types --test tests/integration/scheduled-sync.test.ts`: red before implementation.
  - Scheduled jobs had no `ownerUserId`.

## 2026-05-03 Targeted Verification

- `node --experimental-strip-types --test tests/integration/frontend-ui.test.ts`: pass.
  - 5 backend integration tests passed, including two-user dashboard isolation.
- `node --experimental-strip-types --test tests/integration/manual-refresh.test.ts tests/integration/protections.test.ts`: pass.
  - 7 backend integration tests passed, including missing/unknown/pending owner rejection and valid owner enqueue.
- `node --experimental-strip-types --test tests/integration/scheduled-sync.test.ts tests/unit/refresh-orchestrator-supabase.test.ts`: pass.
  - 3 backend tests passed, including multi-owner scheduled enqueue and pending-owner exclusion.
- `npm run typecheck:backend`: pass.
- `sh -c '! rg -n -e MIGRATION_SYSTEM_USER_ID -e storageUserId backend/src tests'`: pass.

## 2026-05-03 Full Regression

- `npm run typecheck && npm test && sh -c '! rg -n -e MIGRATION_SYSTEM_USER_ID -e storageUserId backend/src tests backend/test-support'`: pass.
  - Backend and frontend typecheck passed.
  - Backend: 45 tests passed.
  - Frontend: 21 test files passed, 138 tests passed.
  - Frontend test run emitted the existing Node `--localstorage-file` warning.
  - Fixed-owner absence audit passed across runtime code, tests, and backend test support.
- `supabase status`: local live Supabase check not available.
  - Supabase CLI exists, but Docker reported no container named `supabase_db_Tsukiyo_Data`.
