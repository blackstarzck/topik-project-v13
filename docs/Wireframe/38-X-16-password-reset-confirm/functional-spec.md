# X-16 새 비밀번호 설정 기능명세

> 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.

## 화면 목적

X-06 비밀번호 재설정 요청 후 이메일 링크를 연 사용자가 새 비밀번호를 설정하고 로그인으로 복귀하게 한다.

## 사용자와 권한

- Audience: public
- 세션 없이 route 자체는 열릴 수 있으나 저장 action은 recovery session이 필요하다.
- 권한 기준: public route이며 인증 세션이 없어도 접근할 수 있어야 한다.

## 진입/이탈 흐름

- Route: `/password-reset/confirm`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: X-06 재설정 메일 링크가 `/auth/callback?type=recovery`를 거친 뒤 `/password-reset/confirm`으로 이동한다.
- 이탈 경로: 비밀번호 변경 완료 후 A-02 로그인으로 이동한다.
- 화면 내부 동작: 새 비밀번호 입력, 강도/일치 확인, `updateUser` 요청, 오류 표시를 처리한다.

## 주요 기능

- 새 비밀번호 입력
- 비밀번호 확인 일치 검증
- 8-64자 길이 검증
- 비밀번호 강도/규칙 실시간 표시 (4단계 강도 바 + 길이·대소문자·숫자·특수문자 체크리스트)
- 링크 만료 시간 안내 (절대/상대 병기)
- 보안 마스코트 (이모지 fallback)
- Supabase Auth password update
- 성공 후 로그인 복귀
- 링크 만료/세션 끊김 복구 안내 (재시도 + 재발송 링크)

## 상태/오류

- 제출 중 button loading으로 중복 제출을 막는다.
- provider raw error는 노출하지 않고 `mapSupabaseErrorCode` → `REASON_CONTENT`의 canonical message를 사용한다.
- 저장 실패 시 warning alert(`data-testid="password-reset-confirm-error"`)와 `/password-reset` 재발송 링크를 노출한다.

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `Supabase Auth:updateUser` | `password` | auth action | 새 비밀번호 저장 | recovery session 필요 | `src/components/auth/PasswordResetConfirmForm.tsx` | Supabase Auth 내부 저장소는 앱 DB table로 직접 조회하지 않음 |

## 현재 구현 상태

- `src/app/password-reset/confirm/page.tsx`가 `PasswordResetConfirmForm`을 렌더링한다.
- `PasswordResetConfirmForm`("use client")은 antd `Card`/`Form`/`Input.Password`로 카드형 폼을 그린다.
- 흐름 안내 헤더 카피 + `AuthMascot`(🔐 이모지 fallback) + 만료 시간 안내(절대/상대 병기)를 표시한다.
- `PasswordStrengthMeter`로 입력 중 강도/규칙을 실시간 표시한다(scoring은 `password-strength.ts`).
- 8-64자 길이와 확인값 일치 검증을 Form rules로 적용한다.
- `supabase.auth.updateUser({ password })`를 호출하고, 성공 시 `/login`으로 이동한다.
- 실패 시 canonical 한국어 message error + warning alert + `/password-reset` 링크를 보여준다.

## 코드 구현 근거

- `PasswordResetConfirmPage` - `src/app/password-reset/confirm/page.tsx`
- `PasswordResetConfirmForm`, `handleSubmit` - `src/components/auth/PasswordResetConfirmForm.tsx`
- `mapSupabaseErrorCode` - `src/lib/auth/error-mapping.ts`
- `GET` route handler recovery branch - `src/app/auth/callback/route.ts`

## 미구현/불일치

- recovery session이 없는 직접 진입을 사전에 판별하는 별도 server guard는 없다. 잘못된 진입은 저장 시도가 실패하며 실패 알림으로 안내하는 reactive 방식이다(honest seam).
- 만료 시각은 진입 시각 + 약 60분 추정값이다. 정확한 발급 시각은 이메일에서 진입하므로 클라이언트에 없어 "약"으로 명시한다.
- 비밀번호 정책은 8-64자 길이 + 확인값 일치까지를 강제하며, 강도/규칙 체크리스트는 권장 안내(차단 아님)이다.

## 추가 발견 후보

- 만료 링크/세션 상태를 더 명확히 판별하려면 `onAuthStateChange`(`PASSWORD_RECOVERY`)나 `getSession` 기반 진입 가드와 reason별 copy가 필요하다.
- 보안 정책 강화 시 대소문자/숫자/기호 의무화와 유출 비밀번호 차단을 별도 명세해야 한다.

## 수용 기준

- 기존 34개 Wireframe 이후 추가된 코드 기준 화면임을 명시한다.
- `/password-reset/confirm`은 X-06과 별도 IA 문서로 추적된다.
- 8-64자 길이와 확인값 일치 검증이 문서화되어 있다.
- 강도/규칙 실시간 표시, 마스코트, 만료 시간(절대/상대 병기) 안내가 X-06 region 규약과 정렬된다.
- 성공은 `/login`, 실패는 `/password-reset` 재발송 복구 경로로 이어진다.
- raw provider 오류와 token 값이 UI에 노출되지 않는다.
