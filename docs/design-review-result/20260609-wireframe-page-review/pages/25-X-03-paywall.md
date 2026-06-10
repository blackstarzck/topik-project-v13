# 25-X-03 페이월 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-03 / `/paywall`
- **audience**: user
- **상태**: PASS
- **host**: 단독 페이지

## 2. 보정 요약
- 기존 P2였던 사용자 화면 IA 코드 노출을 제거했다. `PaywallShell`은 더 이상 `<Tag>X-03</Tag>`를 렌더하지 않는다.
- 분기 플랜의 stale seed 혜택 문구를 실제 가격 기준 할인율로 정규화했다. 월간 9,900원 기준 분기 26,700원은 약 10% 할인으로 표시하고, 연간 99,000원은 17% 할인으로 유지한다.
- `PaywallShell`에 회귀 검증용 test id를 추가했다: `paywall-shell`, `paywall-plan-grid`, `paywall-plan-monthly`, `paywall-plan-quarterly`, `paywall-plan-yearly`, `paywall-select-*`, `paywall-stub-note`, `paywall-benefits-panel`, `paywall-payment-info`.
- X-03 전용 e2e를 추가해 mobile/tablet/desktop에서 IA 코드 미노출, 3개 결제 주기 카드, 할인 문구, 결제 deferred 안내를 검증했다.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 결제 선택 제목 (#1) | 유료 기능 진입 시 단일 구독 결제 선택 단계 안내, 사용자 화면 IA 코드 미노출 | 일치 | capture: `headingVisible` true, `iaCodeCount` 0 |
| 결제 주기 카드 3열 (#2) | 월간, 분기, 연간 카드 비교, 추천 배지 1개 | 일치 | capture/e2e: `paywall-plan-monthly`, `paywall-plan-quarterly`, `paywall-plan-yearly` 표시 |
| 결제 주기 선택 CTA (#3) | 카드별 CTA 1개, 결제 준비/로딩 안내 | 일치 | e2e: 분기 CTA 클릭 후 결제 연동 준비 중 메시지 표시, `/paywall` 유지 |
| 혜택/지원 패널 (#4) | 혜택 4개 이하, 지원 문의 CTA | 일치 | capture: `benefitsPanelVisible` true |
| 결제 보조 정보 (#5) | 환불, 세금계산서, 보안 결제, 기관 문의 안내 | 일치 | capture: `paymentInfoVisible` true |
| deferred billing 경계 | 실제 결제 provider/checkout은 아직 구현하지 않음 | 일치 | `docs/development/deferred-scope.md`에 따라 stub 안내만 유지 |

**종합 verdict: PASS.**

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/25-X-03-paywall.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/25-X-03-paywall/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/25-X-03-paywall/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/25-X-03-paywall/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/25-X-03-paywall/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/25-X-03-paywall/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/components/settings/PaywallShell.tsx src/components/settings/billing-data.ts tests/components/settings/SubscriptionPaywallChrome.test.tsx tests/e2e/screens/paywall.spec.ts`
- `pnpm exec vitest run tests/components/settings/SubscriptionPaywallChrome.test.tsx`
- `pnpm exec playwright test tests/e2e/screens/paywall.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-03 캡처 생성 스크립트: mobile/tablet/desktop headingVisible true, iaCodeCount 0, plan cards 3개 visible, quarterlyDiscountVisible true, quarterlyStaleDiscountCount 0, yearlyDiscountVisible true, stubNoteCount 3, console/page error 0

## 6. 검증 제한
- 기존 구독자 redirect branch는 컴포넌트 테스트/실측 범위에 포함하지 않았다.
- 실제 결제 checkout, payment provider, invoice/receipt 생성은 deferred scope라 구현하거나 검증하지 않았다.
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패한다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단된다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패한다. X-03 대상 검증은 기존 `tests/e2e/auth-state/student.json`을 사용하는 `--no-deps` 실행으로 확인했다.
