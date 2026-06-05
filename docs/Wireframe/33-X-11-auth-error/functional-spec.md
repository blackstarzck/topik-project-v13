# X-11 인증 에러 기능명세

## 화면 목적

Supabase 인증 실패 이유를 안전한 문구와 재시도 행동으로 안내한다.

## 사용자와 권한

- Audience: public
- 권한 기준: public route. 세션이 없을 수 있으므로 사용자 row 접근을 전제로 하지 않는다.

## 진입/이탈 흐름

- Route: `/auth/error`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: `/auth/callback` 실패, X-17 fragment 처리 실패, 인증 토큰/PKCE 오류.
- 이탈 경로: `user_not_found`는 A-01, `otp_expired`/`email_not_confirmed`는 X-12, `flow_state_*`/`bad_code_verifier`는 A-02로 이동한다.
- 화면 내부 동작: 오류 reason 매핑, 재전송, Retry-After countdown, primary/secondary CTA 분기를 처리한다.

## 주요 기능

- 오류 이유 분기
- 재시도 CTA
- 카운트다운
- 로그인/가입 이동

## 상태/오류

- raw error 노출 금지, rate limit

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `id`, `status` | read | 인증 오류 후 계정 상태 안내와 재시도 분기에 연결될 수 있다. | public/auth flow; no user-owned row access unless session exists | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/admin/queries.ts`<br>`src/lib/admin/server.ts`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |

## 현재 구현 상태

- query reason은 신뢰하지 않고 canonical reason만 표시한다.

## 코드 구현 근거

- `AuthErrorPage` - `src/app/auth/error/page.tsx`
- `AuthErrorCard`, `handleResend`, `handlePrimaryClick` - `src/components/auth/AuthErrorCard.tsx`
- `mapSupabaseErrorCode`, `rateLimitFallback` - `src/lib/auth/error-mapping.ts`
- `GET` route handler - `src/app/auth/callback/route.ts`

## 미구현/불일치

- Auth 중심 화면은 Supabase Auth 동작과 UI 상태 연결을 함께 확인해야 한다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.
