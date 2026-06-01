# Phase 3 — App Shell And IA Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TALKPIK이 27개 active sitemap route 전체에 thin placeholder 응답을 돌려주고, Ant Design 기반 보호 workspace shell + role-aware navigation + App Router 경계(loading/error/not-found) + onboarding/admin redirect 가드를 제공한다. 실제 페이지 콘텐츠는 Phase 4 이후가 채운다.

**Architecture:** Next.js Route Group `(workspace)`로 모든 보호 라우트를 묶고, 그 layout.tsx에 Ant Design `Layout`(Sider + Header + Content) 기반 shell을 둔다. role 체크는 `src/lib/auth/profile.ts`의 `getCurrentProfile()`에 집중하고, admin 진입은 `(workspace)/admin/layout.tsx`에서 한 곳 게이트. dynamic route는 `[id]` 형태로 placeholder. types는 17개 마이그레이션과 정합하도록 갱신(supabase CLI 가능 시 자동, 부재 시 manual).

**Tech Stack:** Next.js 16 App Router, React 19, Ant Design 6 (`ConfigProvider`, `App`, `Layout`), Tailwind v4(constrained), TypeScript 6, Vitest 4, Playwright 1.x(가능 시).

---

## Docs Consulted

- `docs/spec.md` (§Frontend Implementation Rules, §State Management Model)
- `docs/development/stack.md` (Ant Design 6, React 19, Vitest 4, Playwright)
- `docs/sitemap.md` (Target React Route Map — 27 active route + 5 modal surface)
- `docs/ia.md` + `docs/Wireframe/README.md` (32 IA 화면 인벤토리)
- `docs/Wireframe/{...}/description.md` 매칭 화면 (필요 시 task별로 읽음)
- `docs/flow/user-flow.md` (사용자 흐름 정본)
- `docs/ant-design/README.md` (UI 정책 — task별로 deep dive)
- `docs/domain-glossary.md` (도메인 폴더 매핑)
- `docs/ai-workflow/light-specs/phase-3-app-shell-and-ia-routes.md` (이 phase의 light spec)
- `supabase/migrations/INDEX.md` (17개 마이그레이션 — Database type regen 기준)
- Phase 2 cross-model review 결과 (이월 4건의 처리 결정 근거)

## Out of Scope — Intentional Cuts

