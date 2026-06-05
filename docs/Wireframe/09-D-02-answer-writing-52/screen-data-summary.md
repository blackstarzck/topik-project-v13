# D-02 52번 답안 작성 화면 데이터 계약

## 화면 요약
52번 쓰기 문제의 자료와 조건을 보고 답안을 작성, 자동저장, 제출하는 화면이다.

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
- 52번 문제 지문
- 보기/자료
- 답안 입력 영역
- 글자 수
- 자동저장 상태
- 제출 버튼
- 작성 팁

## 사용자 입력/상태 데이터
- answer_text
- answer_json
- char_count
- 저장/제출 액션

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 문항 본문/자료/조건 | 현재 스키마로 충족 | problems와 problem_assets가 52번 문제의 prompt, materials, answer_key, rubric, 첨부 자료를 제공한다. | question_no = 52로 구분한다. |
| 작성 draft와 제출 | 현재 스키마로 충족 | writing_drafts, writing_submissions, submit_writing_with_feedback RPC가 작성과 제출 계약을 담당한다. | feedback_status로 분석 상태를 추적한다. |
| 52번 전용 조건 배열 | 스키마 보강 필요 | 조건 항목, 문장 완성 구조, 예시 표현을 화면 단위로 검증하는 typed 구조는 없다. | 현재는 JSON 기반 문제 자료 계약이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| problems | 52번 문제 원본 | 20260520120200_problems.sql: id, source, author_id, domain, question_no, topik_level, difficulty, title, prompt, materials, answer_key, rubric, explanation, tags, publish_status, review_status, visibility, created_at, updated_at. |
| problem_assets | 참고 자료 | 20260520120200_problems.sql: id, problem_id, storage_path, asset_type, sort_order. asset_type은 image 또는 audio. |
| writing_drafts | 자동저장 | 20260520120400_writing.sql: id, user_id, problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, created_at, updated_at. 활성 draft는 사용자와 문제 기준 1개만 허용된다. |
| writing_submissions | 최종 제출 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| rpc:public.submit_writing_with_feedback | 제출 처리 | 20260521130000_phase_5_writing_rpc.sql, 20260521140000_phase_6_rpc_and_admin.sql: 제출, 피드백, 영역 점수, 문장 피드백을 한 트랜잭션으로 만든다. |
| study_events | 작성/제출 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |
| storage:problem-assets | 참고 자료 파일 | 20260520121200_storage_buckets.sql, 20260520121300_storage_policies.sql: public bucket, 이미지와 오디오 허용, 쓰기는 운영 권한 정책. |

## 저장/조회/이벤트 흐름
problem과 활성 draft를 불러온 뒤 입력 변화를 draft로 저장한다. 제출은 RPC로 처리하고 분석 대기 화면으로 이동한다.

## RLS/권한 기준
- draft와 submission은 본인 row만 접근한다.
- 문제 자료는 parent problem 노출 권한을 따른다.
- problems는 published/public 문제 또는 본인이 만든 ai_generated 문제만 사용자에게 노출된다.
- problem_assets 조회 권한은 연결된 problems의 노출 권한을 따른다.
- writing_drafts는 user_id = auth.uid() 기준 본인 draft만 읽고 쓸 수 있다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- study_events는 본인 select/insert가 가능하다.
- problem-assets 파일은 public-read이며 쓰기는 운영 권한 흐름이다.

## 스키마 정합성 메모
52번 화면 데이터는 통합 writing 스키마로 충족된다. 화면 고유 자료 구조를 운영에서 검증하려면 스키마 보강 필요다.

## 검수 필요 항목
- 52번 글자 수 기준과 제출 가능 조건을 문서 계약으로 고정한다.
- 작성 팁 문구를 운영 데이터로 분리할지 정한다.
