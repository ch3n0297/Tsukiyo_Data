# Runtime Flows

## UI Dashboard

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as Fastify
  participant Auth as Supabase Auth
  participant Factory as forUser(userId)
  participant DB as Supabase Postgres

  FE->>API: GET /api/v1/ui/accounts + Bearer JWT
  API->>Auth: getUser(jwt)
  Auth-->>API: auth.users.id + app_metadata
  API->>API: require active user
  API->>Factory: forUser(auth.users.id)
  Factory->>DB: select account/snapshot rows where user_id = owner
  DB-->>API: owner-matched rows only
  API-->>FE: existing dashboard response shape
```

## Manual Refresh

```mermaid
sequenceDiagram
  participant Caller as HMAC Caller
  participant API as Fastify
  participant Auth as Supabase Admin
  participant Factory as forUser(owner)
  participant Queue as JobQueue

  Caller->>API: POST /api/v1/refresh-jobs/manual { owner_user_id, account_id, ... }
  API->>API: verify HMAC over raw body
  API->>API: validate owner_user_id is present
  API->>Auth: getUserById(owner_user_id)
  Auth-->>API: active owner metadata
  API->>Factory: forUser(owner_user_id)
  Factory->>Factory: verify account belongs to owner
  Factory->>Queue: enqueue job with ownerUserId
  API-->>Caller: 202 queued
```

Rejected cases:

- Missing `owner_user_id`: `400 VALIDATION_ERROR`.
- Unknown owner: `404 USER_NOT_FOUND`.
- Pending/rejected owner: `403 USER_PENDING` or `403 USER_REJECTED`.
- Account not owned by owner: existing account-not-configured error.

## Scheduled Sync

```mermaid
sequenceDiagram
  participant Timer as Scheduler/Internal Route
  participant Sys as SystemOwnershipRepository
  participant Factory as forUser(owner)
  participant Queue as JobQueue

  Timer->>Sys: listActiveAccountsWithOwners()
  Sys-->>Timer: accounts with ownerUserId
  loop each account
    Timer->>Factory: forUser(account.ownerUserId)
    Factory->>Factory: check active job and sheet metadata
    Factory->>Queue: enqueue job with ownerUserId
  end
```

## Restart Recovery

```mermaid
sequenceDiagram
  participant App as createApp
  participant Sys as SystemOwnershipRepository
  participant Factory as forUser(owner)
  participant Queue as JobQueue

  App->>Sys: listJobsByStatusesAcrossOwners(running)
  App->>Factory: forUser(job.ownerUserId)
  Factory->>Factory: mark interrupted job/account error
  App->>Sys: listJobsByStatusesAcrossOwners(queued)
  App->>Queue: re-enqueue job with ownerUserId
```
