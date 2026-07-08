# SOT Change Proposal: PDF Export Quota Management

Date: 2026-07-07
Status: accepted (2026-07-08, owner decision)
Implementation owner: v13 user app for enforcement, topik-ai for admin management

## Acceptance Record (2026-07-08)

- 결정: 오너가 2026-07-08 본 제안 수락을 확정했다(작업 계획 승인 시 SOT 갱신 포함을 함께 승인).
- 결정 이유: PDF 내보내기를 배포 없이 DB 정책으로 운영 가능한 관리 포인트로 전환하기 위함. v13은 admin 기능을 만들지 않는 비협상 경계가 있어 관리면은 topik-ai로 분리했다.
- 근거 문서: `docs/handoff-pdf-export-quota-topik-ai.md`(2026-07-08 amend 포함), `supabase/migrations/20260707120000_pdf_export_quota.sql`, topik-ai 저장소 shared-supabase-schema-ownership 문서의 2026-07-07 PDF 쿼터 기록.
- 검토한 대안: (1) 클라이언트 측 카운트 — 위변조·동시성 문제로 기각. (2) `export_files` 집계 기반 제한 — reserve 단계가 없어 동시 초과 사용을 막지 못해 기각. (3) v13 내 admin 화면 — v13 비협상 경계(admin 기능 금지) 위반으로 기각.
- Open Decisions 해소: 다중 활성 정책 금지(단일 활성, `priority`는 lower-wins 예약 필드로 문서화만). `resetAt`은 기존 구현대로 기간 종료 시각 안내. 리셋 이력은 학습자 미노출(admin 전용).
- 그룹 정의: 기관 코드(`profiles.affiliation_code`) 기준, 리셋 대상은 생성 시점 스냅샷.
- SOT 갱신 완료: `docs/prd.md` §7.9.1, `docs/flow/user-flow.md` F-M1 흐름, `docs/Wireframe/19-F-M1-pdf-export-modal/functional-spec.md`, `docs/Wireframe/data-usage-index.md`.

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

## SOT Files To Update If Accepted

- `docs/prd.md`
- `docs/flow/user-flow.md`
- relevant feedback/library Wireframe functional specs
- `docs/Wireframe/data-usage-index.md`
- `supabase/migrations/INDEX.md`

## Open Decisions

- Whether multiple simultaneous active policies are allowed beyond the default `user + problem` rule.
- Whether `resetAt` should be presented to learners as an exact date/time or only as “next period”.
- Whether reset history should be visible to learners or admin-only.
