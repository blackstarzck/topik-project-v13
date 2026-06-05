# C-03 다시 풀기 모달 화면 데이터 계약

## 화면 요약
이미 푼 문제 또는 작성 중인 답안을 다시 시작할 때 기존 상태 처리 방식을 묻는 모달이다.

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
- 기존 풀이/작성 상태 요약
- 다시 풀기 안내
- 기존 답안 유지/새로 시작 CTA
- 취소 버튼

## 사용자 입력/상태 데이터
- 새 시도 시작 선택
- 기존 draft 유지 선택
- 모달 닫기

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 이전 객관식 풀이 상태 | 현재 스키마로 충족 | problem_attempts가 이전 시도, 점수, 제출 시각, 북마크 상태를 가진다. | 새 풀이를 시작하면 새 attempt row로 관리한다. |
| 이전 쓰기 draft | 현재 스키마로 충족 | writing_drafts의 autosave_status와 활성 draft unique 제약으로 이전 작성 상태를 구분한다. | 기존 draft를 superseded 처리하는 trigger가 있다. |
| 재시도 UX 문구 | 스키마 보강 필요 | 모달 문구와 재시도 정책을 운영 데이터로 바꾸는 구조는 현재 migration에 없다. | 정책은 앱 코드 또는 문서 기준으로 유지된다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| problem_attempts | 이전 풀이 상태 | 20260520120300_attempts.sql: id, user_id, problem_id, selected_answer, is_correct, score, status, started_at, submitted_at, bookmarked, time_spent_seconds. |
| writing_drafts | 이전 작성 draft | 20260520120400_writing.sql: id, user_id, problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, created_at, updated_at. 활성 draft는 사용자와 문제 기준 1개만 허용된다. |
| study_events | 재시도 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
문제 진입 전 기존 attempt 또는 draft를 조회한다. 사용자가 새로 시작을 선택하면 새 attempt/draft를 만들고 이전 draft는 superseded로 전환된다.

## RLS/권한 기준
- problem_attempts와 writing_drafts는 본인 row만 읽고 쓴다.
- study_events는 본인 이벤트만 insert한다.
- problem_attempts는 user_id = auth.uid() 기준 본인 풀이만 읽고 쓸 수 있다.
- writing_drafts는 user_id = auth.uid() 기준 본인 draft만 읽고 쓸 수 있다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
재시도 데이터는 현재 스키마로 충족된다. 모달 정책을 운영에서 조정하려면 별도 스키마가 필요하다.

## 검수 필요 항목
- 기존 제출본까지 새 제출의 parent_submission_id로 연결할지 정한다.
- 재시도 클릭 event_type 이름을 표준화한다.
