# Data Model

## Canonical Identity

| Concept | Source |
| --- | --- |
| User id | `auth.users.id` |
| Email | Supabase Auth user email |
| Role | `auth.users.app_metadata.role` |
| Status | `auth.users.app_metadata.status` |
| Display name | `auth.users.user_metadata.name` and app profile display copy |

## App Metadata

```json
{
  "role": "member",
  "status": "pending"
}
```

Allowed values:

- `role`: `admin`, `member`
- `status`: `pending`, `active`, `rejected`

Only service-role backend code may update these claims.

## Profiles

Recommended table for app-owned user display and approval timestamps:

```sql
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Notes:

- Do not store canonical `role` or `status` here unless explicitly labeled as a derived snapshot.
- Admin pending list combines Supabase Auth metadata with profile display fields.
- Service-role queries must scope explicitly when reading user-owned data.

## Audit Events

Minimum table for approval and high-risk auth operations:

```sql
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  actor_user_id uuid references auth.users(id),
  actor_type text not null check (actor_type in ('user', 'admin', 'system')),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

Required P0 events:

- `auth.signup_synced`
- `auth.user_approved`
- `auth.user_rejected`
- `auth.legacy_endpoint_called` if compatibility stubs are kept

## Removed FileStore Collections

These collections must not remain as runtime storage:

| Collection | Replacement |
| --- | --- |
| `users` | Supabase Auth + `profiles` |
| `sessions` | Supabase Auth sessions/JWT |
| `password-reset-tokens` | Supabase Auth reset flow |
| `outbox-messages` | Removed from P0 runtime; future notifications require a separate feature |
| `account-configs` | Supabase `account_configs` |
| `jobs` | Supabase `jobs` |
| `raw-platform-records` | Supabase `raw_records` |
| `normalized-content-records` | Supabase `normalized_records` |
| `sheet-status` / `sheet-output` | Supabase `sheet_snapshots` |

## Test Data

- Backend tests should construct explicit in-memory repository stubs or use Supabase-backed fixtures.
- Tests must not use FileStore as an implicit runtime fallback.
