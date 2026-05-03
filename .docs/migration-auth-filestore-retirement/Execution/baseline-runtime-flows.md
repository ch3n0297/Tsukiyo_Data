# Baseline Runtime Flows Snapshot

Snapshot of `runtime-flows.md` for Main handoff on 2026-05-01.

## Flows

- Signup: frontend Supabase signup -> backend JWT sync -> profile/audit write -> app_metadata pending -> frontend signout.
- Login/current user: frontend Supabase login -> `/api/v1/auth/me` with Bearer JWT -> active users succeed; pending/rejected users fail.
- Admin approval: active admin JWT -> update target `app_metadata.status` -> approval/audit write.
- Password reset: Supabase Auth reset flow only.
- Logout: Supabase `signOut()` only.

## Error Behavior

- Missing JWT: `401 MISSING_JWT`.
- Invalid JWT: `401 INVALID_JWT`.
- Pending user: `403 USER_PENDING`.
- Rejected user: `403 USER_REJECTED`.
- Legacy login/forgot/reset compatibility stubs: `410 LEGACY_AUTH_REMOVED`.
- Logout compatibility route: 200 no-op.
