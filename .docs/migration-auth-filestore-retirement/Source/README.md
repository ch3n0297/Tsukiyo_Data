# Source Registry

## Feature

- `migration-auth-filestore-retirement`

## External Sources

| Source | Version / Date | Why Relevant | Notes |
| --- | --- | --- | --- |
| `/Users/hjc/Downloads/tsukiyo_macro_architecture_review.md` | v0.1, 2026-04-30 | Macro review that identified P0 identity and storage convergence risks. | Treated as a recommendation source, not direct implementation authority. Adopted only where confirmed against code/docs. |
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
| `backend/src/app.ts` | Always initializes `FileStore`; Supabase mode only replaces account/job/raw/normalized/sheet repositories. User/session/password-reset/outbox repositories still come from FileStore. | Confirms P0 is not complete and must remove runtime FileStore injection entirely. |
| `backend/src/routes/auth-routes.ts` | `login`, `logout`, `forgot-password`, `reset-password`, and public `register` still call legacy services. | Confirms legacy cookie/password-reset routes remain active. |
| `backend/src/middleware/require-auth.ts` | Supabase JWT middleware maps `app_metadata.role/status` into `req.user`. | Supports using `app_metadata` as authorization source. |
| `backend/src/routes/route-auth.ts` | Protected route auth still falls back to legacy `UserAuthService` and resolves users through FileStore-backed `userRepository`. | Must be removed for Supabase-only P0. |
| `frontend/src/hooks/useAuthSession.ts` | Auth mode is selected by `VITE_SUPABASE_URL`; otherwise it falls back to legacy HTTP auth. | Frontend must become Supabase-only for P0. |
| `frontend/src/api/authApi.ts` | Supabase signup then calls legacy `registerUser` with `email`, `display_name`, `external_user_id`, and `password`. | This violates the target boundary; backend registration sync must not receive password. |
| `.docs/feat-supabase-migration/database-schema.md` | Existing schema covers `account_configs`, `platform_tokens`, `jobs`, raw/normalized records, and `sheet_snapshots`; it also documents service-role bypassing RLS. | This pack extends auth/profile approval storage; it does not adopt the macro review `refresh_jobs/job_runs` rename in P0. |

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
