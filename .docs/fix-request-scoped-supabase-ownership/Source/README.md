# Source Registry

## Feature

- `fix-request-scoped-supabase-ownership`

## External Sources

| Source | Version / Date | Why Relevant | Decision |
| --- | --- | --- | --- |
| `/Users/hjc/Downloads/tsukiyo_macro_architecture_review.md` | Reviewed 2026-05-03 from repo copy in `.docs/migration-auth-filestore-retirement/Source/` | Calls out service-role/RLS confusion and requires backend queries to self-scope by user id. | Adopt for this fix. |
| PR #14 `fix/migration-auth-filestore-retirement` | Head `fe1dbb6` at planning time | Removes FileStore runtime paths but still leaves user-owned repositories scoped through a startup owner. | Treat as dependency; this branch stacks on PR #14 until it merges. |

## Version Evidence

| Evidence | Observation |
| --- | --- |
| `package.json` | `@supabase/supabase-js` is `^2.103.0`; backend is Node ESM with TypeScript strip-types tests. |
| `supabase/migrations/20240413000001_init.sql` | User-owned app tables all include `user_id`; RLS policies compare `auth.uid()` to `user_id`. |
| `supabase/migrations/20240413000002_security_fixes.sql` | Policies have `WITH CHECK`; token encryption remains explicitly deferred. |
| `supabase/migrations/20240501000004_auth_filestore_retirement.sql` | `profiles` and `audit_events` are Supabase/Auth-backed and service-role managed. |

## Codebase Observations

| Path | Observation | Impact |
| --- | --- | --- |
| `backend/src/app.ts` | Runtime creates Supabase repositories with one `storageUserId`, resolved from bootstrap admin or a migration UUID. | Protected UI and internal jobs can read/write a startup owner instead of the current/request owner. |
| `backend/src/routes/ui-accounts-route.ts` | Route validates JWT but discards `requireRouteUser().user.id` before querying dashboard data. | Active JWT users are authorized but not used as data owner. |
| `backend/src/routes/manual-refresh-route.ts` | HMAC payload identifies account, not owner. | Same platform/account id can be ambiguous across users; service-role path cannot prove owner. |
| `backend/src/services/scheduled-sync-service.ts` | Scheduler works against one injected account/job repository. | Scheduled sync covers only the startup owner and cannot process all active users cleanly. |
| `backend/src/services/job-queue.ts` and `RefreshOrchestrator` | Jobs do not carry owner context. | Background work cannot reconstruct the owner scope after enqueue/restart. |
| `backend/test-support/support.ts` | Memory repositories are global and seeded without owner. | Tests need owner-aware fixtures to prove isolation. |

## Verification Notes

- Baseline before this feature: `npm run typecheck && npm test` passed on 2026-05-03 in the new worktree.
- This fix must add failing tests first for two-user dashboard isolation, manual refresh owner validation, scheduled sync multi-owner processing, and absence of fixed storage owner symbols.
- Live Supabase row visibility is optional in this pass; if local Supabase is not available, record that limitation in `Execution/test-log.md`.
