# UI Contract Baseline Report — 2026-07-10

## 목적

Phase 4는 기존 UI 부채를 한 번에 실패시키지 않고, 현재 상태를 exact fingerprint baseline으로 고정해 새 부채와 기존 부채 증가만 차단한다. 이 보고서는 최초 bootstrap 기준선과 검증 경계를 기록한다.

## 기준선

| 항목 | 값 |
| --- | ---: |
| schema / scanner | `1` / `1` |
| 생성 시각 (UTC) | `2026-07-10T14:00:46.575Z` |
| 전체 위반 수 | 5,935 |
| 고유 fingerprint 수 | 5,419 |
| 영향 경로 수 | 47 |
| rule 수 | 9 |
| active approval / exception | 0 / 0 |
| baseline SHA-256 | `538a543c7a6f8196507a2a1aea0730aee1765fae17f05bbf160ea950c60100b7` |

### Rule별 수량

| Rule | 수량 |
| --- | ---: |
| `global-css.declaration-freeze` | 4,018 |
| `global-css.selector-freeze` | 1,253 |
| `visual.raw-color` | 332 |
| `visual.raw-radius-shadow-font` | 190 |
| `tailwind.arbitrary-visual` | 65 |
| `react.static-inline-style` | 42 |
| `antd.broad-state-override` | 21 |
| `workspace.missing-body-recipe` | 8 |
| `antd.shared-wrapper-bypass` | 6 |

`src/styles/global.css`가 5,794건으로 전체의 대부분을 차지한다. 이 값은 허용 목표가 아니라 기존 부채의 상한이다. source가 바뀌지 않은 상태에서 기준선을 두 번 생성했을 때 파일 hash와 fingerprint/rule/path summary가 동일했고 `generatedAt`도 보존됐다. critic 재검토에서 누락이 확인된 at-rule 직속 declaration 65건과 modern color function, gradient named color, non-`--app-*` color variable 51건을 bootstrap 전에 포함했으며, 이는 runtime source 추가가 아니라 scanner false-negative 수정이다.

## 권한과 fail-closed 경계

- candidate baseline은 current source와 exact multiset으로 일치해야 한다.
- CI는 base commit의 baseline·approval·active-exception 3-file tuple을 읽는다. 일부만 존재하면 실패한다.
- 최초 bootstrap은 base에 세 파일이 모두 없고 candidate approval/exception이 모두 비어 있을 때만 허용한다.
- bootstrap PR에서는 checker와 기준선이 함께 처음 들어오므로 marker가 나타내듯 자체적으로 tamper-proof하지 않다. 해당 PR을 직렬로 먼저 merge하고 이후 PR에서 base-authority가 실제로 작동하는지 확인해야 한다. required CI와 UI contract 파일의 CODEOWNERS/branch protection은 GitHub 저장소 설정에서 별도로 유지해야 한다. 검증 시점에 `.github/CODEOWNERS`는 없었고 remote branch protection은 이 로컬 보고서에서 확인하지 않았으므로, bootstrap merge 전 repository owner가 별도로 확인해야 한다.
- 기존 부채 감소는 허용하지만 신규 또는 증가 fingerprint, 같은 수량의 바꿔치기, stale candidate baseline은 차단한다.
- exception은 exact path/rule/fingerprint approval이 base와 candidate에 모두 존재해야 한다. 같은 PR에서 만든 approval은 CI suppression 권한이 없다.
- report 출력은 source lexeme와 free-form exception metadata를 공개하지 않는다.

## 검증 증거

- `node scripts/check-ui-contract.mjs --mode report --format json --write-baseline config/ui-contract-baseline.json`: 기존 부채 수집 및 최초 기준선 생성
- 동일 생성 명령 2회: byte-identical SHA-256 및 summary 확인
- `node scripts/check-ui-contract.mjs --mode diff-block`: `LOCAL_NOT_BASE_AUTHORITY`, 신규 위반 0, exit 0
- `pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs --reporter=verbose --maxWorkers=1`: 57개 fixture 통과
- `pnpm exec eslint scripts/check-ui-contract.mjs scripts/lib/ui-contract.mjs tests/scripts/check-ui-contract.test.mjs`: 경고·오류 0

## Phase 5 우선순위

1. `workspace.missing-body-recipe` 8개 route를 owner component까지 추적해 화면별로 `WorkspaceBody` recipe로 이관한다.
2. `antd.shared-wrapper-bypass` 6건과 `react.static-inline-style` 42건을 공통 wrapper/token 소유권 기준으로 작은 화면 단위에서 줄인다.
3. `global.css` 5,794건은 selector consumer와 sibling route를 먼저 찾은 뒤 한 화면/recipe PR 단위로 이동한다. 검증된 제거 fingerprint만 같은 PR의 baseline에서 감소시키며, 일괄 변환이나 baseline 증가·바꿔치기로 수치를 숨기지 않는다.
4. 각 runtime UI remediation은 desktop/mobile render, 관련 상태와 상호작용, 좁힌 Playwright 회귀 증거를 포함한다.

## 범위와 남은 위험

Phase 4는 정책·검사기·문서·CI만 바꾼다. 제품 runtime UI와 `src/styles/global.css`는 수정하지 않았으므로 Playwright를 형식적으로 실행하지 않는다. AST 규칙이 모든 디자인 품질을 자동 판단하지는 못하므로 Page Recipe sibling 비교와 review checklist는 계속 필요하다. Scanner contract 변경은 별도 STRICT migration으로 다룬다.

Active UI SOT owner는 `DESIGN.md`, `docs/agent-workflow/ui.md`, `docs/ant-design/07-review-checklist.md`다. 이번 Phase 4는 이 owner의 내용을 보강했지만 SOT registry path/status는 바꾸지 않았고, `pnpm check:sot-registry`에서 등록 문서 20개와 생성 index의 일치를 확인했다.
