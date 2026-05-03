# API Contract

## Auth Endpoints

| Method | Path | P0 Behavior | Auth | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Sync Supabase signup into app profile/approval state. | Bearer JWT required | Body may include `display_name`; must not include trusted `email`, `password`, `role`, or `status`. |
| `GET` | `/api/v1/auth/me` | Return active current user mapped from Supabase JWT and app metadata. | Bearer JWT required | Pending/rejected users receive 403. |
| `POST` | `/api/v1/auth/login` | Compatibility stub. | None | Return `410 LEGACY_AUTH_REMOVED`; frontend uses Supabase client. |
| `POST` | `/api/v1/auth/logout` | Compatibility no-op. | None | Return 200 without storage access; frontend uses Supabase `signOut()` as the real logout action. |
| `POST` | `/api/v1/auth/forgot-password` | Removed legacy endpoint. | None | Return `410 LEGACY_AUTH_REMOVED`; frontend uses `supabase.auth.resetPasswordForEmail`. |
| `POST` | `/api/v1/auth/reset-password` | Removed legacy endpoint. | None | Return `410 LEGACY_AUTH_REMOVED`; frontend uses `supabase.auth.updateUser`. |

## Admin Endpoints

| Method | Path | P0 Behavior | Auth | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/admin/pending-users` | List pending signup records. | Active admin JWT | Source of role/status is `app_metadata`; profile table supplies display metadata. |
| `POST` | `/api/v1/admin/pending-users/:userId/approve` | Set target `app_metadata.status=active`; record approval metadata/audit. | Active admin JWT | Must reject non-pending target users with 409. |
| `POST` | `/api/v1/admin/pending-users/:userId/reject` | Set target `app_metadata.status=rejected`; record rejection metadata/audit. | Active admin JWT | Must reject non-pending target users with 409. |

## Protected UI/Data Endpoints

All protected `/api/v1/ui/*` endpoints require Bearer JWT and active status. Cookie session fallback is removed.

## Request/Response Shapes

### `POST /api/v1/auth/register`

Request:

```json
{
  "display_name": "Example User"
}
```

Server-derived values:

- `user_id` from validated Supabase JWT.
- `email` from Supabase Auth user.
- `role` default `member`.
- `status` default `pending`.

Response `201`:

```json
{
  "status": "pending",
  "system_message": "註冊申請已送出，待管理員核准後即可登入。",
  "user": {
    "id": "auth-user-id",
    "email": "user@example.com",
    "displayName": "Example User",
    "role": "member",
    "status": "pending"
  }
}
```

## Removed Trust Boundaries

- Backend must not accept password for registration.
- Backend must not accept role/status from frontend.
- Backend must not validate auth through legacy cookie sessions.
