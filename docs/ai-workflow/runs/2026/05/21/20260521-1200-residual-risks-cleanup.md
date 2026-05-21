# Residual Risks Cleanup Ledger

## Run Metadata

- Run id: 20260521-1200-residual-risks-cleanup
- Created: 2026-05-21 12:00 KST
- Updated: 2026-05-21 12:00 KST
- Main session owner: Claude Code (Opus 4.7, 1M context)
- Host: Claude Code
- Status: complete

## Task

- User goal: Phase 1·2·3 보고서가 적어둔 7개 잔여 위험 + A1(docker-dependent 통합 테스트) 처리.
- Accepted scope: plan(`docs/ai-workflow/plans/20260521-residual-risks-cleanup.md`)의 9 task. 단 A1은 docker 부재로 코드-side 준비 + degraded 명시까지.
- Out of scope: 새 마이그레이션, 새 의존성, Phase 4 진입, e2e Playwright 셋업.
- Current next action: codex 사전 plan 리뷰 background 시작 → 그 사이 Task 1 진행.

## Docs Consulted

- Exact files read:
  - Phase 2·3 ledger 두 개 (잔여 위험 목록)
  - Phase 2·3 HTML 보고서 (Phase 4 이월 목록)
  - `docs/development/stack.md`, `deployment.md`
  - `docs/sitemap.md` (paywall/subscription 분류)
  - `supabase/migrations/INDEX.md` + 마이그레이션 14개 (types regen 시 deep read 예정)
  - `src/middleware.ts`, `src/lib/supabase/server.ts` (cache headers 변경 위치)
- Extracted requirements:
  - docker 부재이므로 A1는 코드-side 준비 + degraded
  - `@supabase/ssr` 0.10.x 시그니처는 변경 전 라이브러리 docs 확인
  - paywall/subscription billing scope는 `deferred-scope.md` 그대로
