# 29-X-07 약점 기반 추천 페이지 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-07 / `/practice/weakness`
- **audience**: user
- **상태**: PASS
- **host**: 단독 페이지. 현재 감사 계정은 free 플랜 잠금 예외 경로다.

## 2. 보정 요약
- 기존 구현은 free 플랜에서 본문 추천을 잠그는 예외 경로와 일치했다.
- 잠금 visual을 텍스트 이모지 대신 `lucide-react` `LockKeyhole` 아이콘으로 교체하고, X-07 감사가 안정적으로 잡을 수 있도록 locked shell/card/CTA test id를 추가했다.
- X-07 전용 e2e를 추가해 free 계정에서 약점 분석 본문이 노출되지 않고, 업그레이드/문제 목록 CTA가 올바른 라우트로 연결되는지 검증했다.

## 3. Layer 1 - SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 학습자 사이드 내비 (#1) | 인증 사용자 workspace 안에서 학습 화면으로 접근 | 일치 | `current.json`: `/practice/weakness` 도달, `headingVisible` true |
| 약점 탭/진단/추천 본문 (#2-#5) | 유료 플랜에서만 본문 노출, 무료 플랜은 잠금 안내 | 일치(예외 경로) | `lockedShellVisible` true, `lockedCardVisible` true, `paidBodyVisible` false |
| 잠금 안내 | 현재 플랜과 업그레이드 이유를 표시 | 일치 | `lockTitleVisible` true, `lockBodyVisible` true |
| 추천 학습 CTA (#6) | 선택 추천 학습 또는 문제 목록 이동 | 일치(잠금 분기) | `upgradeHref` `/paywall`, `problemListHref` `/practice/problems` |
| 반응형 배치 | mobile/tablet/desktop에서 잠금 카드와 CTA가 읽히게 배치 | 일치 | mobile/desktop screenshot 시각 확인, console/page error 0 |

**종합 verdict: PASS.**

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/29-X-07-weakness-based-recommendations.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/29-X-07-weakness-based-recommendations/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/29-X-07-weakness-based-recommendations/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/29-X-07-weakness-based-recommendations/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/29-X-07-weakness-based-recommendations/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/29-X-07-weakness-based-recommendations/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint "src/app/(workspace)/practice/weakness/page.tsx" tests/e2e/screens/weakness-recommendations.spec.ts`
- `pnpm exec vitest run tests/components/practice/WeaknessView.test.tsx tests/lib/practice/weakness.test.ts tests/integration/weakness-flow.test.ts`
- `pnpm exec playwright test tests/e2e/screens/weakness-recommendations.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-07 캡처 생성 스크립트: mobile/tablet/desktop `status` PASS, authenticated route/free-plan lock/actions/paid-body-hidden assertions true, dev overlay false, console/page error 0

## 6. 검증 제한
- 유료 플랜의 약점 탭, 진단 카드, 추천 카드 본문은 현재 세션의 테스트 계정이 free 플랜이라 e2e로 실측하지 않았다. 해당 본문 로직은 `WeaknessView`, `weakness.ts`, `weakness-flow` 테스트로 검증했다.
- 추천 카드 클릭의 실제 `recommendation_items.status='consumed'` 업데이트와 `study_events` insert는 이번 free-plan 잠금 감사 범위 밖이다.
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패한다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단된다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패한다. X-07 대상 검증은 기존 `tests/e2e/auth-state/student.json`을 사용하는 `--no-deps` 실행으로 확인했다.
