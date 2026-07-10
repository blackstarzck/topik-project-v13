# UI Ownership and Implementation Workflow

## Goal

페이지마다 새 디자인을 만드는 일을 멈추고, 기존 app shell·공통 layout·theme·Page Recipe를 먼저 재사용한다. Tailwind가 있어도 page-specific 규칙을 `global.css`에 계속 쌓거나 AntD 상태를 CSS로 다시 구현하지 않는다.

## 1. Active sources

UI 작업은 다음을 함께 확인한다.

- `DESIGN.md`
- `docs/ant-design/README.md`
- `docs/ant-design/04-page-patterns-for-talkpik.md`
- `docs/ant-design/07-review-checklist.md`
- `docs/ant-design/08-theme-architecture.md`
- 관련 Wireframe과 현재 sibling route/source

문서 값과 runtime token이 다르면 둘을 동시에 active로 취급하지 않는다. 현재 theme source와 adapter를 확인하고 불일치를 보고한다.

## 2. Page Recipe first

새 화면을 만들기 전에 화면 유형을 고른다.

| Recipe | 기본 구조 |
| --- | --- |
| Authenticated workspace | `WorkspaceShell`의 `<main>` + `WorkspaceBody` |
| Workspace header | 기존 `PageHeader` 또는 report 계열 `ReportPageHeader` |
| Fixed workspace action | `WorkspaceFixedActionBar` |
| Settings/form | `WorkspaceBody size="form"` + 기존 settings shell/pattern |
| Focused task gate | `WorkspaceBody size="task"` |
| Default dashboard/list/detail | `WorkspaceBody size="workspace"` |
| Dense data page | 근거가 있을 때 `wide` |
| Editor/canvas | 의도적으로 전체 폭이 필요할 때만 `full` |
| Public/auth | 기존 `PageContainer` pattern |

Workspace route에 별도 `<main>`이나 `PageContainer`를 추가하지 않는다. 같은 recipe의 sibling 화면과 heading, action, card, spacing 위계를 비교한다.

## 3. Style ownership ladder

항상 위에서 아래 순서로 해결한다.

1. 기존 공통 컴포넌트와 Page Recipe
2. Ant Design component props와 composition
3. global/component token 또는 scoped `ConfigProvider`
4. Tailwind layout, spacing, responsive utility
5. 기록된 CSS exception

### Ant Design owns

- color, hover, active, selected, disabled
- border, radius, control height
- component state와 semantic token

이 값을 Tailwind selector나 broad `.ant-*` override로 재구현하지 않는다.

### Tailwind owns

- layout, grid/flex
- spacing과 alignment
- responsive behavior
- 제한된 typography/layout 보정

`bg-[#...]`, `rounded-[...]`, `shadow-[...]`, 임의 font/palette처럼 theme을 우회하는 arbitrary visual value는 사용하지 않는다. runtime geometry처럼 실제 계산값이 필요한 경우에만 좁은 근거와 annotation을 남긴다.

### Inline style

정적인 React `style={{...}}`와 AntD `styles` prop으로 시각 디자인을 추가하지 않는다. 계산 geometry가 필요한 예외는 값의 출처와 범위를 설명한다.

## 4. Theme changes

theme은 하나의 project source에서 두 adapter로 투영한다.

- AntD: `ConfigProvider`, `theme.token`, `theme.components`
- Tailwind: `src/styles/global.css`의 `@theme inline`과 `--app-*` bridge

새 palette, font, radius, shadow token을 한 adapter에만 추가하지 않는다. feature 한정 상태는 app-wide global override보다 scoped `ConfigProvider`를 우선한다.

## 5. Global CSS gate

신규 page-specific `global.css` selector와 broad `.ant-*` override는 금지한다. 기존 부채 때문에 무관한 PR을 실패시키지 않도록 rollout은 다음 순서를 따른다.

1. `report`: 기존 baseline과 신규 위반을 구분해 보고
2. `diff-block`: 새로 추가된 위반만 차단
3. `enforce`: baseline이 제거된 영역부터 전체 계약 적용

CSS exception은 다음을 모두 가진다.

- path/selector pattern
- owner
- token/prop/scoped provider로 해결되지 않은 이유
- created date
- expires date 또는 removal condition
- regression evidence

## 6. STRICT remediation lane

기존 global CSS 이관은 공통 theme을 건드리므로 STRICT다. 다만 같은 승인 brief를 화면별로 재사용할 수 있다.

1. 현재 동작과 desktop/mobile 시각 기준을 test/screenshot으로 잠근다.
2. selector owner와 소비 route를 찾는다.
3. 기존 component, token, Tailwind layout으로 가장 작은 단위를 이관한다.
4. 한 PR에 한 화면/recipe 범위를 유지한다.
5. 관련 상태와 sibling hierarchy를 검증한다.
6. 사용하지 않는 selector를 삭제한다.

새 token, recipe, shell 변경이 필요하면 remediation lane을 멈추고 별도 설계 검토를 받는다.

## 7. UI completion evidence

- desktop/mobile 실제 렌더링
- 주요 상호작용
- 변경과 관련된 loading, empty, success, error, disabled 상태
- 같은 Page Recipe sibling과 시각적 위계 비교
- 관련 unit/integration, lint, typecheck
- global selector/theme/shared navigation이면 영향 범위에 맞는 e2e

UI를 변경하지 않은 정책·검사기 작업에는 Playwright를 형식적으로 실행하지 않는다.
