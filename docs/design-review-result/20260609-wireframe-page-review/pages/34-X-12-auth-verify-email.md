# 34-X-12 인증 메일 확인 안내 와이어프레임 리뷰

## 1. 메타
- **IA / route**: X-12 / `/auth/verify-email` (public)
- **Audience**: public
- **상태**: PASS
- **Host**: 가입 직후 인증 메일 안내 페이지

## 2. 보정 요약
- 코드 동작 보정은 필요하지 않았다.
- X-12 전용 e2e를 추가해 Supabase resend endpoint를 intercept하고, 실제 메일 발송 없이 성공 후 cooldown 상태를 검증했다.
- 캡처는 Gmail 테스트 주소를 사용해 받은편지함 shortcut, resend 버튼, cooldown, disabled 상태를 mobile/tablet/desktop에서 확인했다.

## 3. Layer 1 - SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 안내 카드 (#1) | 가입 직후 이메일 확인을 안내하는 중앙 카드 | Pass | `current.json`: HTTP 200, heading/card content rendered |
| 이메일 표시 (#2) | 가입한 이메일을 표시하고 resend input에 prefill | Pass | `current.json`: `emailDisplayed` true, `inputValue` `verify.audit@gmail.com` |
| 인증 메일 재전송 (#3) | 사용자가 명시적으로 클릭해야 resend 실행 | Pass | e2e/capture: intercepted `/auth/v1/resend` request count 1 after click |
| Cooldown timer (#4) | 성공 후 countdown 표시, 버튼/input 비활성화 | Pass | `current.json`: `countdownVisible`, `resendDisabled`, `inputDisabled` true |
| 이메일이 안 보일 때 안내 (#5) | 스팸함 확인, inbox shortcut, 다른 이메일 가입 링크 | Pass | `current.json`: `helpVisible` true, `openInboxVisible` true |
| Escape link (#6) | 로그인/가입/홈으로 빠져나갈 수 있음 | Pass | mobile/desktop screenshot에서 하단 escape links 표시 |

**종합 verdict: PASS.**

## 4. 증거
- Report: `docs/design-review-result/wireframe-ui-audit/2026-06-10/34-X-12-auth-verify-email.html`
- Structured findings: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/34-X-12-auth-verify-email/findings.json`
- Current capture data: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/34-X-12-auth-verify-email/current.json`
- Screenshots:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/34-X-12-auth-verify-email/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/34-X-12-auth-verify-email/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/34-X-12-auth-verify-email/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint tests/e2e/screens/verify-email.spec.ts`
- `pnpm exec playwright test tests/e2e/screens/verify-email.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- `pnpm exec playwright test tests/e2e/screens/screens-public.spec.ts -g "X-12" --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-12 capture script: resend success intercept 후 cooldown 상태를 360/768/1280에서 캡처했고 status PASS.

## 6. 검증 한계
- 실제 Supabase Auth 메일 발송은 실행하지 않았다. e2e와 capture 모두 `/auth/v1/resend`를 intercept해 UI 계약과 payload만 검증했다.
- 전체 lint/typecheck와 기본 Playwright setup은 unrelated auth/landing/legal worktree 변경 때문에 계속 차단되어 있다.
