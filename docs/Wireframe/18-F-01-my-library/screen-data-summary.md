# F-01 내 서재 화면 데이터 계약

## 화면 요약
사용자가 저장한 문제, 제출, 리포트, PDF export를 모아 보는 화면이다.

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
- 저장 항목 목록
- 항목 유형
- 저장 시각
- 태그/메모
- PDF 상태
- 필터와 정렬

## 사용자 입력/상태 데이터
- item_type 필터
- 태그 필터
- 메모 수정
- 저장 해제
- 다운로드 선택

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 내 서재 저장 항목 | 현재 스키마로 충족 | library_items가 attempt, submission, report, export, problem 저장을 하나의 다형 구조로 관리한다. | export 연결 컬럼은 export_id다. |
| 내보내기 파일 | 현재 스키마로 충족 | export_files와 generated-exports storage가 PDF 생성 상태와 파일 경로를 관리한다. | source_type은 submission, report, library_selection이다. |
| 서재 분류/컬렉션 | 스키마 보강 필요 | 폴더, 컬렉션, 공유 상태 같은 고급 보관 구조는 현재 migration에 없다. | 현재는 태그와 메모 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| library_items | 내 서재 저장 항목 | 20260520120700_library_events_exports.sql: id, user_id, item_type, attempt_id, submission_id, report_id, export_id, problem_id, note, tags, saved_at. 하나의 row에는 대상 id가 하나만 들어간다. |
| writing_submissions | 제출 이력 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| comparison_reports | 리포트 항목 | 20260520120500_feedback.sql: id, user_id, current_submission_id, previous_submission_id, metrics, narrative, ai_model, generated_at. |
| problems | 저장 문제 | 20260520120200_problems.sql: id, source, author_id, domain, question_no, topik_level, difficulty, title, prompt, materials, answer_key, rubric, explanation, tags, publish_status, review_status, visibility, created_at, updated_at. |
| export_files | 내보내기 파일 | 20260520120700_library_events_exports.sql: id, user_id, source_type, source_id, storage_path, options, status, created_at, ready_at. |
| storage:generated-exports | PDF 파일 | 20260520121200_storage_buckets.sql, 20260520121300_storage_policies.sql, 20260527113000_storage_email_confirmed_hardening.sql: private bucket, PDF만 허용, 경로는 exports/{user_id}/{export_id}.pdf, 소유자 읽기/생성. |
| study_events | 활동 기록 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
서재 진입 시 library_items를 item_type과 saved_at 기준으로 조회한다. 항목별로 연결된 submission, report, problem, export를 읽고, 저장 해제는 library_items delete로 처리한다.

## RLS/권한 기준
- library_items와 export_files는 본인 row만 접근한다.
- generated-exports 파일은 본인 경로만 읽는다.
- library_items는 user_id = auth.uid() 기준 본인 저장 항목만 전체 작업이 가능하다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- comparison_reports는 본인 select만 허용된다.
- problems는 published/public 문제 또는 본인이 만든 ai_generated 문제만 사용자에게 노출된다.
- export_files는 user_id = auth.uid() 기준 본인 export만 전체 작업이 가능하다.
- generated-exports 파일은 private이며 본인 경로의 PDF만 읽고 만들 수 있다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
내 서재 기본 기능은 현재 스키마로 충족된다. 컬렉션/공유/보관 상태 확장은 스키마 보강 필요다.

## 검수 필요 항목
- 태그 목록을 사용자 자유 입력으로 둘지 표준화할지 정한다.
- 삭제가 저장 해제인지 원본 삭제인지 화면 문구를 고정한다.
