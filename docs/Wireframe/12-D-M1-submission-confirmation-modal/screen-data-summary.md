# D-M1 제출 확인 모달 화면 데이터 계약

## 화면 요약
쓰기 답안을 최종 제출하기 전 답안 요약과 제출 후 변경 제한을 안내하는 모달이다.

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
- 제출 전 답안 요약
- 글자 수
- 자동저장 완료 상태
- 제출 후 안내 문구
- 확정/취소 버튼

## 사용자 입력/상태 데이터
- 최종 제출 선택
- 취소 선택
- 현재 draft id

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 제출 전 답안 요약 | 현재 스키마로 충족 | writing_drafts가 answer_text, answer_json, char_count, autosave_status를 제공한다. | 제출 가능 상태는 autosave_status와 글자 수로 판단한다. |
| 최종 제출 처리 | 현재 스키마로 충족 | submit_writing_with_feedback RPC가 writing_submissions와 feedback 초기 데이터를 만든다. | writing_submissions 직접 insert 정책은 뒤 단계에서 제한되었다. |
| 모달 경고 문구 | 스키마 보강 필요 | 제출 후 변경 제한 문구와 문항별 경고 문구를 운영 데이터로 관리하는 구조는 없다. | 현재는 앱 문구 계약이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| writing_drafts | 제출 전 답안 요약 | 20260520120400_writing.sql: id, user_id, problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, created_at, updated_at. 활성 draft는 사용자와 문제 기준 1개만 허용된다. |
| rpc:public.submit_writing_with_feedback | 최종 제출 | 20260521130000_phase_5_writing_rpc.sql, 20260521140000_phase_6_rpc_and_admin.sql: 제출, 피드백, 영역 점수, 문장 피드백을 한 트랜잭션으로 만든다. |
| writing_submissions | 제출본 생성 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| writing_feedback | 초기 피드백 row | 20260520120500_feedback.sql: submission_id, user_id, status, score_total, score_max, overall_summary, ai_model, ai_model_version, raw_ai_result, generated_at. |
| study_events | 제출 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
모달은 현재 draft를 읽어 글자 수와 저장 상태를 표시한다. 사용자가 제출을 확정하면 RPC를 호출하고 분석 상태 화면으로 이동한다.

## RLS/권한 기준
- writing_drafts는 본인 row만 읽는다.
- 제출 RPC는 인증 사용자 context에서 실행된다.
- feedback 상세 생성은 서버 권한 흐름이다.
- writing_drafts는 user_id = auth.uid() 기준 본인 draft만 읽고 쓸 수 있다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- writing_feedback, feedback_dimension_scores, sentence_feedback은 본인 select만 허용되며 생성은 서버 권한 흐름이다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
제출 전 데이터는 현재 스키마로 충족된다. 경고/동의 문구 이력 저장은 현재 migration에 없다.

## 검수 필요 항목
- 제출 버튼 활성 기준을 autosave_status 기준으로 고정한다.
- 제출 동의 이력을 남길지 정한다.
