# Commit Log

| Slice | Commit | Notes |
| --- | --- | --- |
| docs-pack | - | P0 Auth/FileStore docs pack prepared; implementation not started. |
| AC-01 | 8f5b262 | Supabase-only route auth; protected routes reject missing JWT and do not use cookie sessions. |
| AC-02 | 8f5b262 | JWT signup sync, service-role `app_metadata` approval/rejection, profile/audit persistence, and downgrade guard. |
| AC-03 | 8f5b262 | Supabase Auth password reset/logout frontend flow; legacy backend login/reset endpoints remain disabled compatibility stubs. |
| AC-04 | 8f5b262 | Removed FileStore runtime composition and legacy auth/reset/session/outbox repositories/services; Supabase repositories are the runtime path. |
| AC-05 | 8f5b262 | Full typecheck/test regression and FileStore/session/reset/outbox absence audit passed. |
