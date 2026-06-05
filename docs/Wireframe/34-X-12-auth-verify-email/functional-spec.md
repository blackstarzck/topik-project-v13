# X-12 인증 메일 확인 안내 기능명세

## 화면 목적

가입 직후 이메일 확인과 재발송 제한을 안내한다.

## 사용자와 권한

- Audience: public
- 권한 기준: public route. 세션이 없을 수 있으므로 사용자 row 접근을 전제로 하지 않는다.

## 진입/이탈 흐름

- Route: `/auth/verify-email`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: A-01 회원가입 직후 인증 메일 안내.
- 이탈 경로: 이메일 링크 클릭은 `/auth/callback`으로 이동하고, 로그인 링크는 A-02로 이동한다.
- 화면 내부 동작: 이메일 확인 안내, 60초 cooldown, 인증 메일 재전송, resend 오류 표시를 처리한다.

## 주요 기능

- 인증 메일 안내
- 재발송
- cooldown
- 로그인 복귀

## 상태/오류

- 메일 미도착, rate limit, 이미 인증됨

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `id`, `email`, `status` | read | 가입 직후 이메일 인증 안내와 인증 상태 확인에 연결된다. | public/auth flow; no user-owned row access unless session exists | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/admin/queries.ts`<br>`src/lib/admin/server.ts`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |
| `rpc:public.handle_new_user` | - | trigger | 가입 직후 프로필 row 생성을 보장한다. | public/auth flow; no user-owned row access unless session exists | `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql` | none |

## 현재 구현 상태

- handle_new_user trigger와 profile 상태를 함께 고려한다.

## 코드 구현 근거

- `VerifyEmailPage` - `src/app/auth/verify-email/page.tsx`
- `VerifyEmailCard`, `handleResend` - `src/components/auth/VerifyEmailCard.tsx`
- `buildAuthRedirectUrl` - `src/lib/auth/redirect-url.ts`
- `mapSupabaseErrorCode` - `src/lib/auth/error-mapping.ts`
- `useEmailCooldown` - `src/lib/auth/use-email-cooldown.ts`

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
