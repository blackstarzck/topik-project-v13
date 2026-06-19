# 2026-06-19 51~54 작성 화면 사이드바 숨김(시험 집중 모드) 결정

## 결론

51~54번 쓰기 작성 화면(D-01~D-04)에서는 학습자 사이드 내비게이션을 **표시하지 않는다.** 작성 화면을 시험처럼 집중하게 만드는 "시험 집중 모드"로 운영한다. 이는 사용자 결정(2026-06-19)으로 확정되었다.

## 배경 / 현재 구현

- `src/components/app/WorkspaceShell.tsx`는 다음 4개 route를 `isWritingExamRoute`로 분류한다: `/writing/short-answer-writing-51`, `/writing/answer-writing-52`, `/writing/long-form-writing-53`, `/writing/essay-writing-54`.
- 이 route에서는 데스크톱 `Sider` + `SidebarNav`, 모바일 상단바, 모바일 드로어를 모두 렌더링하지 않는다(`app-workspace-layout--exam`).
- 작성 중 이탈은 사이드바 메뉴가 아니라 저장 경고 / 이탈 가드(`useUnsavedChangesGuard`, D-M3 자동저장 경고)로 처리한다.

## 기존 SOT와의 충돌 및 재정의

- `docs/Wireframe/share/03-learner-side-nav-state/sidebar-navigation-decision-summary.md:58`은 `D-01~D-04`를 사이드바 **"노출"**로 분류한다. 같은 문서 `:92`(원칙7)은 "저장 전 이탈 경고가 필요한 화면에서는 사이드바 클릭보다 이탈 확인 흐름이 우선한다"고 한다.
- `docs/Wireframe/09-D-02-answer-writing-52/description.md`와 `docs/Wireframe/10-D-03-long-form-writing-53/description.md`의 No.1은 "학습자 사이드 내비"를 작성 화면 영역으로 명시한다. 반면 `08-D-01`, `11-D-04`의 No.1은 "저장/제출 액션"으로 사이드 내비 표기가 없어 문서 간 불일치가 있었다(같은 문서 `:79`도 이 불일치를 보정 대상으로 지목).
- 이 결정으로 위 SOT를 **"D-01~D-04 작성 화면은 시험 집중 모드로 사이드바 비노출"**로 재정의한다.

## 변경이 필요한 SOT (확정 시 갱신 대상)

- `docs/Wireframe/share/03-learner-side-nav-state/sidebar-navigation-decision-summary.md`: `D-01~D-04`의 사이드바 노출 판정을 "작성(시험) 화면은 비노출, 이탈은 저장 가드로 처리"로 갱신.
- `docs/Wireframe/share/03-learner-side-nav-state/description.md`, `contextual-route-placement.md`: 51~54 작성 route를 사이드바 비노출(시험 모드) route로 명시.
- `docs/Wireframe/09-D-02-answer-writing-52/description.md`, `docs/Wireframe/10-D-03-long-form-writing-53/description.md`: No.1의 "학습자 사이드 내비"를 시험 모드(사이드 내비 비노출 + 이탈 가드)로 정정. `08-D-01`, `11-D-04`와 표기를 일관화.

## 결정 근거 / 검토한 대안

- 결정 근거: 작성 화면에서 다른 메뉴로의 이탈을 줄여 집중도를 높이고, 저장 전 이탈로 인한 답안 유실을 이탈 가드로 일관 처리한다.
- 검토한 대안 ⓐ(채택 안 함): SHARE-03 원칙7대로 사이드바를 **표시한 채** 메뉴 클릭 시 이탈 가드를 띄우는 방식. 시험 집중 의도와 맞지 않아 보류.
- 검토한 대안 ⓑ(채택): 작성 화면에서 사이드바 자체를 숨기는 시험 집중 모드. 현재 구현과 일치.

## 검증 기준

- 51~54 작성 화면(desktop/mobile)에서 학습자 사이드 내비/모바일 메뉴 버튼/드로어가 보이지 않는다.
- 같은 workspace의 다른 화면(홈, 문제 목록, 피드백 등)은 사이드바가 정상 노출된다.
- 작성 중 이탈 시 저장 경고/이탈 가드가 동작한다.
- `WorkspaceShell` 테스트에 51~54 작성 route에서 사이드바 미노출을 단언하는 케이스를 추가한다(현재 누락).
