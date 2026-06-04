# Context Ledger — antd deprecation gate (M6) + /dashboard fix

## Run Metadata

- Run id: 20260604-1539-antd-deprecation-gate
- Created: 2026-06-04 15:39
- Updated: 2026-06-04 15:45
- Main session owner: Claude Code (Opus 4.8)
- Host: Claude Code
- Status: complete

## Task

- User goal: /dashboard 콘솔 에러(antd deprecated 문법) 해결 + PLAN.md에 해당 검수/수정 작업이 없는 이유 규명. 사용자 결정: (1) 게이트 구현, (2) /dashboard 즉시 수정 커밋, (3) 전체 sweep은 PLAN.md 문서 보완만.
- Accepted scope:
  - /dashboard `<Space direction>` → `orientation` 수정 (1줄).
  - 신규 기계 게이트 M6 (antd deprecation 정적 가드) TDD 구현 + M1 콘솔 캡처 보강.
  - PLAN.md 보완(M6 게이트 표/통합 게이트/DoD/이력/백로그).
- Out of scope: 기존 user-facing 폐기 문법 전체 sweep(코드) — PLAN.md 백로그 문서화만. admin 소스(동결).
- Current next action: 완료 — 커밋 후 사용자 보고. 후속 권고: CI 배선(D단계), 게이트 코드 적대적 cross-review, 전체 sweep 클러스터 청산.

## Docs Consulted

- Exact files read:
  - `docs/ui-redesign/PLAN.md` (전체) — 1차 실패 3대 결함 중 deprecation만 전용 게이트 부재 확인(부록 A v4.0/L286).
  - `scripts/ai-workflow-check.mjs` — M4(`checkInlineStyleNumbers` + `--check-inline-styles` arm) 패턴을 M6 모델로 채택.
  - `scripts/dev-route-smoke.mjs` (L177-260) — M1 콘솔 캡처가 `msg.type()==="error"`만 수집 확인.
  - `node_modules/antd/es/space/index.js` (L93) + `node_modules/antd/es/_util/warning.js` — Space `direction`/`split` 폐기 매핑 + deprecation 라우팅(default console.error / non-strict console.warn) 확인.
  - `tests/scripts/ai-workflow-check.test.ts` — 테스트 스타일 본.
  - `docs/ai-workflow/templates/context-ledger-template.md` — 본 ledger 형식.
- Extracted requirements: M6는 신규(델타)만·user-facing src 한정(admin 동결 제외)·탈출구·prop형만(런타임형은 M1). validate-the-validator 의무.
- Doc conflicts: none.
- Untouched relevant docs and reason:
  - `docs/admin-scope-boundary.md` — admin 동결 정책 준수만 하면 됨, 편집 불필요.
  - `docs/ant-design/08-theme-architecture.md` — 본 작업은 테마/토큰이 아니라 deprecation 가드라 무관.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 15:40 | M6 = M4와 동일한 정적 델타 가드 패턴 | 일관성 + diff 시점 fail-closed가 plan A0-(1) 철학과 합치 | PLAN.md §M4 |
| 15:41 | Space 룰을 `<Space …direction=`로 스코프 | Steps의 정당한 `direction="vertical"` 오탐 방지 | antd Steps API |
| 15:41 | 정적 message/Modal.confirm은 M6에서 제외 | per-line 오탐 위험 큼·런타임형 → M1 콘솔 캡처가 담당 | 설계 |
| 15:42 | denylist 보수적(5종)·버전핀 | 게이트 신뢰성(오탐=커밋 차단) 우선, 확장은 추후 | cross-audit 정신 |
| 15:43 | 전체 sweep 코드는 보류, PLAN 백로그만 | 사용자 결정 #3 | 사용자 |

## Active Files

