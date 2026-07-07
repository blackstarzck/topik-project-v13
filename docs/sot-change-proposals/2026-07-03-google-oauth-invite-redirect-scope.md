# Google OAuth 기관 초대 경유 조건 명확화

작성일: 2026-07-03

상태: 사용자 결정 확정(2026-07-03), 구현 반영

## 제안 요약

일반 Google 회원가입은 기관 초대 확인 화면을 거치지 않고 `/auth/post-auth?intent=sign-up`로 이어진다.

기관 초대 확인 화면(`/auth/institution-invite`)은 브라우저에 유효한 `talkpik:affiliation-code`가 저장되어 있거나, 로그인 `next`가 명시적으로 초대 확인 화면을 가리키는 경우에만 OAuth 완료 뒤 경유한다.

이 문서는 `2026-07-01-institution-invite-flow.md`의 "Google OAuth 가입/로그인은 초대 확인 화면을 거친다"는 문장을 보완한다. 해당 문장은 `?aff=CODE`로 시작한 기관 초대 흐름 안에서만 적용한다.

## 결정 이유

- `docs/flow/user-flow.md`와 `docs/Wireframe/01-A-01-sign-up/functional-spec.md`는 소셜 가입/로그인의 기본 이탈 경로를 `/auth/post-auth`로 둔다.
- 초대 코드가 없는 일반 사용자를 `/auth/institution-invite`로 보내면 "초대 코드가 없거나 만료됐어요" 상태를 보게 되어, 사용자는 가입이 실패했다고 해석할 수 있다.
- 반대로 `?aff=CODE`로 시작한 사용자는 기관 소속 연결이 콘텐츠 접근 상태(`profiles.affiliation_code`)를 바꿀 수 있으므로, OAuth 완료 뒤 명시 확인 화면을 유지한다.

## 동작 규칙

| 상황 | OAuth callback `next` |
| --- | --- |
| `/sign-up`에서 Google 회원가입, 유효한 저장 초대 코드 없음 | `/auth/post-auth?intent=sign-up` |
| `?aff=CODE` 진입 후 Google 회원가입, 유효한 저장 초대 코드 있음 | `/auth/institution-invite?next=/auth/post-auth?intent=sign-up` |
| `/login?next=/auth/institution-invite`에서 Google 로그인 | `/auth/institution-invite` |
| 직접 `/auth/institution-invite` 진입, 코드 없음 또는 만료 | OAuth/RPC를 시작하지 않고 no-code 상태 표시 |
| Google 버튼 클릭 시점에 저장 코드가 만료됨 | 만료 코드를 삭제하고 일반 Google 회원가입 경로로 진행 |

## 구현 범위

- `src/lib/auth/oauth.ts`: `sign-up` intent를 기본 invite 경로로 자동 감싸지 않는다. 초대 경유가 필요하면 호출부가 명시적으로 `nextPath`를 전달한다.
- `src/components/auth/SignUpForm.tsx`: Google 회원가입 시작 시 `readStoredAffiliationCode()` 결과가 있을 때만 invite 확인 경로를 전달한다.
- 테스트: OAuth helper, `SignUpForm`, `LoginForm`, Google OAuth e2e, institution invite e2e를 확인한다.

## 제외

- 활성 SOT 문서 직접 수정.
- Supabase migration, RLS, RPC, `profiles.affiliation_code` 정책 변경.
- 기관 코드 카탈로그, 기관명 표시, 서버 측 코드 만료 검증.
- 이메일 회원가입 metadata 전달 방식 변경.

## 검증 기준

- 일반 `/sign-up` Google OAuth 요청의 `redirect_to` callback `next`가 `/auth/post-auth?intent=sign-up`다.
- `?aff=CODE` 초대 진입 뒤 Google 회원가입 요청의 `redirect_to` callback `next`가 `/auth/institution-invite?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up`다.
- `/login?next=/auth/institution-invite` Google 로그인은 기존처럼 초대 확인 화면을 보존한다.
- 직접 `/auth/institution-invite` no-code 화면은 유지된다.

## 구현 검증 기록

- `pnpm vitest run tests/lib/auth/oauth.test.ts tests/components/auth/SignUpForm.test.tsx tests/components/auth/LoginForm.test.tsx` — 51 passed.
- `pnpm lint` — 통과.
- `pnpm typecheck` — 통과.
- `pnpm exec playwright test tests/e2e/flows/google-oauth.spec.ts --project=mobile-360 --no-deps` — 5 passed.
- `pnpm exec playwright test tests/e2e/flows/google-oauth.spec.ts --project=desktop-1280 --no-deps` — 5 passed.
- `pnpm exec playwright test tests/e2e/flows/institution-invite.spec.ts --project=mobile-360 --no-deps -g "institution invite anonymous entry"` — 4 passed.
- `pnpm exec playwright test tests/e2e/flows/institution-invite.spec.ts --project=desktop-1280 --no-deps -g "institution invite anonymous entry"` — 4 passed.

## 근거 문서

- `docs/flow/user-flow.md` — A-01/A-02 Google OAuth의 기본 후처리 노드는 `/auth/post-auth`.
- `docs/Wireframe/01-A-01-sign-up/functional-spec.md` — 소셜 가입/로그인은 `/auth/post-auth`에서 약관/학습 목표 상태를 확인한다.
- `docs/sot-change-proposals/2026-07-01-institution-invite-flow.md` — 기관 초대 흐름의 신뢰 모델과 명시 확인 필요성.
- `docs/sot-change-proposals/2026-07-03-affiliation-code-ttl-30min.md` — `talkpik:affiliation-code` 30분 보관과 만료 시 삭제 기준.
