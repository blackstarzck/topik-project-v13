# X-07 약점 기반 추천 화면 데이터 계약

## 화면 요약
사용자의 약점 영역을 기준으로 다음에 풀 문제와 학습 방향을 제안하는 화면이다.

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
- 약점 영역 목록
- 약점 정도
- 추천 문제 카드
- 추천 이유
- 예상 소요 시간
- 시작 CTA

## 사용자 입력/상태 데이터
- 약점 영역 선택
- 추천 문제 선택
- 추천 항목 status 변경

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 약점 계산 근거 | 현재 스키마로 충족 | feedback_dimension_scores가 dimension, score, weakness_level을 제공한다. | writing_feedback 생성 시 같이 만들어진다. |
| 약점 기반 추천 결과 | 현재 스키마로 충족 | recommendation_runs.source_type = weakness와 recommendation_items가 추천 묶음과 항목을 저장한다. | weakness_tags로 약점 연결을 담는다. |
| 추천 대상 문제 | 현재 스키마로 충족 | problems가 유형, 난이도, 태그, 공개 상태를 제공한다. | 사용자에게 보이는 문제만 추천 화면에 노출한다. |
| 약점-문제 매핑 규칙 | 스키마 보강 필요 | dimension별 문제 유형 매핑, 가중치, 제외 조건을 관리하는 구조는 없다. | 현재는 결과 row 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| feedback_dimension_scores | 약점 계산 | 20260520120500_feedback.sql: id, submission_id, user_id, dimension, score, score_max, summary, weakness_level. dimension은 grammar, vocab, structure, content, expression, topic_fit. |
| recommendation_runs | 추천 묶음 | 20260520120600_recommendations.sql: id, user_id, source_type, source_id, reason_summary, created_at, expires_at. source_type은 dashboard, feedback, weakness, next_problem. |
| recommendation_items | 추천 항목 | 20260520120600_recommendations.sql: id, run_id, user_id, problem_id, rank, reason, estimated_minutes, weakness_tags, status. |
| problems | 추천 문제 정보 | 20260520120200_problems.sql: id, source, author_id, domain, question_no, topik_level, difficulty, title, prompt, materials, answer_key, rubric, explanation, tags, publish_status, review_status, visibility, created_at, updated_at. |
| study_events | 추천 클릭 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
화면은 사용자의 최근 dimension score를 조회하고 weakness source 추천 run을 가져온다. 문제 클릭 시 recommendation_items.status를 consumed로 바꾼다.

## RLS/권한 기준
- 약점 점수와 추천 row는 본인 데이터만 조회한다.
- 추천 항목 update도 본인 row만 가능하다.
- recommendation_runs는 본인 select만 허용된다.
- recommendation_items는 본인 select/update가 가능하며 status 소비 처리를 담는다.
- problems는 published/public 문제 또는 본인이 만든 ai_generated 문제만 사용자에게 노출된다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
약점과 추천 결과 데이터는 현재 스키마로 충족된다. 매핑 규칙 운영 구조는 스키마 보강 필요다.

## 검수 필요 항목
- weakness_level 해석 기준을 화면 문구와 맞춘다.
- 추천 항목이 없을 때 fallback 문제 조회 기준을 정한다.
