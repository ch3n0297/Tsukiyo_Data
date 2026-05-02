# Feature Spec

## Goal

Make runtime storage ownership explicit and request-scoped. User-owned Supabase data must be read or written under the owner derived from the active JWT, signed internal payload, or system enumeration.

## Non-goals

- Do not rename `jobs` to `refresh_jobs` or add `job_runs`.
- Do not split API and worker into separate processes.
- Do not implement token vault, OAuth token encryption, or credential refresh lifecycle.
- Do not add a local/FileStore fallback.
- Do not change frontend route shape or dashboard response shape.

## Requirements

- Protected UI routes must query data for `requireRouteUser().user.id`.
- HMAC manual refresh must require `owner_user_id` in the signed JSON body.
- Manual refresh must reject missing, unknown, pending, rejected, or account-mismatched owners.
- Scheduled sync must enumerate all active owner accounts through an explicit system-scoped helper.
- Queued jobs must include `ownerUserId` so queue processing and restart recovery use the same owner scope as enqueue.
- Supabase user-owned repositories may only be constructed with an explicit owner user id.
- Admin/profile/audit paths remain service-role paths and are not converted to request-scoped repositories.
- `MIGRATION_SYSTEM_USER_ID`, `storageUserId`, and implicit startup owner fallbacks must be removed.

## Acceptance Criteria

| AC | Requirement |
| --- | --- |
| AC-01 | Docs pack and Execution baseline are complete and implementation-ready. |
| AC-02 | Protected UI account APIs are scoped to the active JWT user. |
| AC-03 | Manual refresh requires a valid signed `owner_user_id` and enqueues owner-scoped jobs. |
| AC-04 | Scheduled sync and restart recovery process jobs/accounts across owners without a fixed startup owner. |
| AC-05 | Final regression and absence audit prove no fixed storage owner path remains. |

## Failure Cases

- A user can see another user's account, sheet snapshot, raw record, normalized record, or job data.
- HMAC manual refresh can enqueue a job without a validated owner.
- Scheduler only processes one bootstrap/system owner.
- Background processing writes records under a different owner than the job owner.
- Runtime code still contains `MIGRATION_SYSTEM_USER_ID` or `storageUserId`.
