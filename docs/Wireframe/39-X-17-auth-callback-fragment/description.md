# 인증 콜백 fragment 처리

- Source: 39 X-17 인증 콜백 fragment 처리
- Code: X-17
- Added-screen note: 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.
- Wireframe: (해당 없음 - 기존 34개 이후 추가된 코드 기준 화면, wireframe.png 추후 추가)

## Wireframe Number Map

| No. | Area | Description |
| --- | --- | --- |
| 1 | Callback container | 공개 callback support page의 중앙 카드 영역. SR 전용 제목과 `role="status"` aria-live 영역으로 상태를 알린다. |
| 2 | Spinner | fragment 파싱과 session 설정 중 antd `Spin`을 표시한다. |
| 3 | Status text | "인증을 확인 중이에요…"(처리 중) 또는 "이동 중이에요…"(redirect 직전) 상태 문구를 표시한다. |
| 4 | Fragment parser | URL hash의 `error_code`, `access_token`, `refresh_token`을 browser에서만 읽는다(`parseAuthFragment`). |
| 5 | Safe redirect | 성공 시 sanitized `next`, 실패 시 `/auth/error?reason=...`으로 `router.replace` 이동한다. |

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
• `#error_code`가 있으면 `mapSupabaseErrorCode`로 canonical reason에 매핑해 X-11 `/auth/error?reason=...`로 이동한다.
• `#access_token`과 `#refresh_token`이 모두 있으면 browser supabase client의 `auth.setSession`을 호출한다.
• `next`는 page 진입 시 server에서 `sanitizeNext`를 통과한 relative URL만 component로 전달한다(기본값 `/dashboard`).
• token, refresh token, raw error description을 화면이나 URL에 표시하지 않는다.

3
■ 실패 처리

▣ 설명
• token도 error도 없으면 `/auth/error?reason=unknown`으로 이동한다.
• `setSession` 실패는 console error 기록 후 canonical reason으로 auth error 페이지에 보낸다.

## 화면 목적

Supabase implicit flow 또는 오래된 인증 링크의 URL fragment를 안전하게 처리해 세션을 설정하거나 인증 오류 화면으로 이동시킨다.

## 분기

- 진입: `/auth/callback` route handler가 query(`token_hash`/`code`/`error_code`) 없는 callback을 `next`를 query로 붙여 `/auth/callback-fragment`로 redirect. 브라우저가 RFC 7231에 따라 fragment를 새 location에 보존한다.
- loading: mount 직후 fragment를 파싱하고 `setSession`을 호출하는 동안 spinner + "인증을 확인 중이에요…".
- success-redirect: `setSession` 성공 시 sanitized `next`(기본 `/dashboard`)로 이동.
- error-reason: `#error_code` 또는 `setSession` 실패 시 `/auth/error?reason=<canonical>`로 이동.
- missing-fragment: token도 error도 없으면 `/auth/error?reason=unknown`으로 이동.

## 피드백

- 처리 중: "인증을 확인 중이에요…"
- redirect 직전(success/error/missing 공통): "이동 중이에요…"
- 세부 provider 오류나 token 값은 보여주지 않는다.

## 예외 상황

- 이 페이지는 브라우저 전용 token 처리를 하므로 server-side 렌더에서 fragment를 읽으려 하지 않는다(`"use client"` component가 mount 후 `window.location.hash` 파싱).
- `next` open redirect는 허용하지 않는다(`//`, 절대 URL, scheme 포함 값은 `/dashboard`로 fallback).
- `setSession` 실패는 console error로만 기록하고 UI에는 canonical reason 화면으로만 연결한다.

## Navigation

- 진입 경로: `/auth/callback`에 query 없이 implicit fragment만 있는 경우 fallback 화면으로 진입한다.
- 이탈 경로: `setSession` 성공 시 B-01 또는 sanitized `next` 경로로 이동하고, fragment 실패/unknown 오류는 X-11로 이동한다.
- 화면 내부 동작: fragment 파싱, session 설정, spinner, 오류 매핑과 안전한 next 경로 정리를 처리한다.
