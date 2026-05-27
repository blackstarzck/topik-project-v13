# Theme System Refactor — Context Ledger

## Run Metadata

- Run id: 20260527-0000-theme-system-refactor
- Created: 2026-05-27
- Updated: 2026-05-27
- Main session owner: Claude Code (Opus 4.7, coordinator)
- Host: Claude Code
- Status: active

## Task

- User goal: 프로젝트 내에서 theme을 관리할 수 있는 구조로 수정. 5개의 CSS 변수 관련 버그(B1~B5) + AntdRegistry 누락(B6) 해결, 다크모드 런타임 토글 가능, 모든 CSS Variable Scoping Gate 제약 충족.
- Accepted scope: `docs/superpowers/plans/2026-05-26-theme-system-refactor.md`의 Task 0~11 (12개 태스크).
- Out of scope: 다크모드 토글 UI 버튼, 추가 theme 프리셋, Zustand `useThemeStore` 마이그레이션, Supabase profile 동기화.
- Current next action: Task 0 (pnpm add @ant-design/nextjs-registry) 디스패치.

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
- Files changed: (Task 진행 시 업데이트)
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
- Checks run: (Task 진행 시 업데이트)
- Latest results: pending
- Known failures: none yet
- Skipped checks and reason: none
- Cross-model review: passed — Codex GPT-5.5 plan review 5라운드 PASS (사전 검토). 구현 후 코드 레벨 cross-review는 finishing-a-development-branch 단계에서 진행.
- Architecture Pass: pending — Task 11 시점에 평가
- Light Spec: 본 작업은 phase 작업이 아님 (단일 도메인 refactor) — 면제
- UX/UI Consistency Pass: pending — Task 11 시점에 평가 (`src/styles/global.css`, `src/app/layout.tsx`, `src/theme/**` 변경 → UI 패턴 매칭)
  - Tokens: pending
  - Components: pending
  - A11y: pending
  - Responsive: pending
- QA Gate: pending — Task 11 시점에 dev 서버 직접 검증

## Fallback State

- Normal path blocked: none
- Failure class: none
- Fallback used: none
- Evidence collected: n/a
- Completion allowed: pending all tasks
- Remaining fallback risk: none

## Ledger/File-State Consistency

- Files changed match accepted scope: pending
- Docs consulted match implemented behavior: pending
- Child result packets integrated: pending
- Verification state current: yes
- Remaining risks listed: yes

## Risks And Follow-Up

- Remaining risks:
  - C7 (브라우저 hydration 완전 증명) — Playwright 검증으로 보완 예정 (Task 11.8)
  - `@ant-design/nextjs-registry`가 AntD v6 + cssVar 모드와 완벽히 호환되는지 — Task 0 후 dev 서버 검증으로 확인
- Assumptions:
  - `theme.getDesignToken()` API가 AntD v6.4.3에서 동작 (이전 세션 검증 완료)
  - cookies() async API가 Next.js 16에서 정상 동작
- Follow-up needed:
  - 추후 useThemeStore (Zustand) 마이그레이션 — 별도 작업
  - 다크모드 토글 UI 버튼 — 별도 feature task
