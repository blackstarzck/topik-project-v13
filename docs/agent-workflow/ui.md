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

`docs/sot-registry.json`의 `wireframe-entry`는 `docs/Wireframe/` 하위 상세 기능명세의 lifecycle·owner를 상속하고, `antd-entry`는 Page Pattern을 포함한 `docs/ant-design/` 하위 가이드의 lifecycle·owner를 상속한다. 하위 문서가 별도 exact path로 등록되어 있으면 그 계약이 우선한다.

문서 값과 runtime token이 다르면 둘을 동시에 active로 취급하지 않는다. 현재 theme source와 adapter를 확인하고 불일치를 보고한다.

## 2. Page Recipe first

새 화면을 만들기 전에 화면 유형을 고른다.

| Recipe | Shell/body | Header/surface/action/state owner |
| --- | --- | --- |
| `workspace` | `WorkspaceShell`의 `<main>` + `WorkspaceBody size="workspace"` | `PageHeader` 또는 report 계열 `ReportPageHeader`; `AppCard`; 고정 action은 `WorkspaceFixedActionBar`; 상태는 기존 AntD feedback component |
| `form` | `WorkspaceShell` + `WorkspaceBody size="form"` | 기존 settings/form header와 `Form`; submit action은 form 또는 정렬된 fixed action owner; validation/disabled/error를 함께 설계 |
| `reading` | `WorkspaceShell` + 약 760px semantic reading body | `PageHeader`; 16px 이상·약 1.7 line-height의 본문; 문서 계약만 존재하며 첫 Phase 5 consumer 전에는 unused runtime API를 추가하지 않음 |
| `task` | `WorkspaceShell` + `WorkspaceBody size="task"` | focused prompt/editor 또는 gate가 주 surface; 진행/확인 action과 loading/success/error owner를 명시 |
| `wide` | `WorkspaceShell` + `WorkspaceBody size="wide"` | dense table/report처럼 추가 폭의 근거가 있을 때만 사용; header와 action은 workspace 규칙 유지 |
| `full` | `WorkspaceShell` + `WorkspaceBody size="full"` | editor/canvas처럼 의도적으로 전체 폭이 필요한 surface만 허용; focus와 overflow 검증 필수 |
| `public/auth` | 기존 `PageContainer` pattern | 기존 public/auth header, form, feedback owner를 재사용하며 workspace shell과 섞지 않음 |
| `empty/error` | 독립 width recipe가 아니라 부모 recipe를 그대로 유지 | `Empty`, `Result`, `Alert` 또는 기존 wrapper가 상태를 소유하고 다음 행동을 제공; 새 shell/card를 만들지 않음 |

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

| 목적 | 명령 | 권한과 판정 |
| --- | --- | --- |
| 현재 부채 읽기 | `pnpm report:ui-contract` | read-only 보고다. candidate baseline의 최신 여부를 승인하거나 CI 통과를 증명하지 않는다. |
| 신규 부채 차단 | `pnpm check:ui-contract` | candidate가 current source와 정확히 일치해야 하고, CI에서는 base commit의 baseline을 ratchet authority로 사용한다. |
| 기준선 갱신 | `node scripts/check-ui-contract.mjs --mode report --write-baseline config/ui-contract-baseline.json` | 최초 bootstrap, 승인된 scanner migration, 또는 검증된 Phase 5 부채 감소에서만 사용한다. 부채 감소 PR은 제거된 fingerprint만 같은 PR의 baseline에서 함께 줄여야 하며, 일반 PR에서 baseline을 늘리는 도구가 아니다. |

최초 CI bootstrap은 base commit에 baseline·approval·active-exception·scanner-migration 네 파일이 모두 없고 candidate의 exception/migration manifest가 비어 있을 때만 허용한다. 네 파일 중 일부만 존재하면 fail closed다. baseline이 merge된 뒤에는 base commit의 기존 부채와 scanner digest가 권한이다.

scanner source가 기준 브랜치와 다르면 같은 PR의 checker나 migration manifest는 권한이 아니다. 별도 PR에서 exact `fromVersion`/`fromDigest`/`toVersion`/`toDigest` migration approval을 먼저 merge해야 하며, CI는 기준 브랜치에서 추출한 trusted runner로 이 순서를 검사한다. source가 같으면 기준 브랜치 scanner를 실행하고, 사전 승인된 exact migration일 때만 candidate scanner를 실행한다. `CODEOWNERS`는 workflow·checker·config 변경의 소유자 리뷰를 지정하지만 실제 강제 여부는 GitHub branch protection 설정에 달려 있다.

예외가 정말 필요하면 두 PR로 나눈다.

1. 첫 PR에서 exact `path` / `ruleId` / `fingerprint` approval을 추가하고 merge한다.
2. 다음 PR에서 source 변경과 exact active exception을 함께 제출한다.

다음을 금지한다.

- current source보다 많은 위반을 담도록 baseline을 늘리거나 기존 fingerprint를 바꿔치기하는 일
- 같은 CI PR에서 새 approval을 추가해 그 PR의 위반을 숨기는 일
- glob, wildcard, selector pattern처럼 범위가 넓은 exception
- 별도 STRICT 계획·fixture·migration 증거 없이 `scannerVersion: 1`을 바꾸는 일

로컬 exception preview는 작성 중 정책을 확인하는 advisory 기능일 뿐이다. `LOCAL_NOT_BASE_AUTHORITY`가 표시된 로컬 PASS를 CI authorization 증거로 사용하지 않는다.

CSS exception은 다음을 모두 가진다.

- exact path, known rule ID, exact fingerprint
- owner
- token/prop/scoped provider로 해결되지 않은 이유
- created date
- 90일 이내 expires date와 removal condition
- regression evidence

## 6. STRICT remediation lane

기존 global CSS 이관은 공통 theme을 건드리므로 STRICT다. 다만 같은 승인 brief를 화면별로 재사용할 수 있다.

1. 현재 동작과 desktop/mobile 시각 기준을 test/screenshot으로 잠근다.
2. selector owner와 소비 route를 찾는다.
3. 기존 component, token, Tailwind layout으로 가장 작은 단위를 이관한다.
4. 한 PR에 한 화면/recipe 범위를 유지한다.
5. 관련 상태와 sibling hierarchy를 검증한다.
6. 사용하지 않는 selector를 삭제한다.
7. 제거된 fingerprint만 반영하도록 baseline을 같은 PR에서 갱신하고 `pnpm check:ui-contract`로 current source와 exact 일치를 확인한다.

새 token, recipe, shell 변경이 필요하면 remediation lane을 멈추고 별도 설계 검토를 받는다.

## 7. UI completion evidence

- desktop/mobile 실제 렌더링
- 주요 상호작용
- 변경과 관련된 loading, empty, success, error, disabled 상태
- 같은 Page Recipe sibling과 시각적 위계 비교
- 관련 unit/integration, lint, typecheck
- global selector/theme/shared navigation이면 영향 범위에 맞는 e2e

UI를 변경하지 않은 정책·검사기 작업에는 Playwright를 형식적으로 실행하지 않는다.
