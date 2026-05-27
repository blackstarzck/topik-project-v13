# Phase 2 — Data And Auth Foundation (Light Spec)

> 1쪽 분량. 결정 로그는 ledger에, 작업 분해는 plan에 둔다.

## Core Functionality

1. Supabase 클라이언트를 browser + SSR(cookie-based via `@supabase/ssr`) 양면으로 박는다.
2. `@supabase/supabase-js` + `@supabase/ssr` 사용. env 검증은 `zod`로 1곳에서.
3. schema-generated TypeScript types를 코드와 함께 둔다(생성 절차 문서화 포함). 이미 작성된 `supabase/migrations/*.sql` 16개 위에 올린다 — 스키마 변경 없음.
4. 인증/세션 경계 helper(`getCurrentUser`, `requireUser` 같은 server-side helper)와 Next.js `middleware.ts`를 도입해 보호 라우트의 redirect 동작을 만든다.
5. profile auto-bootstrap: 마이그레이션 1개(`auth.users` insert → `public.profiles` INSERT 트리거)를 신규 추가해 16개 마이그레이션의 self-inconsistency를 해소(`20260520121100_rls_policies.sql:46`의 "auth trigger out of scope" 주석에 대응하는 실제 트리거 부재 문제). 코드 측은 idempotent `bootstrapProfile()` helper만 — 트리거가 정상 작동하면 helper는 거의 no-op.
6. RLS smoke 검증: 익명/사용자 A/사용자 B 케이스의 read 차단/허용을 통합 테스트 한두 개로 증명.

## Out of Scope — Intentional Cuts

| 제외 | 이유 |
| --- | --- |
| Sign-up / Login / Password-reset 실제 UI | Phase 3(App Shell And IA Routes)와 그 이후가 채움. Phase 2는 인프라만. |
| 학습/문제/글쓰기/피드백 데이터 CRUD | Phase 4·5에서. |
| Admin role/Org admin flow | Phase 6에서. |
| 추가 OAuth providers(Google/Apple 등) | 이번 phase는 Supabase Auth 기본 email/password만 검증. |
| Supabase Storage 업로드 UI | Phase 5 이후. policy/bucket만 마이그레이션에 이미 있음. |
| Schema 변경 (1개 예외) | 16개 마이그레이션은 정본. **예외: auth.users → profiles INSERT 트리거 마이그레이션 1개만 신규 추가** (Codex 사전 리뷰가 self-inconsistency 발견 — line 46 주석은 트리거 존재 가정, 실제는 부재). 그 외 schema 변경은 별도 PR. |
| `SUPABASE_SERVICE_ROLE_KEY` 도입 | 이번 phase에서 admin-only 서버 작업 없음. 도입 보류. |
| Billing/paywall 연동 | `deferred-scope.md` 그대로. |

## Minimum Acceptable Behavior

- `NEXT_PUBLIC_SUPABASE_URL` 또는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 누락 시 명확한 에러로 fail-fast.
- browser client는 publishable key로 익명 호출 가능.
- server client는 cookie-based 세션을 읽고 RSC/Route Handler/Server Action에서 사용 가능.
- `middleware.ts`가 보호 라우트(`/dashboard`, `/practice/*`, `/writing/*`, `/library`, `/profile`, `/settings/*`, `/admin/*`, `/growth`, `/onboarding/*`)에 비로그인 접근 시 `/login`으로 redirect.
- 공개 allowlist(인증 없이 접근 가능): `/`(X-01 Landing), `/sign-up`, `/login`, `/password-reset`. 미들웨어가 명시적으로 통과시킴.
- 라우트 결정 보류: `/paywall`, `/subscription` (billing scope 보류 상태 — `deferred-scope.md`). 이번 phase에선 보호 라우트로 분류해 redirect되도록 두고, billing 재개 시 재검토.
- 현재 `/login`은 placeholder 페이지(Phase 3에서 본격 UI)여도 redirect 자체는 작동.
- 신규 가입 시 `public.profiles` row가 자동 생성됨(트리거 또는 server bootstrap).
- 익명 클라이언트가 다른 사용자의 `attempts` 같은 테이블 row를 읽지 못함(RLS smoke).

## User Flow

`docs/flow/user-flow.md` 기준. Phase 2는 그중 인증 진입선만 다룬다:

```
비로그인 사용자 → /dashboard 진입 시도 → middleware → /login으로 redirect
신규 가입 → profiles row 자동 생성 → /onboarding/learning-goal (Phase 3에서 채움)
재로그인 사용자 → cookie 세션 복구 → /dashboard
```

## Domain Boundary

Audience: user (인프라 레이어 — 익명/로그인 사용자 경계만 다룬다. Admin role gate는 Phase 3에서 도입.)

폴더(정본은 코드 폴더 구조, `docs/domain-glossary.md` 참조):

- `src/lib/supabase/` — env 검증, browser/server 클라이언트, generated types
- `src/lib/auth/` — session helper, profile bootstrap
- `src/middleware.ts` — Next.js route protection
- `tests/lib/supabase/`, `tests/lib/auth/`, `tests/integration/` — 검증

손대지 않는 도메인: `src/learning/`, `src/writing/`, `src/feedback/`, `src/components/app/`(이 phase는 visible UI 없음).

## Success Criteria

- `pnpm test`: env 검증, session helper, profile bootstrap 단위 테스트 모두 통과
- `pnpm test:e2e` 또는 통합 테스트: middleware redirect + RLS smoke 각각 1 케이스 이상 통과
- `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과
- 시크릿이 `NEXT_PUBLIC_` 접두사로 새지 않음(grep + 코드 리뷰)
- 새 마이그레이션 0건(이번 phase에서 schema 수정 없음)
- Architecture Pass: `src/lib/supabase/`와 `src/lib/auth/` 경계 명확, route handler/page에 supabase client 직접 import 누수 없음, generated types가 hand-written types를 침범 안 함
- Cross-model review 통과(Claude 구현 + Codex 리뷰, 또는 그 반대)
