# Runtime Flows

## Signup And Pending Sync

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant FE as Frontend
  participant SA as Supabase Auth
  participant API as Fastify API
  participant DB as Supabase Postgres

  U->>FE: submit email/password/display name
  FE->>SA: signUp(email, password, user_metadata.name)
  SA-->>FE: session/JWT (current local config has confirmations disabled)
  FE->>API: POST /api/v1/auth/register with Bearer JWT and display_name
  API->>SA: validate JWT / get auth user
  API->>DB: upsert profile + approval timestamps
  API->>SA: set app_metadata role=member,status=pending
  API-->>FE: 201 pending user
  FE->>SA: signOut
```

## Login And Current User

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant SA as Supabase Auth
  participant API as Fastify API

  FE->>SA: signInWithPassword(email, password)
  SA-->>FE: JWT
  FE->>API: GET /api/v1/auth/me with Bearer JWT
  API->>SA: validate JWT
  API->>API: map app_metadata role/status
  alt status active
    API-->>FE: 200 user
  else status pending/rejected
    API-->>FE: 403 USER_PENDING or USER_REJECTED
    FE->>SA: signOut
  end
```

## Admin Approval

```mermaid
sequenceDiagram
  autonumber
  participant Admin as Admin UI
  participant API as Fastify API
  participant SA as Supabase Admin API
  participant DB as Supabase Postgres

  Admin->>API: POST /api/v1/admin/pending-users/:userId/approve with admin JWT
  API->>API: require active admin from app_metadata
  API->>DB: load pending profile/approval record
  API->>SA: update target app_metadata.status=active
  API->>DB: write approved_at/approved_by + audit event
  API-->>Admin: 200 approved user
```

## Password Reset

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant SA as Supabase Auth

  FE->>SA: resetPasswordForEmail(email)
  SA-->>FE: Supabase email/reset flow
  FE->>SA: updateUser(password) from reset session
  SA-->>FE: password updated
```

## Logout

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant SA as Supabase Auth

  FE->>SA: signOut()
  SA-->>FE: session cleared
```

## Error Flow

- Missing Bearer JWT returns `401 MISSING_JWT`.
- Invalid or expired JWT returns `401 INVALID_JWT`.
- `pending` users return `403 USER_PENDING`.
- `rejected` users return `403 USER_REJECTED`.
- Legacy login/forgot/reset compatibility stubs return `410 LEGACY_AUTH_REMOVED` and must not touch storage.
- Logout compatibility route returns 200 no-op and must not touch storage.
