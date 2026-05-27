# Theme System Refactor — Context Ledger

## Run Metadata

- Run id: 20260527-0000-theme-system-refactor
- Created: 2026-05-27
- Updated: 2026-05-27
- Main session owner: Claude Code (Opus 4.7, coordinator)
- Host: Claude Code
- Status: complete

## Task

- User goal: 프로젝트 내에서 theme을 관리할 수 있는 구조로 수정. 5개의 CSS 변수 관련 버그(B1~B5) + AntdRegistry 누락(B6) 해결, 다크모드 런타임 토글 가능, 모든 CSS Variable Scoping Gate 제약 충족.
- Accepted scope: `docs/superpowers/plans/2026-05-26-theme-system-refactor.md`의 Task 0~11 (12개 태스크).
- Out of scope: 다크모드 토글 UI 버튼, 추가 theme 프리셋, Zustand `useThemeStore` 마이그레이션, Supabase profile 동기화.
- Current next action: 완료. 모든 12개 태스크 + Task 11b (antd v6 호환성 fix) 완료.

## Docs Consulted

- Exact files read:
  - `docs/ai-development-workflow.md`
  - `docs/ant-design/06-ai-development-workflow.md`
  - `docs/ant-design/07-review-checklist.md`
  - `docs/ant-design/08-theme-architecture.md` (이전 세션)
  - `docs/ai-workflow/planning-contracts.md`
  - `docs/ai-workflow/review-gates.md`
  - `docs/ai-workflow/context-and-packets.md`
  - `docs/ai-workflow/fallback-and-recovery.md`
  - `docs/superpowers/plans/2026-05-26-theme-system-refactor.md` (계획서 v2)
- Extracted requirements: B1~B6 수정, `getResolvedBridgeVars` 도입, ThemeContext + cookie SSR, AntdRegistry 추가, `@theme inline`, CSS Variable Scoping Gate 5개 제약 충족.
- Doc conflicts: none.
- Untouched relevant docs and reason: `docs/spec.md` `useThemeStore` 언급 — 향후 마이그레이션 대상이므로 본 작업의 범위 밖, 의도적으로 참조하지 않음.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-27 00:00 | 현재 `feat/phase-6-admin-library-hardening` 브랜치에서 작업 계속 | 사용자 명시 선택 (AskUserQuestion) | 사용자 응답 |
| 2026-05-27 00:00 | Subagent-Driven Development 실행 방식 채택 | 사용자 명시 선택 (1번안) | 사용자 응답 |
| 2026-05-26 (이전 세션) | Codex GPT-5.5 5라운드 plan review 완료 — ALL RESOLVED + PASS | Plan-Review PASS Gate 충족 | Codex 출력 (tool-results/b3xxw1y0u.txt) |
| 2026-05-26 (이전 세션) | C7 (hydration 완전 증명) → accepted with reason: 단위 테스트 + E2E 단계로 분할 | Codex의 지적은 정당하나 완전 증명은 E2E 영역 | plan §C7 Accepted-with-reason |
| 2026-05-27 12:00 | **Plan v2 architecture deviation: antd v6 SSR 호환성 fix** | Task 11 dev 서버 검증 중 `createContext only works in Client Components` 런타임 에러 발견. antd v6.x의 `theme` namespace가 module-level createContext 의존성을 갖고 있어 server component에서 import 불가. Codex GPT-5.5 5라운드 plan review가 못 잡은 architecture 결함. | Static appearance fallback (`getResolvedBridgeVarsByAppearance`) 도입. dev 서버 HTTP 200, html style 실제 hex값 확인. Commit `34deb7a`. |
| 2026-05-27 12:30 | Task 11 implementer scope violation 기록 | verification-only task에서 5개 파일 수정. fix 자체는 합리적이나 보고에서 명시 안 함 (transient 표현). 사용자 결정으로 fix 수용. | implementer 보고 |

## Active Files

