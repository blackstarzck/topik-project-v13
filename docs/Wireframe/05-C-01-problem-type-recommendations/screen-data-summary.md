# C-01 문제 유형 추천 화면 데이터 계약

## 화면 요약
사용자 약점과 목표를 바탕으로 풀 문제 유형과 추천 이유를 보여주는 화면이다.

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
- 추천 유형 카드
- 난이도와 예상 소요 시간
- 추천 이유
- 약점 태그
- 바로 풀기 CTA

## 사용자 입력/상태 데이터
- 추천 카드 선택
- 추천 항목 소비 상태
- 문제 유형 필터 상태

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 추천 묶음과 항목 | 현재 스키마로 충족 | recommendation_runs와 recommendation_items가 source_type, rank, reason, estimated_minutes, weakness_tags, status를 관리한다. | source_type은 dashboard, feedback, weakness, next_problem 중 하나다. |
| 문제 유형/난이도/태그/공개 상태 | 현재 스키마로 충족 | problems가 domain, question_no, topik_level, difficulty, tags, publish_status, visibility를 제공한다. | published/public 또는 본인 생성 문제만 표시된다. |
| 추천 규칙 설정 | 스키마 보강 필요 | 약점에서 문제 유형으로 이어지는 운영 규칙과 가중치 catalog는 현재 migration에 없다. | 현재는 결과 row 중심 계약이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| recommendation_runs | 추천 생성 묶음 | 20260520120600_recommendations.sql: id, user_id, source_type, source_id, reason_summary, created_at, expires_at. source_type은 dashboard, feedback, weakness, next_problem. |
| recommendation_items | 추천 문제 항목 | 20260520120600_recommendations.sql: id, run_id, user_id, problem_id, rank, reason, estimated_minutes, weakness_tags, status. |
| feedback_dimension_scores | 약점 근거 | 20260520120500_feedback.sql: id, submission_id, user_id, dimension, score, score_max, summary, weakness_level. dimension은 grammar, vocab, structure, content, expression, topic_fit. |
| problems | 문제 메타데이터 | 20260520120200_problems.sql: id, source, author_id, domain, question_no, topik_level, difficulty, title, prompt, materials, answer_key, rubric, explanation, tags, publish_status, review_status, visibility, created_at, updated_at. |

## 저장/조회/이벤트 흐름
화면은 사용자의 최근 약점 점수와 recommendation_runs를 조회한다. 추천 카드 클릭 시 recommendation_items.status를 consumed로 바꾸고 문제 풀이 화면으로 이동한다.

## RLS/권한 기준
- recommendation_runs와 recommendation_items는 본인 row만 조회한다.
- recommendation_items status update도 본인 row만 가능하다.
- problems는 사용자에게 보이는 공개 범위만 조회된다.
- recommendation_runs는 본인 select만 허용된다.
- recommendation_items는 본인 select/update가 가능하며 status 소비 처리를 담는다.
- problems는 published/public 문제 또는 본인이 만든 ai_generated 문제만 사용자에게 노출된다.

## 스키마 정합성 메모
추천 결과 저장은 현재 스키마로 충족된다. 추천 규칙 자체를 운영에서 관리하려면 스키마 보강 필요다.

## 검수 필요 항목
- 추천 reason 문구 생성 기준을 raw AI 결과로 둘지 별도 catalog로 둘지 정한다.
- weakness_tags 값 목록의 표준화를 정한다.
