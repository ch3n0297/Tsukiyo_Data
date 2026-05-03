# Slice Tracker

| Slice | Summary | Status | Test Command | Expected Output | Commit |
| --- | --- | --- | --- | --- | --- |
| AC-01 | Docs pack and baseline. | committed | `test -f .docs/fix-request-scoped-supabase-ownership/api.md && test -f .docs/fix-request-scoped-supabase-ownership/data-model.md && test -f .docs/fix-request-scoped-supabase-ownership/Execution/slice-tracker.md` | Required docs and Execution tracker exist. | 2b4d11e |
| AC-02 | JWT-scoped UI account APIs. | committed | `node --experimental-strip-types --test tests/integration/frontend-ui.test.ts` | Two-user dashboard isolation test passes. | 65d4378 |
| AC-03 | Owner-aware manual refresh. | committed | `node --experimental-strip-types --test tests/integration/manual-refresh.test.ts tests/integration/protections.test.ts` | Missing/invalid owner cases fail; valid owner job has `ownerUserId`. | 65d4378 |
| AC-04 | Multi-owner scheduled sync and recovery. | committed | `node --experimental-strip-types --test tests/integration/scheduled-sync.test.ts tests/unit/refresh-orchestrator-supabase.test.ts` | Multi-owner scheduled jobs and owner-scoped processing pass. | 65d4378 |
| AC-05 | Regression and fixed-owner absence audit. | committed | `npm run typecheck && npm test && sh -c '! rg -n -e MIGRATION_SYSTEM_USER_ID -e storageUserId backend/src tests backend/test-support'` | Typecheck/tests pass and fixed-owner symbols are absent. | 65d4378 |
