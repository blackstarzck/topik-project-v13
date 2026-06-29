# 2026-06-29 결과/후속 학습 화면 사이드바 비노출 제안

## 결론

문제 풀이 제출 이후 이어지는 결과/후속 학습 화면은 학습 집중 흐름으로 보고, workspace 사이드바와 모바일 메뉴 chrome을 노출하지 않는다.

대상 route:

- `/writing/feedback/short/:id` (E-01)
- `/writing/feedback/long/:id` (E-02)
- `/writing/reports/:id/compare` (R-01)
- `/practice/next` (R-02)

D-M2 분석 중 상태는 별도 route가 아니라 51~54 작성 화면 내부 상태이므로 기존 작성 화면의 sidebarless 정책을 그대로 따른다.

## 배경 / 현재 구현

- 51~54 작성 화면은 이미 `WorkspaceShell`에서 `hidesWorkspaceChrome` 대상이다.
- E-01/E-02는 기존에 global floating action만 숨기고 사이드바는 유지했다.
- R-01/R-02는 일반 workspace route처럼 사이드바와 모바일 메뉴를 유지했다.
- 사용자는 제출 이후 `분석 & 피드백`, `다음 문제`, `비교 리포트` 화면에서도 사이드바를 숨기기를 요청했다.

## 기존 SOT와의 충돌 / 보정 필요

- `docs/Wireframe/share/03-learner-side-nav-state/contextual-route-placement.md`는 feedback, comparison report, next problem route를 contextual route로 정의하고 active sidebar state를 설명한다.
- `docs/Wireframe/share/03-learner-side-nav-state/sidebar-navigation-decision-summary.md`도 해당 화면들이 직접 메뉴 target은 아니지만 contextual route로 유지될 수 있음을 전제로 한다.
- 이번 제안은 "direct menu에 노출하지 않는다"에서 한 단계 더 나아가, 해당 화면 진입 시 workspace sidebar chrome 자체를 숨기는 정책이다.

## 변경이 필요한 SOT

- `docs/Wireframe/share/03-learner-side-nav-state/description.md`
- `docs/Wireframe/share/03-learner-side-nav-state/contextual-route-placement.md`
- `docs/Wireframe/share/03-learner-side-nav-state/sidebar-navigation-decision-summary.md`
- 필요 시 E-01/E-02/R-01/R-02 wireframe description 또는 functional spec의 navigation/chrome 항목

## 결정 근거 / 검토한 대안

- 채택: 결과/후속 학습 화면을 작성 화면과 같은 집중 흐름으로 보고 sidebarless route로 처리한다. 사용자가 제출 이후 화면 묶음 전체에서 사이드바 숨김을 요청했고, route 정책을 `WorkspaceShell`에 중앙화하면 구현 범위가 작다.
- 보류: 사이드바는 숨기되 mobile header와 알림/프로필 floating action은 유지한다. 같은 흐름 안에서 desktop/mobile chrome이 달라져 QA 표면이 넓어진다.
- 보류: App Router route group을 분리해 별도 layout을 만든다. URL에는 영향이 없지만 route tree 이동이 많고, 현재 shell 중앙 정책보다 변경 위험이 크다.

## 검증 기준

- desktop/mobile에서 E-01, E-02, R-01, R-02 route에 `.app-workspace-sider`, mobile drawer/menu, global floating action이 렌더링되지 않는다.
- 51~54 작성 화면과 D-M2 분석 상태는 기존처럼 sidebarless 상태를 유지한다.
- `/dashboard`, `/practice/problems`, `/practice/weakness`, `/library`, `/profile`, `/settings/*` 같은 일반 workspace route는 기존 sidebar를 유지한다.
- `/practice/next`의 fixed bottom CTA는 desktop에서도 sidebar offset 없이 viewport left `0` 기준으로 정렬된다.
