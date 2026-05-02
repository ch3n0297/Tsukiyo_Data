# Test Log

## 2026-05-01

- Docs-only pack creation. No implementation tests were run for this feature yet.
- Required first Main action: run `npm run typecheck` and `npm test` as baseline before AC-01.

## 2026-05-01 Baseline Before AC-01

- `npm run typecheck`: pass.
- `npm test`: pass.
  - Backend: 46 tests passed.
  - Frontend: 21 files passed, 138 tests passed.

## 2026-05-01 AC-01

- `npm run typecheck:backend`: pass.
- `node --experimental-strip-types --test tests/unit/supabase-require-auth.test.ts tests/unit/route-auth.test.ts`: pass.
  - 5 tests passed.
  - Covered missing JWT rejection, pending user rejection, active admin acceptance, and removal of legacy cookie-session auth from route guard tests.

## 2026-05-01 AC-02

- `node --experimental-strip-types --test tests/integration/auth-session.test.ts tests/unit/supabase-require-auth.test.ts tests/unit/route-auth.test.ts`: pass.
  - 10 tests passed.
  - Covered JWT signup sync, backend rejection of password/frontend-controlled identity fields, admin approval metadata update, pending list behavior, and legacy login/password-reset endpoint retirement.
- Rerun after adding signup-sync downgrade guard: pass.
  - 10 tests passed.
  - Added coverage that an approved user cannot call signup sync to reset `app_metadata.status` back to `pending`.

## 2026-05-01 AC-03

- First run of `npm run typecheck:frontend && npm run test:frontend`: failed.
  - Frontend typecheck passed.
  - `frontend/src/App.test.tsx` had 5 failing tests because the App-level tests still assumed legacy backend login/session behavior and did not mock Supabase Auth.
- Updated App-level tests to mock Supabase `getSession()`/`signInWithPassword()` and keep route behavior assertions on the Supabase runtime path.
- Rerun `npm run typecheck:frontend && npm run test:frontend`: pass.
  - Frontend: 21 test files passed, 138 tests passed.

## 2026-05-01 AC-04

- `npm run typecheck:backend && npm run test:backend`: pass.
  - Backend typecheck passed.
  - Backend: 41 tests passed.
  - Covered app composition without FileStore, Supabase route auth, auth/admin integration, dashboard APIs, refresh jobs, scheduler, and repository-path persistence.

## 2026-05-01 AC-05

- `npm run typecheck && npm test && sh -c '! rg -n -e FileStore -e fs-store -e USE_SUPABASE_STORAGE -e SessionRepository -e PasswordResetTokenRepository -e OutboxMessageRepository backend/src tests'`: pass.
  - Backend and frontend typecheck passed.
  - Backend: 41 tests passed.
  - Frontend: 21 test files passed, 138 tests passed.
  - FileStore/session/reset/outbox absence audit returned no matches in `backend/src` or `tests`.

## 2026-05-02 CodeRabbit Follow-up

- `npm run typecheck:backend`: pass.
  - Verified repository renames, seed pagination helper, audit repository error normalization, and Supabase profile repository clock injection compile.
- `npm run typecheck && npm test && sh -c '! rg -n -e FileStore -e fs-store -e USE_SUPABASE_STORAGE -e SessionRepository -e UserRepository -e PasswordResetTokenRepository -e OutboxMessageRepository backend/src frontend/src tests'`: pass.
  - Backend and frontend typecheck passed.
  - Backend: 41 tests passed.
  - Frontend: 21 test files passed, 138 tests passed.
  - Expanded FileStore/session/user/reset/outbox absence audit returned no matches in `backend/src`, `frontend/src`, or `tests`.
- Rerun after removing stale legacy auth/FileStore config fields and unused frontend legacy auth helpers: pass.
  - Backend and frontend typecheck passed.
  - Backend: 41 tests passed.
  - Frontend: 21 test files passed, 138 tests passed.
  - FileStore/session/reset/outbox absence audit returned no matches in `backend/src` or `tests`.

## 2026-05-03 PR #14 Hygiene

- `npm run typecheck && npm test && sh -c '! rg -n -e FileStore -e fs-store -e USE_SUPABASE_STORAGE -e SessionRepository -e UserRepository -e PasswordResetTokenRepository -e OutboxMessageRepository backend/src frontend/src tests'`: pass.
  - Backend and frontend typecheck passed.
  - Backend: 41 tests passed.
  - Frontend: 21 test files passed, 138 tests passed.
  - FileStore/session/user/reset/outbox absence audit returned no matches in `backend/src`, `frontend/src`, or `tests`.
