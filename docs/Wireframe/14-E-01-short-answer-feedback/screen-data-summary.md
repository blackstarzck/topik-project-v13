# E-01 단답 피드백 화면 데이터 계약

## 화면 요약
51~52번 단답 제출 결과의 점수, 총평, 영역별 피드백, 문장 수정을 보여주는 화면이다.

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
- 제출 답안
- 총점과 총평
- 영역별 점수
- 문장별 수정 제안
- 저장/다음 문제/PDF CTA

## 사용자 입력/상태 데이터
- 저장 선택
- PDF 내보내기 선택
- 다음 문제 선택
- 피드백 표시 탭 상태

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 제출 원문과 총평 | 현재 스키마로 충족 | writing_submissions와 writing_feedback이 제출 답안, 총점, 총평, 생성 모델 정보를 제공한다. | 단답형도 동일 feedback 테이블을 사용한다. |
| 영역별/문장별 피드백 | 현재 스키마로 충족 | feedback_dimension_scores와 sentence_feedback이 영역 점수와 문장 수정 데이터를 제공한다. | dimension enum은 migration에 고정되어 있다. |
| 저장과 PDF | 현재 스키마로 충족 | library_items, export_files, generated-exports storage가 저장과 PDF 내보내기를 담당한다. | export 파일 연결 컬럼은 export_id다. |
| 피드백 라벨/채점 문구 catalog | 스키마 보강 필요 | 영역 라벨, 점수 설명, 예시 문구를 운영 데이터로 관리하는 구조는 없다. | 현재는 결과 row와 앱 문구 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| writing_submissions | 단답 제출 원문 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| writing_feedback | 총점/총평 | 20260520120500_feedback.sql: submission_id, user_id, status, score_total, score_max, overall_summary, ai_model, ai_model_version, raw_ai_result, generated_at. |
| feedback_dimension_scores | 영역별 점수 | 20260520120500_feedback.sql: id, submission_id, user_id, dimension, score, score_max, summary, weakness_level. dimension은 grammar, vocab, structure, content, expression, topic_fit. |
| sentence_feedback | 문장별 수정 | 20260520120500_feedback.sql: id, submission_id, user_id, sentence_index, original_text, corrected_text, comment. |
| library_items | 보관 저장 | 20260520120700_library_events_exports.sql: id, user_id, item_type, attempt_id, submission_id, report_id, export_id, problem_id, note, tags, saved_at. 하나의 row에는 대상 id가 하나만 들어간다. |
| export_files | PDF 생성 상태 | 20260520120700_library_events_exports.sql: id, user_id, source_type, source_id, storage_path, options, status, created_at, ready_at. |
| storage:generated-exports | PDF 파일 | 20260520121200_storage_buckets.sql, 20260520121300_storage_policies.sql, 20260527113000_storage_email_confirmed_hardening.sql: private bucket, PDF만 허용, 경로는 exports/{user_id}/{export_id}.pdf, 소유자 읽기/생성. |
| study_events | 피드백 조회 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
feedback 화면은 submission과 연결된 feedback/detail rows를 조회한다. 저장은 library_items에 row를 만들고 PDF는 export_files와 storage 파일로 관리한다.

## RLS/권한 기준
- feedback 관련 테이블은 본인 select만 허용된다.
- library_items와 export_files는 본인 row만 읽고 쓴다.
- generated-exports는 본인 경로 PDF만 접근한다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- writing_feedback, feedback_dimension_scores, sentence_feedback은 본인 select만 허용되며 생성은 서버 권한 흐름이다.
- library_items는 user_id = auth.uid() 기준 본인 저장 항목만 전체 작업이 가능하다.
- export_files는 user_id = auth.uid() 기준 본인 export만 전체 작업이 가능하다.
- generated-exports 파일은 private이며 본인 경로의 PDF만 읽고 만들 수 있다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
결과 데이터와 보관/내보내기는 현재 스키마로 충족된다. 채점 라벨과 설명 문구 운영 구조는 없다.

## 검수 필요 항목
- 단답 피드백에서 sentence_feedback을 항상 노출할지 정한다.
- PDF 생성 실패 시 사용자 재시도 흐름을 정한다.
