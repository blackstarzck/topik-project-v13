# D-01 51번 단답 작성 화면 데이터 계약

## 화면 요약
51번 쓰기 문제의 지문, 자료, 답안 입력, 자동저장, 제출을 처리하는 화면이다.

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
- 문제 지문
- 참고 이미지 또는 자료
- 답안 입력 영역
- 글자 수
- 자동저장 상태
- 제출 버튼
- 작성 도움말

## 사용자 입력/상태 데이터
- answer_text
- answer_json
- char_count
- 저장/제출 액션
- 문제별 작성 상태

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 문항 본문/자료/조건 | 현재 스키마로 충족 | problems와 problem_assets가 51번 문제의 prompt, materials, answer_key, rubric, 첨부 자료를 제공한다. | question_no = 51로 구분한다. |
| 작성 draft와 자동저장 | 현재 스키마로 충족 | writing_drafts가 answer_text, answer_json, char_count, autosave_status, last_saved_at을 저장한다. | 활성 draft는 사용자와 문제 기준 1개다. |
| 최종 제출과 피드백 생성 | 현재 스키마로 충족 | submit_writing_with_feedback RPC가 submission과 feedback row를 만든다. | 직접 insert 대신 RPC 중심으로 제출한다. |
| 51번 전용 빈칸/힌트 구조 | 스키마 보강 필요 | 빈칸 라벨, 빈칸별 정답, 힌트 카드처럼 화면 고유 UI를 검증된 컬럼으로 나누는 구조는 없다. | 현재는 problems.materials, answer_key, rubric JSON에 담는 수준이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| problems | 51번 문제 원본 | 20260520120200_problems.sql: id, source, author_id, domain, question_no, topik_level, difficulty, title, prompt, materials, answer_key, rubric, explanation, tags, publish_status, review_status, visibility, created_at, updated_at. |
| problem_assets | 참고 자료 | 20260520120200_problems.sql: id, problem_id, storage_path, asset_type, sort_order. asset_type은 image 또는 audio. |
| writing_drafts | 자동저장 | 20260520120400_writing.sql: id, user_id, problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, created_at, updated_at. 활성 draft는 사용자와 문제 기준 1개만 허용된다. |
| writing_submissions | 최종 제출 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| rpc:public.submit_writing_with_feedback | 제출 처리 | 20260521130000_phase_5_writing_rpc.sql, 20260521140000_phase_6_rpc_and_admin.sql: 제출, 피드백, 영역 점수, 문장 피드백을 한 트랜잭션으로 만든다. |
| study_events | 작성/제출 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |
| storage:problem-assets | 참고 자료 파일 | 20260520121200_storage_buckets.sql, 20260520121300_storage_policies.sql: public bucket, 이미지와 오디오 허용, 쓰기는 운영 권한 정책. |

## 저장/조회/이벤트 흐름
화면 진입 시 problem과 활성 draft를 조회한다. 작성 중에는 draft를 저장하고 제출 시 확인 모달 뒤 submit_writing_with_feedback을 호출한다.

## RLS/권한 기준
- problems와 problem_assets는 사용자에게 보이는 문제만 조회한다.
- writing_drafts와 writing_submissions는 본인 row만 읽고 쓴다.
- feedback 생성은 서버 권한 흐름이다.
- problems는 published/public 문제 또는 본인이 만든 ai_generated 문제만 사용자에게 노출된다.
- problem_assets 조회 권한은 연결된 problems의 노출 권한을 따른다.
- writing_drafts는 user_id = auth.uid() 기준 본인 draft만 읽고 쓸 수 있다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- study_events는 본인 select/insert가 가능하다.
- problem-assets 파일은 public-read이며 쓰기는 운영 권한 흐름이다.

## 스키마 정합성 메모
기존 요약의 전용 문제 테이블 방식은 migration 근거가 없다. 이번 문서는 현재 migration의 통합 problems 계약으로 정리한다.

## 검수 필요 항목
- 51번 UI 전용 구조를 JSON 계약으로 둘지 별도 typed 구조로 보강할지 정한다.
- 자동저장 실패 상태의 재시도 정책을 정한다.