- Files expected to change: dashboard/page.tsx, ai-workflow-check.mjs, dev-route-smoke.mjs, ai-workflow-check.test.ts, PLAN.md, (this ledger).
- Files inspected: 위 Docs Consulted 일체 + DashboardBody.tsx, dashboard/loading.tsx, dashboard/page.tsx.
- Files changed:
  - `src/app/(workspace)/dashboard/page.tsx` — `direction`→`orientation` (커밋 `2b8b6c3`, 별도 atomic).
  - `scripts/ai-workflow-check.mjs` — `checkAntdDeprecations()` + `ANTD_DEPRECATIONS`/`stripComments` + `--check-antd-deprecations` arm + internals export.
  - `scripts/dev-route-smoke.mjs` — console.warn antd-deprecation 캡처.
  - `tests/scripts/ai-workflow-check.test.ts` — M6 describe 블록(+6) + import.
  - `docs/ui-redesign/PLAN.md` — M6 보완.
- Files explicitly not to touch: `src/components/admin/**`, `src/app/(workspace)/admin/**` (동결). 기존 user-facing 폐기 문법 다수(이번엔 백로그).

## Verification State

- Required checks: M6 단위테스트 RED→GREEN, M6 arm 라이브 validate-the-validator, typecheck, ai-workflow-check `--repo .`.
- Checks run:
  - `pnpm exec vitest run tests/scripts/ai-workflow-check.test.ts` — RED(6 fail, "not a function") → 구현 후 GREEN(38 pass).
  - `node scripts/ai-workflow-check.mjs --check-antd-deprecations` — probe(`<Space direction>` 신규파일) FAIL/exit 1 → 삭제 후 PASS/exit 0.
  - `pnpm typecheck` — GREEN (dashboard fix + test 파일).
- Latest results: 위 전부 통과. cache-headers 회귀 테스트(직전 커밋 49e6810)도 4 GREEN 유지.
- Known failures: none.
- Skipped checks and reason: 전체 `pnpm test`/`lint`/clean build — 본 변경은 스크립트/테스트/문서 한정이고 dev 서버 실행 중이라 clean build는 M5 정신상 회피(focused 테스트 + typecheck로 대체). 통합 게이트 full 실행은 커밋 직후 권고.
- Cross-model review: degraded — 단일 세션 구현. validate-the-validator(단위 RED→GREEN + 라이브 arm exit-code)로 대체 증거 확보. 한글 카피 mojibake로 codex 부적격(see codex-review-mojibake-windows); 후속 Claude 리뷰어 적대 검수 권고(M2-M5 v4.2 전례).

## Fallback State

- Normal path blocked: cross-model review(codex 한글 mojibake) + CI 미배선.
- Failure class: degraded-mode.
- Fallback used: validate-the-validator(기계 증거) + TDD RED→GREEN로 대체. CI는 D단계까지 로컬 종료코드로만 강제.
- Evidence collected: vitest RED/GREEN 로그, M6 arm probe FAIL(exit 1)/clean PASS(exit 0).
- Completion allowed: yes (게이트 자체 검증 충족; 보고서에 degraded 명시).
- Remaining fallback risk: 적대 cross-review 부재로 게이트 코드의 미세 구멍 가능 — denylist 보수적 + 탈출구로 완화.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes (antd 6.4.3 폐기 매핑 직접 확인 후 룰 작성).
- Child result packets integrated: not applicable (단일 세션, 서브에이전트 미사용).
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks: M6 denylist 수동·버전핀(antd 업글 시 갱신); 기존 폐기 문법 다수 잔존(델타 가드라 미차단 — 백로그); 런타임/컨텍스트형 deprecation은 M1 스모크 라우트/로드 시점에만 보임(상호작용형 정적 message는 양 게이트 모두 사각).
- Assumptions: bodyStyle/headStyle/Tabs.TabPane/dropdownClassName이 antd 6.4.3에서도 폐기 상태(잘 알려진 v5→v6 폐기). Space direction은 node_modules 직접 확인.
- Follow-up needed: (a) 게이트 코드 적대 cross-review, (b) CI 배선(D), (c) 전체 sweep 클러스터 청산, (d) 통합 게이트 full 실행.
