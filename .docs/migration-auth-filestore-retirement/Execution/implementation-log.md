# Implementation Log

## 2026-05-01

- Docs prepared P0 auth/FileStore retirement pack.
- Main started implementation on branch `docs/migration-auth-filestore-retirement`.
- Baseline `npm run typecheck` and `npm test` passed before AC-01.

## 2026-05-01 AC-01

- Replaced protected-route authorization with Supabase JWT-derived request context only.
- Removed route guard reliance on legacy cookie sessions.
- Updated UI account route wiring to use Supabase route context and shared services.
- Updated route auth unit tests to assert missing JWT rejection, pending user rejection, active admin acceptance, and active member admin denial.

## 2026-05-01 AC-02

- Reworked `/api/v1/auth/register` into a JWT sync endpoint that derives canonical identity from Supabase Auth and accepts only optional profile input.
- Added Supabase-backed profile and audit repositories for signup sync and admin approval state.
- Reworked approval/rejection to update Supabase `app_metadata.status` and backend profile records together.
- Updated integration tests to use mock Supabase JWT context instead of backend password/session auth.
- Added a backend guard so signup sync cannot downgrade active/rejected or non-member Supabase users back to pending/member.

## 2026-05-01 AC-03

- Retired backend password-reset token and notification outbox services from runtime code.
- Kept backend legacy login/forgot/reset endpoints as explicit `410 LEGACY_AUTH_REMOVED` compatibility responses.
- Updated frontend auth session flow to always use Supabase Auth helpers for sign-in, sign-up, reset password, and sign-out.
- Updated App-level tests to mock Supabase Auth session/sign-in rather than backend cookie login.

## 2026-05-01 AC-04

- Removed FileStore runtime composition from `backend/src/app.ts`.
- Converted legacy repository modules into interfaces where services still need contracts.
- Added Supabase repository composition for account configs, jobs, raw records, normalized records, sheet snapshots, profiles, and audit events.
- Reworked test support to use in-memory repositories and a mock Supabase Auth store instead of temporary FileStore directories.
- Updated seed/demo CLI to write through Supabase repositories instead of JSON data files.

## 2026-05-01 AC-05

- Ran full backend/frontend typecheck and test regression.
- Ran runtime absence audit for legacy FileStore/session/password-reset/outbox symbols in `backend/src` and `tests`.
- Removed stale config fields for `DATA_DIR`, legacy session cookies, and backend password-reset TTL.
- Removed unused frontend HTTP helpers for legacy backend login/logout/password-reset endpoints.
- Result: all AC test commands pass; no runtime fallback references remain in the audited paths.

## 2026-05-02 CodeRabbit Follow-up

- Reviewed 20 CodeRabbit issues on PR #14 and applied valid blockers.
- Tightened Supabase `profiles` and `audit_events` migration with auth user FKs, approval-state check, `updated_at` trigger, audit indexes, and RLS policies.
- Replaced raw Supabase audit insert errors with `HttpError`.
- Added paginated bootstrap-admin lookup to `seed-demo.ts`.
- Renamed the app-owned profile repository contract away from `UserRepository` and removed the unused pending-list repository method; pending approval lists remain sourced from Supabase Auth `app_metadata`.
- Injected clock-derived fallbacks into Supabase profile mapping and pending-user profile/auth metadata merging.
- Updated docs pack source/data/spec/test-plan to cover repo-relative macro review source, FileStore data migration handling, display-name/email ownership, RLS/indexes, HMAC internal route continuity, removed `useSupabaseStorage`, and expanded AC-05 audit scope.
- Evaluated the AuthScreen cookie-session suggestion as invalid for this P0 because Supabase Auth is the required runtime identity provider.
