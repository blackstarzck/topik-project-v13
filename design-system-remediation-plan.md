# Wireframe 기준 사용자 화면 스타일 일관성 복구 계획

## Summary

`docs/Wireframe/`를 phase 단위의 작업 범위로 삼아 사용자 화면의 스타일 규칙을 Awesomic 기준으로 재정렬한다. Ant Design은 theme token의 주입 지점, Tailwind는 AntD/Awesomic token을 소비하는 bridge로만 사용한다. `global.css`의 page/component-specific override와 inline style은 phase별로 줄이고, 각 phase는 분석 에이전트 → 작업 에이전트 → 독립 리뷰 에이전트 → 회귀 수정 → 재리뷰 → page-scoped 검증 → commit → 에이전트 종료 순서로 닫는다.

기술 기준은 AntD `ConfigProvider theme.token/components`와 Tailwind v4 `@theme inline` 방식을 따른다. 참고: [AntD theme customization](https://github.com/ant-design/ant-design/blob/master/docs/react/customize-theme.en-US.md), [Tailwind theme variables](https://github.com/tailwindlabs/tailwindcss.com/blob/main/tailwindcss.com/src/docs/theme.mdx).

## Key Changes

- 디자인 source of truth를 `DESIGN.md`에서 `AWESOMIC-DESIGN.md`로 전환한다. `DESIGN.md`는 삭제하지 않고 비권위 문서로 격하하며, `docs/ant-design/08-theme-architecture.md`의 원칙을 “stock AntD default 유지”가 아니라 “Awesomic token을 AntD 구조에 바인딩”으로 고친다.
- Dark mode는 이번 범위에서 `light-fixed`로 동결한다. Awesomic이 light-only이고 현재 dark algorithm/bridge는 black primary와 충돌할 수 있으므로, dark infra 코드는 보존하되 사용자-facing 진입점과 초기 렌더는 light만 사용한다.
- 실제 font stack은 당장 Pretendard 단일 계열로 유지한다. Awesomic의 Cosmica 원칙은 기록하되, 로컬 font asset이 없는 상태에서 `Cosmica`, `DM Sans`, `Plus Jakarta Sans`를 CSS에 허위 선언하지 않는다.
- `src/theme` 계층을 기준으로 AntD token을 설정하고, Tailwind bridge는 필요한 CSS variable만 노출한다. bridge key를 추가하면 `tailwind-bridge.ts`, root variable injection, `global.css @theme inline`, theme parity tests를 함께 갱신한다.
- `src/styles/global.css`는 reset, typography base, approved bridge, unavoidable third-party adapter만 남기는 방향으로 축소한다. `.ant-*` 직접 override, page-specific selector, undefined `--app-*`, hardcoded color/radius/shadow/font는 phase별로 제거하거나 명시 예외로 기록한다.

## Theme Contract

AntD seed/component token의 1차 binding은 아래를 기본값으로 한다.

| Intent | Awesomic Value | AntD Binding |
| --- | --- | --- |
| Primary / obsidian | `#09090b` | `token.colorPrimary` |
| Text / ink | `#18181b` | `token.colorText` |
| Secondary text / steel | `#71717a` | `token.colorTextSecondary` |
| Border / pebble | `#d4d4d8` | `token.colorBorder` |
| Layout bg / mist | `#f4f4f5` | `token.colorBgLayout` |
| Container bg / snow | `#ffffff` | `token.colorBgContainer` |
| Link | `#3f3f46`, hover `#09090b` | `token.colorLink`, `colorLinkHover`, `colorLinkActive` |
| Base radius | `14` | `token.borderRadius` |
| Card radius | `36` | `components.Card.borderRadiusLG` or local card primitive |
| Compact card radius | `28` | local compact card primitive |
| Pill button radius | `36` or full pill | `components.Button` token plus app variant |
| Tag/badge radius | `12` | `components.Tag.borderRadiusSM` or local badge primitive |
| Input radius | `14` | `components.Input.borderRadius` |
| Primary action shadow | Awesomic multi-layer | primary CTA variant only |
| Normal card shadow | none | remove default card shadow unless explicit elevated state |

Theme tests are updated first: old AntD default expectations such as `#1677ff`, `#d9d9d9`, `6px` are replaced with the Awesomic baseline, then implementation is changed until the tests pass.

## Phase Workflow

- Phase 0: source-of-truth and theme contract.
  Update design docs, AntD theme preset, Tailwind bridge, theme tests, dark-mode policy, and global token assumptions before touching individual pages.

- Phase 1: shared shell and primitives.
  Normalize app shell, shared layout primitives, card/button/input/tag/modal/menu/tabs behavior, and remove the most dangerous global `.ant-*` overrides. After this phase, run the Wireframe screen-spec batch because global styling affects many pages.

- Phase 2: high-drift public entry screens.
  Start with `X-01`, then auth/onboarding-related Wireframe pages. These have large landing/signup style drift, custom fonts, gradients, and global CSS blocks, so they need early visual comparison.

- Phase 3+: remaining Wireframe pages.
  Process user-facing Wireframe folders one page at a time. Hosted modal specs are grouped with their host route when the modal has no standalone route.

- Frozen scope:
  Admin-oriented Wireframes `H-01`, `X-08`, `X-10`, `X-15` are inventory-only and must not be remediated in this repository.

For each page phase:
- 분석 에이전트 inventories Wireframe spec, current route, relevant components, inline styles, global selectors, hardcoded visual values, and existing tests.
- 작업 에이전트 performs only the phase-owned remediation.
- 리뷰 에이전트 starts fresh after implementation and checks against Awesomic, AntD/Tailwind separation, Wireframe spec, global CSS rules, responsive behavior, and regression evidence.
- 작업 에이전트 fixes review findings.
- 리뷰 에이전트 rechecks before commit.
- Commit is made with explicit staged files only, then all phase agents are closed.

## Review Gate

A phase cannot close if any of these remain unhandled:

- Active implementation references `DESIGN.md` as the design source of truth.
- Tailwind defines an independent palette or duplicates Awesomic tokens instead of consuming bridge variables.
- New page-specific CSS is added to `global.css`.
- `.ant-*` selectors are used for component styling where AntD tokens/component tokens or local primitives can solve it.
- Inline `style={{ ... }}` count is not reduced or justified with concrete exceptions such as dynamic chart coordinates.
- Hardcoded color, radius, shadow, font family, gradient, or animation values bypass the theme contract.
- Motion animates `color` or `background-color`; allowed motion is limited to transform/opacity unless explicitly justified.
- Wireframe `description.md` or `functional-spec.md` conflicts with the implemented page.
- Desktop and mobile screenshots are missing for the changed page.
- Page-scoped Playwright verification is missing or uses an incorrect grep title.
- Review findings were fixed without an independent re-review.

## Test Plan

- Phase 0:
  Run theme contract tests after updating expected Awesomic values:
  `pnpm vitest run tests/theme/theme-contract.test.ts tests/theme/theme-bridge-parity.test.ts`

- Phase 1:
  Run lint/typecheck as appropriate, then run the Wireframe screen-spec batch only, not the whole e2e suite. Use the existing Playwright screen specs across `desktop-1280` and `mobile-360` projects to catch global token/shell regressions.

- Each page phase:
  Run the matching page grep, for example:
  `pnpm exec playwright test tests/e2e/screens/screens-authed.spec.ts -g "B-01 home-dashboard" --project=desktop-1280 --project=mobile-360`

- Visual evidence:
  Use the existing render-shot flow or a batch wrapper around it to capture desktop/mobile screenshots per page. Store artifacts in the established ignored review-output location.

- Final close:
  Do not run final whole-project `pnpm test:e2e`. Instead, rely on Phase 1 screen-spec batch plus each page’s scoped desktop/mobile verification.

## Commit And Agent Rules

- At the start of every phase, run `git status --short` and record existing unrelated changes.
- Never use `git add -A`; stage explicit phase-owned files only.
- Commit after each phase passes review and scoped verification.
- Commit messages follow the AGENTS Lore Commit Protocol, including `Constraint`, `Rejected`, `Confidence`, `Scope-risk`, `Directive`, `Tested`, and `Not-tested` when relevant.
- Close analysis/work/review agents after each phase commit so the next phase starts with fresh context and review objectivity.

## Assumptions

- `docs/Wireframe/` is the work inventory, while `src/lib/routes.ts` is only an auxiliary route/IA mapping reference.
- Awesomic light-only is binding for this remediation; designing a true dark Awesomic theme is a separate task.
- Pretendard is the implementation font until a valid local Cosmica-compatible font asset is added.
- Full final e2e is intentionally excluded per user instruction; the accepted tradeoff is stronger phase-level and screen-spec verification.
