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
- Current next action: 완료. 영구 재발방지(사용자 "결정해줘"): (1) Stop 훅 wiring을 `.gitignore` 예외로 커밋해 팀 강제, (2) M6를 CI(`ai-workflow-check.yml`)에 `--check-antd-deprecations --base`로 배선, (3) PLAN.md에 강제 경로 명시, (4) 브랜치 push. 전체 sweep은 훅+M1 클러스터 자동청산에 위임(일괄수정 비선택).

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
  - **(추가 2건, 사용자 재신고 후)** `src/components/learning/UpcomingExamCard.tsx`(`Statistic valueStyle`→`styles.content`)·`RecentFeedbackCard.tsx`(`List`→`Flex` 교체). `scripts/ai-workflow-check.mjs`에 `valueStyle` denylist 추가 + 테스트(+1=39 GREEN).
  - **(직접확인 기계강제)** `scripts/hooks/require-ui-smoke.mjs`(신규 Stop 훅 가드)·`.claude/settings.json`(신규, Stop 훅 배선).
- Files explicitly not to touch: `src/components/admin/**`, `src/app/(workspace)/admin/**` (동결). 기존 user-facing 폐기 문법 다수(이번엔 백로그).

## Verification State

- Required checks: M6 단위테스트 RED→GREEN, M6 arm 라이브 validate-the-validator, typecheck, ai-workflow-check `--repo .`.
- Checks run:
  - `pnpm exec vitest run tests/scripts/ai-workflow-check.test.ts` — RED(6 fail, "not a function") → 구현 후 GREEN(38 pass).
  - `node scripts/ai-workflow-check.mjs --check-antd-deprecations` — probe(`<Space direction>` 신규파일) FAIL/exit 1 → 삭제 후 PASS/exit 0.
  - `pnpm typecheck` — GREEN (dashboard fix + test 파일).
  - **실제 앱 M1 스모크(사용자 지적 후, PLAN §A0/M1 절차):** `node scripts/dev-route-smoke.mjs --routes /dashboard` — 기존 dev 재사용, `student.json` 인증, authed /dashboard status 200 `ok:true` `reasons:[]`. consoleErrors=HMR WebSocket 노이즈뿐(non-fatal 분류), **antd deprecation 0건**(M1 보강이 warn까지 잡는데도 valueStyle·List·Space direction 전부 무검출=런타임 실제 소멸). 아티팩트 `docs/ui-redesign/pilot-shots/smoke-result.json`.
  - **Stop 훅 가드 직접 테스트:** allow(신선 스모크)·block(아티팩트 부재 exit 2)·loop-guard(stop_hook_active) 3경로 확인.
- Latest results: 위 전부 통과. cache-headers 회귀 테스트(직전 커밋 49e6810)도 4 GREEN 유지.
- **정직 기록(반복 실수):** /dashboard "한 줄이면 끝"이라던 1차 단정은 **틀렸다** — 실제 앱을 안 띄우고 부분 grep만 했다. valueStyle·List 2개를 사용자가 잡아냈다. 교훈을 기계강제(Stop 훅)로 박았다. cf. [[feedback-ui-completion-requires-dev-server]].
- Known failures: none.
- Skipped checks and reason: 전체 `pnpm test`/`lint`/clean build — 본 변경은 스크립트/테스트/문서 한정이고 dev 서버 실행 중이라 clean build는 M5 정신상 회피(focused 테스트 + typecheck로 대체). 통합 게이트 full 실행은 커밋 직후 권고.
- Cross-model review: degraded — 단일 세션 구현. validate-the-validator(단위 RED→GREEN + 라이브 arm exit-code)로 대체 증거 확보. 한글 카피 mojibake로 codex 부적격(see codex-review-mojibake-windows); 후속 Claude 리뷰어 적대 검수 권고(M2-M5 v4.2 전례).
- UX/UI Consistency Pass: passed
  - Tokens: passed | `var(--app-color-border)`(승인 9 중) + Flex gap 토큰(small/middle); 신규 매직넘버 0 (M4 PASS).
  - Components: passed | deprecated `List`→`Flex`(stable)·`Statistic valueStyle`→`styles.content`; AppCard 스코프 무관, 미터치 부채 없음.
  - A11y: passed | `role=list/listitem`로 ul/li 시맨틱 보존; view 링크 tab 포커스·focus-visible 기본·대비(토큰 불변)·라벨(Tag+점수 텍스트) 유지.
  - Responsive: passed | M1 실제앱 /dashboard @360/768/1280 전부 ok=true·가로스크롤/오버레이 없음·Flex wrap; 스크린샷 3장 docs/ui-redesign/pilot-shots/.
- QA Gate: passed | 로컬 dev(재사용) 실제 인증 /dashboard 진입 + 콘솔 캡처, antd deprecation 0건(3뷰포트). M1 아티팩트 smoke-result.json.

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
- Follow-up needed: (a) 게이트 코드 적대 cross-review, (b) M1/M3 CI 배선(브라우저+인증 — 여전히 미배선; M4·M6는 배선됨), (c) 전체 sweep은 클러스터 확장 시 훅+M1로 자동 청산, (d) Stop 훅 팀 도입 후 다른 기여자 마찰 모니터링(우회=`.smoke-skip`).
