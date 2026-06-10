# 26-X-04 구독 관리 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-04 / `/subscription`
- **audience**: user
- **상태**: PASS
- **host**: 단독 페이지

## 2. 보정 요약
- 기존 P2였던 사용자 화면 IA 코드 노출을 제거했다. `SubscriptionShell`은 더 이상 `<Tag>X-04</Tag>`를 렌더하지 않는다.
- 구독 없음 branch와 결제 이력/도움말 영역에 회귀 검증용 test id를 추가했다: `subscription-shell`, `subscription-current-card`, `subscription-no-sub`, `subscription-start-cta`, `subscription-change-card`, `subscription-change-plan`, `subscription-change-payment`, `subscription-cancel`, `subscription-history-card`, `subscription-help-card`.
- X-04 전용 e2e를 추가해 mobile/tablet/desktop에서 IA 코드 미노출, 구독 없음 요약, 변경 액션 미노출, 결제 이력 빈 상태, 도움말 패널을 검증했다.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 학습자 사이드 내비 (#1) | 구독 관리에서도 학습자 메뉴와 설정 위치 유지 | 일치 | `/subscription` 인증 접근, workspace shell 렌더 |
| 현재 구독 요약 (#2) | 플랜/주기/다음 결제일/사용량, 구독 없음 배지 | 일치(예외 경로) | capture: `currentCardVisible` true, `noSubVisible` true, `noSubBadgeVisible` true |
| 변경/취소 액션 (#3) | 구독 상태에서 플랜 변경/취소/결제수단 변경 | 일치(구독 없음 branch) | no-sub 상태에서는 `changeCardCount` 0, 구독 시작 CTA로 유도 |
| 결제 이력 (#4) | 10개/페이지 표, 빈 상태/재시도 | 일치 | capture: `historyCardVisible` true, `emptyHistoryVisible` true |
| 우측 도움말 (#5) | 정책/환불/플랜 차이/고객지원 4항목 이하 | 일치 | capture: `helpCardVisible` true |
| deferred billing 경계 | 실제 결제 provider/checkout은 아직 구현하지 않음 | 일치 | `docs/development/deferred-scope.md`에 따라 provider 호출 없이 shell 상태만 표시 |

**종합 verdict: PASS.**

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/26-X-04-subscription-management.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/26-X-04-subscription-management/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/26-X-04-subscription-management/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/26-X-04-subscription-management/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/26-X-04-subscription-management/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/26-X-04-subscription-management/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/components/settings/SubscriptionShell.tsx tests/components/settings/SubscriptionPaywallChrome.test.tsx tests/e2e/screens/subscription-management.spec.ts`
- `pnpm exec vitest run tests/components/settings/SubscriptionPaywallChrome.test.tsx`
- `pnpm exec playwright test tests/e2e/screens/subscription-management.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-04 캡처 생성 스크립트: mobile/tablet/desktop headingVisible true, iaCodeCount 0, current/no-sub/start CTA visible, changeCardCount 0, history empty visible, help visible, console/page error 0

## 6. 검증 제한
- 실제 구독 보유 상태의 변경/취소/결제수단 policy modal branch는 컴포넌트 테스트로만 일부 확인했고, 실계정 e2e로는 확인하지 않았다.
- 실제 결제 checkout, payment provider, invoice/receipt 생성은 deferred scope라 구현하거나 검증하지 않았다.
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패한다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단된다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패한다. X-04 대상 검증은 기존 `tests/e2e/auth-state/student.json`을 사용하는 `--no-deps` 실행으로 확인했다.
