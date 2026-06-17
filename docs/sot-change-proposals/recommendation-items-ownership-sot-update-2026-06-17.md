# recommendation_items ownership SOT update proposal

## 한 줄 결론

추천 문제는 사용자가 보는 앱에서 즉석으로 모두 계산하는 기능이 아니라, 준비된 추천 결과가 있으면 먼저 보여 주고 없으면 기본 규칙으로 이어가는 구조로 정리해야 한다.

## 대상 문서

- `docs/development-core-planning/06-submission-ai-recommendations/README.md`
- `docs/Wireframe/04-B-01-home-dashboard/screen-data-summary.md`
- `docs/Wireframe/04-B-01-home-dashboard/functional-spec.md`
- `docs/Wireframe/05-C-01-problem-type-recommendations/screen-data-summary.md`
- `docs/Wireframe/05-C-01-problem-type-recommendations/functional-spec.md`
- `docs/Wireframe/17-R-02-next-problem-recommendation/screen-data-summary.md`
- `docs/Wireframe/17-R-02-next-problem-recommendation/functional-spec.md`
- `docs/Wireframe/29-X-07-weakness-based-recommendations/screen-data-summary.md`
- `docs/Wireframe/29-X-07-weakness-based-recommendations/functional-spec.md`
- `docs/Wireframe/data-usage-index.md`

## 수정 이유

현재 구현과 문서 사이에 큰 충돌은 없지만, `recommendation_items`의 의미가 충분히 분명하지 않다.

현재 코드는 `recommendation_items`가 있으면 먼저 사용하고, 없으면 최근 풀이 유형이나 공개 문제 목록 같은 기본 규칙으로 추천을 만든다. 이 구조는 관리자 쪽에서 사용자별 추천을 직접 편집한다는 뜻이 아니라, 관리자 앱 또는 운영 데이터가 문제 후보와 상태를 준비해 두면 사용자 앱이 그 결과를 우선 소비한다는 뜻으로 해석해야 한다.

이 경계를 SOT에 명시하지 않으면 다음 작업자가 `recommendation_items`를 관리자 수동 추천 테이블로 오해하거나, 반대로 사용자 앱 안에서 완전한 추천 생성 엔진까지 이미 구현되어 있다고 오해할 수 있다.

## 현재 확인한 사실

| 확인 항목 | 현재 상태 |
| --- | --- |
| 추천 결과 저장소 | `recommendation_runs`, `recommendation_items` 테이블이 있다. |
| 사용자 앱 동작 | 저장된 추천 항목을 먼저 읽고, 없으면 기본 규칙으로 fallback한다. |
| 관리자 앱 경계 | 이 저장소는 사용자 앱이며 관리자 전용 화면과 관리자 스키마 확장은 범위 밖이다. |
| 추천 생성 엔진 | 후보 생성, 점수화, 재정렬, 저장을 모두 수행하는 독립 엔진은 현재 구현에서 확인되지 않았다. |
| MVP 방향 | AI 기반 약점 추천 엔진은 보류이고, 규칙 기반 다음 문제 추천은 MVP 범위와 맞다. |

## 제안하는 SOT 문장

아래 문장을 관련 문서에 같은 의미로 반영한다.

> `recommendation_items`는 사용자 앱이 소비하는 사용자별 추천 결과 캐시다. 운영 또는 관리자 앱은 문제의 공개 상태, 추천에 필요한 태그와 후보 품질을 관리하고, 추천 row 생성은 별도 서버 로직 또는 후속 배치가 담당한다. 사용자 앱은 준비된 `recommendation_items`가 있으면 우선 사용하되, row가 없거나 만료된 경우에는 최근 풀이 유형, 공개 문제, 약점 태그 overlap 같은 MVP 규칙 fallback으로 사용자가 계속 학습할 수 있게 한다.

> 관리자 앱은 사용자별 추천 row를 사람이 직접 강제 편집하는 화면이 아니다. 관리자 역할은 문제 후보 풀과 운영 메타데이터를 정비하는 데 한정한다. 사용자별 추천 결과와 상태는 사용자 소유 데이터로 취급하고, 본인 조회 및 소비 상태 변경만 허용한다.

## 문서별 반영 방향

| 문서 | 반영 방향 |
| --- | --- |
| `06-submission-ai-recommendations` | 추천의 역할 구분을 추가한다. 준비된 추천 결과 우선, 없으면 MVP fallback이라는 원칙을 명시한다. |
| B-01, C-01, R-02, X-07 screen-data-summary | `recommendation_items`를 “관리자가 직접 넣는 추천”이 아니라 “사용자 앱이 읽는 추천 결과 캐시”로 설명한다. |
| B-01, C-01, R-02, X-07 functional-spec | read/update 사용 목적에 “조회와 소비 상태 변경”을 명시하고, 사용자별 추천 생성/강제 편집은 제외한다. |
| `data-usage-index.md` | `recommendation_items`, `recommendation_runs` 항목에 소유권과 생성 책임을 요약한다. |

## SOT에 명시해야 할 경계

- 사용자 앱은 관리자 화면을 만들지 않는다.
- 사용자는 본인 추천 결과만 본다.
- 사용자가 추천 문제를 시작하면 추천 항목은 소비된 상태로 바뀔 수 있다.
- 관리자는 개별 사용자 추천 결과를 직접 편집하지 않는다.
- 관리자/운영 쪽 책임은 문제 공개 상태, 태그, 추천 후보 품질 관리다.
- 추천 row 생성 로직은 이 제안에서 새로 구현하지 않는다.
- AI provider, 자동 점수 추론, ML 기반 약점 추천 엔진은 별도 scope decision 전까지 포함하지 않는다.

## 수용 기준

- 관련 SOT 문서에서 `recommendation_items`가 관리자 수동 추천 테이블처럼 읽히지 않는다.
- 관련 SOT 문서에서 사용자 앱이 완전한 추천 생성 엔진을 이미 갖춘 것처럼 읽히지 않는다.
- B-01, C-01, R-02, X-07의 추천 화면은 모두 같은 데이터 책임 설명을 공유한다.
- `docs/todo/codex-recommendation-logic-design.html`의 설계 내용은 참고 설계로 남기되, 정식 SOT에는 MVP 경계와 현재 구현 상태가 함께 반영된다.

## 근거

- `src/lib/practice/next.ts`: 다음 문제 추천은 `recommendation_items` 우선, 최근 풀이 유형, 공개 문제 순으로 fallback한다.
- `src/lib/practice/weakness.ts`: 약점 추천은 `recommendation_items` 우선, 약점 태그 overlap 순으로 fallback한다.
- `src/lib/practice/queries.ts`: 추천 문제 목록은 active `recommendation_items`를 읽는다.
- `supabase/migrations/20260520120600_recommendations.sql`: `recommendation_runs`, `recommendation_items` 저장 구조가 있다.
- `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`: 실제 AI 분석과 고급 추천 엔진은 보류로 정리되어 있다.

