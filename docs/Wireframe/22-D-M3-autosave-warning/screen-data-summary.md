# D-M3 자동저장 경고 화면 데이터 계약

## 화면 요약
쓰기 작성 중 자동저장 실패나 네트워크 문제를 사용자에게 알리는 경고 모달이다.

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
- 자동저장 실패 상태
- 마지막 저장 시각
- 재시도 안내
- 계속 작성/나가기 CTA

## 사용자 입력/상태 데이터
- 재시도 선택
- 계속 작성 선택
- 나가기 선택
- 현재 draft 상태

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 자동저장 상태 | 현재 스키마로 충족 | writing_drafts.autosave_status와 last_saved_at이 clean, dirty, syncing, failed, superseded 상태를 제공한다. | 실패 상태를 화면 경고로 노출한다. |
| 자동저장 이벤트 | 현재 스키마로 충족 | study_events에 draft_autosaved 또는 실패 관련 payload를 남길 수 있다. | event_type catalog는 comment에 고정되어 있다. |
| 경고 문구/재시도 정책 | 스키마 보강 필요 | 네트워크 안내 문구와 재시도 횟수 정책을 운영 데이터로 관리하는 구조는 없다. | 현재는 앱 정책이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| writing_drafts | 자동저장 상태 | 20260520120400_writing.sql: id, user_id, problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, created_at, updated_at. 활성 draft는 사용자와 문제 기준 1개만 허용된다. |
| study_events | 자동저장 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
작성 화면이 draft 저장 실패를 감지하면 autosave_status를 failed로 두고 모달을 띄운다. 재시도는 같은 draft를 다시 저장한다.

## RLS/권한 기준
- writing_drafts는 본인 row만 update 가능하다.
- study_events는 본인 이벤트만 insert한다.
- writing_drafts는 user_id = auth.uid() 기준 본인 draft만 읽고 쓸 수 있다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
경고의 핵심 상태는 현재 스키마로 충족된다. 재시도 정책 운영화는 스키마 보강 필요다.

## 검수 필요 항목
- failed 상태에서 나가기 허용 기준을 정한다.
- 마지막 저장 시각 표시 timezone을 정한다.