- Doc conflicts: none

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-21 12:00 | 7건 + A1 한 PR로 묶음 | 사용자 결정(AskUserQuestion) | conversation |
| 2026-05-21 12:00 | docker 부재로 A1 통합 테스트는 코드-side만 + ledger degraded | 사용자 결정(AskUserQuestion: docker 없음) | conversation |
| 2026-05-21 12:00 | ~~paywall/subscription을 `(workspace)` 밖으로 이동~~ **철회** (Codex 사전 리뷰 P1 #2가 Phase 3 light spec L8,L58-60 위반 지적). 이번 PR에서 빼고 Phase 4 이월 결정 (12:30 행 참조) | n/a — superseded | Codex 사전 리뷰 |
| 2026-05-21 12:00 | types regen은 manual hand-align (CLI 부재) | docker 부재 → supabase local stack 불가 → CLI gen types 불가 | 사용자 환경 |
| 2026-05-21 12:30 | Codex 사전 리뷰 VERDICT FAIL 반영 — scope 7→5건, 2건 Phase 4 이월 | Codex P1 #1 (Task 5 14 테이블 hand-align 위험) → 5 테이블 축소. Codex P1 #2 (paywall/subscription이 Phase 3 light spec L8,L58-60 위반) → C7 Phase 4 이월. Codex P2 #5 (cache headers 시그니처 추측 위험) → B5 Phase 4 이월. Codex P2 #6 → routes.ts 3 export split. Codex P2 #8 → TESTING.md + test:supabase:local script | Codex cleanup plan pre-review |
| 2026-05-21 14:00 | **워크플로우 갭 인정**: 사전 리뷰 FAIL → 보정 후 재리뷰 PASS 확인하지 않고 바로 구현. 같은 패턴이 Phase 2·3 사전 리뷰에도 있었음 (모두 FAIL → 반영 → 재리뷰 없이 구현). 사후 cross-model이 안전망 역할은 했지만 정석 워크플로우 위반 | 사용자 지적 → 시스템적 갭 식별 → docs/ai-development-workflow.md §3a "Plan-Review PASS Gate" 추가 + retrospective 재리뷰 진행 | 사용자 |
| 2026-05-21 14:00 | Codex retrospective 재리뷰 진행 — 보정된 cleanup plan에 대해 PASS/CONCERN/FAIL 확인 | 워크플로우 정합성 회복. 결과는 본 ledger의 Verification State에 기록 | 위 결정 |

## Active Files

- Files expected to change/create: plan §File Structure 참조
- Files inspected: 위 Docs Consulted + 마이그레이션 5개(`20260520120200_problems.sql`, `120300_attempts.sql`, `120600_recommendations.sql`) + 기존 `src/middleware.ts`(rename source) + `src/components/app/SidebarNav.tsx`(routes consumer)
- Files changed (이번 PR 종합):
  - `.env.example` (modify, A3 — placeholder 정리)
  - `src/lib/routes.ts` (new, C6 — 3 export split: PUBLIC_PATHS, PROTECTED_ROUTE_CASES, SIDEBAR_ITEMS+SIDEBAR_ADMIN_SECTION)
  - `src/components/app/SidebarNav.tsx` (modify — routes import + MenuProps cast 개선 Opus P2 #2)
  - `src/middleware.ts` (delete, B4)
  - `src/proxy.ts` (new, B4 — middleware.ts content + `proxy` export, Next.js 16 convention)
  - `tests/middleware/middleware.test.ts` (modify — import path src/proxy + 함수 이름 proxy)
  - `tests/integration/route-matrix.test.ts` (modify — routes.ts import + src/proxy 경로)
  - `src/lib/supabase/types.ts` (modify, A2 — 5 테이블 추가 + 헤더에 schema vs TS gap 노트 Opus P2 #4)
  - `package.json` (modify — `test:supabase:local` script + `cross-env` devDependency 추가 Codex P1 #1 fix)
  - `TESTING.md` (new — A1 docs + http URL 사용 범위 명시 Codex P2)
  - `docs/ai-workflow/plans/20260521-residual-risks-cleanup.md` (modify — Codex 사전 리뷰 7 findings 반영)
  - 이 ledger (modify)
- Files explicitly not to touch:
  - `supabase/migrations/*.sql` (schema 변경 없음)
  - `scripts/ai-workflow-check.mjs`, `selftest.mjs` (확정)
  - `AGENTS.md`, `CLAUDE.md`

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Claude Code Opus 4.7 (main) | 조정자 + 구현 | plan 전체 | complete | this ledger |
| codex (gstack) | plan 사전 리뷰어 | plan 단독 | complete | VERDICT FAIL (P1 #1 14→5 테이블, P1 #2 paywall 이월, P2 #3-#8 모두 반영) |
| Claude Code Opus 4.7 (subagent) | 사후 cross-model 1/2 | 구현 완료 diff | complete | VERDICT CONCERN (P1 cross-env 누락 → 같은 PR fix, P2 7건 반영) |
| codex (gstack) | 사후 cross-model 2/2 | 구현 완료 diff | complete | VERDICT CONCERN (P1 ledger stale → 본 행 갱신, P2 TESTING.md http URL → 명시 추가) |

## Child Result Packets

(미생성)

## Verification State

- Required checks:
  - `pnpm test`, `lint`, `typecheck`, `build`
  - `node scripts/ai-workflow-check.mjs --repo .`
- Checks run (최종):
  - `pnpm test` — 98 passed / 3 skipped (10 test files)
  - `pnpm typecheck` — PASS
  - `pnpm lint` — PASS
  - `pnpm build` — PASS (Proxy(Middleware) 출력, "middleware → proxy" deprecation warning 사라짐)
  - `node scripts/ai-workflow-check.mjs --repo .` — PASS
  - `pnpm install` — cross-env 추가 후 정상
- Latest results: ALL GREEN
- Known failures: none
- Skipped checks and reason:
  - 통합 테스트 2개(profile-trigger, rls-smoke) skip — docker 부재. degraded 명시. `TESTING.md`에서 활성화 방법 안내.
- Cross-model review: codex (gstack) — plan 사전 리뷰 FAIL(P1×2+P2×6) 반영 후 5건 처리 + 2건 Phase 4 이월 + 사후 Opus(CONCERN P1×1+P2×7) + 사후 Codex(CONCERN P1×1+P2×1). 양측 P1 모두 같은 PR fix(cross-env devDep 추가, ledger 갱신, TESTING.md 노트 추가, SidebarNav MenuProps cast, types.ts 헤더 gap 노트).
- Plan-Review PASS Gate (retrospective, docs/ai-development-workflow.md §3a 신규 룰) — **종결**:
  - **1st pre-review**: VERDICT FAIL (P1×2 + P2×6) — scope 7→5건, B5/C7 Phase 4 이월 결정
  - **2nd retrospective re-review**: VERDICT FAIL — task summary는 갱신됐으나 per-task detail body(Task 4/5/6)가 outdated 상태로 모순. plan body fix
  - **3rd re-review**: VERDICT CONCERN — task body 정합성 OK, 그러나 non-task prose(Architecture L7-10, Risks L162-167)가 outdated. prose fix
  - **4th re-review**: VERDICT CONCERN — Architecture/Risks OK, 그러나 Verification Strategy L164의 "paywall/subscription Static 표시" 검증 기대가 C7 이월과 모순. 1줄 fix
  - **5th re-review**: **VERDICT PASS** — plan globally consistent. cleanup PR plan gate finally closed.
  - Codex catch 가치: 매 round 다른 layer(scope summary → task body → prose narrative → verification strategy)의 모순을 잡음. 단일 round로 plan revision을 "충분히" 정합화하는 것이 사실상 어렵다는 증거. 향후 plan 작성 시 scope 변경은 처음부터 모든 layer를 함께 갱신해야 함을 학습.
- Architecture Pass: skipped — non-phase scope. 다만 verification grep 4종은 통과 확인됨 (직접 supabase import 0, SidebarNav 하드코드 0, route-matrix 하드코드 0, src/middleware.ts 삭제 확인).

## Fallback State

- Normal path blocked: docker 부재 → A1 통합 테스트 실제 실행 불가
- Failure class: degraded-mode
- Fallback used: A1는 코드-side 준비 + docs 안내까지, 실행은 사용자 환경
- Evidence collected: ledger에 명시
- Completion allowed: yes (fallback 인정 경로)
- Remaining fallback risk: 사용자가 docker 셋업 안 하면 RLS smoke + trigger integration 실제 검증이 누락된 채 phase 4 진입 가능. ledger와 보고서에 강조.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes — 5 위험 + Codex/Opus 추가 fix 모두 위 Active Files에 반영
- Docs consulted match implemented behavior: yes — 마이그레이션 5개 schema가 types.ts 5 테이블에 정확 매핑
- Child result packets integrated: yes — Codex 사전 리뷰 + Opus/Codex 사후 리뷰 모두 본 ledger에 통합
- Verification state current: yes
- Remaining risks listed: yes (아래)

## Risks And Follow-Up

- Remaining risks:
  - types.ts 5 테이블 hand-align 정밀도 갭(int → number, numeric(5,2) → number)은 의도적 — `supabase gen types` 출력과 동일. 헤더 주석에 명시. 위험 시 zod 검증을 fetch site에 추가.
  - Phase 4 진입 시 supabase CLI 도입되면 manual 타입을 즉시 regen으로 교체. 9개 미정의 테이블도 동시에.
- Assumptions:
  - 사용자는 docker 미가용 환경 그대로 유지 (변경되면 즉시 통합 테스트 실행 권장)
  - Next.js 16의 proxy 컨벤션이 middleware 동작과 호환 (이름만 변경)
- Phase 4 Follow-up (이 PR에서 의식적 이월):
  - **B5 cache headers** — `@supabase/ssr` 0.10.x setAll 추가 인자(예: response headers) 시그니처를 docker로 검증 후 `src/proxy.ts`, `src/lib/supabase/server.ts`에 반영. Codex 사전 P2 #5.
  - **C7 paywall/subscription `(workspace)` 밖 이동** — Phase 3 light spec L8,L58-60 위반 회피. 옵션 (a)(shell 안 유지) / (b)(spec 갱신) / (c)(자체 layout) 중 결정. Codex 사전 P1 #2.
  - **Dashboard supabase query/cache 최적화** — onboarding gate query를 cache headers와 짝지어 정비. Codex 사전 P2 #7 + Opus 사후 P2 #8.
  - **types.ts 9 테이블 추가** — writing/feedback/library/audit 도메인. Phase 5·6 진입 시 또는 supabase CLI regen으로.
  - **SUPABASE_LOCAL_STACK 통합 테스트 1회 수동 실행** — docker 환경 셋업 시.
- Follow-up needed (cleanup PR 종결 후 즉시):
  - 사용자가 `local-commit` 또는 `push-and-pr` 결정.
  - Phase 4 진입 — `docs/ai-workflow/light-specs/phase-4-learning-core.md` 작성 시 위 Follow-up 4건을 첫 task로 흡수.

## Git Publication Decision

- Git publication decision: pending (사용자 결정 대기)
- Reason: 사용자가 commit/push 시점을 결정
- Branch: main
- Upstream: origin/main
- Dirty scope: 위 Active Files 종합. cleanup PR 의도된 범위 그대로.
- Review status: cross-model 양측 완료 (사전 + 사후). 모든 P1 같은 PR fix.
- Verification status: PASS (test 98/98, lint, typecheck, build, workflow checker)
- Ledger: docs/ai-workflow/runs/2026/05/21/20260521-1200-residual-risks-cleanup.md (this)
- Fallback status: degraded — docker 부재로 SUPABASE_LOCAL_STACK 통합 테스트 skip. 코드-side 준비 완료.
- Next git action: 사용자 결정
