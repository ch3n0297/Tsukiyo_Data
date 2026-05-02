# Slice Tracker

| Slice | Summary | Status | Test Command | Expected Output | Commit |
| --- | --- | --- | --- | --- | --- |
| AC-01 | Docs pack and baseline. | committed | `test -f .docs/fix-request-scoped-supabase-ownership/api.md && test -f .docs/fix-request-scoped-supabase-ownership/data-model.md && test -f .docs/fix-request-scoped-supabase-ownership/Execution/slice-tracker.md` | Required docs and Execution tracker exist. | 8d50f0e |
| AC-02 | JWT-scoped UI account APIs. | pending | `node --experimental-strip-types --test tests/integration/frontend-ui.test.ts` | Two-user dashboard isolation test passes. | - |
| AC-03 | Owner-aware manual refresh. | pending | `node --experimental-strip-types --test tests/integration/manual-refresh.test.ts tests/integration/protections.test.ts` | Missing/invalid owner cases fail; valid owner job has `ownerUserId`. | - |
| AC-04 | Multi-owner scheduled sync and recovery. | pending | `node --experimental-strip-types --test tests/integration/scheduled-sync.test.ts tests/unit/refresh-orchestrator-supabase.test.ts` | Multi-owner scheduled jobs and owner-scoped processing pass. | - |
| AC-05 | Regression and fixed-owner absence audit. | pending | `npm run typecheck && npm test && sh -c '! rg -n -e MIGRATION_SYSTEM_USER_ID -e storageUserId backend/src tests'` | Typecheck/tests pass and fixed-owner symbols are absent. | - |
