# X-16 새 비밀번호 설정 기능명세

> 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.

## 화면 목적

X-06 비밀번호 재설정 요청 후 이메일 링크를 연 사용자가 새 비밀번호를 설정하고 로그인으로 복귀하게 한다.

## 진입/이탈 흐름

- Route: `/password-reset/confirm`
- Route type: page
- Audience: public
- 진입: Supabase password recovery redirect.
- 성공 이탈: `/login`.
- 실패 이탈: 현재 화면 유지 또는 `/password-reset` 재요청.

## 주요 기능

- 새 비밀번호 입력
- 비밀번호 확인 일치 검증
- 8-64자 길이 검증
- Supabase Auth password update
- 성공 후 로그인 복귀
- 링크 만료/세션 끊김 복구 안내

## 상태/오류/권한

- 세션 없이 route 자체는 열릴 수 있으나 저장 action은 recovery session이 필요하다.
- 제출 중 button loading으로 중복 제출을 막는다.
- provider raw error는 노출하지 않고 `mapSupabaseErrorCode`의 canonical message를 사용한다.

## 현재 구현 상태

- `src/app/password-reset/confirm/page.tsx`가 `PasswordResetConfirmForm`을 렌더링한다.
- `PasswordResetConfirmForm`은 `supabase.auth.updateUser({ password })`를 호출한다.
- 성공 시 `/login`으로 이동한다.
- 실패 시 warning alert와 `/password-reset` 링크를 보여준다.

## 미구현/불일치

- recovery session이 없는 직접 진입을 사전에 판별하는 별도 server guard는 없다.
- password strength meter는 없다.
- 비밀번호 정책은 현재 8-64자와 확인값 일치 수준이다.

## 추가 발견 후보

- 만료 링크를 더 명확히 판별하려면 Supabase session 상태 확인과 reason별 copy가 필요하다.
- 보안 정책 강화 시 대소문자/숫자/기호 조건과 유출 비밀번호 차단을 별도 명세해야 한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `Supabase Auth:updateUser` | `password` | auth action | 새 비밀번호 저장 | recovery session 필요 | `src/components/auth/PasswordResetConfirmForm.tsx` | Supabase Auth 내부 저장소는 앱 DB table로 직접 조회하지 않음 |

## 수용 기준

- 기존 34개 Wireframe 이후 추가된 코드 기준 화면임을 명시한다.
- `/password-reset/confirm`은 X-06과 별도 IA 문서로 추적된다.
- 8-64자, 필수값, 확인값 일치 검증이 문서화되어 있다.
- 성공은 `/login`, 실패는 `/password-reset` 재발송 복구 경로로 이어진다.
- raw provider 오류와 token 값이 UI에 노출되지 않는다.

## 검증 근거

- Description: `docs/Wireframe/38-X-16-password-reset-confirm/description.md`
- Route map: `docs/sitemap.md`
- Source: `src/app/password-reset/confirm/page.tsx`
- Form: `src/components/auth/PasswordResetConfirmForm.tsx`
- Error mapping: `src/lib/auth/error-mapping.ts`
