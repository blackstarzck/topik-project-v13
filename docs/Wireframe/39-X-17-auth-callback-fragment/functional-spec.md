# X-17 인증 콜백 fragment 처리 기능명세

> 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.

## 화면 목적

Supabase implicit flow의 URL fragment를 browser에서 파싱해 세션을 설정하거나 안전한 인증 오류 화면으로 이동시킨다.

## 진입/이탈 흐름

- Route: `/auth/callback-fragment`
- Route type: page
- Audience: public
- 진입: `/auth/callback` route handler가 fragment 보존 redirect를 수행한 뒤 도착.
- 성공 이탈: sanitized `next`.
- 실패 이탈: `/auth/error?reason=<canonical>`.

## 주요 기능

- URL fragment 파싱
- `error_code` canonical reason 매핑
- `access_token`/`refresh_token` 기반 `setSession`
- `next` relative URL sanitization
- 처리 중 spinner/status 표시

## 상태/오류/권한

- public route로 열려야 한다.
- 4개 상태: loading(spinner) / success-redirect / error-reason redirect / missing-fragment redirect.
- token과 refresh token은 UI에 표시하지 않는다.
- provider raw error는 URL/UI에 노출하지 않고 canonical reason으로만 연결한다.
- `next`는 open redirect가 되지 않도록 page 진입 시 server에서 `sanitizeNext`를 통과한다.

## 현재 구현 상태

- `src/app/auth/callback-fragment/page.tsx`가 `metadata` 제목과 SR 전용 `<h1>`을 두고 `Suspense`로 `CallbackFragmentFallback`을 렌더링한다. `next`는 server에서 `sanitizeNext`로 정리해 prop으로 전달한다.
- `CallbackFragmentFallback`(`"use client"`)이 mount 시 `parseAuthFragment`, `mapSupabaseErrorCode`, browser `supabase.auth.setSession`, `router.replace`를 사용해 자동 분기한다.
- 상태 카드는 `role="status"` + `aria-live="polite"`로 처리/이동 상태를 알린다.
- `export const dynamic = "force-dynamic"`으로 callback support page를 동적으로 처리한다.

## 미구현/불일치

- 사용자에게 수동 CTA를 제공하지 않고 자동 redirect에 의존한다.
- token parsing 실패 상세 원인은 X-11 auth error 페이지로 위임한다.

## 추가 발견 후보

- callback fragment 실패율을 운영에서 보려면 server-visible correlation id 또는 client telemetry가 별도 필요하다.
- X-11 reason copy가 늘어나면 이 페이지의 error mapping도 함께 확인해야 한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `Supabase Auth:setSession` | `access_token`, `refresh_token` | auth action | fragment token으로 browser session 설정 | browser auth client | `src/components/auth/CallbackFragmentFallback.tsx` | token 값은 DB 객체로 직접 노출되지 않음 |

## 수용 기준

- 기존 34개 Wireframe 이후 추가된 코드 기준 화면임을 명시한다.
- `/auth/callback-fragment`가 X-17 standalone IA page로 추적된다.
- fragment token과 raw provider 오류가 UI/URL에 노출되지 않는다.
- `next`는 relative-only sanitization을 거친다.
- loading / success-redirect / error-reason / missing-fragment 4개 상태가 각각 spinner 또는 X-11/target route로 연결된다.
- 상태 카드가 SR에 announce되도록 `role="status"` aria-live 영역을 제공한다.

## 검증 근거

- Description: `docs/Wireframe/39-X-17-auth-callback-fragment/description.md`
- Route map: `docs/sitemap.md`
- Source: `src/app/auth/callback-fragment/page.tsx`
- Component: `src/components/auth/CallbackFragmentFallback.tsx`
- Error mapping: `src/lib/auth/error-mapping.ts`
