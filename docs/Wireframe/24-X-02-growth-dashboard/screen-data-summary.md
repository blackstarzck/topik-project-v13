# X-02 성장 대시보드 화면 데이터 계약

## 화면 요약
사용자의 점수 추세, 활동량, 약점 변화를 보여주는 학습 성장 분석 화면이다.

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
- 학습량 KPI
- 점수 추세
- 영역별 약점
- 풀이량/정확도
- 최근 활동 목록

## 사용자 입력/상태 데이터
- 기간 필터
- 차트 탭
- 약점 영역 선택
- 추천 문제 이동
- 결제/구독 상태는 성장 대시보드 접근 조건으로 사용하지 않음

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| KPI와 활동 추세 | 현재 스키마로 충족 | get_dashboard_kpi와 study_events가 기본 학습량과 이벤트 추세를 제공한다. | 세부 기간 집계 RPC는 없다. |
| 점수/약점 추세 | 현재 스키마로 충족 | writing_feedback과 feedback_dimension_scores가 점수와 weakness_level 추세의 원천이다. | dimension enum을 기준으로 차트를 만든다. |
| 성장 리포트 집계 | 스키마 보강 필요 | 기간별 집계 snapshot이나 badge/level 운영 구조는 현재 migration에 없다. | 현재는 원천 데이터를 클라이언트 또는 서버 쿼리에서 집계한다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| rpc:public.get_dashboard_kpi | KPI 요약 | 20260521140000_phase_6_rpc_and_admin.sql: 인증 사용자의 오늘 풀이 수, 전체 풀이 수, 시험 D-day, 연속 학습일을 반환한다. |
| study_events | 활동 추세 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |
| writing_feedback | 점수 추세 | 20260520120500_feedback.sql: submission_id, user_id, status, score_total, score_max, overall_summary, ai_model, ai_model_version, raw_ai_result, generated_at. |
| feedback_dimension_scores | 약점 분석 | 20260520120500_feedback.sql: id, submission_id, user_id, dimension, score, score_max, summary, weakness_level. dimension은 grammar, vocab, structure, content, expression, topic_fit. |
| problem_attempts | 풀이량/정확도 | 20260520120300_attempts.sql: id, user_id, problem_id, selected_answer, is_correct, score, status, started_at, submitted_at, bookmarked, time_spent_seconds. |

## 저장/조회/이벤트 흐름
화면은 KPI와 원천 이벤트/피드백 데이터를 기간 필터로 조회한다. 약점 영역 클릭 시 weakness 기반 추천 화면으로 이동한다.

## RLS/권한 기준
- 모든 원천 데이터는 본인 row만 조회한다.
- study_events는 본인 이벤트만 조회된다.
- study_events는 본인 select/insert가 가능하다.
- writing_feedback, feedback_dimension_scores, sentence_feedback은 본인 select만 허용되며 생성은 서버 권한 흐름이다.
- problem_attempts는 user_id = auth.uid() 기준 본인 풀이만 읽고 쓸 수 있다.

## 스키마 정합성 메모
원천 데이터는 현재 스키마로 충족된다. 대시보드 전용 집계 테이블이나 RPC는 현재 없다.

## 검수 필요 항목
- 차트 집계를 클라이언트에서 할지 서버 RPC로 보강할지 정한다.
- 기간 필터의 기본값과 timezone을 정한다.
