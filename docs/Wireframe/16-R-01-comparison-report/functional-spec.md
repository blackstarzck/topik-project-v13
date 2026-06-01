# R-01 비교 리포트 기능명세

## 화면 목적

현재 제출과 이전 제출을 비교해 성장과 다음 개선점을 보여준다.

## 진입/이탈 흐름

- Route: `/writing/reports/:id/compare`
- Route type: page
- Audience: user
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 이탈: 다음 CTA, 상위 목록, 인증 오류, 권한 오류, 또는 빈 상태 CTA로 이동한다.

## 주요 기능

- 제출본 비교
- 점수 변화
- 영역별 지표
- 다음 문제 이동

## 상태/오류/권한

- 이전 제출 없음, 리포트 생성 실패
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 현재 구현 상태

- comparison_reports와 create_comparison_report_with_metrics RPC가 기준이다.
- 실제 구현 여부는 `src/**`, IA 감사 산출물, 이 문서의 DB 근거를 함께 확인한다.

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- IA 감사 결과와 source-map이 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `rpc:public.create_comparison_report_with_metrics` | - | rpc | 현재 제출과 이전 제출 비교 리포트를 생성한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/writing/server-actions.ts`<br>`supabase/migrations/20260521130000_phase_5_writing_rpc.sql` | none |
| `comparison_reports` | `current_submission_id`, `previous_submission_id`, `metrics`, `narrative`, `generated_at` | read/write | 비교 리포트 본문과 지표에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/writing/server.ts`<br>`supabase/migrations/20260520120500_feedback.sql` | none |
| `writing_submissions` | `id`, `answer_text`, `char_count`, `submitted_at` | read | 비교 대상 제출본을 불러온다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/queries.ts` | none |
| `writing_feedback` | `submission_id`, `score_total`, `overall_summary` | read | 점수 변화와 요약 비교에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/next.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | none |
| `feedback_dimension_scores` | `dimension`, `score`, `summary` | read | 영역별 성장 지표에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/weakness.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | none |
| `study_events` | `event_type`, `report_id`, `occurred_at` | write | 리포트 조회 이벤트를 남긴다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/events/study-events.ts`<br>`src/lib/export/pdf-export.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.

## 검증 근거

- Description: `docs/Wireframe/16-R-01-comparison-report/description.md`
- Wireframe: `docs/Wireframe/16-R-01-comparison-report/wireframe.png`
- Route map: `docs/sitemap.md`
- Active user flow: `docs/flow/user-flow.md`
- DB inventory: `reports/wireframe-functional-specs/runs/20260601-1542/data-inventory.json`
- Evidence: `src/lib/writing/server-actions.ts`
- Evidence: `supabase/migrations/20260521130000_phase_5_writing_rpc.sql`
- Evidence: `src/lib/library/queries.ts`
- Evidence: `src/lib/library/server.ts`
- Evidence: `src/lib/writing/server.ts`
- Evidence: `supabase/migrations/20260520120500_feedback.sql`
- Evidence: `src/lib/practice/next.ts`
- Evidence: `src/lib/practice/queries.ts`
- Evidence: `src/lib/writing/queries.ts`
- Evidence: `supabase/migrations/20260520120400_writing.sql`
- Evidence: `src/app/(workspace)/dashboard/page.tsx`
- Evidence: `src/lib/practice/weakness.ts`
