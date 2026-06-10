# 33-X-11 인증 에러 와이어프레임 리뷰

## 1. 메타
- **IA / route**: X-11 / `/auth/error?reason=<code>` (public)
- **Audience**: public
- **상태**: PASS
- **Host**: 단독 public 인증 에러 페이지

## 2. 보정 요약
- `AuthErrorCard`의 secondary CTA 분기에서 deprecated Next `Link legacyBehavior` wrapper를 제거했다.
- X-11 전용 e2e로 두 감사 분기를 고정했다.
  - `otp_expired`: 이메일 입력, countdown, 비활성 resend CTA, secondary CTA, escape link.
  - `over_request_rate_limit`: countdown, 비활성 retry CTA, 이메일 입력 없음, escape link.
- 두 변형 모두 mobile/tablet/desktop에서 캡처했으며 dev overlay, page error, console error, 500 response가 없었다.

## 3. Layer 1 - SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 에러 카드 (#1) | 인증 callback 실패 사유를 중앙 카드로 안내 | Pass | `current.json`: 두 감사 reason 모두 `cardVisible` true |
| 사유별 메시지 (#2) | canonical 한국어 문구, raw provider error 미노출 | Pass | e2e에서 `error_description` 주입, `rawProviderTextExposed` false |
| 주요 CTA (#3) | 사유별 action, rate-limit/countdown 중 비활성 | Pass | `current.json`: countdown 중 `primaryDisabled` true |
| Retry-After countdown (#4) | rate-limit 계열 사유에서 countdown 표시 | Pass | `current.json`: otp와 ratelimit 분기 모두 `countdownVisible` true |
| 이메일 prefill (#5) | resend reason에서만 편집 가능한 email input 표시 | Pass | `otp_expired` email field visible, `over_request_rate_limit` email field absent |
| 보조 링크 (#6) | 막다른 상태를 피하는 escape route 제공 | Pass | `current.json`: 모든 capture에서 `escapeVisible` true |

**종합 verdict: PASS.**

## 4. 증거
- Report: `docs/design-review-result/wireframe-ui-audit/2026-06-10/33-X-11-auth-error.html`
- Structured findings: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/33-X-11-auth-error/findings.json`
- Current capture data: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/33-X-11-auth-error/current.json`
- Screenshots:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/33-X-11-auth-error/otp-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/33-X-11-auth-error/otp-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/33-X-11-auth-error/otp-1280.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/33-X-11-auth-error/ratelimit-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/33-X-11-auth-error/ratelimit-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/33-X-11-auth-error/ratelimit-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/components/auth/AuthErrorCard.tsx tests/e2e/screens/auth-error.spec.ts`
- `pnpm exec vitest run tests/lib/auth/error-mapping.test.ts`
- `pnpm exec playwright test tests/e2e/screens/screens-public.spec.ts -g "X-11" --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- `pnpm exec playwright test tests/e2e/screens/auth-error.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-11 capture script: otp/ratelimit 변형을 360/768/1280에서 캡처했고 status PASS.

## 6. 검증 한계
- 재전송 action 자체는 Supabase Auth mail endpoint 호출 가능성이 있어 이 감사에서 submit하지 않았다. UI 분기, cooldown 상태, raw error 비노출은 검증했다.
- 전체 lint/typecheck와 기본 Playwright setup은 unrelated auth/landing/legal worktree 변경 때문에 계속 차단되어 있다.
