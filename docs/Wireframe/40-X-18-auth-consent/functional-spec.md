# X-18 소셜 로그인 약관 동의 기능명세

> 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.

## 화면 목적

소셜 로그인으로 들어온 사용자가 일반 회원가입 화면의 약관 체크 절차를 거치지 않았을 수 있으므로, 서비스 진입 전에 최신 필수 약관/개인정보 동의를 받고 이력을 저장한다.

## 사용자와 권한

- Audience: user
- Supabase Auth 세션이 있는 사용자만 정상 대상이다.
- 권한 기준: `auth.uid()` 기반으로 본인의 `user_consents` row만 읽고 insert할 수 있어야 한다.

## 진입/이탈 흐름

- Route: `/auth/consent`
- Route type: page + server action
- 기준 흐름: `docs/flow/user-flow.md`의 Google OAuth 후처리 흐름을 따른다.
- 진입 경로: `/auth/post-auth`에서 미동의 필수 문서가 있을 때 `/auth/consent?next=/auth/post-auth?...`로 redirect.
- 이탈 경로: 동의 기록 성공 후 sanitized `next`로 redirect.
- 화면 내부 동작: 필수 문서 목록 확인, 동의 체크, 동의 기록, 재라우팅.

## 주요 기능

- 최신 published required legal document 조회
- 사용자별 미동의 문서만 표시
- 필수 동의 체크박스 검증
- `user_consents.source='signup'`으로 동의 기록
- 선택 입력(성별/전화번호) 섹션 표시: 비어 있어도 계속 가능하며, 입력 시 complete_auth_gate로 함께 저장
- 저장 후 `next` 경로 복귀
- 체크 누락 시 `error=required` 상태로 재시도 안내

## 왜 별도 화면이 필요한가

일반 이메일 회원가입은 A-01 화면에서 약관 동의 체크를 받을 수 있다. 반대로 Google OAuth는 외부 provider 인증을 마친 뒤 앱 callback으로 돌아오므로, 사용자가 A-01의 약관 체크 UI를 지나지 않았을 수 있다.

이 차이 때문에 `/auth/post-auth`가 소셜 로그인 직후 다음 순서로 사용자를 정리한다.

1. 세션 확인
2. 프로필 보강
3. 필수 약관 동의 누락 확인
4. 누락 시 X-18 `/auth/consent`
5. 동의 완료 후 학습 목표 또는 대시보드로 이동

따라서 X-18은 "약관 내용을 읽는 공개 페이지"가 아니라 "인증된 사용자의 필수 동의 이력을 남기는 게이트"다.

## 상태/오류

- loading: 서버에서 문서와 사용자 동의 상태를 조회하는 동안 기본 page render 상태를 따른다.
- ready: 미동의 필수 문서와 체크박스, 계속 버튼을 표시한다.
- required-error: 체크박스 없이 제출한 경우 같은 화면에 안내를 표시한다.
- no-session: 세션이 없으면 정상 동의 대상이 아니므로 인증 흐름으로 되돌린다.
- db-error: 문서 조회 또는 동의 저장 실패 시 동의 완료로 처리하지 않는다.

## 데이터 사용

- `legal_documents`: 최신 published required 약관/개인정보 문서 조회
- `user_consents`: 사용자별 동의 이력 조회와 insert
- `profiles`: 사용자 locale 확인·profile bootstrap 및 게이트 완료 시 선택 입력 성별/전화번호(`gender`, `phone_country_code`, `phone_number`) 저장(complete_auth_gate RPC)

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `legal_documents` | `id`, `doc_type`, `version`, `locale`, `title`, `summary`, `body`, `effective_at`, `status`, `requires_consent` | select | 표시할 최신 필수 문서 계산 | published read | `src/lib/legal/consent.ts` | 정식 법무 문구는 placeholder 이후 교체 필요 |
| `user_consents` | `user_id`, `document_id`, `doc_type`, `version`, `source`, `accepted_at` | select/insert | 미동의 여부 확인 및 동의 기록 | owner read + owner insert | `src/lib/legal/consent.ts`, `supabase/migrations/20260608120000_legal_documents_and_consents.sql` | 없음 |
| `profiles` | `id`, `ui_locale`, `gender`, `phone_country_code`, `phone_number` | select/bootstrap + update via RPC | 사용자 locale 기준 문서 조회 및 게이트 완료 시 선택 입력 성별/전화번호 저장 | owner/server auth 흐름; `complete_auth_gate`(SECURITY DEFINER, authenticated) | `src/app/auth/consent/actions.ts`<br>`supabase/migrations/20260709153000_profiles_optional_gender_phone.sql`<br>`supabase/migrations/20260709165000_profiles_split_phone_country_code.sql` | 없음 |

## 현재 구현 상태

- `src/app/auth/consent/page.tsx`가 서버에서 사용자와 미동의 문서를 확인한다.
- `src/components/auth/AuthConsentPanel.tsx`가 실제 동의 UI를 렌더링한다.
- `src/app/auth/consent/actions.ts`가 체크박스 검증과 동의 저장을 처리한다.
- `src/lib/legal/consent.ts`가 필수 문서 조회, 미동의 계산, `user_consents` insert를 담당한다.
- `src/lib/routes.ts`의 protected route 목록에 `/auth/consent`가 포함되어 있다.

## 코드 구현 근거

- `AuthConsentPage` - `src/app/auth/consent/page.tsx`
- `AuthConsentPanel` - `src/components/auth/AuthConsentPanel.tsx`
- `acceptRequiredConsentsAction` - `src/app/auth/consent/actions.ts`
- `getMissingRequiredConsentDocuments`, `recordRequiredConsents` - `src/lib/legal/consent.ts`
- route protection - `src/lib/routes.ts`
- schema - `supabase/migrations/20260608120000_legal_documents_and_consents.sql`
- initial published docs seed - `supabase/migrations/20260610104017_seed_initial_legal_documents.sql`

## 미구현/불일치

- 이 폴더는 코드에 이미 존재하는 `/auth/consent` 흐름을 Wireframe 인벤토리에 뒤늦게 등록하는 문서다.
- 정식 legal document 본문은 아직 placeholder seed 상태다.
- `wireframe.png` 또는 `browser-screenshot.png`는 아직 없다.

## 추가 발견 후보

- 정식 약관 게시 시 `legal_documents` 새 버전을 추가하고 기존 사용자 재동의 정책을 확정해야 한다.
- Google 외 다른 소셜 provider를 추가해도 이 게이트를 재사용할 수 있다.

## 수용 기준

- `/auth/post-auth`에서 필수 동의 누락 사용자를 `/auth/consent`로 보낸다.
- X-18은 authenticated user route로 동작한다.
- 최신 published required 문서 중 미동의분만 표시한다.
- 체크 없이 제출하면 저장하지 않고 재시도 안내를 표시한다.
- 체크 후 제출하면 누락된 문서만 `user_consents.source='signup'`으로 저장한다.
- 저장 후 안전한 `next` 경로로 복귀한다.
- provider token, raw OAuth error, secret key를 UI에 노출하지 않는다.
