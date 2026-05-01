# Source Registry

## Feature

- `migration-auth-filestore-retirement`

## External Sources

| Source | Version / Date | Why Relevant | Notes |
| --- | --- | --- | --- |
| `Source/tsukiyo_macro_architecture_review.md` | v0.1, 2026-04-30 | Macro review that identified P0 identity and storage convergence risks. | Treated as a recommendation source, not direct implementation authority. Adopted only where confirmed against code/docs. |
| Supabase docs links listed by macro review | Review date 2026-04-30 | Auth users, JWT metadata, API keys, and RLS/service-role boundaries. | Not re-fetched in this docs pass. Main should verify official docs if SDK/Auth behavior changes during implementation. |

## Version Evidence

| Evidence | Observed Version / State | Relevance |
| --- | --- | --- |
| `package.json` | `@supabase/supabase-js` `^2.103.0`, Node `>=24.0.0` | Implementation must stay compatible with current Supabase JS SDK and native TypeScript execution. |
| `supabase/config.toml` | `[auth.email] enable_confirmations = false` | JWT sync after signup is feasible in current local config. Enabling confirmations later requires a separate callback/hook decision. |
| `package.json` scripts | `typecheck`, `test:backend`, `test:frontend`, `test` exist | Acceptance slices can be verified through existing commands. |

## Codebase Observations

| Path | Observation | Relevance |
| --- | --- | --- |
| `backend/src/app.ts` | Baseline before implementation: always initializes `FileStore`; Supabase mode only replaces account/job/raw/normalized/sheet repositories. User/session/password-reset/outbox repositories still come from FileStore. | Confirms P0 is not complete and must remove runtime FileStore injection entirely. |
| `backend/src/routes/auth-routes.ts` | Baseline before implementation: `login`, `logout`, `forgot-password`, `reset-password`, and public `register` still call legacy services. | Confirms legacy cookie/password-reset routes remain active. |
| `backend/src/middleware/require-auth.ts` | Supabase JWT middleware maps `app_metadata.role/status` into `req.user`. | Supports using `app_metadata` as authorization source. |
| `backend/src/routes/route-auth.ts` | Baseline before implementation: protected route auth still falls back to legacy `UserAuthService` and resolves users through FileStore-backed profile storage. | Must be removed for Supabase-only P0. |
| `frontend/src/hooks/useAuthSession.ts` | Baseline before implementation: auth mode is selected by `VITE_SUPABASE_URL`; otherwise it falls back to legacy HTTP auth. | Frontend must become Supabase-only for P0. |
| `frontend/src/api/authApi.ts` | Baseline before implementation had a forbidden backend signup-sync payload containing frontend-controlled identity fields and the password. Implemented P0 behavior sends only `display_name` to backend signup sync after Supabase Auth signup. | Backend registration sync must not receive password or frontend-controlled identity fields. |
| `.docs/feat-supabase-migration/database-schema.md` | Existing schema covers `account_configs`, `platform_tokens`, `jobs`, raw/normalized records, and `sheet_snapshots`; it also documents service-role bypassing RLS. | This pack extends auth/profile approval storage; it does not adopt the macro review `refresh_jobs/job_runs` rename in P0. |

## FileStore Data Migration Strategy

No production FileStore export was present in this checkout during implementation. Local `backend/data/users.json`, `backend/data/sessions.json`, and `backend/data/password-reset-tokens.json` were absent, so the observed local counts were:

| Legacy collection | Observed local count | P0 handling |
| --- | ---: | --- |
| `users` | 0 | No local rows to migrate. A production migration, if needed, must create Supabase Auth users out-of-band and map legacy user ids to `auth.users.id`; passwords must not be copied or re-hashed into the backend. |
| `sessions` | 0 | Invalidated by this migration. Users must sign in again through Supabase Auth. |
| `password-reset-tokens` | 0 | Expired by this migration. Users must request a new Supabase Auth reset email. |
| `outbox-messages` | 0 | Not migrated for P0. Future notifications require a separate feature. |

If production FileStore data exists outside this checkout, migration tooling should live under a dedicated follow-up docs pack and script path such as `scripts/migrations/auth-filestore-export.ts` and `scripts/migrations/auth-supabase-import.ts`. That follow-up must include tests for id mapping, duplicate email handling, session invalidation, and reset-token expiry before execution.

## Adopt / Defer / Reject Decisions

| Macro Review Recommendation | Decision | Reason |
| --- | --- | --- |
| Use Supabase Auth and `auth.users.id` as canonical user id. | Adopt for P0. | Matches existing migration docs and current Supabase JWT middleware. |
| Retire cookie sessions and FileStore user/session/reset/outbox runtime paths. | Adopt for P0. | These are the highest-risk dual-track paths in current code. |
| Backend service-role queries must self-scope and not assume RLS. | Adopt for P0. | Already documented locally and relevant to approval/profile writes. |
| API process and worker process split. | Defer. | Important P1 work, but not needed to remove auth/FileStore dual-track. |
| `refresh_jobs` / `job_runs` redesign. | Defer. | Current Supabase schema uses `jobs`; changing job model belongs in Jobs/Worker P1. |
| Token vault, API call logs, sheet export logs, full observability model. | Defer. | Relevant after P0 storage/auth convergence. |
| Split into microservices. | Reject for now. | Macro review also recommends modular monolith first. |

## Verification Notes

- This docs pack is based on read-only inspection of current files and the macro review.
- No implementation code is changed by this pack.
- Main must run baseline checks before AC-01 implementation and record results in `Execution/test-log.md`.
- CodeRabbit follow-up on 2026-05-02 verified that implemented frontend signup sync sends only `display_name` to the backend; password remains a Supabase Auth input only.
