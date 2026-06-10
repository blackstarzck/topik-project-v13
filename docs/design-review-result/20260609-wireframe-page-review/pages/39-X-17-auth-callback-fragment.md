# 39-X-17 인증 콜백 fragment 처리 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-17 / `/auth/callback-fragment`
- **audience**: public
- **캡처 상태**: rendered / PASS
- **host**: 단독 페이지. Supabase implicit auth fragment fallback을 브라우저에서 처리한다.
- **SOT 이미지**: 없음. 기존 34개 Wireframe 이후 코드 기준으로 추가된 transient support page라 텍스트 SOT와 현재 구현을 대조했다.

## 2. 판정
**PASS**

이전 리뷰의 남은 보강점이었던 정상 fragment 경로를 실토큰 없이도 synthetic JWT + intercepted Supabase user response로 검증했다. X-17은 status/spinner surface를 표시하고, token fragment 성공 시 sanitized relative `next=/terms`로 이동하며 최종 URL에 token/hash를 남기지 않는다. error fragment와 missing fragment도 각각 canonical X-11 오류 화면으로 이동한다.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| Callback container(#1) | 일치 | `AppCard`가 `role="status"` / `aria-live="polite"` 상태 카드로 렌더된다. |
| Spinner(#2) | 일치 | synthetic `setSession` user lookup을 보류한 상태에서 antd `Spin`과 상태 문구가 캡처된다. |
| Status text(#3) | 일치 | 처리 중 “인증을 확인 중이에요...” 상태가 표시된다. |
| Fragment parser(#4) | 일치 | `error_code`, `access_token`, `refresh_token` fragment 분기가 e2e로 검증됐다. |
| Safe redirect(#5) | 일치 | token 성공은 sanitized relative `next`로 이동하고, error/missing은 `/auth/error?reason=...`으로 이동한다. |

## 4. Layer 2 — 멘탈 모델 / 보안 상태 검증
- **정상 token fragment**: synthetic JWT와 refresh token을 넣으면 `setSession`이 `/auth/v1/user` 검증 요청을 보낸다. e2e에서 해당 요청을 synthetic user로 응답해 `/terms` 이동까지 확인했다.
- **URL 정리**: 성공 redirect 후 최종 URL에는 `access_token`, `refresh_token`, hash가 남지 않는다.
- **error fragment**: `#error_code=otp_expired`는 `/auth/error?reason=otp_expired`로 이동하고, raw provider description은 화면에 노출되지 않는다.
- **missing fragment**: token/error가 모두 없으면 `/auth/error?reason=unknown`으로 이동한다.
- **반응형**: 360/768/1280 status 캡처 모두 레이아웃 겹침, 잘림, dev error overlay가 없다.

## 5. 증거
- Report: `docs/design-review-result/wireframe-ui-audit/2026-06-10/39-X-17-auth-callback-fragment.html`
- Structured findings: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/39-X-17-auth-callback-fragment/findings.json`
- Current capture data: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/39-X-17-auth-callback-fragment/current.json`
- Screenshots:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/39-X-17-auth-callback-fragment/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/39-X-17-auth-callback-fragment/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/39-X-17-auth-callback-fragment/desktop-1280.png`

## 6. 검증
- `pnpm exec eslint tests/e2e/screens/auth-callback-fragment.spec.ts`
- `pnpm exec vitest run tests/lib/auth/error-mapping.test.ts`
- `pnpm exec playwright test tests/e2e/screens/auth-callback-fragment.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- `pnpm exec playwright test tests/e2e/screens/screens-public.spec.ts -g "X-17" --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`

## 7. 남은 리스크
- 실제 Supabase 이메일 링크로 발급된 production token은 사용하지 않았다. 대신 Supabase client가 요구하는 JWT 형태와 `/auth/v1/user` 검증 응답을 Playwright에서 통제해 success 분기와 URL 보안 계약을 검증했다.
