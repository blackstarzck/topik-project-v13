# 24-X-02 성장 대시보드 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-02 / `/growth`
- **audience**: user
- **상태**: PASS
- **host**: 단독 페이지

## 2. 보정 요약
- 기존 P2였던 free 잠금 상태의 문구/화면 불일치를 수정했다.
- `GrowthDashboard`에서 KPI/목표 없음 안내를 `reportLocked` 조건 밖으로 이동했다. free 플랜도 기본 KPI 4개를 먼저 보고, 상세 성장 리포트 영역만 잠긴다.
- `GrowthDashboard`와 `GrowthLockedReport`에 회귀 검증용 test id를 추가했다: `growth-kpi-grid`, `growth-kpi-average`, `growth-kpi-attempts`, `growth-kpi-improvement`, `growth-kpi-goal`, `growth-no-goal`, `growth-locked-report`, `growth-upgrade-cta`, `growth-manage-cta`.
- X-02 전용 e2e를 추가해 mobile/tablet/desktop에서 KPI 4개와 잠금 CTA, 상세 차트 미노출을 검증했다.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 학습자 사이드 내비 (#1) | 성장 리포트 메뉴 유지, 권한 없는 리포트는 잠금 안내 | 일치 | `/growth` 인증 접근, free 잠금 카드와 업그레이드/구독 관리 CTA 표시 |
| KPI 카드 (#2) | 평균 점수, 풀이 수, 개선률, 목표 달성률 4개 고정 | 일치 | e2e/capture: `kpiCardCount` 4 |
| 성장 차트 (#3) | 유료 상세 리포트 영역, free는 잠금 | 일치 | free 잠금 상태에서 `trendChartCount` 0 |
| 약점 매트릭스 (#4) | 유료 상세 리포트 영역, 색상만으로 의미 전달 금지 | 일치(잠금) | free 상태에서는 잠금 카드의 텍스트 안내와 CTA로 대체 |
| 인사이트 (#5) | 유료 상세 리포트 영역, 3개 이하 | 일치(잠금) | free 상태에서는 잠금 카드의 텍스트 안내와 CTA로 대체 |
| 하단 요약/추천 (#6) | 추천 5개 이하, 없으면 CTA | 일치(잠금) | free 상태에서는 상세 리포트 잠금으로 대체 |

**종합 verdict: PASS.**

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/24-X-02-growth-dashboard.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/24-X-02-growth-dashboard/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/24-X-02-growth-dashboard/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/24-X-02-growth-dashboard/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/24-X-02-growth-dashboard/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/24-X-02-growth-dashboard/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/components/growth/GrowthDashboard.tsx src/components/growth/GrowthLockedReport.tsx tests/components/growth/GrowthChrome.test.tsx tests/e2e/screens/growth-dashboard.spec.ts`
- `pnpm exec vitest run tests/components/growth/GrowthChrome.test.tsx`
- `pnpm exec playwright test tests/e2e/screens/growth-dashboard.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-02 캡처 생성 스크립트: mobile/tablet/desktop kpiGridVisible true, kpiCardCount 4, lockedReportVisible true, upgrade/manage enabled, trendChartCount 0, console/page error 0

## 6. 검증 제한
- 유료 플랜 unlock 상태의 차트/약점/인사이트/추천 전체 화면은 현재 free 테스트 계정으로 실측하지 않았다.
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패한다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단된다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패한다. X-02 대상 검증은 기존 `tests/e2e/auth-state/student.json`을 사용하는 `--no-deps` 실행으로 확인했다.
