# E-01 단답 피드백 기능명세

## 화면 목적

짧은 답안의 점수와 문장별 수정 제안을 보여준다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/writing/feedback/short/:id`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: D-M2 분석 완료 후 단답 제출 결과 또는 직접 `/writing/feedback/short/[id]` 접근.
- 이탈 경로: 다시 풀기는 C-03, 다음 문제 추천은 R-02, 비교 리포트는 R-01, 결과 저장은 F-01 흐름으로 이어진다.
- 화면 내부 동작: 점수 요약, 차원별 피드백, 상세 코멘트, 저장 CTA와 다음 액션을 처리한다.

## 주요 기능

- 총점/총평
- 영역별 점수
- 문장별 피드백
- 보관함 저장
- PDF 내보내기

## 상태/오류

- 분석 대기, 결과 없음, 권한 없음, export 실패

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `writing_submissions` | `id`, `problem_id`, `answer_text`, `char_count`, `submitted_at`, `feedback_status` | read | short 제출 원문과 상태를 표시한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/queries.ts` | none |
| `writing_feedback` | `submission_id`, `score_total`, `score_max`, `overall_summary`, `ai_model`, `generated_at` | read | AI 첨삭 총점과 요약을 표시한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/next.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | none |
| `feedback_dimension_scores` | `dimension`, `score`, `score_max`, `summary`, `weakness_level` | read | 영역별 점수와 약점 수준을 표시한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/weakness.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | none |
| `sentence_feedback` | `sentence_index`, `original_text`, `corrected_text`, `comment` | read | 문장별 수정 제안을 표시한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/writing/queries.ts`<br>`src/lib/writing/server.ts`<br>`supabase/migrations/20260520120500_feedback.sql` | none |
| `library_items` | `submission_id`, `item_type`, `note`, `tags` | read/write | 피드백 저장/보관함 추가에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/mutations.ts`<br>`src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |
| `export_files` | `source_type`, `source_id`, `status`, `storage_path` | read/write | 피드백 PDF 내보내기와 연결된다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/export/pdf-export.ts`<br>`src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |
| `study_events` | `event_type`, `submission_id`, `payload` | write | 피드백 조회 이벤트를 기록한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/events/study-events.ts`<br>`src/lib/export/pdf-export.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | none |

## 현재 구현 상태

- 피드백 화면은 제출 소유자 RLS와 feedback_status를 함께 확인해야 한다.

## 코드 구현 근거

- `ShortFeedbackPage` - `src/app/(workspace)/writing/feedback/short/[id]/page.tsx`
- `FeedbackPageContent` - `src/components/feedback/FeedbackPageContent.tsx`
- `FeedbackSummary` - `src/components/feedback/FeedbackSummary.tsx`
- `DimensionCardGrid` - `src/components/feedback/DimensionCardGrid.tsx`
- `DetailedFeedbackPanel` - `src/components/feedback/DetailedFeedbackPanel.tsx`
- `NextActionBar` - `src/components/feedback/NextActionBar.tsx`
- `SaveToLibraryButton` - `src/components/feedback/SaveToLibraryButton.tsx`
- `getSubmission`, `getFeedbackBundle` - `src/lib/writing/server.ts`
- `useCreateComparisonReport` - `src/lib/writing/mutations.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/ia.md`와 화면 기능명세의 audience와 맞는다.
