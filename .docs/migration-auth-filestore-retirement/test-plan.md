# Test Plan

| Slice | Summary | Test Command | Expected Output |
| --- | --- | --- | --- |
| AC-01 | Supabase-only protected route auth; remove legacy cookie fallback. | `npm run typecheck:backend && node --experimental-strip-types --test tests/unit/supabase-require-auth.test.ts tests/unit/route-auth.test.ts` | Backend typecheck passes; protected routes reject missing JWT and no test authenticates via cookie session. |
| AC-02 | JWT signup sync and admin approval metadata. | `node --experimental-strip-types --test tests/integration/auth-session.test.ts tests/unit/supabase-require-auth.test.ts tests/unit/route-auth.test.ts` | Signup sync accepts JWT-derived user only, does not accept password, and admin approval updates `app_metadata.status`. |
| AC-03 | Password reset/logout use Supabase Auth, not backend FileStore services. | `npm run typecheck:frontend && npm run test:frontend` | Frontend auth tests pass with Supabase helpers; legacy backend reset token path is not used. |
| AC-04 | Remove FileStore runtime composition and fallback repositories. | `npm run typecheck:backend && npm run test:backend` | Backend tests pass; `backend/src/app.ts` has no FileStore initialization or `USE_SUPABASE_STORAGE` storage switch. |
| AC-05 | Final regression and FileStore absence audit. | `npm run typecheck && npm test && sh -c '! rg -n -e FileStore -e fs-store -e USE_SUPABASE_STORAGE -e SessionRepository -e PasswordResetTokenRepository -e OutboxMessageRepository backend/src tests'` | Typecheck/tests pass; `rg` returns no runtime FileStore/session/reset/outbox fallback references. |

## Notes

- Main must run a baseline `npm run typecheck` and `npm test` before AC-01 and record the result in `Execution/test-log.md`.
- Slice order is mandatory. Do not start the next slice until the current slice is tested and committed.
- If a command flag is unsupported by the local runner, use the nearest targeted test file command and record the substituted command.
