# Data Model

## Canonical Identity

| Concept | Source |
| --- | --- |
| User id | `auth.users.id` |
| Email | Supabase Auth user email |
| Role | `auth.users.app_metadata.role` |
| Status | `auth.users.app_metadata.status` |
| Display name | `profiles.display_name` app-owned display copy, initially synced from `auth.users.user_metadata.name` |

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
  email text not null unique,
  display_name text not null,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_approval_state_check check (
    not (approved_at is not null and rejected_at is not null)
  )
);
```

Notes:

- Do not store canonical `role` or `status` here; they remain in `auth.users.app_metadata`.
- `profiles.email` is a denormalized lookup/display copy of Supabase Auth email. Signup sync and any future email-change flow must update it from `auth.users.email`; `auth.users.email` remains canonical.
- `profiles.display_name` is the app display source after signup sync. Supabase `auth.users.user_metadata.name` is the signup input source, not the ongoing canonical display field.
- Admin pending list combines Supabase Auth metadata with profile display fields.
- Service-role queries must scope explicitly when reading user-owned data.
- RLS must be enabled. Users may read their own profile, while service-role backend code performs profile sync and approval writes.
- Index `approved_at` and `rejected_at` with partial indexes for operational review queries where those values are not null.

## Audit Events

Minimum table for approval and high-risk auth operations:

```sql
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
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

Required indexes and RLS:

- `idx_audit_events_user_id` on `(user_id, created_at desc)`.
- `idx_audit_events_actor_user_id` on `(actor_user_id, created_at desc)`.
- `idx_audit_events_type` on `(event_type)`.
- `idx_audit_events_created_at` on `(created_at desc)`.
- Enable RLS on `audit_events`.
- Policy `Admins can read all audit events` checks the current Supabase user in `auth.users` and requires `raw_app_meta_data->>'role' = 'admin'`.
- Policy `Service role can insert audit events` permits inserts from `auth.role() = 'service_role'`.

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
