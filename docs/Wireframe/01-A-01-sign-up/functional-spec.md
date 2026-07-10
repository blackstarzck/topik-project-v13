# A-01 회원가입 기능명세

## 화면 목적

새 사용자가 계정을 만들고 이메일 인증 또는 온보딩으로 이어지게 한다.

## 사용자와 권한

- Audience: public
- 권한 기준: public route. 세션이 없을 수 있으므로 사용자 row 접근을 전제로 하지 않는다.

## 진입/이탈 흐름

- Route: `/sign-up`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: X-01 제품 랜딩의 무료 시작 CTA, A-02 로그인의 회원가입 링크, 직접 `/sign-up` 접근.
- 이탈 경로: 이메일 가입 성공 시 X-12 인증 메일 확인 안내로 이동하고, 인증 링크의 `/auth/callback?next=/onboarding/learning-goal` 처리 후 A-03 학습 목표 설정으로 이어진다. 소셜 가입/로그인은 `/auth/post-auth`에서 약관 동의와 학습 목표 상태를 확인한 뒤 X-18, A-03, B-01 중 하나로 이동한다. 약관/개인정보 링크는 X-13/X-14로 이동한다.
- 화면 내부 동작: 입력값 검증, 약관 동의, 약관 단계에서 성별/전화번호 선택 입력(필수 아님, Auth metadata로 전달), 소셜 로그인 선택, 인증 메일 발송 실패/중복 이메일 오류 표시.

## 주요 기능

- 이메일/비밀번호 입력
- 약관 동의
- 선택 입력(성별/전화번호): 비밀번호 확인까지 유효해 약관 단계가 열릴 때 함께 표시하며 둘 다 필수 아님
- 가입 요청
- 인증 메일 안내

## 상태/오류

- 이메일 중복, 약한 비밀번호, 발송 제한, 가입 비활성화

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `id`, `email`, `display_name`, `app_role`, `plan_label`, `status`, `gender`, `phone_country_code`, `phone_number` | triggered-write | 회원가입 후 auth.users 트리거가 프로필 기본 row를 만든다. 약관 단계에서 선택 입력한 성별/전화번호는 Auth signup metadata로 전달되어 `handle_new_user()`가 함께 저장한다(선택, 미입력 시 null). | public/auth flow; no user-owned row access unless session exists | `src/components/auth/SignUpForm.tsx`<br>`src/components/shared/PhoneNumberInput.tsx`<br>`src/lib/auth/profile.ts` | none |
| `rpc:public.handle_new_user` | - | trigger | auth.users 생성 후 public.profiles를 보강한다. | public/auth flow; no user-owned row access unless session exists | `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql`<br>`supabase/migrations/20260709153000_profiles_optional_gender_phone.sql`<br>`supabase/migrations/20260709165000_profiles_split_phone_country_code.sql` | none |

## 현재 구현 상태

- 가입 폼은 구현되어 있으나 실제 상태별 문구는 Auth 오류 화면과 함께 검증해야 한다.

## 코드 구현 근거

- `SignUpPage` - `src/app/sign-up/page.tsx`
- `SignUpForm`, `handleSignUp` - `src/components/auth/SignUpForm.tsx`
- `buildAuthRedirectUrl` - `src/lib/auth/redirect-url.ts`
- `mapSupabaseErrorCode` - `src/lib/auth/error-mapping.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/ia.md`와 화면 기능명세의 audience와 맞는다.
