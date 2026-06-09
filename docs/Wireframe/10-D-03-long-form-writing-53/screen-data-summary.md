# D-03 53번 장문 작성 화면 데이터 계약

## 화면 요약
도표나 자료를 보고 53번 장문 답안을 작성, 자동저장, 제출하는 화면이다.

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
- 53번 문제 지문
- 그래프/표/자료
- 장문 답안 입력 영역
- 글자 수
- 자동저장 상태
- 제출 버튼
- 구성 안내

## 사용자 입력/상태 데이터
- answer_text
- answer_json
- char_count
- 저장/제출 액션

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 문항 본문/도표 자료 | 현재 스키마로 충족 | problems.materials와 problem_assets가 도표와 참고 자료를 담는다. | question_no = 53으로 구분한다. |
| 장문 draft와 제출 | 현재 스키마로 충족 | writing_drafts와 writing_submissions가 본문, JSON, 글자 수, 제출 상태를 저장한다. | submit_writing_with_feedback이 제출/피드백 생성을 묶는다. |
| 53번 도표 세부 구조 | 스키마 보강 필요 | 축, 범례, 수치, 비교 포인트를 typed 컬럼으로 검증하는 구조는 없다. | 현재는 materials JSON과 asset 파일로 표현한다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| problems | 53번 문제 원본 | 20260520120200_problems.sql: id, source, author_id, domain, question_no, topik_level, difficulty, title, prompt, materials, answer_key, rubric, explanation, tags, publish_status, review_status, visibility, created_at, updated_at. |
| problem_assets | 도표/참고 자료 | 20260520120200_problems.sql: id, problem_id, storage_path, asset_type, sort_order. asset_type은 image 또는 audio. |
| writing_drafts | 자동저장 | 20260520120400_writing.sql: id, user_id, problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, created_at, updated_at. 활성 draft는 사용자와 문제 기준 1개만 허용된다. |
| writing_submissions | 최종 제출 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| rpc:public.submit_writing_with_feedback | 제출 처리 | 20260521130000_phase_5_writing_rpc.sql, 20260521140000_phase_6_rpc_and_admin.sql: 제출, 피드백, 영역 점수, 문장 피드백을 한 트랜잭션으로 만든다. |
| study_events | 작성/제출 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |
| storage:problem-assets | 자료 파일 | 20260520121200_storage_buckets.sql, 20260520121300_storage_policies.sql: public bucket, 이미지와 오디오 허용, 쓰기는 운영 권한 정책. |

## 저장/조회/이벤트 흐름
화면은 53번 problem과 draft를 조회한다. 사용자는 장문 답안을 작성하고 제출하면 RPC가 submission과 feedback 초기 row를 만든다.

## RLS/권한 기준
- 쓰기 데이터는 본인 row만 접근한다.
- problem_assets는 연결된 problem의 공개 범위를 따른다.
- problems는 published/public 문제 또는 본인이 만든 ai_generated 문제만 사용자에게 노출된다.
- problem_assets 조회 권한은 연결된 problems의 노출 권한을 따른다.
- writing_drafts는 user_id = auth.uid() 기준 본인 draft만 읽고 쓸 수 있다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- study_events는 본인 select/insert가 가능하다.
- problem-assets 파일은 public-read이며 쓰기는 운영 권한 흐름이다.

## 스키마 정합성 메모
53번 장문 작성의 기본 저장 계약은 현재 스키마로 충족된다. 도표 의미 구조를 운영 데이터로 안정화하려면 스키마 보강 필요다.

## 2026-06-09 구현 메모
- 53번 더미 JSON은 `problems.materials`, `answer_key`, `rubric` JSONB에 저장한다.
- 사용자 화면은 raw JSONB 대신 `NormalizedWritingProblem(kind="q53")`을 사용한다.
- UI 입력 필드는 `charts`, `materialCards`, `writingTasks`, `rubricCriteria`, `referenceMaterials`이다.
- 차트는 정규화된 `NormalizedChart`를 기준으로 렌더링하고, 원본 JSON 구조 차이는 normalizer에서 흡수한다.

## 검수 필요 항목
- 도표 자료가 이미지인지 구조화 JSON인지 기준을 정한다.
- 장문 글자 수 제한과 autosave 주기를 문서 계약으로 고정한다.
