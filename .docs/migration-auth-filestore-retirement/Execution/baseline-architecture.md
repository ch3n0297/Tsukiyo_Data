# Baseline Architecture Snapshot

Snapshot of `architecture.md` for Main handoff on 2026-05-01.

## Target Architecture

```mermaid
flowchart TD
  FE[Frontend React] -->|signup/login/reset/logout| SBAUTH[Supabase Auth]
  SBAUTH -->|JWT| FE
  FE -->|Bearer JWT| API[Fastify API]
  API --> MW[Supabase JWT Middleware]
  MW --> CTX[AppUserContext]
  CTX --> AUTHZ[Business Authorization]
  AUTHZ --> REPO[Supabase Repositories]
  REPO --> PG[(Supabase Postgres)]
  AUTHZ --> ADMIN[Supabase Admin API]
  ADMIN --> META[app_metadata role/status]
```

## Key Boundaries

- Frontend uses Supabase Auth directly.
- Backend registration sync must not receive passwords.
- Backend validates JWT and derives `AppUserContext`.
- `app_metadata.role/status` is server-managed authorization state.
- Runtime repositories are Supabase-backed only.
- Tests use explicit mocks/stubs, not FileStore fallback.
