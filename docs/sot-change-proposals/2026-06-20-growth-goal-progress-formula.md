# Growth Goal Progress Formula Proposal

## 대상 문서

- `docs/Wireframe/24-X-02-growth-dashboard/description.md`
- `docs/Wireframe/24-X-02-growth-dashboard/functional-spec.md`
- `docs/Wireframe/24-X-02-growth-dashboard/screen-data-summary.md`
- `docs/Wireframe/data-usage-index.md`
- 필요 시 `docs/development-core-planning/`의 성장 지표/목표 관련 결정 문서

## 수정 이유

`/growth`와 `/dashboard`는 사용자에게 `목표 달성률`을 표시하지만, 현재 SOT에는 산식이 없다. 코드에만 산식이 있으면 같은 지표를 다른 화면이나 문서에서 다르게 해석할 위험이 있다.

## 제안 산식

TALKPIK은 현재 TOPIK 쓰기 점수만 DB에 저장하므로, 공식 TOPIK II 전체 등급 기준을 쓰기 100점 척도에 맞춘 제품 산식으로 환산한다.

```text
쓰기 목표점수 = TOPIK II 목표 등급 총점 하한 / 3
피드백 점수 = writing_feedback.score_total / (writing_feedback.score_max ?? 100) * 100
목표 달성률 = round(최근 90일 피드백 평균점수 / 쓰기 목표점수 * 100)
표시 최대값 = 100%
```

## 등급별 쓰기 목표점수

| 목표 등급 | TOPIK II 총점 하한 | 쓰기 환산 목표 |
| --- | ---: | ---: |
| 3급 | 120 / 300 | 40 |
| 4급 | 150 / 300 | 50 |
| 5급 | 190 / 300 | 63.33 |
| 6급 | 230 / 300 | 76.67 |

## 범위와 예외

- 이 값은 공식 TOPIK 합격 산식이 아니라 TALKPIK의 쓰기 전용 제품 산식이다.
- `topik_level`이 `TOPIK_I`이면 현재 쓰기 점수 원천이 없으므로 목표 달성률을 계산하지 않는다.
- `score_max`가 없으면 프로젝트의 기존 피드백 UI 관례와 동일하게 100점 만점으로 처리한다.
- `score_max <= 0`이거나 `score_total`이 없으면 해당 피드백은 계산에서 제외한다.

## 현재 코드 반영 위치

- `src/lib/growth/goalProgress.ts`
- `src/app/(workspace)/growth/page.tsx`
- `src/app/(workspace)/dashboard/page.tsx`

## 검토한 대안

| 대안 | 판단 |
| --- | --- |
| 모든 등급에 `60점`을 공통 목표로 사용 | 등급별 목표 난이도를 반영하지 못해 폐기 |
| TOPIK 총점 하한을 그대로 사용 | 앱 점수는 쓰기 100점 기준이므로 척도가 맞지 않아 폐기 |
| 응시일까지 남은 기간, 풀이 수, 연속 학습일을 함께 가중 | 설명 가능성이 낮고 지표가 과하게 복잡해 MVP/상용 첫 기준에서는 제외 |

## 근거

- NIIED TOPIK 개요는 TOPIK II를 300점 만점, 3급 120점, 4급 150점, 5급 190점, 6급 230점 기준으로 안내한다.
- 현재 DB 원천은 `learning_goals.topik_level`, `learning_goals.target_grade`, `writing_feedback.score_total`, `writing_feedback.score_max`다.
