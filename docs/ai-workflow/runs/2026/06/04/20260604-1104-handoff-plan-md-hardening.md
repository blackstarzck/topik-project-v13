# Context Ledger / HANDOFF — PLAN.md 강화 → 파일럿 재실행 → Wireframe 확장

> **이 문서는 다른 세션이 이어받기 위한 HANDOFF다.** 아래 "RESUME — 다음 세션이 할 일"부터 읽어도 된다.

## Run Metadata
- Run id: 20260604-1104-handoff-plan-md-hardening
- Created: 2026-06-04 11:04 +09:00
- Updated: 2026-06-04 11:04 +09:00
- Main session owner: Claude Code (Opus 4.8) → 다음 세션으로 인계
- Host: Claude Code
- Status: paused (Phase A 착수: M2 게이트+B1 완료, PLAN.md 보완은 헤더만 시작)
- Branch: 작업 시작 시 `docs/auth-overview-consolidated-reference` (재개 전 `git branch --show-current`로 확인)
- 커밋 상태: **아무것도 커밋 안 함.** 모든 변경은 working tree에 있음.

## Task
- 승인된 계획 파일: **`C:\Users\admin\.claude\plans\refactored-knitting-dragonfly.md`** (이게 마스터 플랜. 먼저 읽을 것.)
- 한 줄 목적: `docs/ui-redesign/PLAN.md`(=AI 자동검수 실행 문서)를 1차 실행이 실패한 교훈으로 **강화**하고
  → 강화된 PLAN.md로 **파일럿(로그인+대시보드) 재실행**해 완성도를 높이고 → 검증된 PLAN.md를
  **나머지 `docs/Wireframe/`(37개) 적용 기준**으로 쓴다.
- 핵심 전환(사용자가 끌어낸 가장 깊은 결론): **"에이전트가 문서를 읽게" 강제하지 말고, 안 읽으면 그
  결과가 실제 코드·런타임에서 기계적으로 FAIL나게 만든다.** 판정 원천 = 내가 적은 ledger가 아니라
  **기계가 관찰한 현실**. 완료는 게이트 명령의 **종료코드(+CI)** 로 잠근다(에이전트의 "됐다"는 권한 없음).
- 제약: **"단계마다 승인"**(각 단계 끝에 사용자 승인). admin 동결(`src/components/admin/**`,
  `src/app/(workspace)/admin/**` 편집 금지). 신규 DB 스키마 금지.

## 왜 이렇게 됐나 (배경 — 다음 세션이 맥락을 알도록)
1. v3.3 PLAN.md로 파일럿을 1차 실행 → "검증 완료, 74/74"로 보고됨.
2. 사용자가 `pnpm dev`로 직접 보니 실제 문제 발견:
   - **#5 (치명):** `dashboard/loading.tsx`가 서버 컴포넌트인데 `<Skeleton.Button>` 렌더 → RSC에서 antd
     복합 하위가 `undefined` → 런타임 "Element type is invalid".
   - antd v6 deprecation 경고: `Space direction`(→`orientation`), `Drawer width`(→`size`).
   - 랜딩(`/`)의 stale 에러 — `pnpm dev` 살아있는데 `pnpm build` 2회 → `.next` 오염("(stale)" 배지).
   - PLAN.md "인라인 매직넘버 → 토큰/공통부품"을 건너뜀 + 새 파일에 새 매직넘버 추가.
