# 쓰기 직접 진입 미풀이 문제 우선 노출 제안

## 배경

- `docs/Wireframe/share/03-learner-side-nav-state/sidebar-navigation-decision-summary.md`는 51~54 작성 화면 직접 메뉴화가 C-03 문제 선택 흐름을 우회하므로 정책 보강이 필요하다고 정리한다.
- 현재 구현은 `problem` 파라미터 없이 `/writing/...`에 진입하면 공개/활성/노출 가능 후보 중 기본 문제를 안정적으로 선택한다.
- 사이드바의 51~54 메뉴는 특정 문제 deep link가 아니라 유형별 시작 진입점으로 해석한다.

## 제안

- 51~54 사이드바 직접 진입은 해당 유형의 untouched 문제 시작 진입점으로 정의한다.
- untouched는 현재 사용자 기준 `writing_submissions`에 해당 `problem_id` 제출 row가 없고, `writing_drafts`에도 해당 `problem_id` draft row가 전혀 없는 문제다.
- `superseded` draft도 draft를 만든 이력으로 보아 untouched에서 제외한다.
- `?problem=<id>` explicit deep link, 문제 목록, 추천, 다시 풀기 모달은 기존처럼 지정된 문제를 연다.
- untouched 후보가 없으면 기존 기본 문제 선택 로직으로 fallback한다.

## 수용 기준

- 직접 `/writing/short-answer-writing-51` 등으로 들어갈 때 untouched submittable 문제가 있으면 그 문제를 보여준다.
- 제출 이력 또는 draft 이력이 있는 문제는 untouched 후보에서 제외된다.
- 다른 사용자의 제출/draft 이력은 영향을 주지 않는다.
- explicit `?problem=` 진입은 untouched 필터를 적용하지 않는다.
- 기존 visibility, lifecycle, seed fixture 제외, submit-blocked 처리 기준은 유지된다.

## 검토한 대안

- active draft만 제외: 사용자가 답한 "임시 저장한 적도 없는 문제"보다 좁아 채택하지 않는다.
- 새 RPC/DB migration: 현재 범위에서는 과하고, 성능 문제가 확인되면 별도 제안으로 분리한다.
- 문제 목록으로 redirect: 사용자가 직접 작성 화면에서 문제를 보길 원하므로 채택하지 않는다.
