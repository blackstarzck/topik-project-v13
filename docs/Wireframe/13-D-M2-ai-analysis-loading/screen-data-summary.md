# D-M2 AI 분석 로딩 화면 데이터 계약

## 화면 요약
제출 뒤 AI 첨삭이 진행되는 동안 분석 상태와 실패/재시도 안내를 보여주는 화면이다.

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
- 분석 중 상태
- 예상 대기 안내
- 실패 메시지
- 결과 보기 또는 다시 시도 CTA

## 사용자 입력/상태 데이터
- submission id
- polling 또는 refresh 상태
- 재시도 선택

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 분석 상태 | 현재 스키마로 충족 | writing_submissions.feedback_status가 pending, analyzing, complete, failed 상태를 제공한다. | private.set_submission_feedback_status는 서버 권한으로 상태를 바꾼다. |
| 피드백 결과 연결 | 현재 스키마로 충족 | writing_feedback.status가 partial, complete, failed를 제공한다. | 완료 시 feedback 화면으로 이동한다. |
| 분석 진행률 단계 문구 | 스키마 보강 필요 | 세부 로딩 단계와 예상 시간 문구를 운영 데이터로 관리하는 구조는 없다. | 현재 상태 enum은 충분하지만 진행률 catalog는 없다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| writing_submissions | 분석 상태 | 20260520120400_writing.sql: id, user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, submitted_at, feedback_status, parent_submission_id. 제출본은 직접 수정/삭제하지 않는 구조다. |
| writing_feedback | 분석 결과 연결 | 20260520120500_feedback.sql: submission_id, user_id, status, score_total, score_max, overall_summary, ai_model, ai_model_version, raw_ai_result, generated_at. |
| rpc:private.set_submission_feedback_status | 서버 권한 상태 전이 | 20260520121500_submission_status_function.sql: service role 전용으로 writing_submissions.feedback_status 상태 전이를 수행한다. |

## 저장/조회/이벤트 흐름
화면은 submission.feedback_status를 주기적으로 조회한다. complete가 되면 feedback 화면으로 이동하고 failed이면 오류 CTA를 표시한다.

## RLS/권한 기준
- 사용자는 본인 submission과 feedback만 읽는다.
- feedback_status 전이는 클라이언트 직접 update가 아니라 서버 권한 함수로 수행한다.
- writing_submissions는 본인 select/insert만 허용되며 update/delete 정책은 없다.
- writing_feedback, feedback_dimension_scores, sentence_feedback은 본인 select만 허용되며 생성은 서버 권한 흐름이다.

## 스키마 정합성 메모
상태 값은 현재 스키마로 충족된다. 단계별 로딩 문구와 재시도 정책을 운영 데이터로 바꾸려면 스키마 보강 필요다.

## 검수 필요 항목
- polling 간격과 timeout 기준을 정한다.
- failed 상태에서 사용자가 재분석을 요청할 수 있는지 정한다.
