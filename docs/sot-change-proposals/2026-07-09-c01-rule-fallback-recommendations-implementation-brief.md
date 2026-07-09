# C-01 규칙 기반 추천 fallback implementation brief

- 작성일: 2026-07-09
- 상태: 구현 착수 (사용자 승인된 계획 기반)
- 관련 결정: 사용자가 2026-07-09에 "학습 기록 기반으로 C-01에 문제가 추천되도록" 요청하고, `가중치 점수화 lite` 방식과 `transient(무저장)` 방식을 승인했다.

## 한 줄 결론

`/practice/recommendations`(C-01)는 저장된 `recommendation_items`가 없을 때 사용자의 학습 기록(풀이 이력, 첨삭 차원 점수, 학습 목표)을 정해진 규칙으로 점수화해 문제를 즉석 추천한다. DB에는 아무것도 저장하지 않는다.

## 배경과 확인 사실

- 현행 C-01은 `recommendation_runs`/`recommendation_items`를 읽기만 한다(`src/lib/practice/recommendations.ts`). 이 테이블의 쓰기는 RLS상 service_role 전용이고, v13 사용자 앱에는 생성기가 없다. 따라서 운영/배치가 row를 심어주지 않는 한 화면은 항상 빈 상태였다.
- 설계 문서 `docs/todo/codex-recommendation-logic-design.html` §10은 C-01을 "화면 계산형"(요청 시 계산, 저장 보류)으로 정의했고, §6은 규칙 기반 후보 생성→hard filter→점수화→재정렬→사유 코드 사양을 정의한다.
- SOT 제안 `docs/sot-change-proposals/recommendation-items-ownership-sot-update-2026-06-17.md`는 "준비된 recommendation_items 우선, 없으면 MVP 규칙 fallback" 원칙을 제시한다. 이 brief는 그 원칙의 C-01 구체화다.
- 과거 C-01의 하드코딩 가짜 추천("대표 추천" i18n fallback)은 정직성 버그로 제거된 이력이 있다(`tests/e2e/screens/recommendations-empty.spec.ts`). 이번 fallback은 하드코딩이 아니라 실제 사용자 데이터 기반 규칙 계산이며, 사유 문구는 규칙을 사실대로 기술한다.

## 범위

### 포함

- 서버 측 규칙 기반 추천 계산 모듈 (`src/lib/practice/recommendation-fallback.ts`).
- `queryRecommendationBundleForUser` Tier-2 통합: 저장 items 0건일 때만 계산 결과 반환.
- 응답 타입 additive 확장 (`source`, `summaryCode`, item `reasonCode`, `itemId` nullable).
- 클라이언트 최소 수정: reason code 해석, null itemId key 수정, 날조 태그 fallback 제거, 약점 dimension 라벨 표기.
- i18n ko/en/vi 동시 추가.
- 단위/통합/e2e/브라우저 검증.

### 제외 (out-of-scope)

- AI provider, 자동 약점 추론, ML 기반 추천 — 별도 scope decision 전까지 금지.
- 추천 결과 persistence(recommendation_runs/items 쓰기), 신규 `source_type` enum, migration.
- 설계 §6.4 중 신호원이 없는 항목: `avoid_repeat_keys` 감점(−30), 복습 예정 가점(+10), 같은 유형 과다반복 감점(−15). 존재하지 않는 신호로 사유를 만들지 않기 위해 명시적으로 제외한다.
- 관리자 기능, plan/paywall 게이트 신설(현행 C-01은 plan 게이트가 없고 유지한다).
- `pnpm` 의존성 추가.

## 동작 규칙

### 우선순위

1. **Tier-1 (stored)**: 기존 로직 그대로 — active·미만료 run의 visible published items가 1건 이상이면 그것만 반환. `source: "stored"`.
2. **Tier-2 (computed)**: Tier-1이 0건일 때만 규칙 계산. `source: "computed"`, `run: null`(존재하지 않는 run을 지어내지 않음).
3. `?type=51..54` 필터는 두 tier에 동일 적용된다. 저장 items가 특정 유형에만 있으면, 다른 유형 탭은 computed로 채워질 수 있다(쿼리 단위 해석).

### 입력 신호

| 신호 | 원천 | 실패 처리 |
| --- | --- | --- |
| writing 풀이/진행 이력 (touchedIds, 최근 question_no) | `writing_submissions`, `writing_drafts` | 핵심 — 오류 시 500 (기존 에러 UI가 처리) |
| 약점 차원 (bottom-2, 표본 ≥5 게이트) | `feedback_dimension_scores` via `getWeakDimensions` | 보조 — 오류 시 무약점으로 계속 |
| 학습 목표 (topik_level, target_grade) | `learning_goals` via `getLearningGoal` | 보조 — 없거나 오류 시 목표 배점 생략 |
| 후보 문제 | `problems` (published + lifecycle active + seed fixture 제외 + 미풀이) → visibility RPC | 핵심 — RPC 결측은 fail-closed(0건) |

### 점수표 (코드 상수)

| 규칙 | 점수 | reason code |
| --- | --- | --- |
| 유형 순환 다음 (51→52→53→54, 무이력이면 51) | +20 | `TYPE_ROTATION_NEXT` |
| 최근 유형 이어서 | +15 | `RECENT_TYPE_CONTINUATION` |
| 약점 차원과 문제 tags 실제 겹침 (차원당 +8, 상한 +16) | +8~16 | `WEAK_AREA_TAG_MATCH` |
| 목표 적합 (topik_level 일치 +6, 난이도 근접 +9; target = {1:2,2:3,3:3,4:4,5:4,6:5}[target_grade]) | +6~15 | `GOAL_DIFFICULTY_MATCH` |
| 난이도 급상승 (target+2 이상) | −10 | (감점) |
| 기본값 (다른 코드 미발동) | 0 | `UNATTEMPTED_AVAILABLE` |