| 제외 | 이유 |
| --- | --- |
| 실제 페이지 콘텐츠 | Phase 4·5·6 영역. |
| Sign-up/Login/Password-reset 실 UI 폼 | 별도 phase 또는 후속 PR. Phase 3는 placeholder. |
| 학습 데이터 fetch + TanStack Query 도입 | Phase 4. |
| 글쓰기 autosave/제출 흐름 | Phase 5. |
| Admin CRUD 본격 구현 | Phase 6. Phase 3는 admin route gate만. |
| Billing 통합 | `deferred-scope.md` 그대로. paywall/subscription placeholder. |
| @supabase/ssr cache headers 적용(Phase 2 Codex P2 #2) | 라이브러리 시그니처 추가 확인 필요. 별도 PR. |
| RLS smoke를 problem_attempts로 확장(Phase 2 Codex P2 #4) | problem seed가 Phase 4에서 도입되는 시점에. |
| 새 마이그레이션 | 17번까지가 정본. schema 손대지 않음. |
| 모든 보호 라우트에 자동 onboarding redirect | `/dashboard` + 핵심 진입에만. 나머지는 Phase 4가 정리. |
| 모바일 navigation drawer 완성도 | desktop sidebar + 모바일은 깨지지 않는 최소 수준. 본격 모바일 UX는 Phase 4. |

## Smallest Buildable Unit

types.ts regen(`profiles` + `learning_goals` 최소) + workspace shell layout + `/dashboard` placeholder(자체 onboarding gate 포함) — 로그인한 사용자가 `/dashboard`에 진입했을 때 sidebar + header + "Dashboard placeholder" 콘텐츠가 보이거나 학습 목표 없으면 `/onboarding/learning-goal`로 redirect되는 상태. 이게 가장 작은 ship-shaped 단위이고 나머지 26개 route는 이 패턴의 incremental 적용. `learning_goals`가 SBU에 포함되는 이유: Task 5/6의 onboarding gate가 query하므로 Task 1이 이 두 테이블의 타입을 먼저 박아야 함.

## File Structure

기존(Phase 1·2 산출):

| Path | 상태 | 비고 |
| --- | --- | --- |
| `src/app/page.tsx` (X-01 landing) | existing, verify only | Phase 1 산출. workspace shell 없이 plain. Phase 3 route matrix에서 200 응답 확인만. |
| `src/app/login/page.tsx` (A-02) | existing, verify only | Phase 2 placeholder. workspace shell 없음. matrix에서 anon 200 확인. |

Phase 3 신규/변경:

| Path | Responsibility |
| --- | --- |
| `src/lib/supabase/types.ts` (modify) | CLI 가능 시 17개 마이그레이션 전체 regen. CLI 부재 시 fallback은 **Phase 3가 직접 소비하는 `profiles` + `learning_goals`만** hand-align(전체 manual은 부담 + Phase 5/6에서 자연 확장). 우선순위: full CLI regen > Phase 3 minimum hand-align. |
| `src/lib/auth/profile.ts` (modify) | `getCurrentProfile()` 분리 추가 + `requireRole(allowedRoles: string[])` helper 추가. `bootstrapProfile`은 그대로. |
| `tests/lib/auth/profile.test.ts` (modify) | `getCurrentProfile()` + `requireRole()` 단위 케이스 추가. |
| `src/components/app/SidebarNav.tsx` (new) | 사이드바 메뉴. sitemap 메인 플로우 기반. role-aware. |
| `src/components/app/AppHeader.tsx` (new) | 헤더(앱 타이틀, 사용자 메뉴 placeholder). |
| `src/components/app/WorkspaceShell.tsx` (new) | Sider + Header + Content를 합친 client component. ConfigProvider/App provider는 root에서 이미 적용. |
| `src/components/shared/PlaceholderPage.tsx` (new) | 모든 placeholder page에 재사용. 화면 제목/IA 코드/Phase 안내. |
| `src/components/shared/AppLoading.tsx` (new) | suspense fallback 공용. |
| `src/components/shared/AppError.tsx` (new) | error boundary 공용. |
| `src/components/shared/AppNotFound.tsx` (new) | 404 공용. |
| `src/app/(workspace)/layout.tsx` (new) | workspace 부모 layout. `requireUser()` + onboarding gate(dashboard 진입 전 학습 목표 없으면 redirect). WorkspaceShell wrap. |
| `src/app/(workspace)/loading.tsx` (new) | shared loading. |
| `src/app/(workspace)/error.tsx` (new) | shared error. |
| `src/app/(workspace)/not-found.tsx` (new) | shared 404. |
| `src/app/(workspace)/dashboard/page.tsx` (new) | B-01 placeholder. |
| `src/app/(workspace)/growth/page.tsx` (new) | X-02. |
| `src/app/(workspace)/library/page.tsx` (new) | F-01. |
| `src/app/(workspace)/profile/page.tsx` (new) | X-05. |
| `src/app/(workspace)/settings/language/page.tsx` (new) | G-01. |
| `src/app/(workspace)/settings/notifications/page.tsx` (new) | X-09. |
| `src/app/(workspace)/practice/recommendations/page.tsx` (new) | C-01. |
| `src/app/(workspace)/practice/problems/page.tsx` (new) | C-02. |
| `src/app/(workspace)/practice/next/page.tsx` (new) | R-02. |
| `src/app/(workspace)/practice/weakness/page.tsx` (new) | X-07. |
| `src/app/(workspace)/writing/[questionId]/page.tsx` (new) | D-01~D-04 통합(`51`, `52`, `53`, `54`만 허용). |
| `src/app/(workspace)/writing/feedback/short/[id]/page.tsx` (new) | E-01. |
| `src/app/(workspace)/writing/feedback/long/[id]/page.tsx` (new) | E-02. |
| `src/app/(workspace)/writing/reports/[id]/compare/page.tsx` (new) | R-01. |
| `src/app/(workspace)/admin/layout.tsx` (new) | admin role gate. `app_role`이 `content_admin`/`platform_admin`이 아니면 `/dashboard` redirect. |
| `src/app/(workspace)/admin/problems/page.tsx` (new) | H-01. |
| `src/app/(workspace)/admin/org/page.tsx` (new) | X-08. |
| `src/app/(workspace)/admin/users/page.tsx` (new) | X-10. |
| `src/app/(workspace)/onboarding/learning-goal/page.tsx` (new) | A-03. |
| `src/app/(workspace)/subscription/page.tsx` (new) | X-04 shell. |
| `src/app/(workspace)/paywall/page.tsx` (new) | X-03 shell. |
| `src/app/sign-up/page.tsx` (new) | A-01 placeholder(공개 라우트). |
| `src/app/password-reset/page.tsx` (new) | X-06 placeholder(공개 라우트). |
| `tests/integration/route-matrix.test.ts` (new) | 모든 active route에 대해 unauth/auth 컨텍스트의 응답을 vitest로 검증. |
| `tests/lib/auth/profile-getCurrentProfile.test.ts` (new) | 새 helper 단위 케이스. |

## Tasks

| # | Task | Files | Audience | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- | --- |
| 1 | types.ts regen (CLI 가능 시 17 마이그레이션 full regen, 부재 시 profiles+learning_goals minimum hand-align) | `src/lib/supabase/types.ts` | n/a | N — 후속 task가 새 타입에 의존하므로 main session이 직접 |
| 2 | `getCurrentProfile()` 분리 + `requireRole(roles)` helper + 단위 테스트 (RED→GREEN) | `src/lib/auth/profile.ts`, `tests/lib/auth/profile-getCurrentProfile.test.ts` | both | N — `bootstrapProfile`과 같은 파일, 인터페이스 일관성 |
| 3 | WorkspaceShell + Sidebar + Header 컴포넌트 | `src/components/app/{WorkspaceShell,SidebarNav,AppHeader}.tsx` | user | Y — 독립 UI 컴포넌트 모음 (Task 4의 PlaceholderPage 인터페이스에 의존하지 않음) |
| 4 | shared UI primitives (PlaceholderPage, AppLoading, AppError, AppNotFound) | `src/components/shared/*.tsx` | both | Y — 독립. **Tasks 6-11의 prerequisite — Task 4의 PlaceholderPage props가 frozen된 후 6-11 시작.** |
| 5 | `(workspace)` route group layout + loading/error/not-found (onboarding gate는 Task 6의 dashboard page에서) | `src/app/(workspace)/{layout,loading,error,not-found}.tsx` | user | N — Task 2·3·4 결과 사용 |
| 6 | Dashboard(자체 onboarding gate) + growth + library + profile placeholder | `src/app/(workspace)/{dashboard,growth,library,profile}/page.tsx` | user | Y — Task 4 후 시작. dashboard만 learning_goals 조회 + redirect |
| 7 | Settings (language, notifications) placeholder | `src/app/(workspace)/settings/{language,notifications}/page.tsx` | user | Y — Task 4 후 시작 |
| 8 | Practice 그룹 placeholder (recommendations, problems, next, weakness) | `src/app/(workspace)/practice/{recommendations,problems,next,weakness}/page.tsx` | user | Y — Task 4 후 시작 |
| 9 | Writing 그룹 placeholder + dynamic route stub. `[questionId]` 검증(51-54), feedback/report id 검증은 **Phase 5의 data fetch와 함께 도입** | `src/app/(workspace)/writing/[questionId]/page.tsx`, `src/app/(workspace)/writing/feedback/short/[id]/page.tsx`, `src/app/(workspace)/writing/feedback/long/[id]/page.tsx`, `src/app/(workspace)/writing/reports/[id]/compare/page.tsx` | user | Y — Task 4 후 시작 |
| 10 | Admin layout 1차 게이트(learner 차단) + 3 admin placeholder(각자 `requireRole` 2차 게이트) | `src/app/(workspace)/admin/{layout,problems/page,org/page,users/page}.tsx` | admin | N — Task 2의 `requireRole` helper에 강결합 |
| 11 | Onboarding + subscription + paywall placeholder | `src/app/(workspace)/{onboarding/learning-goal,subscription,paywall}/page.tsx` | user | Y — Task 4 후 시작 |
| 12 | 공개 라우트 placeholder (sign-up, password-reset) | `src/app/{sign-up,password-reset}/page.tsx` | user | Y — middleware의 public allowlist에 이미 들어 있음, page만 추가 |
| 13 | route-matrix 통합 테스트 (모든 active route 응답 확인) | `tests/integration/route-matrix.test.ts` | both | Y — 모든 placeholder 완성 후 독립 검증 |
| 14 | 전체 검증 (pnpm test/lint/typecheck/build) | (전체) | n/a | N — main session 종합 |
| 15 | Architecture Pass | (전체 + ledger) | n/a | N — main session 판정 |
| 16 | Cross-model review (Opus + Codex 병렬) | (전체 diff) | n/a | N — packet 작성/통합 |

---

### Task 1 — types.ts regen

**Files:** `src/lib/supabase/types.ts`

- [ ] Step 1: supabase CLI 가용성 재확인. 있으면 local stack 가동 후 `pnpm dlx supabase gen types typescript --local > src/lib/supabase/types.ts`. 없으면 17개 마이그레이션을 읽어 모든 테이블의 Row/Insert/Update + Relationships를 hand-align.
- [ ] Step 2: 기존 `Tables`/`TablesInsert`/`TablesUpdate` helper 그대로 유지. CLI generated 출력에서 helper 부분만 보존.
- [ ] Step 3: `pnpm typecheck` 통과 확인 — 기존 코드와 type 호환 깨지지 않음.
- [ ] Step 4: 파일 상단 주석에 generated 날짜/방법 한 줄 추가.

### Task 2 — getCurrentProfile + requireRole

**Files:** `src/lib/auth/profile.ts`, `tests/lib/auth/profile-getCurrentProfile.test.ts`

- [ ] Step 1: RED 테스트
  - `getCurrentProfile()`: auth user 있으면 profiles row 반환, 없으면 null
  - `requireRole(['platform_admin'])`: profile.app_role이 허용 목록에 있으면 통과, 없으면 redirect('/dashboard')
- [ ] Step 2: `pnpm test` fail 확인
- [ ] Step 3: 구현
  - `getCurrentProfile()`: `getCurrentUser()` → `bootstrapProfile` → 반환 (null 허용)
  - `requireRole(allowedRoles: readonly string[])`: 내부에서 `getCurrentProfile()` 호출 → app_role 검사 → 통과 시 profile 반환, 실패 시 `redirect('/dashboard')`
- [ ] Step 4: test pass
- [ ] Step 5: commit

### Task 3 — Workspace shell 컴포넌트

**Files:** `src/components/app/WorkspaceShell.tsx`, `src/components/app/SidebarNav.tsx`, `src/components/app/AppHeader.tsx`

- [ ] Step 1: SidebarNav — Ant Design `Menu` + `Layout.Sider`. sitemap.md main flow에서 사용자 가시 메뉴 추출(/dashboard, /practice/*, /writing/*, /library, /growth, /profile, /settings/*, /admin/*). admin 메뉴는 role prop 받아 조건부 렌더.
- [ ] Step 2: AppHeader — Ant Design `Layout.Header`. 앱 타이틀(TALKPIK) + 사용자 메뉴 dropdown placeholder.
- [ ] Step 3: WorkspaceShell — Sider + Header + Content 조립. `children: ReactNode`, `role: string` prop. Tailwind는 layout glue만.
- [ ] Step 4: 깨지지 않는 desktop/모바일 기본 반응형(`md:` breakpoint 정도). 본격 모바일은 Phase 4.
- [ ] Step 5: commit

### Task 4 — Shared UI primitives

**Files:** `src/components/shared/{PlaceholderPage,AppLoading,AppError,AppNotFound}.tsx`

- [ ] Step 1: PlaceholderPage — props로 `title`, `iaCode`(예: B-01), `phaseHint` 받음. Ant Design `Result` + `Empty` 활용.
- [ ] Step 2: AppLoading — `Spin` + 메시지.
- [ ] Step 3: AppError — `Result` `status="error"` + 재시도 버튼.
- [ ] Step 4: AppNotFound — `Result` `status="404"` + dashboard로 가는 링크.
- [ ] Step 5: commit

### Task 5 — `(workspace)` route group

**Files:** `src/app/(workspace)/{layout,loading,error,not-found}.tsx`

> 설계 결정: server layout이 Next.js 16 App Router에서 pathname 정보를 직접 받지 못한다. 따라서 onboarding gate(`/dashboard`에서만 적용)는 layout이 아니라 `/dashboard/page.tsx` 자체에서 처리한다(Task 6). layout은 모든 보호 라우트에 공통으로 필요한 `requireUser()` + `getCurrentProfile()` + WorkspaceShell wrap만 담당.

- [ ] Step 1: layout.tsx — server component. `const user = await requireUser(); const profile = await getCurrentProfile();` 호출. WorkspaceShell에 `role={profile.app_role}` 전달. children 그대로 wrap.
- [ ] Step 2: loading.tsx — AppLoading 사용.
- [ ] Step 3: error.tsx — client component(`'use client'`), AppError 사용.
- [ ] Step 4: not-found.tsx — AppNotFound 사용.
- [ ] Step 5: commit

### Task 6 — Dashboard(onboarding gate 포함) + growth + library + profile placeholder

**Files:** `src/app/(workspace)/{dashboard,growth,library,profile}/page.tsx`

- [ ] Step 1: `/dashboard/page.tsx` server component:
  ```
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: goal } = await supabase
    .from('learning_goals').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!goal) redirect('/onboarding/learning-goal');
  return <PlaceholderPage iaCode="B-01" title="Dashboard" phaseHint="콘텐츠는 Phase 4에서" />;
  ```
- [ ] Step 2: growth/library/profile page.tsx는 PlaceholderPage 한 줄 + Metadata export.
- [ ] Step 3: 각 page에 해당 IA 코드와 한 줄 phase hint 입력. 본문 20줄 이하.
- [ ] Step 4: commit

### Task 7 — Settings placeholders

**Files:** `src/app/(workspace)/settings/{language,notifications}/page.tsx`

- [ ] Step 1: Task 6과 동일 패턴.
- [ ] Step 2: commit

### Task 8 — Practice 그룹 placeholders

**Files:** `src/app/(workspace)/practice/{recommendations,problems,next,weakness}/page.tsx`

- [ ] Step 1: Task 6과 동일 패턴.
- [ ] Step 2: commit

### Task 9 — Writing 그룹 placeholders (dynamic 포함)

**Files:** writing/[questionId]/page.tsx, writing/feedback/short/[id]/page.tsx, writing/feedback/long/[id]/page.tsx, writing/reports/[id]/compare/page.tsx

- [ ] Step 1: `[questionId]/page.tsx` — `params.questionId`가 `'51'|'52'|'53'|'54'`가 아니면 `notFound()` 호출. 외엔 PlaceholderPage.
- [ ] Step 2: feedback short/long, reports/compare — params.id를 받아 PlaceholderPage에 "id={params.id}" 표시. **id format validation(UUID 등)은 Phase 5의 data fetch와 함께 도입.** Phase 3 placeholder는 raw param 표시만.
- [ ] Step 3: commit

### Task 10 — Admin gate + admin placeholders

**Files:** src/app/(workspace)/admin/{layout,problems/page,org/page,users/page}.tsx

**Admin Role Matrix** (IA description.md 기반):

| Route | IA | 허용 role |
| --- | --- | --- |
| `/admin/problems` | H-01 | content_admin, platform_admin |
| `/admin/org` | X-08 (organization-admin-only) | org_admin, platform_admin |
| `/admin/users` | X-10 | platform_admin |

- [ ] Step 1: `admin/layout.tsx` server component — 1차 게이트(learner 차단):
  ```
  const profile = await getCurrentProfile();
  if (!profile || profile.app_role === 'learner') redirect('/dashboard');
  ```
  (admin 계열 4개 role 중 어느 것이든 layout 통과)

- [ ] Step 2: 각 admin page.tsx에서 `await requireRole([...])` 2차 게이트 호출 + PlaceholderPage:
  ```
  // problems/page.tsx
  await requireRole(['content_admin', 'platform_admin']);
  // org/page.tsx
  await requireRole(['org_admin', 'platform_admin']);
  // users/page.tsx
  await requireRole(['platform_admin']);
  ```

- [ ] Step 3: commit

### Task 11 — Onboarding + billing shells

**Files:** `src/app/(workspace)/{onboarding/learning-goal,subscription,paywall}/page.tsx`

- [ ] Step 1: PlaceholderPage 패턴. paywall에는 "billing scope deferred" 명시.
- [ ] Step 2: commit

### Task 12 — 공개 라우트 placeholders

**Files:** `src/app/sign-up/page.tsx`, `src/app/password-reset/page.tsx`

- [ ] Step 1: Phase 2의 login placeholder와 같은 스타일. workspace shell 없이 plain.
- [ ] Step 2: middleware의 PUBLIC_PATHS에 이미 들어 있는지 재확인.
- [ ] Step 3: commit

### Task 13 — route-matrix 통합 테스트

**Files:** `tests/integration/route-matrix.test.ts`

- [ ] Step 1: middleware unit test 패턴 확장. 27개 active route 각각에 대해 (a) 익명 컨텍스트 → public이면 200, protected이면 307 to /login, (b) 인증 컨텍스트 → 200 또는 의도된 redirect 검증.
- [ ] Step 2: admin route 매트릭스 검증:
  - learner context: `/admin/*` 모두 → /dashboard
  - content_admin context: `/admin/problems` 200, `/admin/org` 307 to /dashboard, `/admin/users` 307 to /dashboard
  - org_admin context: `/admin/org` 200, 나머지 307
  - platform_admin context: 3개 모두 200
- [ ] Step 3: 테스트 케이스를 데이터 테이블로 작성해 매트릭스 가독성 확보.
- [ ] Step 4: commit

### Task 14 — 전체 검증

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:e2e`(Playwright 셋업 가능 시; 부재 시 Task 13의 vitest 매트릭스가 대체)
- [ ] `pnpm build`
- [ ] `node scripts/ai-workflow-check.mjs --repo .`

### Task 15 — Architecture Pass

다음 grep을 ledger에 기록하며 통과:

- [ ] `grep -rEn "from ['\"]@supabase/(supabase-js|ssr)['\"]" src/app src/components` → 0줄
- [ ] `grep -rEn "(?<=app/\\(workspace\\)/).+/page\\.tsx" -l | xargs wc -l` → 모든 page.tsx 20줄 이하
- [ ] `grep -rEn "app_role|content_admin|platform_admin" src/app src/components` → admin role 체크는 admin/layout.tsx와 lib/auth/profile.ts에만
- [ ] `grep -rEn "from ['\"]antd['\"]" src/app` → page.tsx에 antd 직접 import 0(전부 components 경유) — 또는 명시적 예외 ledger 기록

### Task 16 — Cross-model review

- [ ] Opus + Codex 병렬. 점검 항목: workspace shell 분리, role gate 누락, dynamic route 검증 누락, public/protected 매트릭스 정확성, types.ts regen 완전성.

---

## Verification Strategy

- 단위: `pnpm test`(vitest). 기존 20+ 케이스 유지 + Task 2·13 추가.
- 통합: Task 13 route-matrix가 27 route × 2 context = 54 케이스 정도.
- 정적: lint, typecheck.
- 빌드: pnpm build로 27개 route 모두 컴파일 확인.
- 워크플로우: ai-workflow-check.

## Risks

- **types regen에서 17개 마이그레이션 manual hand-align 부담** — supabase CLI 부재 시 손으로. enum/citext/jsonb 처리에 실수 가능. typecheck fail이 가장 빠른 감지 신호.
- **Ant Design v6 + Next.js 16 App Router 호환성** — Phase 1에서 ConfigProvider 박았으니 그대로 사용. Sider/Menu의 client component 경계만 신중히.
- **route 매트릭스 테스트가 무거워질 수 있음** — 54 케이스가 단일 파일이면 가독성 손상. 그룹별 describe로 분리.
- **dynamic route param validation 분산** — writing/[questionId]에선 51-54만 허용. 같은 패턴이 feedback id에도 필요할지 결정 시점 명확화.
- **onboarding gate가 모든 보호 라우트에 적용되면 부작용 클 수 있음** — `/dashboard` + 핵심 진입에만, 나머지는 Phase 4가 정리한다는 Out of Scope 결정을 plan과 ledger에서 일관 유지.
