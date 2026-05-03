# Baseline Spec Snapshot

Snapshot of `spec.md` for Main handoff on 2026-05-01.

## Goal

Remove the remaining auth and runtime FileStore dual-track behavior. Supabase Auth owns identity and Supabase-backed persistence owns runtime data.

## Required Outcomes

- Supabase Auth only for runtime identity.
- `auth.users.id` as canonical user id.
- `app_metadata.role/status` as authorization source.
- JWT-authenticated signup sync without backend password handling.
- Supabase Auth password reset.
- No runtime FileStore startup, repository fallback, sessions, reset tokens, or outbox.

## Acceptance Criteria

| Slice | Summary |
| --- | --- |
| AC-01 | Protected route auth is Supabase-only and legacy session fallback is removed. |
| AC-02 | Signup sync and admin approval use Supabase Auth metadata without backend password handling. |
| AC-03 | Password reset/logout no longer depend on backend FileStore tokens or sessions. |
| AC-04 | FileStore runtime storage path is removed from backend app composition and tests. |
| AC-05 | Final verification proves typecheck/tests pass and no runtime FileStore path remains. |

## Rejection Cases

- Backend accepts registration password.
- Protected routes accept legacy cookie session.
- `role/status` are trusted from frontend body or user metadata.
- `backend/src/app.ts` imports or initializes FileStore.
