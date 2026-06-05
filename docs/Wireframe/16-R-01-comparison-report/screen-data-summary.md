# R-01 비교 리포트 화면 데이터 계약

## 화면 요약
현재 제출과 이전 제출을 비교해 점수 변화, 약점 변화, AI 서술 리포트를 보여주는 화면이다.

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
- 현재/이전 제출 요약
- 점수 변화
- 영역별 비교
- AI 서술 리포트
- 다음 학습 CTA

## 사용자 입력/상태 데이터
- 비교 대상 선택
- 리포트 생성/조회
- 저장 또는 PDF 선택

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 비교 리포트 snapshot | 현재 스키마로 충족 | comparison_reports가 current_submission_id, previous_submission_id, metrics, narrative, ai_model을 저장한다. | 재현 가능한 snapshot으로 보관한다. |
| 비교 대상 제출과 피드백 | 현재 스키마로 충족 | writing_submissions, writing_feedback, feedback_dimension_scores가 비교의 원천이다. | 본인 제출만 비교한다. |
| 비교 기준 템플릿 | 스키마 보강 필요 | metrics 내부 key와 narrative 템플릿을 운영 데이터로 검증하는 별도 구조는 없다. | 현재는 jsonb metrics 계약이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| comparison_reports | 비교 리포트 | 20260520120500_feedback.sql: id, user_id, current_submission_id, previous_submission_id, metrics, narrative, ai_model, generated_at. |
| rpc:public.create_comparison_report_with_metrics | 리포트 생성 | 20260521130000_phase_5_writing_rpc.sql: 현재 제출과 이전 제출을 묶어 comparison_reports를 만든다. |
| writing_submissions | 비교 대상 제출 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| writing_feedback | 점수/총평 비교 | 20260520120500_feedback.sql: submission_id, user_id, status, score_total, score_max, overall_summary, ai_model, ai_model_version, raw_ai_result, generated_at. |
| feedback_dimension_scores | 영역별 비교 | 20260520120500_feedback.sql: id, submission_id, user_id, dimension, score, score_max, summary, weakness_level. dimension은 grammar, vocab, structure, content, expression, topic_fit. |
| study_events | 리포트 조회 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |
| library_items | 리포트 저장 | 20260520120700_library_events_exports.sql: id, user_id, item_type, attempt_id, submission_id, report_id, export_id, problem_id, note, tags, saved_at. 하나의 row에는 대상 id가 하나만 들어간다. |

## 저장/조회/이벤트 흐름
사용자가 비교 리포트를 요청하면 RPC가 comparison_reports row를 만든다. 화면은 report와 연결된 제출/피드백 데이터를 조회해 차이를 표시한다.

## RLS/권한 기준
- comparison_reports와 연결 feedback은 본인 row만 조회한다.
- 리포트 생성 RPC도 인증 사용자 context에서 실행된다.
- comparison_reports는 본인 select만 허용된다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- writing_feedback, feedback_dimension_scores, sentence_feedback은 본인 select만 허용되며 생성은 서버 권한 흐름이다.
- study_events는 본인 select/insert가 가능하다.
- library_items는 user_id = auth.uid() 기준 본인 저장 항목만 전체 작업이 가능하다.

## 스키마 정합성 메모
report 저장은 현재 스키마로 충족된다. metrics JSON의 내부 구조 검증은 현재 migration에 없다.

## 검수 필요 항목
- metrics JSON의 필수 key를 문서화한다.
- 이전 제출이 없을 때의 빈 상태를 확정한다.
