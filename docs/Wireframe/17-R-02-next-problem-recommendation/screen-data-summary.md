# R-02 다음 문제 추천 화면 데이터 계약

## 화면 요약
피드백 이후 사용자가 바로 이어서 풀 문제를 추천하는 화면이다.

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
- 추천 문제 카드
- 추천 이유
- 예상 소요 시간
- 약점 태그
- 시작/건너뛰기 CTA

## 사용자 입력/상태 데이터
- 추천 카드 선택
- 건너뛰기 선택
- 추천 항목 status 변경

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 다음 문제 추천 결과 | 현재 스키마로 충족 | recommendation_runs.source_type = next_problem과 recommendation_items가 다음 문제 추천을 저장한다. | rank와 status로 노출 순서와 소비 여부를 관리한다. |
| 추천 근거 | 현재 스키마로 충족 | writing_feedback과 feedback_dimension_scores가 최근 피드백 약점 근거가 된다. | problems가 추천 대상 문제 정보를 제공한다. |
| 추천 정책 | 스키마 보강 필요 | 최근 제출에서 다음 문제로 이어지는 운영 규칙과 제외 조건 catalog는 없다. | 현재는 추천 결과 저장 계약이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| recommendation_runs | 추천 묶음 | 20260520120600_recommendations.sql: id, user_id, source_type, source_id, reason_summary, created_at, expires_at. source_type은 dashboard, feedback, weakness, next_problem. |
| recommendation_items | 다음 문제 추천 카드 | 20260520120600_recommendations.sql: id, run_id, user_id, problem_id, rank, reason, estimated_minutes, weakness_tags, status. |
| problems | 추천 문제 정보 | 20260520120200_problems.sql: id, source, author_id, domain, question_no, topik_level, difficulty, title, prompt, materials, answer_key, rubric, explanation, tags, publish_status, review_status, visibility, created_at, updated_at. |
| writing_submissions | 최근 제출 근거 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| writing_feedback | 최근 피드백 근거 | 20260520120500_feedback.sql: submission_id, user_id, status, score_total, score_max, overall_summary, ai_model, ai_model_version, raw_ai_result, generated_at. |
| feedback_dimension_scores | 약점 근거 | 20260520120500_feedback.sql: id, submission_id, user_id, dimension, score, score_max, summary, weakness_level. dimension은 grammar, vocab, structure, content, expression, topic_fit. |
| study_events | 추천 클릭 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
피드백 화면에서 다음 문제 추천 run을 조회하거나 생성한다. 사용자가 시작하면 item status를 consumed로 바꾸고 해당 문제 화면으로 이동한다.

## RLS/권한 기준
- 추천 run/item은 본인 row만 접근한다.
- 추천 문제는 problems RLS로 보이는 문제만 표시한다.
- recommendation_runs는 본인 select만 허용된다.
- recommendation_items는 본인 select/update가 가능하며 status 소비 처리를 담는다.
- problems는 published/public 문제 또는 본인이 만든 ai_generated 문제만 사용자에게 노출된다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- writing_feedback, feedback_dimension_scores, sentence_feedback은 본인 select만 허용되며 생성은 서버 권한 흐름이다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
추천 결과와 소비 상태는 현재 스키마로 충족된다. 운영 추천 정책은 스키마 보강 필요다.

## 검수 필요 항목
- 건너뛰기 status를 expired로 볼지 별도 값으로 보강할지 정한다.
- 추천 만료 시간 기준을 정한다.
