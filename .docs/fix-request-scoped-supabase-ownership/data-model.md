# Data Model

## Canonical Owner

| Data | Owner Field |
| --- | --- |
| Account configs | `account_configs.user_id = auth.users.id` |
| Jobs | `jobs.user_id = auth.users.id` |
| Raw records | `raw_records.user_id = auth.users.id` |
| Normalized records | `normalized_records.user_id = auth.users.id` |
| Sheet snapshots | `sheet_snapshots.user_id = auth.users.id` |
| Profiles | `profiles.user_id = auth.users.id` |
| Audit events | `audit_events.user_id` and `audit_events.actor_user_id` |

## Type Changes

`AccountConfig` gains owner metadata when returned from runtime repositories:

```ts
interface AccountConfig {
  ownerUserId: string;
}
```

`Job` gains persistent owner context:

```ts
interface Job {
  ownerUserId: string;
}
```

## Repository Ownership

- Owner-scoped repositories require `ownerUserId` at construction.
- System enumeration helpers may query across owners but must return owner-bearing rows.
- User/profile/audit repositories are not user-owned storage repositories and keep their current service-role/admin semantics.

## No Schema Renames

- Keep the current `jobs` table and status values.
- Keep existing `user_id` columns.
- Do not add `refresh_jobs` or `job_runs` in this fix.

## Removed Runtime Concepts

| Concept | Replacement |
| --- | --- |
| `MIGRATION_SYSTEM_USER_ID` | Explicit request/job owner. |
| `storageUserId` app override | `services.forUser(userId)` / test owner fixtures. |
| Bootstrap admin as storage owner | Only bootstrap admin's own rows use its user id. |
