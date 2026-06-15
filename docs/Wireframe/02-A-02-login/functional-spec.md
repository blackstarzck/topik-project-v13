# A-02 로그인 기능명세

## 화면 목적

기존 사용자가 세션을 만들고 학습 대시보드로 들어가게 한다.

## 사용자와 권한

- Audience: public
- 권한 기준: public route. 세션이 없을 수 있으므로 사용자 row 접근을 전제로 하지 않는다.

## 진입/이탈 흐름

- Route: `/login`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: X-01 제품 랜딩의 로그인 CTA, A-01 회원가입의 로그인 링크, 세션 만료 리다이렉트 `/login?reason=session_expired`.
- 이탈 경로: 로그인 성공 시 B-01 홈 대시보드, 회원가입은 A-01, 계정 찾기는 X-06, 매직 링크/복구 링크는 `/auth/callback`으로 이동한다.
- 화면 내부 동작: 이메일/비밀번호 로그인, 매직 링크 발송, 소셜 로그인, 입력 오류와 인증 오류 표시.

## 주요 기능

- 이메일/비밀번호 로그인
- 비밀번호 재설정 진입
- 회원가입 전환
- 인증 오류 분기

## 상태/오류

- 잘못된 계정, 이메일 미인증, rate limit

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `id`, `status`, `app_role` | read | 로그인 후 세션 사용자의 상태와 권한을 확인한다. | public/auth flow; no user-owned row access unless session exists | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |

## 현재 구현 상태

- 기본 로그인은 구현되어 있으나 Auth callback/error와 연결 상태를 계속 확인해야 한다.

## 코드 구현 근거

- `LoginPage` - `src/app/login/page.tsx`
- `LoginForm`, `handlePasswordLogin`, `handleMagicLink` - `src/components/auth/LoginForm.tsx`
- `buildAuthRedirectUrl` - `src/lib/auth/redirect-url.ts`
- `mapSupabaseErrorCode`, `sanitizeNext` - `src/lib/auth/error-mapping.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.
