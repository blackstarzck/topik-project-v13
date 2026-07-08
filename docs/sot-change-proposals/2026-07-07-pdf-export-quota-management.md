# SOT Change Proposal: PDF Export Quota Management

Date: 2026-07-07
Status: accepted
Accepted: 2026-07-08
Implementation owner: v13 user app for enforcement, topik-ai for admin management

## Proposal

Define PDF export quota as a managed product rule:

- A user can export PDF up to `n` times per writing problem within a configured period.
- Default rule is `3` exports per `month`, using `Asia/Seoul` period boundaries.
- The period unit can be changed to `day`, `week`, or `month`.
- Admins can reset export quota for an individual user, a group of users, or all users.
- Admin UI and operational controls are outside v13 and belong to topik-ai.

## User-App Behavior

- v13 enforces quota on `POST /api/export/pdf`.
- v13 browser print fallback must also pass through server-side quota enforcement via `POST /api/export/pdf/print`.
- Quota target problem is derived server-side:
  - submission: `writing_submissions.problem_id`
  - report: `comparison_reports.current_submission_id -> writing_submissions.problem_id`
  - library selection: distinct problem ids of included submissions/reports
- The same problem appearing multiple times in one PDF counts once.
- Saved PDF re-download does not count as a new export.
- Failed PDF generation does not consume quota.

## API Contract

Quota exceeded response:

```json
{
  "error": "Localized PDF quota exceeded message",
  "code": "pdf_export_quota_exceeded",
  "limit": 3,
  "used": 3,
  "remaining": 0,
  "resetAt": "period end timestamp",
  "periodUnit": "month"
}
```

## Data Contract

New DB objects:

- `pdf_export_quota_policies`
- `pdf_export_quota_usages`
- `pdf_export_quota_resets`
- `pdf_export_quota_reset_targets`
- `claim_pdf_export_quota(p_user_id uuid, p_problem_ids uuid[])`
- `commit_pdf_export_quota(p_user_id uuid, p_usage_ids uuid[], p_export_file_id uuid)`
- `release_pdf_export_quota(p_user_id uuid, p_usage_ids uuid[], p_reason text)`

Reset target contract:

- `user`, `group`, and `global` resets are all materialized into `pdf_export_quota_reset_targets`.
- Reset audit headers are admin-only except for rows where the current user is a materialized target.

## Accepted SOT Updates

- `docs/prd.md`
- `docs/flow/user-flow.md`
- `docs/development-core-planning/07-storage-payment-notifications/README.md`
- `docs/Wireframe/14-E-01-short-answer-feedback/functional-spec.md`
- `docs/Wireframe/15-E-02-long-form-feedback/functional-spec.md`
- `docs/Wireframe/18-F-01-my-library/functional-spec.md`
- `docs/Wireframe/19-F-M1-pdf-export-modal/functional-spec.md`
- `docs/Wireframe/data-usage-index.md`
- `supabase/migrations/INDEX.md`

## Deferred Decisions

- Whether multiple simultaneous active policies are allowed beyond the default `user + problem` rule.
- Whether `resetAt` should be presented to learners as an exact date/time or only as “next period”.
- Whether learners should see a summarized reset notice. Raw reset audit history should remain admin-only.
