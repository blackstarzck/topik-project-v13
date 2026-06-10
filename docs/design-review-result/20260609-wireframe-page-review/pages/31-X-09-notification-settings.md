# 31-X-09 알림 설정 페이지 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-09 / `/settings/notifications`
- **audience**: user
- **상태**: PASS
- **host**: 단독 페이지

## 2. 보정 요약
- 기존 구현은 채널, 조건, 미리보기, 발송 이력, 저장 CTA 구성을 이미 충족했다.
- 감사 e2e와 캡처 안정성을 위해 `NotificationPrefsForm`의 주요 영역과 저장 CTA에 test id만 추가했다. 저장 동작과 데이터 계약은 변경하지 않았다.
- X-09 전용 e2e를 추가해 저장을 누르지 않고 초기 저장 비활성화와 로컬 dirty 상태의 저장 활성화만 검증했다.

## 3. Layer 1 - SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 학습자 사이드 내비 (#1) | 인증 사용자 settings 화면에서 접근 | 일치 | `current.json`: `/settings/notifications` 도달, `headingVisible` true |
| 알림 채널 탭 (#2) | 이메일, Zalo, 둘 다 채널과 연동 상태 표시 | 일치 | `channelCardVisible` true, screenshot에 Zalo `미연동` 표시 |
| 알림 조건 입력 (#3) | 알림 유형, 리마인더 시간, 요일 설정 | 일치 | `conditionCardVisible` true, switch/time/day controls visible |
| 미리보기/알림 (#4) | 설정된 알림 문구와 발송 시점 예시, 발송 이력 표시 | 일치 | `previewCardVisible` true, `historyCardVisible` true |
| 저장 CTA (#5) | 변경 전 비활성화, 변경 후 활성화, 저장 중 중복 클릭 차단 | 일치 | `saveInitiallyDisabled` true, `saveEnabledAfterDirty` true |
| deferred transport 안내 | 실제 발송은 준비 중이며 현재는 preference 저장 범위 | 일치 | `deferredNoticeVisible` true |

**종합 verdict: PASS.**

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/31-X-09-notification-settings.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/31-X-09-notification-settings/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/31-X-09-notification-settings/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/31-X-09-notification-settings/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/31-X-09-notification-settings/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/31-X-09-notification-settings/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/components/settings/NotificationPrefsForm.tsx tests/e2e/screens/notification-settings.spec.ts`
- `pnpm exec vitest run tests/components/settings/NotificationPrefsForm.test.tsx`
- `pnpm exec playwright test tests/e2e/screens/notification-settings.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-09 캡처 생성 스크립트: mobile/tablet/desktop `status` PASS, authenticated route/preference regions/deferred copy/dirty-save-gate assertions true, dev overlay false, console/page error 0

## 6. 검증 제한
- 실제 저장 submit은 공유 테스트 계정의 notification settings를 변경하므로 이번 감사 e2e에서는 실행하지 않았다. 저장 payload와 diff는 `NotificationPrefsForm.test.tsx`로 검증했다.
- 실제 이메일/Zalo 발송 transport는 deferred scope라 구현/검증하지 않았다.
- mobile screenshot의 검은 `N` 배지는 Next dev indicator이며 앱 UI 또는 오류 overlay가 아니다.
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패한다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단된다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패한다. X-09 대상 검증은 기존 `tests/e2e/auth-state/student.json`을 사용하는 `--no-deps` 실행으로 확인했다.
