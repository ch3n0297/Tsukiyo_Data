# Slice Tracker

| Slice | Summary | Status | Test Command | Expected Output | Commit |
| --- | --- | --- | --- | --- | --- |
| AC-01 | Supabase-only protected route auth; remove legacy cookie fallback. | committed | `npm run typecheck:backend && node --experimental-strip-types --test tests/unit/supabase-require-auth.test.ts tests/unit/route-auth.test.ts` | Backend typecheck passes; protected routes reject missing JWT and no test authenticates via cookie session. | 8f5b262 |
| AC-02 | JWT signup sync and admin approval metadata. | committed | `node --experimental-strip-types --test tests/integration/auth-session.test.ts tests/unit/supabase-require-auth.test.ts tests/unit/route-auth.test.ts` | Signup sync accepts JWT-derived user only, does not accept password, and admin approval updates `app_metadata.status`. | 8f5b262 |
| AC-03 | Password reset/logout use Supabase Auth, not backend FileStore services. | committed | `npm run typecheck:frontend && npm run test:frontend` | Frontend auth tests pass with Supabase helpers; legacy backend reset token path is not used. | 8f5b262 |
| AC-04 | Remove FileStore runtime composition and fallback repositories. | committed | `npm run typecheck:backend && npm run test:backend` | Backend tests pass; `backend/src/app.ts` has no FileStore initialization or `USE_SUPABASE_STORAGE` storage switch. | 8f5b262 |
| AC-05 | Final regression and FileStore absence audit. | committed | `npm run typecheck && npm test && sh -c '! rg -n -e FileStore -e fs-store -e USE_SUPABASE_STORAGE -e SessionRepository -e PasswordResetTokenRepository -e OutboxMessageRepository backend/src tests'` | Typecheck/tests pass; no runtime FileStore/session/reset/outbox fallback references remain. | 8f5b262 |
