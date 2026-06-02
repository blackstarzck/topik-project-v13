# 인증 콜백 fragment 처리

- Source: 39 X-17 인증 콜백 fragment 처리
- Code: X-17
- Added-screen note: 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.
- Wireframe: (해당 없음 - 기존 34개 이후 추가된 코드 기준 화면, wireframe.png 추후 추가)

## Wireframe Number Map

| No. | Area | Description |
| --- | --- | --- |
| 1 | Callback container | 공개 callback support page의 중앙 카드 영역을 제공한다. |
| 2 | Spinner | fragment 파싱과 session 설정 중 spinner를 표시한다. |
| 3 | Status text | "인증을 확인 중이에요..." 또는 "이동 중이에요..." 상태 문구를 표시한다. |
| 4 | Fragment parser | URL hash의 `error_code`, `access_token`, `refresh_token`을 browser에서만 읽는다. |
| 5 | Safe redirect | 성공 시 sanitized `next`, 실패 시 `/auth/error?reason=...`으로 이동한다. |

## Detailed Description

### 39 X-17 인증 콜백 fragment 처리

1
■ implicit auth fragment fallback

▣ 설명
• `/auth/callback` route handler가 URL query를 받지 못하고 fragment가 브라우저에 남는 경우를 처리하는 client page다.
• 서버는 `#access_token` 같은 fragment를 볼 수 없으므로 이 화면에서만 `window.location.hash`를 파싱한다.
• 사용자는 짧은 spinner와 상태 문구만 보고, 성공/실패 목적지로 자동 이동한다.

2
■ 보안 처리

▣ 설명
• `#error_code`가 있으면 canonical reason으로 매핑해 X-11 `/auth/error`로 이동한다.
• `#access_token`과 `#refresh_token`이 있으면 `supabase.auth.setSession`을 호출한다.
• `next`는 `sanitizeNext`를 통과한 relative URL만 허용한다.
• token이나 raw error description을 화면에 표시하지 않는다.

3
■ 실패 처리

▣ 설명
• token도 error도 없으면 `/auth/error?reason=unknown`으로 이동한다.
• `setSession` 실패는 console error 기록 후 canonical reason으로 auth error 페이지에 보낸다.

## 화면 목적

Supabase implicit flow 또는 오래된 인증 링크의 URL fragment를 안전하게 처리해 세션을 설정하거나 인증 오류 화면으로 이동시킨다.

## 분기

- 진입: `/auth/callback` route handler가 query 없는 callback을 `/auth/callback-fragment`로 redirect.
- 성공: sanitized `next` 또는 기본 목적지.
- 실패: `/auth/error?reason=<canonical>`.
- fragment 없음: `/auth/error?reason=unknown`.

## 피드백

- 처리 중: "인증을 확인 중이에요..."
- redirect 직전: "이동 중이에요..."
- 세부 provider 오류나 token 값은 보여주지 않는다.

## 예외 상황

- 이 페이지는 브라우저 전용 token 처리를 하므로 server-side 렌더에서 fragment를 읽으려 하지 않는다.
- `next` open redirect는 허용하지 않는다.
