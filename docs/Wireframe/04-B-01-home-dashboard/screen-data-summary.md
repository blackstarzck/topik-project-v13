# B-01 홈 대시보드 화면 데이터 계약

## 화면 요약
사용자의 학습 현황, 최근 첨삭, 이어쓰기, 추천 문제를 한 화면에 모아 보여준다.

이 문서는 사용자 화면이 소비하는 운영/관리 대상 데이터만 정리한다. 관리자 전용 화면 구현이나 관리자 스키마 확장은 이번 범위에 포함하지 않는다.

## 기준 소스
| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | description.md | 사용 |
| 2 | functional-spec.md | 보조 |
| 3 | hifi.png | 보조 |
| 4 | wireframe.png | 보조 |

소스 우선순위는 description.md, functional-spec.md, hifi.png, wireframe.png 순서다. 문서와 이미지가 다르면 description.md 기준으로 확정한다.

## 사용자 화면 표시 데이터
- 오늘 학습량과 전체 풀이 수
- 시험 D-day와 연속 학습일
- 최근 피드백 점수와 요약
- 이어쓰기 draft 상태
- 추천 문제 카드

## 사용자 입력/상태 데이터
- 추천 카드 클릭
- 이어쓰기 이동
- 피드백 또는 라이브러리 이동
- 대시보드 기간 상태

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 대시보드 KPI | 현재 스키마로 충족 | public.get_dashboard_kpi가 오늘 풀이 수, 전체 풀이 수, 시험 D-day, 연속 학습일을 반환한다. | 세부 차트가 필요하면 study_events 집계가 추가로 필요하다. |
| 최근 첨삭과 이어쓰기 | 현재 스키마로 충족 | writing_feedback, writing_submissions, writing_drafts로 최근 피드백과 진행 중 draft를 표시한다. | 사용자 소유 row만 표시한다. |
| 추천 문제 노출 | 현재 스키마로 충족 | recommendation_runs와 recommendation_items가 대시보드 출처 추천 묶음과 항목을 저장한다. | 운영 추천 규칙 catalog는 별도 구조가 없다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| rpc:public.get_dashboard_kpi | 대시보드 KPI | 20260521140000_phase_6_rpc_and_admin.sql: 인증 사용자의 오늘 풀이 수, 전체 풀이 수, 시험 D-day, 연속 학습일을 반환한다. |
| learning_goals | 시험 목표와 D-day | 20260520120100_profiles_goals.sql: user_id, topik_level, target_grade, exam_date, weekly_goal_minutes, weak_areas, is_active, updated_at. |
| writing_feedback | 최근 첨삭 요약 | 20260520120500_feedback.sql: submission_id, user_id, status, score_total, score_max, overall_summary, ai_model, ai_model_version, raw_ai_result, generated_at. |
| writing_submissions | 최근 제출 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| writing_drafts | 이어쓰기 상태 | 20260520120400_writing.sql: id, user_id, problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, created_at, updated_at. 활성 draft는 사용자와 문제 기준 1개만 허용된다. |
| recommendation_runs | 추천 묶음 | 20260520120600_recommendations.sql: id, user_id, source_type, source_id, reason_summary, created_at, expires_at. source_type은 dashboard, feedback, weakness, next_problem. |
| recommendation_items | 추천 카드 | 20260520120600_recommendations.sql: id, run_id, user_id, problem_id, rank, reason, estimated_minutes, weakness_tags, status. |
| study_events | 학습 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
대시보드 진입 시 KPI RPC와 최근 feedback/draft/recommendation을 병렬 조회한다. 카드 클릭은 관련 문제, feedback, library 화면으로 이동하고 study_events에 클릭 이벤트를 남길 수 있다.

## RLS/권한 기준
- 모든 사용자 소유 테이블은 auth.uid() 기준 본인 데이터만 노출된다.
- 추천 항목 status update는 본인 항목만 가능하다.
- learning_goals는 user_id = auth.uid() 기준으로 본인 row만 전체 작업이 가능하다.
- writing_feedback, feedback_dimension_scores, sentence_feedback은 본인 select만 허용되며 생성은 서버 권한 흐름이다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- writing_drafts는 user_id = auth.uid() 기준 본인 draft만 읽고 쓸 수 있다.
- recommendation_runs는 본인 select만 허용된다.
- recommendation_items는 본인 select/update가 가능하며 status 소비 처리를 담는다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
화면의 주요 데이터는 현재 스키마로 충족된다. 다만 대시보드 섹션 순서, CTA 문구, 추천 규칙을 운영에서 바꾸는 구조는 없다.

## 검수 필요 항목
- 대시보드 추천 노출 개수와 만료 기준을 운영 데이터로 둘지 정한다.
- KPI와 study_events 집계 값의 기준일 timezone을 고정한다.