- item의 reason code = 발동 성분 중 최고 점수 성분. 동률 tie-breaker: rotation order → difficulty asc(null 최후) → title(ko locale) → id. 시간·난수 미사용(결정적).
- 다양성: `?type` 없으면 rotation 순서로 유형별 최고점 1개씩 최대 4개 선점, 미달 시 전역 점수순 충원. 목표 개수 4(hero 1 + secondary 3).
- `summaryCode`: writing 이력, 약점, 목표 신호 중 하나라도 있으면 `history`, 없으면 `rotation`. 사용자에게 계산 근거를 사실대로 고지하는 용도.

### API/타입 변경 (additive)

- `RecommendationItemCard.itemId: string | null` (computed는 null — 소비할 row가 없으므로 consume 없음, 기존 `consumeRecommendationItem`은 null no-op).
- `RecommendationItemCard.reasonCode?: RecommendationReasonCode | null` — 서버는 문구를 만들지 않고 코드만 내려보내며, 클라이언트가 locale 문구로 해석한다.
- `RecommendationBundle.source: "stored" | "computed"`, `RecommendationBundle.summaryCode?: "history" | "rotation" | null`.
- `/api/practice/recommendations` route 자체는 무변경.

### 화면 영향

- 빈 상태 의미가 "저장 추천 없음"에서 "추천 가능한 후보 자체가 없음(노출 가능한 미풀이 공개 문제 0건)"으로 좁아진다. per-type 빈 상태도 동일하게 정직한 정상 결과다.
- ReasonPanel의 정적 3태그 날조 fallback(문법 표현/구성 흐름/표현 다양성)을 제거한다. 태그는 실측 겹침만 표시하고, 없으면 태그 행을 렌더하지 않는다.
- `reasonSummaryFallback`("최근 분석 결과…")는 분석이 없어도 분석처럼 읽히는 날조 서술이므로 중립 문구로 교정한다.
- 약점 태그는 raw dimension 값 대신 사용자 언어 라벨(문법/어휘/구성/내용/표현/주제 적합성/언어)로 표기한다.

## 수용 기준 (acceptance criteria)

1. 저장 `recommendation_items`(active·미만료·published·visible)가 1개 이상이면 응답은 그것만 사용한다(`source:"stored"`), 후보 계산 쿼리는 실행되지 않는다.
2. 저장 items 0건이고 노출 가능한 미풀이 공개 문제가 있으면 최대 4건을 `source:"computed"`, `itemId:null`, `rank:1..4`로 반환하며, DB 쓰기는 0건이다.
3. `?type=51..54` 필터가 computed 경로에도 동일 적용되고, 해당 유형 후보가 0건이면 빈 배열을 반환한다(빈 상태 UI 유지).
4. `weaknessTags`에는 표본 ≥5 게이트를 통과한 약점 차원 중 해당 문제 tags와 실제로 겹친 값만 담기고, 겹침이 없으면 빈 배열이다.
5. 모든 신규 사용자 문구는 규칙을 사실대로 기술하고 AI/자동 분석/맞춤 알고리즘 표현이 없으며, ko/en/vi 3개 locale에 동시 추가된다.
6. visibility RPC 결측 또는 기관 미배정 사용자는 computed 경로에서도 0건이다(fail-closed, 문제 유출 없음 — `institution-writing-exposure.spec.ts` 무수정 통과로 증명).
7. `learning_goals`가 없는 사용자도 500 없이 동작한다(목표 배점만 생략).
8. 동일 입력에 대해 동일 출력을 반환한다(결정성). 서버 계산은 클라이언트 8초 타임아웃 안에 들어온다(쿼리 ≤12회, 통상 8회).
9. seed fixture 문제(tags `seed:` prefix 또는 `materials.seed_source = "wireframe_problem_fixtures"`)는 후보에서 제외된다.

## 테스트 계획

- 단위: `tests/lib/practice/recommendation-fallback.test.ts` (무이력 순환, attempted 제외, 연속/순환 배점, 약점 부스트, 목표 근접/급상승, type 필터, RPC fail-closed, seed 제외, lifecycle 결측 재시도, 결정성, 보조 신호 degrade).
- 통합: `tests/lib/practice/recommendations.test.ts` (저장 우선, 0건→computed, 전부 hidden→computed, type별 tier 해석).
- e2e: `recommendations-empty`(API 인터셉트 재작업), `recommendations-fallback-ui`(성공/로딩/에러), `recommendations-fallback-live`(실 DB, run expires_at flip+복원), `institution-writing-existing-account`(+1 링크 갱신), `institution-writing-exposure`(무수정 회귀).
- 브라우저: 신선 빌드(포트 3100) + desktop 1280/mobile 360 수동 렌더 확인 + `docs/qa/reports/2026-07-09-c01-rule-recommendations/` 스크린샷.

## 리스크와 후속 과제

- e2e durable seed(`scripts/seed-e2e-audit-fixtures.mjs`의 활성 추천 4건)는 삭제하지 않는다. 라이브 스펙은 run `expires_at`을 과거로 잠시 바꿨다가 복원한다. 크래시 시 복구: `node scripts/seed-e2e-audit-fixtures.mjs` 재실행.
- 후속 과제(이번 범위 밖): seed fixture 판정 로직 3중 복제(`writing-availability.ts`, `writing/server.ts`, 신규 모듈)의 공용 모듈화, `bundle.availableTypes`의 UI 활용 여부 결정, 과다반복/복습 신호 도입 검토.