3. 근본 원인: **문서를 선택적으로 읽고/따랐고(예: #14 `"use client"`가 이미 있었는데 loading.tsx에 미적용),
   그걸 잡을 기계 게이트가 없었다.** + 검증을 prod·미리보기 2페이지·jsdom으로만 함(dev·실제 라우트 누락).
4. gpt-5.5(codex) 교차검토(적대적 렌즈 3 + 합의 1)로 보완안을 검증 → 승인된 마스터 플랜이 됨.

---

## RESUME — 다음 세션이 할 일 (순서대로, 단계마다 승인)

### 이미 완료(DONE) — 재작업 금지
- **M2 RSC 가드** 구현 완료: `scripts/ai-workflow-check.mjs`에 `checkRscCompoundRender()` + 워커 배선
  (`RSC_ENTRY_PATTERN` = `src/app/**/{page,layout,loading,error,not-found,template}.tsx`).
  단위테스트 12/12 GREEN (`tests/scripts/ai-workflow-check.test.ts`).
  **validate-the-validator 증명됨:** 가드가 실제 `loading.tsx:25`의 `Skeleton.Button`을 FAIL로 잡았음.
- **B1 완료:** `src/app/(workspace)/dashboard/loading.tsx` 맨 위에 `"use client"` 추가 → M2 GREEN,
  DashboardLoading 테스트 2/2, typecheck 0. (단, **실제 dev에서 /dashboard 재렌더 검증은 아직 안 함** — M1 몫.)
- **PLAN.md 헤더만** v4.0으로 갱신(상태/개정일 줄). **본문 보완은 미착수.**
- 이전 세션 산출물(파일럿 1차): `DESIGN.md`, `src/components/shared/{AppCard,AppDrawer,PageContainer,PageHeader,PublicShell}.tsx`,
  `tests/theme/theme-bridge-parity.test.ts`, 셸/랜딩 `--app-bg`/`--app-border` 정리, `global.css` reduced-motion,
  `dev-preview/dashboard` 픽스처, 스크린샷 12장. (이건 이미 있음. 단, 위 #5/deprecation/인라인 문제가 남아 있었음.)

### 남은 작업 (TODO)

**A. PLAN.md 보완 (지금 진행 중 — 본문 미완료. 다음 세션의 1순위.)**
`docs/ui-redesign/PLAN.md`에 아래 7개 명세 결함 수정 + 강제성(A0) 원칙을 박는다(헤더는 이미 v4.0):
1. **Phase 2 검증(라인 ~148):** "prod `next start` + `/dev-preview/dashboard`·`/login`"
   → **"개발 모드(`pnpm dev`) + 변경이 닿는 실제 라우트(`/`, 인증 `/dashboard`(그 `loading.tsx` 포함), `/login`)"**.
   (prod는 dev 경고를 숨기고, dev-preview는 실제 대시보드가 아님 — 최대 결함.)
2. **검증 라우트 손선택 → diff에서 기계 도출**(특수파일+공유컴포넌트 역참조). 완료 보고는 스모크 산출물에서
   자동 생성, 부분 커버리지면 FAIL, 손으로 쓴 "검증함" 금지. (M1+M3)
3. **`loading.tsx`/스켈레톤 지시(라인 ~98·146):** 복합 antd(`Skeleton.Button` 등)는 **`"use client"` 필수** 명시
   + M2 가드로 기계 강제. (#14 규칙이 이미 있으나 loading.tsx에 미적용이었음 → 명문화.)
4. **"인라인 매직넘버 → 토큰/공통부품"(라인 ~145):** DoD 항목화 + **M4 기계 검사**(탈출구·토큰면제 포함).
5. **빌드 위생(Hard Rule):** "dev 중 build 금지"를 **M5 사전점검**으로 강제 + "build→`.next` 삭제→dev" 복구 명문화.
6. **validate-the-validator** 원칙 추가: 각 게이트는 실제 결함을 잡는지 먼저 증명.
7. **jsdom 통과 ≠ 완료**(라인 ~140 TDD): jsdom은 RSC 경계 버그 못 잡으니 실제 라우트 dev 렌더로 보완 명시.
   + **A0 강제성 절 신설**(문서 앞부분): 판정=기계가 현실 관찰, 완료=게이트 종료코드/CI, ledger는 게이트 출력의 사본.
   + 버전 changelog(부록 A)에 v4 항목 추가.

**B. 게이트 구현 (PLAN.md가 요구하는 것을 실제로 만든다)**
- **M5 빌드 위생:** dev 떠 있을 때 `pnpm build` 거부/경고 사전점검(`scripts/`). 저비용·먼저.
- **M1 개발-모드 스모크 (가장 큰 작업):** `scripts/dev-route-smoke.mjs` — **인증 storage-state 시드** +
  `pnpm dev` 부팅 + `/`·`/login`·실제 `/dashboard`(+`loading.tsx`) 360/1280에서 콘솔 에러·런타임 오버레이·
  스크린샷 수집 → 산출물(`{baseSha,headSha,changedFiles,requiredRoutes,testedRoutes,perRouteResult}`) 저장.
  - **여기서 #5의 실제 dev 재검증이 이뤄진다**(아직 안 됨). 랜딩 `/`의 stale 에러도 `.next` 정리 후 재확인.
- **M3 보고=증거:** `ai-workflow-check.mjs`에 — 검증 섹션을 M1 산출물에서 생성, 손으로 쓴 "검증함" 금지,
  `testedRoutes ⊊ requiredRoutes`면 FAIL. **좁힌 커버리지에서 FAIL로 먼저 증명.**
- **C1 라우트 도출:** `scripts/derive-smoke-routes.mjs --base <sha>` — `git diff`→필요 라우트(특수파일+역참조).
- **M4 인라인-스타일 델타 가드:** 터치 파일 신규 인라인 숫자 리터럴(`width/height/padding*/margin*/gap/borderRadius/inset`)만,
  토큰/상수·`opacity/zIndex/flex*` 면제, `// ai-check: allow-inline-number <사유>` 탈출구.

**C. 파일럿 재실행 (강화된 PLAN.md 기준) — 버그 보수 + dev 재검증**
- **B2:** `Space direction`→`orientation`, `Drawer width`→`size`(size가 240px를 못 담으면 사유 달고 width 유지).
  대상: `loading.tsx`, `DashboardBody/KpiSummary/Recommendations/AlertsCard`, `AppDrawer`/`WorkspaceShell` 등.
- **B3:** 파일럿 파일의 인라인 매직넘버 토큰화(M4 통과). 대상(grep `style={{` 결과):
  `app/login/page.tsx`(3), `dashboard/loading.tsx`(4), `dev-preview/dashboard/page.tsx`(1),
  `DashboardKpiSummary.tsx`(8), `DashboardRecommendations.tsx`(6), `DashboardAlertsCard.tsx`(2).
- `.next` 정리 후 **dev**로 `/`·인증 `/dashboard`(+loading)·`/login` 재검증(M1) → 콘솔 0, 런타임 0, 스크린샷.

**D. 문서·CI·확장**
- `docs/ai-workflow/review-gates.md` / `ai-development-workflow.md`에 게이트·허용목록 문서화.
- `.github/workflows/ai-workflow-check.yml`에 새 검사 반영(CI 독립 재실행 = 강제성의 핵심).
- 검증된 PLAN.md로 나머지 Wireframe 클러스터 확장(auth/onboarding→practice→writing→…, admin 제외).

---

## 핵심 함정·교훈 (다음 세션이 반복하지 말 것)
- **codex(gpt-5.5) 호출 시 `< /dev/null` 필수.** 안 붙이면 "Reading additional input from stdin..."로 매달림.
  그리고 codex stdout을 다른 명령(PowerShell `Select-Object` 등)에 **파이프하지 말 것**(broken pipe panic). `> file`로 받아서 Read.
- **codex는 Windows에서 한글/em-dash(`—`)를 mojibake** → 한글 카피 판단 불가. 영어 산출물만 codex 검토, **한글은 Claude 리뷰어**.
  (1차 때 codex가 `"—"`/한글을 "문자열 미종료"로 오판한 [P1] 2건은 거짓양성이었음.)
- **`python` 없음** — Windows Store 스텁(exit 9009). `py` 런처 사용(Python 3.14.3).
- **`pnpm dev` 살아있을 때 `pnpm build` 금지.** `.next` 오염 → "(stale)" 가짜 에러. 복구: dev 정지→`.next` 삭제→dev.
- **jsdom 테스트는 RSC 서버/클라 경계 버그를 가짜로 통과시킨다.** loading.tsx 테스트가 통과했지만 실제 dev에선 #5가 났음.
- **M2 가드 설계(이미 구현):** 서버 파일에서 `<Antd.Member>` JSX 렌더만 좁게. 훅(`.useX`)·`import type`·plain `<Antd/>` 제외.
  거짓양성 0 위해 `RSC_ENTRY_PATTERN`(라우트 특수파일)로 스코프. (gpt-5.5 lens1 권고.)
- **`/dev-preview/dashboard`는 PUBLIC_PATHS에 추가돼 prod에서 무인증 접근됨**(파일럿 스캐폴딩) → 확장 전 제거/플래그 필요.
- **08 폴더 리스팅 drift:** `antdTheme.ts`/`presets/liquid-glass.ts`는 실제로 없음(문서만). 별도 정리 follow-up.

## Docs Consulted
- Exact files read: `docs/ui-redesign/PLAN.md`, `C:\Users\admin\.claude\plans\refactored-knitting-dragonfly.md`(승인 플랜),
  `docs/ant-design/08-theme-architecture.md`, `02/03/05/07`, `docs/ai-development-workflow.md`, `docs/agent-index.md`,
  `docs/user-communication-style.md`, `docs/Wireframe/{02-A-02-login,04-B-01-home-dashboard}/description.md`,
  `scripts/ai-workflow-check.mjs`, `src/app/(workspace)/dashboard/loading.tsx`, `src/proxy.ts`, `src/lib/routes.ts`,
  `errors/*.png`(사용자 제공 5장), 이전 ledger `2026/06/02/20260602-2058-ui-redesign-pilot-autocheck.md`.
- Extracted requirements: 위 RESUME A의 7개 결함 수정 + A0 강제성 + 게이트 M1~M5.
- Doc conflicts: none (PLAN.md를 사용자 지시로 강화하는 것).
- Untouched relevant docs and reason:
  - `docs/spec.md`/`prd.md` — 제품 동작 변경 아님(게이트/검증 인프라 + 버그 보수).
  - `docs/Wireframe/` 나머지 35개 — 확장(C) 단계 전까지 불필요.

## Active Files
- 이번 세션이 바꾼 것(THIS run): `scripts/ai-workflow-check.mjs`(M2 추가), `tests/scripts/ai-workflow-check.test.ts`(M2 테스트),
  `src/app/(workspace)/dashboard/loading.tsx`(use client), `docs/ui-redesign/PLAN.md`(헤더 v4.0만).
- 이전 세션(파일럿 1차)이 바꾼 것: `DESIGN.md`, `src/components/shared/*`, `src/theme/components/shared.ts`,
  `src/styles/global.css`, 셸/헤더/랜딩 var 정리, `DashboardHeader/KpiSummary/Recommendations/AlertsCard`,
  `app/login/page.tsx`, `dev-preview/dashboard/page.tsx`, `tests/theme/*`, `docs/ant-design/08`, 스크린샷 12장.
- **내가 만들지 않은 working-tree 변경(이전의 다른 세션 = dev 캐시 수정):** `next.config.ts`, `next-env.d.ts`,
  `src/app/layout.tsx`, `tests/integration/cache-headers.test.ts`. **건드리지 말 것**(내 작업 아님).
- 절대 금지: `src/components/admin/**`, `src/app/(workspace)/admin/**`.

## Verification State
- Required checks(최종): `pnpm test`/`lint`/`typecheck`/(clean)`build` + `node scripts/ai-workflow-check.mjs --repo .`
  + **개발-모드 스모크(M1)** + validate-the-validator(M2·M3 증명) + admin diff 빈 출력.
- Checks run(이번 세션): M2 단위테스트 12/12, M2 validate-the-validator(loading.tsx 적발→수정 후 GREEN),
  DashboardLoading 2/2, typecheck 0.
- Known failures: 없음(단, **M1 미구현 → 실제 dev 재검증 미완료**; B2/B3/PLAN.md 본문 미완료).
- Cross-model review: codex(gpt-5.5) 3렌즈+합의로 마스터 플랜 검증 완료. 코드 변경(M2 등)은 한글 무관 → 다음 세션에서 codex 재검 가능.
- UX/UI Consistency Pass: in progress — 파일럿 재검증(M1) 후 4줄 증거 채울 것.
  - Tokens: in progress — DESIGN.md↔src/theme parity는 GREEN(19/19), 컴포넌트 토큰 적용 검증 필요.
  - Components: in progress — AppCard/AppDrawer 적용됨, 인라인 정리(B3) 후 재확인.
  - A11y: in progress — M1 dev 스모크에서 확인.
  - Responsive: in progress — M1 360/1280 확인.
- QA Gate: degraded — 작업 paused 중 | M2 게이트는 증명 완료이나 M1 dev 스모크 미구현 | 잔여위험: #5는 소스+가드 완료지만 실제 dev /dashboard 재렌더 미검증.

## Ledger/File-State Consistency
- Files changed match accepted scope: yes (M2 게이트 + B1 + PLAN.md 헤더).
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: not applicable (단일 세션, codex는 read-only 자문).
- Verification state current: yes.
- Remaining risks listed: yes (아래).

## Risks And Follow-Up
- Remaining risks: M1 미구현으로 실제 dev 재검증 안 됨(#5 소스 수정은 됐으나 라이브 확인 필요). PLAN.md 본문 보완 미완료.
  `/dev-preview` prod 노출. 08 폴더 리스팅 drift. 커밋 안 됨(working tree 보존 필요).
- Assumptions: 다음 세션도 같은 repo·branch에서 working tree 유지하고 이어받음.
- Follow-up: RESUME 순서대로 A(PLAN.md 본문)→B(M5/M1/M3/C1/M4)→C(B2/B3 + dev 재검증)→D(문서·CI·확장).
