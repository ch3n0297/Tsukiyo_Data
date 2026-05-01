# Feature Spec

## Goal

Remove the remaining auth and runtime FileStore dual-track behavior. After this feature, the app uses Supabase Auth for identity and Supabase-backed persistence for runtime data.

## Non-goals

- Do not redesign `jobs` into `refresh_jobs` / `job_runs`.
- Do not split API and worker processes.
- Do not build token vault, Google Sheets export observability, or platform API rate-limit logs.
- Do not introduce a new non-Supabase local storage fallback.
- Do not migrate historical production data unless a separate migration task provides source data.

## Requirements

- Supabase Auth is the only runtime identity provider.
- `auth.users.id` is the canonical `user_id` for all app-owned rows.
- `app_metadata.role` and `app_metadata.status` are the authorization source; only backend service-role code may update them.
- `POST /api/v1/auth/register` becomes a JWT-authenticated signup sync endpoint and must not accept or persist a password.
- Frontend signup calls Supabase Auth first, then calls backend signup sync with the Supabase JWT.
- Password reset uses Supabase Auth reset flow; legacy reset tokens and notification outbox are removed from runtime.
- Legacy cookie sessions are removed from runtime; protected routes require `Authorization: Bearer <Supabase JWT>`.
- FileStore and FileStore-backed repositories are removed from runtime startup and dependency injection.
- Tests must use mocks/stubs or Supabase-backed fixtures instead of FileStore fallback.

## Constraints

- Do not trust role/status from request body, `user_metadata`, or frontend state.
- Do not pass user password from frontend to backend registration sync.
- Do not assume RLS protects service-role queries; service-role repository calls must self-scope by user id or be explicitly admin-scoped.
- Do not keep `USE_SUPABASE_STORAGE` as a runtime storage switch after this migration; Supabase storage is the only runtime path.
- Do not change job/worker semantics except where required to remove FileStore injection.

## Acceptance Criteria

- `AC-01`: Protected route auth is Supabase-only and legacy session fallback is removed.
- `AC-02`: Signup sync and admin approval use Supabase Auth metadata without backend password handling.
- `AC-03`: Password reset/logout no longer depend on backend FileStore tokens or sessions.
- `AC-04`: FileStore runtime storage path is removed from backend app composition and tests.
- `AC-05`: Final verification proves typecheck/tests pass and no runtime FileStore path remains.

## Failure / Rejection Cases

- Backend registration accepts `password`, hashes a password, or writes password hash.
- Any protected API succeeds through a legacy cookie session after P0.
- `app_metadata.role/status` can be overridden through request body or frontend user metadata.
- `backend/src/app.ts` imports or initializes `FileStore`.
- Production code instantiates FileStore-backed repositories as fallback.
- Tests pass only because a FileStore fallback is still active.
