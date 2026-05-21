# Phase 3 — App Shell And IA Routes (Light Spec)

> 1쪽 분량. 결정 로그는 ledger에, 작업 분해는 plan에 둔다.

## Core Functionality

1. **types.ts regeneration** (Phase 2 이월) — 17개 마이그레이션 기반 정확한 `Database` 타입. 모든 테이블/뷰/함수가 typed. supabase CLI local stack이 없으면 manual hand-alignment, 있으면 `supabase gen types typescript --local`로 자동.
2. **인증된 workspace shell** — Ant Design `Layout`(Sider + Header + Content) 기반 공통 부모 레이아웃. 모든 보호 라우트가 이 shell 아래 들어감. `src/app/(workspace)/layout.tsx`로 묶음.
3. **Navigation** — sitemap.md의 main flow를 사이드바/헤더 메뉴로 표현. role(admin/learner)에 따라 admin 메뉴 항목 표시/숨김.
4. **27개 active sitemap route shell** — 각 route에 thin placeholder page(또는 dynamic route stub). 콘텐츠는 후속 phase가 채움.
5. **App Router 경계** — `loading.tsx` / `error.tsx` / `not-found.tsx`로 RSC suspense + 에러 상태를 시각화.
6. **Role-based admin gate** — `getCurrentProfile()` 분리(Phase 2 Opus P2 #5 이월) + `requireRole(allowedRoles)` helper. admin route별 매트릭스를 page 단위로 정확히 적용 (1차 layout 게이트가 learner 차단, 2차 page에서 route별 role 검증):
   - `/admin/problems` (H-01) → `content_admin`, `platform_admin`
   - `/admin/org` (X-08, IA description.md "organization-admin-only") → `org_admin`, `platform_admin`
   - `/admin/users` (X-10) → `platform_admin`

## Out of Scope — Intentional Cuts

| 제외 | 이유 |
| --- | --- |
| 실제 페이지 콘텐츠 (대시보드 위젯, 문제 풀이 UI, 글쓰기 에디터, 피드백 표시 등) | Phase 4·5·6의 영역. |
| Sign-up / Login / Password-reset 실 UI 폼 | 보호 라우트가 아니라 인증 진입 UI. 별도 phase 또는 후속 PR. Phase 3는 placeholder만 유지. |
| 학습 데이터 fetch (TanStack Query 도입 포함) | Phase 4. |
| 글쓰기 autosave / 제출 흐름 | Phase 5. |
| Admin CRUD 본격 구현 | Phase 6. Phase 3는 admin route 접근 제어만. |
| Billing 통합 (Stripe 등) | `deferred-scope.md` 그대로. paywall/subscription은 placeholder만. |
| @supabase/ssr cache headers(Phase 2 Codex P2 #2) 적용 | 라이브러리 시그니처 추가 확인 필요. 별도 PR. |
| RLS smoke를 problem_attempts로 확장(Phase 2 Codex P2 #4) | problem seed가 Phase 4에서 들어오는 시점에 합치는 게 자연. |
| 새 마이그레이션 | 17번까지가 정본. Phase 3에서 schema 손대지 않음. |
| onboarding 진입 자동 redirect를 모든 진입점에 강제 | dashboard + 핵심 진입에만 적용. 나머지는 Phase 4 진입 시 정리. |

## Minimum Acceptable Behavior

- 모든 active sitemap route가 404 아닌 thin placeholder 응답을 돌려줌(빈 page.tsx 또는 layout 적용된 stub).
- 비로그인 접근 → `/login` redirect (Phase 2 middleware 그대로).
- 로그인 + workspace shell이 Ant Design 토큰을 사용해 desktop/mobile 둘 다 깨지지 않게 렌더링.
- `app_role === 'learner'`인 사용자가 `/admin/*` 접근 → `/dashboard` redirect (1차 admin layout).
- admin 계열 사용자라도 해당 route의 허용 role 목록에 없으면 `/dashboard` redirect (2차 page에서 `requireRole`).
- 학습 목표가 없는 사용자가 `/dashboard` 진입 → `/onboarding/learning-goal`로 redirect(server component 레이어). 그 외 경로의 자동 redirect는 Phase 4가 정리.
- `loading.tsx` / `error.tsx` / `not-found.tsx`가 각 경로 그룹별로 시각적으로 응답.

## User Flow

`docs/flow/user-flow.md` 기준. Phase 3가 다루는 진입선:

```
Login → workspace shell + Dashboard placeholder (학습 목표 없으면 → /onboarding)
Sidebar 클릭 → 해당 route placeholder (workspace shell 유지)
Admin 메뉴 → role 체크 → admin이면 admin placeholder, 아니면 /dashboard
실패한 비동기 → error.tsx
잘못된 경로 → not-found.tsx
```

## Domain Boundary

폴더(정본은 코드 폴더, `docs/domain-glossary.md` 참조):

- `src/app/(workspace)/` — Next.js Route Group. 모든 보호 라우트의 부모 layout.
- `src/app/(workspace)/{dashboard,practice,writing,library,profile,growth,settings,admin,subscription,paywall,onboarding}/` — 각 route 그룹과 placeholder page.
- `src/components/app/` — workspace shell 컴포넌트(`SidebarNav`, `Header`, `Breadcrumb` 등).
- `src/components/shared/` — placeholder, loading skeleton, error fallback 등 reusable UI.
- `src/lib/auth/profile.ts` — `getCurrentProfile()` 분리 추가.
- 손대지 않는 도메인: `src/learning/`, `src/writing/`, `src/feedback/` (아직 폴더 없음 — Phase 4+에서 생성).

## Success Criteria

- `pnpm test`: types/auth/middleware 기존 단위 테스트 그대로 유지(20+) + 신규 `getCurrentProfile` 단위 테스트, route navigation 통합 테스트 추가.
- `pnpm test:e2e` 또는 vitest 변형: 모든 active sitemap route 응답(200 또는 의도된 redirect) 매트릭스 1회 통과.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과.
- `node scripts/ai-workflow-check.mjs --repo .` 통과.
- Architecture Pass: page.tsx는 thin(20줄 이하), workspace shell 컴포넌트는 `src/components/app/`에 모임, role 체크 로직은 `src/lib/auth/`에 한 곳, admin route 게이트가 layout 한 곳에서 적용.
- Cross-model review 통과(Opus + Codex 양측 substantial PASS).