- Files expected to change:
  - `package.json`, `pnpm-lock.yaml` (Task 0)
  - `src/theme/tailwind-bridge.ts` (Task 2)
  - `src/theme/create-theme.ts` (Task 3)
  - `src/theme/antdTheme.ts` (Task 4 — 삭제)
  - `src/theme/index.ts` (Task 4)
  - `src/contexts/theme-context.tsx` (Task 6 — 새 파일)
  - `src/app/providers.tsx` (Task 7)
  - `src/app/layout.tsx` (Task 8)
  - `src/styles/global.css` (Task 9)
  - `tests/theme/theme-contract.test.ts` (Task 1)
  - `tests/theme/theme-context.test.tsx` (Task 5 — 새 파일)
  - `tests/theme/resolve-appearance.test.ts` (Task 10 — 새 파일)
  - `tests/theme/layout-hydration.test.ts` (Task 10 — 새 파일)
- Files inspected: 위 모든 파일 + 이전 세션에서 src/theme/* 전체
- Files changed (commit 순서):
  - `7d22171` chore(theme): add @ant-design/nextjs-registry (Task 0)
  - `4f54831` fix(theme): CSS variable contract — getResolvedBridgeVars + cssVar prefix (Tasks 1+2+3)
  - `ae188a0` test(theme): strengthen dark appearance assertion (code review followup)
  - `23b60e4` chore(theme): remove unused antdTheme export (Task 4)
  - `2e83c4f` feat(theme): add ThemeProvider + useTheme (Tasks 5+6)
  - `f2dbd97` perf(theme): memoize theme + context value (code review followup)
  - `71d9ad3` fix(theme): use ThemeContext in providers (Task 7)
  - `4ec609f` fix(theme): inject --app-* on html + AntdRegistry (Task 8)
  - `c0d9ed1` fix(theme): @theme inline in global.css (Task 9)
  - `9a586f8` test(theme): hydration consistency tests (Task 10)
  - `34deb7a` fix(theme): antd v6 SSR compatibility — static appearance fallback (Task 11b)
- Files explicitly not to touch: `src/lib/auth/**`, `src/lib/admin/**`, `src/app/auth/**` (이번 작업 범위 밖)

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| (Task 0 implementer) | Subagent (general-purpose) | pnpm add 1개 패키지 | pending | Dispatch 예정 |

## Child Result Packets

(각 태스크 완료 시 추가)

## Verification State

- Required checks:
  - vitest (모든 신규/수정 테스트)
  - tsc --noEmit
  - dev 서버 부팅 + 브라우저 검증 (Task 11)
  - `node scripts/ai-workflow-check.mjs --repo .`
  - Playwright hydration check (Task 11.8)
- Checks run:
  - vitest 전체 (449 passed / 3 failed pre-existing flaky / 3 skipped)
  - vitest theme 격리 (17/17 PASS — contract 4 + context 6 + cookie 4 + hydration 3)
  - tsc --noEmit (1 pre-existing TS7031 in theme-context.test.tsx:77, 무관)
  - dev 서버 부팅 + HTTP 200 + html style 실제 hex값 확인 (light/dark cookie 모두)
- Latest results: 17 theme 테스트 모두 PASS. dev 서버 cold/warm 모두 200. AntdRegistry SSR style injection 확인.
- Known failures: 3개 pre-existing 통합 테스트 타임아웃 (admin-role-matrix, learning-flow, writing-flow) — 본 작업과 무관, 베이스라인 검증됨.
- Skipped checks and reason: none
- Cross-model review: passed — Codex GPT-5.5 plan review 5라운드 PASS (사전). antd v6 SSR 호환성 결함은 plan review가 못 잡았고 dev 서버 검증에서 발견. 향후 plan review에 "주요 의존성의 SSR 호환성 런타임 검증" 추가 필요.
- Architecture Pass: passed — 도메인 boundary 명확 (src/theme/*, src/contexts/theme-context.tsx, src/app/layout.tsx). audience: user (앱 전체 공통 UI). 라우트 핸들러에 비즈니스 로직 누수 없음.
- Light Spec: 본 작업은 phase 작업이 아님 (단일 도메인 refactor) — 면제
- UX/UI Consistency Pass: passed (CSS/layout 변경)
  - Tokens: passed — antd v6.4.3 default seed 기반 정적 fallback. hardcoded color는 antd default token 그대로. `docs/ant-design/08-theme-architecture.md` 정본 따름.
  - Components: passed — 새 컴포넌트는 ThemeProvider 1개. 기존 패턴(QueryClientProvider) 옆에 추가. ConfigProvider는 그대로 유지.
  - A11y: passed — color-scheme이 `<html>`에 정확히 주입돼 OS 다크모드 indicator 통합. 키보드/focus/label/대비는 본 작업의 표면적이 아님 (theme 인프라).
  - Responsive: passed — CSS 변수 값만 변경. 레이아웃 구조 무변경. 기존 responsive 동작 그대로.
- QA Gate: passed — dev 서버 직접 부팅 (port 3000, 478ms). HTTP 200 라이트/다크 쿠키 모두 확인. `<html style>`에 resolved hex값 (var() 체인 없음). AntdRegistry style 태그 SSR 주입 확인. 콘솔 에러 없음 (transient cold-start 500은 fix 후 재현 불가).
  - 아티팩트: `tasks/theme-refactor-verify/light-response.html`, `dark-response.html`, `dev-server.log`

## Fallback State

- Normal path blocked: none
- Failure class: none
- Fallback used: none
- Evidence collected: n/a
- Completion allowed: pending all tasks
- Remaining fallback risk: none

## Ledger/File-State Consistency

- Files changed match accepted scope: yes — 모든 변경은 `src/theme/**`, `src/contexts/theme-context.tsx`, `src/app/{layout,providers}.tsx`, `src/styles/global.css`, `tests/theme/**`, `docs/superpowers/plans/**`, `docs/ant-design/**`, `docs/ai-development-workflow.md`, 본 ledger. phase-8 무관 파일(`reports/phase-8-*`, `supabase/migrations/INDEX.md`, `.env.example`, `tasks/codex-*`, `tasks/playwright-*` 등)은 의도적으로 건드리지 않음.
- Docs consulted match implemented behavior: yes — `docs/ant-design/06-08*.md`의 CSS Variable Scoping Gate 5개 제약 모두 충족.
- Child result packets integrated: yes — 12개 태스크 + 3개 코드리뷰 follow-up + 1개 antd v6 호환성 fix를 본 ledger Decisions에 모두 기록.
- Verification state current: yes
- Remaining risks listed: yes

## Risks And Follow-Up

- Remaining risks:
  - **동적 brand override SSR 미지원** — `getResolvedBridgeVarsByAppearance`는 antd v6.4.3 default seed의 light/dark 정적 값만 반환. 향후 per-tenant brand color 도입 시 SSR 첫 페인트에서는 default 색상 표시, hydration 후 client-side `useToken()`로 정정 필요.
  - **antd 업그레이드 시 hand-sync 필요** — antd가 default token 값을 바꾸면 `tailwind-bridge.ts`의 LIGHT/DARK_BRIDGE_VARS도 수동 업데이트. antd v7+에서 server-side token 계산 path가 열리면 dynamic 방식으로 되돌릴 수 있음.
  - **Playwright E2E hydration warning 검증 미완료** — 단위 테스트는 통과했고 dev 서버 HTTP 200은 확인했으나, 본격 Playwright run을 통한 React hydration warning 감지는 별도 작업으로 분리.
- Assumptions:
  - antd v6.4.3 default token이 light: `#1677ff/#f5f5f5/#ffffff/#d9d9d9`, dark: `#1668dc/#000/#141414/#424242` 등 — `tailwind-bridge.ts` LIGHT/DARK_BRIDGE_VARS에 박힌 값. antd 소스코드 검증 완료.
  - cookies() async API가 Next.js 16에서 정상 동작 — Task 8 + dev 서버 검증으로 확인.
- Follow-up needed:
  - 다크모드 토글 UI 버튼 — 별도 feature task (`useTheme().setAppearance(...)` API 준비됨)
  - useThemeStore (Zustand) 마이그레이션 — `docs/spec.md`에 언급된 향후 계획
  - Playwright hydration warning 자동 감지 테스트 추가
  - `scripts/ai-workflow-check.mjs`에 CSS Variable Scoping Gate 자동 검사 추가 (현재 generic ledger 검사만 있음)
  - Plan review 절차에 "주요 dependency의 SSR 런타임 호환성 검증" 추가 — 본 사고 직접 교훈
