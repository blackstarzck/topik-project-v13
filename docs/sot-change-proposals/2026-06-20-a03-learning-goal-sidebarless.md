# A-03 learning goal sidebarless workspace chrome proposal

## 제안 요약

`/onboarding/learning-goal` 화면은 51~54번 쓰기 문제 화면처럼 workspace sidebar, mobile header, drawer, desktop notification corner를 표시하지 않는 집중 화면으로 정의한다.

## 변경 이유

- A-03 학습 목표 설정은 앱 진입 전 마지막 온보딩 단계라서 일반 학습 workspace 탐색보다 목표 입력 완료가 우선이다.
- 기존 sidebar SOT는 A-03에 대해 "정책 결정 필요"로 남겨 두었고, 제품 흐름상 비노출이 자연스럽다고 설명한다.
- 사용자가 51~54번 문제쓰기 화면과 동일하게 sidebar를 숨기도록 명시 요청했다.

## 영향 문서

- `docs/Wireframe/share/03-learner-side-nav-state/sidebar-navigation-decision-summary.md`
  - A-03 학습 목표 설정을 `비노출`로 확정한다.
- `docs/Wireframe/share/03-learner-side-nav-state/contextual-route-placement.md`
  - `/onboarding/learning-goal`을 workspace chrome 비노출 route로 추가한다.
- `docs/Wireframe/03-A-03-learning-goal-setup/description.md`
  - 화면 바디 기준에서 sidebar가 없는 집중 layout임을 명시한다.

## 수용 기준

- `/onboarding/learning-goal` desktop 화면에서 learner sidebar가 렌더링되지 않는다.
- `/onboarding/learning-goal` mobile 화면에서 workspace mobile header와 drawer가 렌더링되지 않는다.
- 51~54번 쓰기 문제 route의 기존 sidebar 비노출 동작은 유지된다.
- 일반 workspace route 예: `/dashboard`는 기존처럼 sidebar를 유지한다.
