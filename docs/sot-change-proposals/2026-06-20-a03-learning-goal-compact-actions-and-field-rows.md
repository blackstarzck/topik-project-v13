# A-03 compact actions and borderless field rows proposal

## 제안 요약

`/onboarding/learning-goal`의 저장 CTA는 기존 primary 배경 버튼을 유지하고, 건너뛰기 CTA는 같은 full-width 크기의 text button으로 바로 아래에 배치한다. 두 버튼 사이 간격은 좁히되, 입력 UI와 저장 CTA 사이에는 충분한 상단 여백을 둔다. 목표 설정 항목 row는 개별 `AppCard` 테두리와 장식 아이콘을 제거하고, row 내부 타이틀/설명 타이포그래피를 각각 16px/14px로 맞춘다. 취약 영역은 Select 드롭다운 대신 복수 선택 가능한 버튼 그리드로 표시하며, 선택된 버튼은 배경 채움이 아니라 outline 강조 상태로 표시한다.

## 변경 이유

- 저장과 건너뛰기는 둘 다 사용자를 대시보드로 보내는 출구 액션이므로 같은 CTA 흐름 안에 두되, 저장은 명시적 설정 완료 액션이므로 primary 위계를 유지하는 편이 자연스럽다.
- 기존 항목 row는 카드 내부에 다시 카드가 반복되어 테두리가 과하게 보인다.
- Ant Design review checklist는 카드 내부 row가 mini card처럼 보이지 않도록 불필요한 permanent border를 피하라고 안내한다.
- 취약 영역은 8개 고정 옵션 중 여러 개를 동시에 고르는 입력이므로, 선택된 항목을 펼쳐 보여주는 버튼 그리드가 드롭다운보다 현재 선택 상태를 더 즉시 확인할 수 있다.
- 화면 헤더, 입력 묶음, CTA 묶음 사이의 구획 간격을 키워 스캔 순서를 명확히 한다.
- 건너뛰기는 보조 액션이므로 hover 배경 변화 없이 조용한 text button으로 유지한다.

## 영향 문서

- `docs/Wireframe/03-A-03-learning-goal-setup/description.md`
  - Area 3 목표 설정 항목 row의 borderless/iconless 표현과 타이틀/설명 크기 명시 필요
  - 취약 영역 입력의 버튼 그리드/복수 선택 표현 명시 필요
- Area 4 CTA 영역에서 저장 primary 버튼과 건너뛰기 text 버튼의 크기, 배치, 간격 명시 필요
- `docs/Wireframe/03-A-03-learning-goal-setup/functional-spec.md`
  - A-03 현재 구현 상태와 수용 기준 갱신 필요

## 수용 기준

- `저장하고 대시보드로 이동`은 기존 primary 배경 버튼 스타일을 유지한다.
- 마지막 입력 UI와 `저장하고 대시보드로 이동` 버튼 사이에는 CTA 영역이 구분되도록 충분한 상단 여백을 둔다.
- 헤더와 입력 UI 영역 사이에는 기존보다 넓은 수직 간격을 둔다.
- `건너뛰기`는 같은 full-width 크기의 text button으로 저장 CTA 바로 아래에 표시된다.
- `건너뛰기`는 hover 시 배경 강조가 나타나지 않는다.
- 두 CTA는 같은 흐름 안에 배치되고, 버튼 사이 간격은 기존보다 좁다.
- 각 목표 설정 항목 row는 개별 `AppCard`/테두리 surface를 사용하지 않는다.
- 각 목표 설정 항목 row에는 왼쪽 장식 아이콘이나 아이콘 배경 박스를 표시하지 않는다.
- 항목 row 타이틀은 16px, 설명은 14px로 표시된다.
- 취약 영역은 Select 드롭다운이 아니라 2~3열 반응형 버튼 그리드로 표시된다.
- 취약 영역 버튼은 각각 토글 가능하며, 여러 옵션을 동시에 선택할 수 있다. 기본 상태와 선택 상태 모두 outlined button을 유지하고, 선택 상태는 outline 두께/강조로 표시한다.
- 저장 시 선택된 취약 영역 값은 기존 `learning_goals.weak_areas` 배열 payload로 전달된다.
