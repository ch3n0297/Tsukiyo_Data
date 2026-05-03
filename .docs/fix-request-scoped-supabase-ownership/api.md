# API Contract

## Unchanged Public Shapes

| Method | Path | Ownership Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/ui/accounts` | Requires active Bearer JWT; returns only rows where `user_id = auth.users.id`. |
| `GET` | `/api/v1/ui/accounts/:platform/:accountId` | Requires active Bearer JWT; account lookup is scoped to `auth.users.id`. |
| `POST` | `/api/v1/internal/scheduled-sync` | HMAC protected; system enumerates all active owners explicitly. |

## Changed Manual Refresh Body

`POST /api/v1/refresh-jobs/manual` remains HMAC protected and adds required `owner_user_id`.

Request:

```json
{
  "owner_user_id": "11111111-1111-4111-8111-111111111111",
  "platform": "instagram",
  "account_id": "ig-demo",
  "refresh_days": 7,
  "request_source": "apps-script"
}
```

Response remains:

```json
{
  "job_id": "job-id",
  "status": "queued",
  "system_message": "已受理手動更新請求。"
}
```

## Error Semantics

| Case | Status | Error |
| --- | --- | --- |
| Missing `owner_user_id` | 400 | `VALIDATION_ERROR` |
| Unknown owner | 404 | `USER_NOT_FOUND` |
| Pending owner | 403 | `USER_PENDING` |
| Rejected owner | 403 | `USER_REJECTED` |
| Account not owned by owner | 400 | `ACCOUNT_NOT_CONFIGURED` |

## Compatibility

- No fallback to a bootstrap admin owner is allowed.
- Existing HMAC callers must add `owner_user_id` before this branch is deployed.
- Frontend dashboard callers do not change request payloads; ownership is derived from the JWT.
