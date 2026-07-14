# 기관 초대 만료 정보 인라인 표시 수정 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 알림 목록에서 기관 초대의 상대 시간과 D-day/만료 상태를 같은 메타 정보 행에 나란히 표시한다.

**Architecture:** 기관 초대 만료 상태 계산과 번역은 기존 로직을 유지한다. `NotificationBell`에서 상대 시간과 만료 라벨만 공통 메타 래퍼로 묶고, 기존 알림에는 만료 라벨을 추가하지 않는다. 래퍼는 기존 CSS grid 안에서 가로 flex 행으로 렌더링한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Ant Design, Tailwind/CSS, Vitest, Playwright.

---

### Task 1: 인라인 메타 행 회귀 테스트 작성

**Files:**
- Modify: `tests/components/notifications/NotificationBell.test.tsx`

- [ ] **Step 1: 같은 메타 래퍼를 요구하는 실패 테스트를 추가한다.**

기관 초대 D-day 테스트에서 `D-1` 요소의 부모가 `app-notification-item__meta`이고, 그 안에 상대 시간과 만료 라벨이 함께 있는지 검증한다.

- [ ] **Step 2: 관련 테스트만 실행해 새 assertion이 실패하는지 확인한다.**

Run: `pnpm exec vitest run tests/components/notifications/NotificationBell.test.tsx -t "shows the institution invitation D-day"`

Expected: 현재 구현에는 메타 래퍼가 없으므로 `app-notification-item__meta` assertion이 실패한다.

### Task 2: 목록 UI를 가로 메타 행으로 변경

**Files:**
- Modify: `src/components/notifications/NotificationBell.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: 상대 시간과 만료 라벨을 공통 래퍼로 묶는다.**

`app-notification-item__time`과 조건부 `app-notification-item__expiry`를 `app-notification-item__meta` 안에 배치한다. 만료 상태 계산, 색상, 기존 알림 동작은 변경하지 않는다.

- [ ] **Step 2: 메타 래퍼를 가로 flex 행으로 스타일링한다.**

`.app-notification-item__meta`에 `display: flex`, `align-items: center`, `gap`을 적용해 `3주 전`과 `D-1`/`만료됨`이 같은 줄에 나오도록 한다. 기존 반응형 폭과 줄바꿈을 해치지 않도록 `flex-wrap: wrap`을 사용하지 않는다.

- [ ] **Step 3: 관련 Vitest를 다시 실행한다.**

Run: `pnpm exec vitest run tests/components/notifications/NotificationBell.test.tsx tests/theme/notification-shadow-surface.test.ts`

Expected: 알림 컴포넌트와 스타일 계약 테스트가 통과한다.

### Task 3: E2E 화면 검증

**Files:**
- Verify: `tests/e2e/screens/institution-invitation-expiry.spec.ts`

- [ ] **Step 1: desktop과 mobile에서 활성 D-day 및 만료 상태를 실행한다.**

Run: `pnpm exec playwright test tests/e2e/screens/institution-invitation-expiry.spec.ts --config=playwright.config.ts --project=desktop-1280 --project=mobile-360`

Expected: 활성 초대의 D-day, 모달 만료일, 만료 초대의 만료 라벨과 disabled 수락 동작이 통과한다.

- [ ] **Step 2: 실제 알림 패널 스크린샷으로 같은 줄 배치를 확인한다.**

활성 목록에서 상대 시간과 D-day가 한 행에 배치되는지, 만료 목록에서 상대 시간과 `만료됨`이 한 행에 배치되는지 desktop/mobile 화면으로 확인한다.

### Task 4: 전체 영향 범위 검증

**Files:**
- No source changes.

- [ ] **Step 1: 관련 단위 테스트를 실행한다.**

Run: `pnpm exec vitest run tests/components/notifications/notifications-data.test.ts tests/components/notifications/NotificationBell.test.tsx tests/theme/notification-shadow-surface.test.ts`

- [ ] **Step 2: 타입 검사와 lint를 실행한다.**

Run: `pnpm typecheck`

Run: `pnpm lint`

- [ ] **Step 3: diff와 변경 범위를 확인한다.**

Run: `git diff --check` and `git status --short --branch`

Expected: 인라인 메타 표시와 관련된 파일만 변경되며, 기존 사용자 변경은 되돌리지 않는다.
