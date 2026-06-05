# E-02 장문 피드백 화면 데이터 계약

## 화면 요약
53~54번 장문 제출 결과의 총평, 영역별 점수, 문장별 첨삭, 저장/PDF 흐름을 보여준다.

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
- 제출 원문
- 총점과 총평
- 영역별 점수
- 문장별 수정 제안
- 개선 포인트
- 저장/PDF/비교 CTA

## 사용자 입력/상태 데이터
- 피드백 탭 상태
- 저장 선택
- PDF 내보내기 선택
- 비교 리포트 선택

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 장문 제출 원문과 총평 | 현재 스키마로 충족 | writing_submissions와 writing_feedback이 장문 답안과 총평을 제공한다. | question_no 53/54로 구분한다. |
| 영역별 점수와 문장별 첨삭 | 현재 스키마로 충족 | feedback_dimension_scores와 sentence_feedback이 normalized detail을 제공한다. | 장문 화면의 핵심 상세 데이터다. |
| 비교 리포트 연결 | 현재 스키마로 충족 | comparison_reports와 create_comparison_report_with_metrics RPC로 이전 제출 대비 리포트를 만들 수 있다. | 현재 제출 id를 current_submission_id로 사용한다. |
| 장문 첨삭 템플릿 | 스키마 보강 필요 | 개선 포인트 라벨, 문장 수정 유형, 채점 기준 문구를 운영 데이터로 관리하는 구조는 없다. | 현재는 feedback 결과 데이터 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| writing_submissions | 장문 제출 원문 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| writing_feedback | 총점/총평 | 20260520120500_feedback.sql: submission_id, user_id, status, score_total, score_max, overall_summary, ai_model, ai_model_version, raw_ai_result, generated_at. |
| feedback_dimension_scores | 영역별 점수 | 20260520120500_feedback.sql: id, submission_id, user_id, dimension, score, score_max, summary, weakness_level. dimension은 grammar, vocab, structure, content, expression, topic_fit. |
| sentence_feedback | 문장별 수정 | 20260520120500_feedback.sql: id, submission_id, user_id, sentence_index, original_text, corrected_text, comment. |
| comparison_reports | 비교 리포트 연결 | 20260520120500_feedback.sql: id, user_id, current_submission_id, previous_submission_id, metrics, narrative, ai_model, generated_at. |
| library_items | 보관 저장 | 20260520120700_library_events_exports.sql: id, user_id, item_type, attempt_id, submission_id, report_id, export_id, problem_id, note, tags, saved_at. 하나의 row에는 대상 id가 하나만 들어간다. |
| export_files | PDF 생성 상태 | 20260520120700_library_events_exports.sql: id, user_id, source_type, source_id, storage_path, options, status, created_at, ready_at. |
| storage:generated-exports | PDF 파일 | 20260520121200_storage_buckets.sql, 20260520121300_storage_policies.sql, 20260527113000_storage_email_confirmed_hardening.sql: private bucket, PDF만 허용, 경로는 exports/{user_id}/{export_id}.pdf, 소유자 읽기/생성. |
| study_events | 피드백 조회 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
화면은 submission, feedback, dimension, sentence rows를 조회한다. 사용자가 비교를 선택하면 comparison report 생성 흐름으로 이동하고, 저장/PDF는 library와 export 계약을 사용한다.

## RLS/권한 기준
- feedback 상세는 본인 select만 가능하다.
- comparison_reports는 본인 report만 조회한다.
- export/storage는 본인 경로만 접근한다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- writing_feedback, feedback_dimension_scores, sentence_feedback은 본인 select만 허용되며 생성은 서버 권한 흐름이다.
- comparison_reports는 본인 select만 허용된다.
- library_items는 user_id = auth.uid() 기준 본인 저장 항목만 전체 작업이 가능하다.
- export_files는 user_id = auth.uid() 기준 본인 export만 전체 작업이 가능하다.
- generated-exports 파일은 private이며 본인 경로의 PDF만 읽고 만들 수 있다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
장문 피드백의 결과 저장과 내보내기는 현재 스키마로 충족된다. 첨삭 템플릿 운영 구조는 스키마 보강 필요다.

## 검수 필요 항목
- 문장별 피드백 정렬 기준을 sentence_index로 고정한다.
- 비교 리포트 생성 버튼의 조건을 정한다.
