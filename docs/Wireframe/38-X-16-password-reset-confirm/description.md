# 새 비밀번호 설정

- Source: 38 X-16 새 비밀번호 설정
- Code: X-16
- Added-screen note: 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.
- Wireframe: (해당 없음 - 기존 34개 이후 추가된 코드 기준 화면, wireframe.png 추후 추가)

## Wireframe Number Map

| No. | Area | Description |
| --- | --- | --- |
| 1 | Page title | "새 비밀번호 설정" 제목을 표시한다. |
| 2 | Instruction copy | 새 비밀번호를 8-64자 사이로 입력하라고 안내한다. |
| 3 | New password field | 새 비밀번호 입력 필드와 길이 검증을 제공한다. |
| 4 | Password confirmation field | 비밀번호 확인 입력과 일치 검증을 제공한다. |
| 5 | Submit CTA | "비밀번호 변경" CTA를 제공하고 제출 중 loading 상태를 표시한다. |
| 6 | Failure alert | 링크 만료/세션 끊김 시 재시도와 `/password-reset` 재발송 링크를 제공한다. |

## Detailed Description

### 38 X-16 새 비밀번호 설정

1
■ 비밀번호 재설정 완료 단계

▣ 설명
• X-06 비밀번호 재설정 메일 요청 후 사용자가 이메일 링크를 열었을 때 도착하는 confirm 페이지다.
• Supabase recovery session이 있는 브라우저에서 새 비밀번호를 저장한다.
• 성공하면 다시 로그인해야 한다는 메시지와 함께 A-02 로그인으로 이동한다.

2
■ 입력 검증

▣ 설명
• 새 비밀번호는 필수이며 8-64자 범위를 적용한다.
• 확인 입력은 새 비밀번호와 일치해야 한다.
• 필드 오류는 해당 입력 아래에 표시한다.

3
■ 저장/실패 처리

▣ 설명
• 제출 중 CTA는 loading 상태로 중복 제출을 막는다.
• `supabase.auth.updateUser({ password })` 실패 시 raw provider 오류 대신 canonical reason 매핑 문구를 사용한다.
• 링크 만료나 세션 끊김 가능성을 안내하고 `/password-reset`에서 링크를 다시 받을 수 있게 한다.

## 화면 목적

비밀번호 재설정 링크를 받은 사용자가 새 비밀번호를 안전하게 저장하고 로그인으로 복귀하게 한다.

## 분기

- 진입: X-06 재설정 메일 링크의 redirect target `/password-reset/confirm`.
- 성공: `/login`.
- 실패: 현재 화면 유지 + `/password-reset` 재발송 링크.
- 세션/토큰 없음: 저장 실패 안내 후 재발송 링크 제공.

## 피드백

- 성공: "비밀번호가 변경되었습니다. 다시 로그인하세요."
- 실패: "비밀번호를 변경하지 못했어요" 경고와 재발송 링크.
- raw auth error는 UI에 그대로 노출하지 않는다.

## 예외 상황

- 만료된 링크, 끊긴 세션, provider 오류는 같은 recovery 안내로 묶는다.
- 브라우저 새로고침 후 recovery session이 사라질 수 있으므로 입력값 보존을 보장하지 않는다.
