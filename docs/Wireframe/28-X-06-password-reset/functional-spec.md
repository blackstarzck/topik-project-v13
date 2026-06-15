# X-06 비밀번호 재설정 기능명세

## 화면 목적

비밀번호를 잊은 사용자가 재설정 메일을 요청하고 복귀하게 한다.

## 사용자와 권한

- Audience: public
- 권한 기준: public route. 세션이 없을 수 있으므로 사용자 row 접근을 전제로 하지 않는다.

## 진입/이탈 흐름

- Route: `/password-reset`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: A-02 로그인의 계정 찾기 또는 직접 `/password-reset` 접근.
- 이탈 경로: 재설정 메일 링크를 통해 `/auth/callback?type=recovery`를 거쳐 X-16 새 비밀번호 설정으로 이동한다.
- 화면 내부 동작: 이메일 입력, 재설정 메일 발송, cooldown, 오류 표시를 처리한다.

## 주요 기능

- 이메일 입력
- 메일 발송
- 재시도 안내
- 로그인 복귀

## 상태/오류

- 존재하지 않는 사용자, rate limit

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `id`, `email`, `status` | read | 비밀번호 재설정 성공 후 사용자 상태 확인에 연결될 수 있다. | public/auth flow; no user-owned row access unless session exists | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |

## 현재 구현 상태

- Auth 중심 화면이며 DB 직접 변경은 제한적이다.

## 코드 구현 근거

- `PasswordResetPage` - `src/app/password-reset/page.tsx`
- `PasswordResetRequestForm`, `handleSubmit` - `src/components/auth/PasswordResetRequestForm.tsx`
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
