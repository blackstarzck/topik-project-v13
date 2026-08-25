# TALKPIK Awesomic Design
> Rounded midnight marketplace — a portfolio gallery cut from matte black tiles on a white tablecloth, where large rounded corners and a single custom typeface do all the expressive work.

> Official visual reference for TALKPIK AI's user-facing app: product-level
> visual intent, semantic token meaning, and imported Awesomic token roles.

> Source map:
> - `DESIGN.md`: canonical visual intent and semantic token meaning.
> - `DESIGN/tokens.json`: machine-readable imported token source.
> - `src/theme`: runtime owner that normalizes values and projects them into
>   AntD and Tailwind adapters.
> - `src/theme/bridge-contract.ts`: theme-neutral L2 token-to-Tailwind bridge
>   contract. Test-only themes use the same projection without entering the
>   production theme registry.
> - `src/styles/foundation.css`: Tailwind v4 `@theme inline` bridge;
>   `src/styles/global.css` imports it before approved global runtime styles.

> Runtime policy: one project theme source is projected into two adapters. AntD
> receives values through `ConfigProvider`, `theme.token`, and
> `theme.components`; Tailwind receives the same resolved values through
> `--app-*` bridge variables and Tailwind v4 `@theme inline`. Tailwind must not
> become a second palette, radius scale, shadow scale, or font source.

> Runtime exception: the raw Awesomic reference favors very soft 28-36px
> surfaces, but TALKPIK runtime intentionally reduces app workspace radii to
> 4-8px so study dashboards read as panels instead of bubbles. Keep this
> exception in this document and `src/theme/tokens/awesomic.ts`.

> Do not paste raw CSS custom properties or raw Tailwind `@theme` values from
> this file into app CSS. Normalize selected values through `src/theme`, then
> project them into both the AntD adapter and the Tailwind v4 adapter. New
> `--app-*` bridge variables require a documented source token, a real
> Tailwind/plain-CSS use case, and matching theme contract tests.

**Theme:** light

**Product intent:** TALKPIK is a calm, focused TOPIK study tool. Long Korean
passages must stay readable, each task area should present one clear primary
action, and the UI should avoid loud game-like or generic AI-gradient identity.
Color carries meaning, never decoration; pair every color signal with text or
icon.

## Runtime Theme 소유권

- `src/theme/config.ts`가 active preset을 선택한다. 현재 product preset은 `awesomic`이고 stock Ant Design은 fallback이다.
- `DESIGN/tokens.json`은 가져온 machine-readable source이고 `src/theme/tokens/awesomic.ts`는 이를 정규화한 runtime mapping이다.
- Ant Design은 component adapter다. 전역 값과 component state 값은 `ConfigProvider`, `theme.token`, `theme.components` 또는 scoped provider가 소유한다.
- Tailwind는 layout·responsive와 앱이 직접 소유한 표면의 제한된 시각 보조 adapter다. 시각 utility는 `src/theme/tailwind-bridge.ts`와 `src/styles/foundation.css`의 `@theme inline`을 통해 계산된 L2 의미 토큰(`--app-*`)만 사용한다. `src/styles/global.css`는 이 foundation을 import한다. 별도의 palette, font, radius, shadow scale을 만들거나 AntD 내부 상태를 다시 그리지 않는다.
- 새 `--app-*` 변수에는 source token, 실제 Tailwind/plain-CSS consumer, theme contract test가 모두 필요하다. 계산된 값은 first render에 존재해야 하고 `var(--ant-*)`를 다시 가리키면 안 된다.
- 쓰기 자료 차트의 첫 번째와 네 번째 범주색은 AntD blue·cyan seed를 정규화한 차트 계열색(`--app-color-chart-series-primary`, `--app-color-chart-accent`)을 사용한다. 나머지 범주색과 격자선은 기존 status·border 의미 토큰을 재사용한다.
- 기존 project wrapper와 AntD props를 우선한다. 프로젝트가 작성한 visual inline style, 광범위한 `.ant-*` override, 생성된 AntD class selector, page-specific global CSS를 추가하지 않는다.

### 공통 layout과 card 진입점

- 인증 workspace의 전역 chrome은 `src/components/app/WorkspaceShell.tsx`가 소유하고, 안쪽 content 폭은 `src/components/app/WorkspaceBody.tsx`의 실제 `size` 값(`form`, `task`, `workspace`, `wide`, `full`)으로 정한다. `src/components/shared/PageContainer.tsx`는 `narrow`, `default`, `wide` 폭과 단일 `<main>` landmark가 필요한 일반 page용이므로 다른 `<main>` 안에 중첩하지 않는다.
- `src/components/shared/AppCard.tsx`는 AntD `CardProps`를 그대로 전달하며 별도의 project card header/footer component는 없다. 전체 card의 title·status는 AntD `title`·`extra`, card 단위의 반복 action은 `actions`를 사용하고, 화면 구조상 다른 위치가 더 자연스러우면 억지로 footer를 만들지 않는다.

## UI 검토 체크리스트

- [ ] 대상 route가 `WorkspaceShell` chrome 안에 있는지 숨김 route인지 확인하고, content 폭에는 `WorkspaceBody` 또는 단일-main `PageContainer` 중 실제 구조에 맞는 primitive를 사용했다.
- [ ] `AppCard`의 전체 title·status와 card 단위 action에 AntD `title`·`extra`·`actions` 계약을 일관되게 적용했다.
- [ ] AntD hover, active, selected, disabled, border, radius state는 Tailwind로 다시 만들지 않고 props 또는 token으로 제어했다.
- [ ] color, typography, spacing, responsive layout은 shared theme에서 가져오며, hardcoded visual value가 있다면 이유를 기록했다.
- [ ] loading, empty, success, error, disabled state가 같은 page 구조를 유지하고 다음 action을 분명하게 제공한다.
- [ ] form에는 label이 있고 icon-only control에는 accessible name이 있으며, focus가 보이고 color만으로 의미를 전달하지 않는다.
- [ ] desktop과 mobile에서 겹침이나 horizontal overflow가 없고, 긴 한국어 text가 읽기 좋은 폭과 line height를 유지한다.
- [ ] 관련 test, `pnpm check:ui-contract`, Playwright CLI, Playwright MCP 직접 browser 검증이 변경한 UI 범위에서 통과했다.

Awesomic operates on a white-and-near-black canvas with maximum roundness — 36px cards and pill-shaped containers dominate every surface, creating a soft, approachable tension against the very dark #09090b fills used for primary actions. The neutral scale is dense and graduated (gray-50 through gray-950), but only 3-4 steps appear in any single view, keeping contrast high without complexity. The single custom typeface, Cosmica, spans the entire system from 10px badge labels to 64px display headlines — its weight range (300–700) does all tonal work that color doesn't. Accent color is almost entirely absent from the UI layer: vivid orange (#ff5a00) surfaces only on YC badge labels, and the vivid pink (#fe45e2) is a single decorative card wash — the system's restraint makes these moments land harder.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Obsidian | `#09090b` | `--color-obsidian` | Primary filled button backgrounds, display heading text on white surfaces — the system's anchor dark, nearly true black |
| Ink | `#18181b` | `--color-ink` | Body text, nav text, badge text on light surfaces — one shade lighter than Obsidian, used for reading-weight text |
| Graphite | `#3f3f46` | `--color-graphite` | Button borders, badge backgrounds (dark variant), border strokes across components — the dominant UI border tone |
| Slate | `#52525b` | `--color-slate` | Mid-dark card backgrounds in dark sections, subtle icon fills |
| Steel | `#71717a` | `--color-steel` | Muted body copy, helper text labels such as stat captions |
| Ash | `#a1a1aa` | `--color-ash` | Subdued heading variants, placeholder text, decorative rule strokes |
| Pebble | `#d4d4d8` | `--color-pebble` | Hairline dividers, inactive link backgrounds, lightest visible border on white cards |
| Fog | `#ececee` | `--color-fog` | Card backgrounds (mid variant), badge borders, section dividers — the second surface step above the canvas |
| Mist | `#f4f4f5` | `--color-mist` | Page canvas, light card backgrounds, tag/link hover surface — the dominant background tone |
| Snow | `#ffffff` | `--color-snow` | White card surfaces, input backgrounds, button fill for outlined variant — the brightest surface in the stack |
| Link Secondary | `#3254F2` | `--color-link-secondary` | Legal and secondary text links plus secondary progress accents that must remain distinguishable from the near-black primary action color |
| Ember | `#ff5a00` | `--color-ember` | YC batch badge backgrounds — vivid orange signals startup-ecosystem provenance, appears only on badge-sized labels |
| Orchid Flash | `#fe45e2` | `--color-orchid-flash` | Decorative card wash accent — single-use vivid pink on a large card background to punctuate the portfolio grid |

## Tokens — Difficulty Scale

Semantic color scale for TOPIK writing difficulty (`problems.difficulty`, 1–5).
A low-saturation warm gradient (easy = green → hard = brick), kept deliberately
muted so it never reads as "vivid" and does not break the system's calm,
largely-achromatic identity. This is the only chromatic scale allowed in the UI
layer beyond the reserved Ember/Orchid accents, and it exists solely to encode
difficulty.

| Level | Label key (`practice.common`) | Value | Role |
|-------|-------------------------------|-------|------|
| 1 · 쉬움 (very easy) | `difficultyVeryEasy` | `#5e9e6f` | Calm green — easiest |
| 2 · 조금 쉬움 (easy) | `difficultyEasy` | `#8aa04e` | Olive |
| 3 · 보통 (normal) | `difficultyNormal` | `#cca63a` | Gold / mustard |
| 4 · 조금 어려움 (hardish) | `difficultyHardish` | `#cf833f` | Soft orange |
| 5 · 어려움 (hard) | `difficultyHard` | `#c75d4f` | Brick red — hardest |

**Rules**

- Tint the difficulty **icon only** (e.g. the lucide
  `ChartNoAxesColumnIncreasing` stroke). Keep the text label achromatic
  (`text-secondary`) so contrast/legibility holds — color is a supplementary
  signal and the text label always carries the meaning, per "color carries
  meaning, never decoration; pair every color signal with text or icon."
- Default to a single tinted icon, not a multi-bar meter, for the difficulty
  indicator.
- Single source: the level→color and level→label-key mapping is defined only in
  `src/components/practice/DifficultyMeter.tsx` (`difficultyFillColor(level)`,
  `difficultyLabelKey(level)`) — same single-source rule as
  `reason-tag-colors.ts`.
- These five colors are difficulty-only. Do not reuse them for CTAs, buttons,
  states, hover, or any other UI (the achromatic-CTA rule stands).
- They currently live as fixed hex in the component helper. If they ever need to
  be consumed via Tailwind utilities or AntD tokens, promote them through
  `src/theme` into `--app-*` and update the theme contract tests (per the
  runtime policy above).

## Tokens — Semantic Borders

Ant Design is the L1 owner of border roles. App-owned CSS that needs the
secondary separator color uses the resolved L2 bridge value instead of reading
an `--ant-*` runtime variable or inventing another gray. The Awesomic values
preserve the previously resolved paint: light `#f0f0f0`, dark `#303030`.

| Meaning | Ant Design owner | App bridge | Consumer |
| --- | --- | --- | --- |
| Secondary row separator | `colorBorderSecondary` | `--app-color-border-secondary` | Component-local CSS border |

Alternate test themes must provide a visibly distinct resolved value through
the same bridge. The test-only fixture remains excluded from production source
and bundles.

## Tokens — Shared Card Outline

Outlined workspace cards use one app-owned subtle outline recipe. The recipe
preserves the current border-at-25%-over-layout paint while allowing alternate
themes to replace the resolved result without copying a `color-mix()` into
global CSS. Selected cards continue to override only `border-color` with the
primary role, so their state remains visually stronger than the shared outline.

| Meaning | Awesomic source | App bridge | Consumer |
| --- | --- | --- | --- |
| Shared card subtle outline | border at 25% mixed with layout | `--app-color-shared-card-subtle-outline` | `.app-cards-bordered` AppCard outline |

## Tokens — Practice and Review Visual Roles

Practice and review surfaces reserve seven app-owned roles for the bounded
consumer cleanup that follows this foundation change. The production values
preserve the existing light and dark paint exactly; alternate themes resolve
appearance-sensitive color and shadow roles independently. These roles are
plain-CSS bridge values and must not add Tailwind aliases.

| Meaning | Awesomic source | App bridge |
| --- | --- | --- |
| Retry summary corner | 10px | `--app-radius-practice-retry-summary` |
| Retry mode option corner | 12px | `--app-radius-practice-retry-mode-option` |
| Library score track | border at 18% mixed with container | `--app-color-library-review-score-track` |
| Selected card elevation and inset ring | elevated shadow plus 1.5px primary inset | `--app-shadow-selectable-card-selected` |
| Question number display type | Space Grotesk over the app family | `--app-font-question-number-display` |
| New-problem badge corner | 12px | `--app-radius-problem-new-badge` |
| New-problem badge surface | secondary text at 12% over transparent | `--app-color-problem-new-badge-surface` |

## Tokens — Analysis Handoff and Failure Actions

The submitted-analysis handoff overlay and failure actions use two app-owned
plain-CSS roles. The overlay keeps the existing container-at-62%-over-transparent
paint, while the failure action corner preserves the current 10px geometry.
Alternate themes must provide a visibly distinct overlay for each appearance.
These roles do not add foundation Tailwind aliases.

| Meaning | Awesomic source | App bridge | Consumer |
| --- | --- | --- | --- |
| Completed-analysis handoff overlay | container at 62% over transparent | `--app-color-analysis-handoff-overlay-surface` | `.analysis-state-card__overlay` |
| Failed-analysis action corner | 10px | `--app-radius-analysis-failure-action` | `.analysis-loading__actions .ant-btn` |

## Tokens — Semantic Status

Ant Design is the L1 owner of interface status meaning. App-owned Tailwind
consumers use the matching L2 bridge aliases below; they do not read
`--ant-*` variables directly. The light/dark values are the resolved Ant Design
status and fill values already used by the product, so promoting them does not
change the production paint.

| Meaning | Ant Design owner | App bridge | Tailwind alias |
| --- | --- | --- | --- |
| Error / weak | `colorError` | `--app-color-status-error` | `status-error` |
| Error border | `colorErrorBorder` | `--app-color-status-error-border` | None; direct app CSS |
| Error surface | `colorErrorBg` | `--app-color-status-error-surface` | None; direct app CSS |
| Warning / fair | `colorWarning` | `--app-color-status-warning` | `status-warning` |
| Success / good | `colorSuccess` | `--app-color-status-success` | `status-success` |
| Strong success | `colorSuccessActive` | `--app-color-status-strong-success` | `status-strong-success` |
| Inactive indicator fill | `colorFillSecondary` | `--app-color-fill-secondary` | `fill-secondary` |
| Indicator corner | `borderRadiusXS` | `--app-radius-indicator` | `indicator` |

Status color is always paired with a translated strength label, rule text, or
symbol. These roles are not CTA or decorative palette colors.

The account deletion card uses the error border and surface roles in both its
loading and ready states. The selected notification channel keeps its existing
one-pixel primary ring through `--app-shadow-notification-channel-selected`.
These atomic roles are plain-CSS consumers and do not add foundation Tailwind
aliases.

## Tokens — Semantic Radius

App-owned CSS uses two shape roles in addition to the default workspace radius.
The card radius preserves the existing 8px menu and notification-row corners;
the pill radius comes from the imported Awesomic `radius.full-6` source and is
used only where the rendered shape must stay fully rounded.

| Meaning | Awesomic source | App bridge | Consumer |
| --- | --- | --- | --- |
| Compact card/action corner | Runtime card radius (8px) | `--app-radius-card` | Menu and notification rows |
| Fully rounded control | `radius.full-6` (10000px) | `--app-radius-pill` | User/notification action groups and unread dot |

## Tokens — Shared Overlay Shadows

Workspace floating actions, popovers, and Ant Design messages use three
app-owned elevation roles because their existing depth and placement differ
from the quieter shared elevated surface. Production light and dark themes keep
the exact current shadows; alternate themes must replace all three with
distinct values. These bridge variables are consumed directly by global CSS,
so no unused Tailwind `--shadow-*` aliases are exposed.

| Meaning | Current value | App bridge |
| --- | --- | --- |
| Floating workspace actions | `0 6px 18px rgba(42, 55, 89, 0.1)` | `--app-shadow-floating-action` |
| Notification/report popovers | `0 16px 42px rgba(15, 23, 42, 0.16), 0 4px 14px rgba(15, 23, 42, 0.1)` | `--app-shadow-popover` |
| Ant Design message toast | `0 6px 16px 0 rgba(0, 0, 0, 0.1), 0 2px 6px -2px rgba(0, 0, 0, 0.08)` | `--app-shadow-message` |

The existing `--app-shadow-elevated` role remains unchanged and continues to
own quieter notification/card surfaces.

## Tokens — Writing Exam Header

The writing exam header keeps its translucent container paint as an app-owned
semantic surface. `WritingExamShell.module.css` is the L2 consumer and owns the
header paint plus the shared save/submit button corner. The button corner reuses
`--app-radius-card` because its existing value is exactly 8px.

| Meaning | Awesomic source | App bridge | Consumer |
| --- | --- | --- | --- |
| Sticky writing header surface | `color-mix(in srgb, var(--app-color-bg-container) 92%, transparent)` | `--app-color-writing-exam-header-surface` | `WritingExamShell.module.css` |

Autosave status color remains owned by Ant Design's public `Tag` tones for all
five states; writing CSS must not replace them with one blanket success paint.
The shell module retains only the badge's existing zero margin, zero border,
12px type size, and 700 weight so the visual geometry does not regress.

## Tokens — Writing Material Surfaces

Writing 53 chart tooltips and value rows use a compact visual cluster owned by
`Writing53MaterialCards.module.css`. The 4px corner is an app-specific compact
surface role, not the semantic badge radius. Tooltip depth and the shared
hover/focus/active row surface also have dedicated roles so alternate themes can
replace the cluster without changing its interaction contract.

| Meaning | Production value | App bridge |
| --- | --- | --- |
| Compact tooltip/value-row corner | `4px` | `--app-radius-writing-material-compact-surface` |
| Chart tooltip depth | `0 4px 12px rgb(0 0 0 / 6%)` | `--app-shadow-writing-material-tooltip` |
| Hover/focus/active value-row surface | `color-mix(in srgb, var(--app-color-primary) 8%, transparent)` | `--app-color-writing-material-row-active-surface` |

Tooltip emphasis and keyboard focus continue to use `--app-color-primary`
directly. App bridge availability is guaranteed, so writing CSS does not carry
a raw `#1677ff` fallback.

## Tokens — Writing Blank Controls

`InteractiveBlankPrompt.module.css` owns inline blank radius and focus/active/
filled paint. `ShortAnswerWritingWorkspace.module.css` owns the shared Q51/Q52
tab and answer-card radius, including the mobile answer-card override. Stable
global class names remain markup hooks but do not own these properties.

| Meaning | Production value | App bridge |
| --- | --- | --- |
| Selected tab inverse text | `#ffffff` | `--app-color-text-inverse` |
| Inline blank active surface | Primary 6% mixed with container | `--app-color-writing-blank-active-surface` |
| Filled inline blank border | Primary 42% mixed with border | `--app-color-writing-blank-filled-border` |
| Zero corner | `0px` | `--app-radius-none` |
| Inline blank keyboard focus ring | Primary 18%, 2px ring | `--app-shadow-writing-blank-focus` |
| Inline blank active inset | Primary 2px bottom inset | `--app-shadow-writing-blank-active-inset` |

Composite corners are assembled from atomic roles: inline blanks use
`--app-radius` with `--app-radius-indicator`, tabs use `--app-radius-card` with
`--app-radius-none`, and answer cards use `--app-radius-none` with
`--app-radius`. This keeps desktop and mobile geometry themeable without a
selector-specific composite token.

## Tokens — Writing Manuscript Preview

`ManuscriptPreview.module.css` owns the manuscript grid font and the selected
intro/body/conclusion paint. Stable global classes remain runtime and E2E hooks;
global CSS keeps only shared grid geometry and base cell structure. The module
consumes resolved app variables directly and does not rebuild section paint
through local custom-property cascades or Ant Design runtime variables.

| Meaning | Production value | App bridge |
| --- | --- | --- |
| Manuscript monospace stack | Existing system monospace stack | `--app-font-writing-manuscript-mono` |
| Intro selected surface | Primary 12% mixed with container | `--app-color-writing-manuscript-intro-surface` |
| Intro selected border | Primary 48% mixed with border | `--app-color-writing-manuscript-intro-border` |
| Intro selected inset ring | Primary 30%, 1px inset | `--app-shadow-writing-manuscript-intro-inset` |
| Body selected surface | Success background: light `#f6ffed`, dark `#162312` | `--app-color-writing-manuscript-body-surface` |
| Body selected border | Success 48% mixed with border | `--app-color-writing-manuscript-body-border` |
| Body selected inset ring | Success 30%, 1px inset | `--app-shadow-writing-manuscript-body-inset` |
| Conclusion selected surface | Warning background: light `#fffbe6`, dark `#2b2111` | `--app-color-writing-manuscript-conclusion-surface` |
| Conclusion selected border | Warning 48% mixed with border | `--app-color-writing-manuscript-conclusion-border` |
| Conclusion selected inset ring | Warning 30%, 1px inset | `--app-shadow-writing-manuscript-conclusion-inset` |

Alternate test themes replace all ten roles with mutually distinct values and
remain outside production source and theme registration.

## Tokens — Landing CTA

The live landing page has two intentional CTA color modes: a dark primary
action over the hero video and a light ghost action in the translucent header.
Their current paint is preserved as a semantic L1 source and projected to L2 so
alternate themes can replace the complete cluster without page-local colors.
Ant Design continues to own focus, disabled, loading, and active lifecycle;
app CSS owns only the documented default and enabled-hover paint.

| Meaning | Awesomic value | App bridge |
| --- | --- | --- |
| Primary fill and border | `#070203` | `--app-color-landing-cta-primary` |
| Primary enabled hover | `#21080c` | `--app-color-landing-cta-primary-hover` |
| Primary foreground | `#ffffff` | `--app-color-landing-cta-foreground` |
| Header ghost surface | `#ffffff` | `--app-color-landing-cta-ghost-surface` |
| Header ghost text and hover fill | `#0c0c0d` | `--app-color-landing-cta-ghost-text` |
| Header ghost border | `#e7e7e6` | `--app-color-landing-cta-ghost-border` |
| Hero CTA square corner | `0px` | `--app-radius-landing-hero-cta` |

The header CTA uses the existing fully rounded control token
(`--app-radius-pill`). The retired hero secondary selector is not a supported
variant; add a real consumer and explicit visual contract before introducing a
new landing CTA mode.

## Tokens — Landing Hero and Header

The public landing shell, video fallback, translucent header, navigation, and
hero copy form one opening-scene palette. These roles are independent from CTA
states and from the portfolio content below the hero, even where current values
match. Production light and dark appearances preserve the existing paint; the
Phase 5D alternate fixture replaces all eight roles with distinct values.

| Meaning | Current value | App bridge |
| --- | --- | --- |
| Outer page canvas | `#f7f3ef` | `--app-color-landing-hero-outer-canvas` |
| Video and stage fallback | `#ccc2b7` | `--app-color-landing-hero-media-fallback` |
| Translucent header surface | `rgba(255, 255, 255, 0.72)` | `--app-color-landing-hero-header-surface` |
| Header navigation foreground | `#0c0c0d` | `--app-color-landing-hero-header-foreground` |
| Header navigation hover | `#8b8b8e` | `--app-color-landing-hero-header-hover` |
| Hero title foreground | `#ffffff` | `--app-color-landing-hero-foreground` |
| Hero kicker foreground | `rgba(255, 255, 255, 0.72)` | `--app-color-landing-hero-kicker` |
| Hero body foreground | `rgba(255, 255, 255, 0.82)` | `--app-color-landing-hero-body` |

The brand logo hover changes opacity only; text color is not a logo state. The
header's no-shadow behavior remains owned by its existing utility class and is
not duplicated in global CSS.

## Tokens — Portfolio Landing Foreground and Type

The portfolio content below the hero owns a restrained editorial palette and
two display stacks. These are content foreground and typography roles, not CTA
states: do not reuse `landingCta` tokens for headings, copy, icons, labels, or
footer links. Hero and header paint remain outside this token group.

| Meaning | Current value | App bridge |
| --- | --- | --- |
| Primary text and icon foreground | `#0c0c0d` | `--app-color-landing-portfolio-foreground` |
| Muted heading span | `#a5a5aa` | `--app-color-landing-portfolio-heading-accent` |
| Supporting intro copy | `#77777b` | `--app-color-landing-portfolio-supporting` |
| Repeated secondary copy | `#8b8b8e` | `--app-color-landing-portfolio-muted` |
| Faint caption metadata | `#b6b6b8` | `--app-color-landing-portfolio-faint` |
| Service numeric label | `#1c1c1f` | `--app-color-landing-portfolio-label` |
| Footer CTA hover foreground | `#3c3c40` | `--app-color-landing-portfolio-footer-hover` |
| Editorial display stack | `Space Grotesk` + app fallback | `--app-font-landing-portfolio-display` |
| Numeric marker stack | `Montserrat` + app fallback | `--app-font-landing-portfolio-numeric` |

Production light and dark appearances preserve the current portfolio paint.
The Phase 5D alternate fixture must replace every portfolio role with a distinct
value and remain excluded from `src/**`.

### Portfolio surfaces and shapes

The portfolio cards and content sections use their own surface, divider,
placeholder, and shape roles. These roles must not borrow CTA state tokens.
Exact common geometry continues to use the shared card radius; the media,
circular avatar/check, and visual tag shapes remain portfolio-owned.

| Meaning | Current value | App bridge |
| --- | --- | --- |
| Page and avatar canvas | `#ffffff` | `--app-color-landing-portfolio-canvas` |
| Dark media/action surface | `#0c0c0d` | `--app-color-landing-portfolio-dark-surface` |
| Foreground on dark surfaces | `#ffffff` | `--app-color-landing-portfolio-inverse-foreground` |
| Visual tag surface | `rgba(255, 255, 255, 0.72)` | `--app-color-landing-portfolio-tag-surface` |
| Card and footer surface | `#fbfbfb` | `--app-color-landing-portfolio-card-surface` |
| Step divider | `#b9b9b3` | `--app-color-landing-portfolio-divider` |
| Subtle path divider | `#dededc` | `--app-color-landing-portfolio-divider-subtle` |
| Dark action hover | `#1c1c1f` | `--app-color-landing-portfolio-action-hover` |
| Media placeholder pattern | Existing repeating gradient | `--app-background-landing-portfolio-media-placeholder` |
| Media overlay | Existing linear gradient | `--app-background-landing-portfolio-media-overlay` |
| Media corner | `4px` | `--app-radius-landing-portfolio-media` |
| Avatar/check circle | `50%` | `--app-radius-landing-portfolio-round` |
| Visual tag pill | `999px` | `--app-radius-landing-portfolio-tag-pill` |

Path cards and footer focus treatment reuse `--app-radius-card` because their
current `8px` geometry exactly matches the shared card role. The visual tag
also reuses the existing portfolio muted foreground and display font roles.

## Tokens — Auth Prompt Surfaces

The login and sign-up prompt keeps its white outer canvas and layered desktop
illustration background independent from the general app and landing palettes.
Both production appearances preserve the existing paint. Image-only brand links
do not own inherited text colors: `BrandLogo` renders no `strong` or
`currentColor` consumer, so those obsolete declarations are not theme roles.
The official four-color Google mark remains a separate brand asset and is not
projected through the app theme.

| Meaning | Current value | App bridge |
| --- | --- | --- |
| Prompt canvas | `#ffffff` | `--app-color-auth-prompt-canvas` |
| Desktop illustration background | Existing layered radial and linear gradient | `--app-background-auth-prompt-hero` |

## Tokens — Auth Prompt Controls

The live login and sign-up prompt owns one scoped Ant Design theme for Input and
Select focus paint only. Button lifecycle, including disabled social and the
magic-link retry action, remains owned by the outer Ant Design theme. The app
bridge and the prompt's local stylesheet are the single geometry owner for the
50px/8px input, select, primary, and social controls; only the primary action
gets the local 600 font weight. Alternate themes must replace every bridge
value through the same source contract.

| Meaning | Awesomic value | App bridge |
| --- | --- | --- |
| Shared focus outline | `rgba(24, 24, 24, 0.08)` | `--app-color-auth-prompt-focus-outline` |
| Login focus border | `#aab5ff` | `--app-color-auth-prompt-login-focus-border` |
| Shared focus ring | `0 0 0 2px rgba(24, 24, 24, 0.08)` | `--app-shadow-auth-prompt-focus` |
| Login focus ring | `0 0 0 2px rgba(82, 102, 255, 0.1)` | `--app-shadow-auth-prompt-login-focus` |
| Control corner | `8px` | `--app-radius-auth-prompt-control` |
| Control height | `50px` | `--app-size-auth-prompt-control` |

## Tokens — Auth Completion Surfaces

The required-document card on `/auth/consent` and the verification card on
`/auth/verify-email` own semantic surface recipes. The consent role applies only
to the nested document card; the outer consent card keeps its existing shared
surface. The verification card uses a compact corner below `479.98px` while its
shadow remains the same recipe. Light and dark currently preserve the same
values, but alternate themes must replace all six roles through the bridge.

| Meaning | Awesomic value | App bridge |
| --- | --- | --- |
| Consent document surface | container at 94% mixed with layout | `--app-color-auth-consent-document-surface` |
| Verify card border | border at 72% mixed with transparent | `--app-color-auth-verify-email-card-border` |
| Verify summary surface | layout at 56% mixed with container | `--app-color-auth-verify-email-summary-surface` |
| Verify card corner | `28px` | `--app-radius-auth-verify-email-card` |
| Verify compact corner | `12px` | `--app-radius-auth-verify-email-card-compact` |
| Verify card shadow | primary-tinted lift plus elevated shadow | `--app-shadow-auth-verify-email-card` |

The global stylesheet consumes these app bridge variables directly. They do not
have Tailwind foundation aliases, and resend, cooldown, loading, success, and
error behavior remain outside this visual token contract.

## Tokens — Auth Character Illustration

로그인·회원가입 프롬프트의 네 캐릭터는 인터페이스 상태색이 아니라 제품 삽화다.
따라서 Ant Design의 primary/status 색을 빌려 쓰지 않고
`src/theme/tokens/awesomic.ts`의 `authCharacter`가 L1 palette·shape를
소유한다. `AnimatedAuthCharacters`의 전역 CSS는 아래 L2 변수만 소비하며,
레이아웃·애니메이션·입력 상태에 따른 움직임은 이 토큰 계약 밖에서 유지한다.
항상 숨겨져 있던 종이와 바닥 장식은 DOM과 CSS에서 제거했다.

| 삽화 역할 | 현재 값 | App bridge |
| --- | --- | --- |
| 보라 몸체 | `#6c3ff5` | `--app-color-auth-character-purple` |
| 짙은 몸체 | `#2d2d2d` | `--app-color-auth-character-charcoal` |
| 코랄 몸체 | `#ff9b6b` | `--app-color-auth-character-coral` |
| 노랑 몸체 | `#e8d754` | `--app-color-auth-character-yellow` |
| 얼굴 선 | `#25262d` | `--app-color-auth-character-ink` |
| 흰 눈 | `#ffffff` | `--app-color-auth-character-eye` |
| 몸체 아래 기준 모서리 | `0px` | `--app-radius-auth-character-base-edge` |
| 보라 몸체 위 모서리 | `10px` | `--app-radius-auth-character-body-top` |
| 눈·입·둥근 몸체 | `999px` | `--app-radius-auth-character-pill` |

짙은 몸체의 8px 위 모서리는 기존 `--app-radius-card`를 재사용한다. 서로 다른
위·아래 모서리는 원자적 radius 변수를 조합하며 selector별 토큰을 만들지 않는다.
기본·dark 제품 테마는 현재 삽화 값을 보존할 수 있지만, Phase 5D alternate test
fixture는 위의 모든 삽화 역할을 서로 다른 값으로 제공해야 한다. 테스트 전용 테마는
production registry 또는 `src/**`에서 import하지 않는다.

## Tokens — Semantic Overlay

App-owned overlay paint keeps alpha inside the color value so Ant Design can
continue to own component lifecycle opacity and fade animation.

| Meaning | Awesomic source | App bridge | Consumer |
| --- | --- | --- | --- |
| Subtle modal mask | Mist at 18% alpha | `--app-color-mask-subtle` | Local Drawer mask CSS |

Do not recreate this role with element `opacity`, `filter`, or a component-local
raw color. Alternate test themes must provide a distinct resolved value through
the same L1-to-L2 bridge; they are never registered in production.

## Tokens — Typography

### Cosmica — The sole typeface across the entire system — every badge, button, nav link, heading, and body copy uses Cosmica. Its wide weight range means all typographic hierarchy is weight-driven rather than family-switching. At 56–64px the light-to-medium weights feel assertive without shouting; at 10–14px the medium-to-semibold weights keep small labels legible at compact density. · `--font-cosmica`
- **Substitute:** DM Sans, Plus Jakarta Sans
- **Weights:** 300, 400, 500, 600, 700
- **Sizes:** 10px, 12px, 13px, 14px, 15px, 16px, 18px, 20px, 32px, 40px, 56px, 64px
- **Line height:** 1.0–1.8 (tighter at display sizes ~1.0–1.12, looser at body sizes ~1.45–1.68)
- **Letter spacing:** normal across all sizes — no tracked-out headlines or tight-tracked display text
- **Role:** The sole typeface across the entire system — every badge, button, nav link, heading, and body copy uses Cosmica. Its wide weight range means all typographic hierarchy is weight-driven rather than family-switching. At 56–64px the light-to-medium weights feel assertive without shouting; at 10–14px the medium-to-semibold weights keep small labels legible at compact density.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 10px | 1.8 | — | `--text-caption` |
| body | 14px | 1.56 | — | `--text-body` |
| body-lg | 16px | 1.5 | — | `--text-body-lg` |
| subheading | 18px | 1.45 | — | `--text-subheading` |
| heading-sm | 20px | 1.35 | — | `--text-heading-sm` |
| heading | 32px | 1.28 | — | `--text-heading` |
| heading-lg | 40px | 1.25 | — | `--text-heading-lg` |
| display-sm | 56px | 1.12 | — | `--text-display-sm` |
| display | 64px | 1 | — | `--text-display` |

기존 Tailwind `--text-*` 별칭은 같은 역할의 L2 `--app-font-size-*` bridge
변수를 통해 계산된다. 따라서 글자 크기도 color, radius, shadow, font family와
같이 선택된 theme source에서 first render에 함께 결정된다.

### Runtime UI Hierarchy Contract

아래 표는 현재 공통 컴포넌트의 runtime anchor와 앞으로 새 UI가 따라야 할 계약을 함께 정리한다. 기존 화면의 불일치는 Phase 5 remediation 대상으로 다루며, 새 화면에서 다시 복제하지 않는다.

| Role | Contract |
| --- | --- |
| Page title | `PageHeader` 또는 report 계열 `ReportPageHeader`를 재사용한다. route의 주 제목은 의미상 `h1` 하나이며, 현재 공통 title의 24px / 1.35 / 600을 시각 anchor로 삼는다. 기존 wrapper의 heading semantics가 다르면 별도 remediation에서 고친다. |
| Section title | 한 section에는 한 가지 목적만 두고 18px / 1.45 / 600을 기본 목표로 한다. page title과 경쟁하는 크기나 별도 display heading을 만들지 않는다. |
| Card title | 카드 전체를 설명하는 title과 status/count는 `AppCard`의 `title` / `extra`를 사용한다. body 안에 같은 역할의 header row를 다시 만들지 않는다. |
| Korean reading | 연속된 한국어 읽기 본문은 16px 이상, 약 1.7 line-height, 약 760px 읽기 폭을 목표로 한다. 새 `max-w-[...]` 임의값 대신 승인된 reading recipe 또는 semantic layout source를 사용한다. |
| Helper/status | 현재 14px / 약 1.57 anchor와 semantic secondary token을 사용한다. 색만으로 의미나 상태를 전달하지 않는다. |

한 task area에는 primary action을 하나만 둔다. Desktop에서는 공간이 허용될 때 title과 actions를 같은 header axis에 두고, mobile에서는 actions를 아래로 감싸되 title의 크기와 위계를 줄이지 않는다.

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** compact

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 36 | 36px | `--spacing-36` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 64 | 64px | `--spacing-64` |
| 68 | 68px | `--spacing-68` |
| 80 | 80px | `--spacing-80` |
| 120 | 120px | `--spacing-120` |

### Border Radius

| Element | Value |
|---------|-------|
| hero | 48px |
| pill | 10000px |
| cards | 36px (primary) or 28px (compact) |
| icons | 40px |
| badges | 12px |
| inputs | 14px |
| buttons | 36px (pill) or 14-16px (rounded rect) |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `rgba(255, 255, 255, 0.5) 0px 0.5px 0px 0px inset, rgba(11...` | `--shadow-subtle` |
| subtle-2 | `rgb(228, 228, 231) 0px 1px 0px 0px inset` | `--shadow-subtle-2` |
| subtle-3 | `rgb(255, 255, 255) 0px 0.5px 0px 0px inset` | `--shadow-subtle-3` |
| subtle-4 | `rgb(255, 255, 255) 0px -0.5px 0px 0px` | `--shadow-subtle-4` |
| subtle-5 | `rgb(228, 228, 231) 0px -1px 0px 0px` | `--shadow-subtle-5` |
| md | `rgba(0, 0, 0, 0.04) 0px 4px 12px 0px` | `--shadow-md` |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 80px
- **Card padding:** 24-28px
- **Element gap:** 8px

## Components

### Primary Pill Button
**Role:** Main page CTA — Book demo, Get started, View all projects

Background #09090b, white text, Cosmica 14–16px weight 500, border-radius 36px, padding 12px 16px, 1.5px ring at rgb(44,46,52) with layered inset highlight and soft drop shadow. The multi-layer shadow gives the black pill a pressed-glass tactile quality unique to this system.

### Outlined White Button
**Role:** Secondary actions, nav-adjacent controls

Background #ffffff, text #3f3f46, border 1px solid #3f3f46, border-radius 36px, padding 20px. Same pill silhouette as primary but inverted — white fill against the dark border reads as a ghost on light backgrounds.

### Rounded Dark Button
**Role:** In-context actions within dark card panels

Background #09090b, white text, border 1px solid rgba(255,255,255,0.2), border-radius 14–16px, padding 12–14px 16–18px. The softer radius (not pill) distinguishes panel-embedded actions from page-level CTAs.

### Light Surface Card
**Role:** Stat blocks, feature sections, testimonials on white canvas

Background #ffffff, border-radius 36px, padding 28px horizontal and vertical, no box-shadow (flat). The extreme 36px radius makes white rectangles read as bubbles rather than panels.

### Card Footer Actions
**Role:** Card-level CTAs and navigation actions in TALKPIK app surfaces

Use Ant Design `Card.actions` for card-level buttons instead of placing those buttons inside the card body. The body should hold content only; the footer/actions area owns the card's primary or secondary CTA. In TALKPIK runtime, keep this footer visually borderless by default: no top divider, no extra outline, and no nested mini-card treatment. Use one action group per card and keep the button aligned with the card content.

### Card Header Title + Extra
**Role:** Card titles, right-aligned status chips, and count metadata in TALKPIK app surfaces

Use Ant Design `Card` `title` for the card title and `extra` for card-level status or count metadata. Do not hand-build a title/status row inside the card body when sibling cards should share alignment. The card body should start with the card's actual content, not a repeated header row.

### Muted Surface Card
**Role:** Secondary content blocks and social proof rows

Background #ececee, border-radius 28px, padding 24px all sides, no shadow. Slightly smaller radius and darker fill than white cards creates a quiet depth step without elevation.

### Dark Problem Panel
**Role:** Contrast section listing bottleneck points (e.g. 'We solve the bottlenecks' section)

Background #09090b or #222222, border-radius 28–36px, white and #a1a1aa text. Keyword phrases use Cosmica weight 600–700 while lead-in words use weight 300–400, creating inline weight contrast within single lines.

### Portfolio Tile Card
**Role:** Work showcase grid — full-bleed image with category badges overlaid

Background is the full-bleed project image or a vivid accent fill (#fe45e2 for decorative tiles). Border-radius 36px clipping the image. Badge labels float over the image at bottom-left, using the transparent dark badge variant.

### Dark Overlay Badge
**Role:** Category/skill tags on dark or image backgrounds

Background transparent, text #ffffff, border 1px solid rgba(255,255,255,0.3–0.5), border-radius 12px, padding 4px 8px, Cosmica 12px weight 500.

### Dark Filled Badge
**Role:** Skill/service tags on light backgrounds

Background #3f3f46, text #fafafa, border-radius 12px, padding 4px 8px, Cosmica 12px weight 500.

### Ember Badge (YC Marker)
**Role:** Y Combinator batch identifier on project cards and testimonials

Background #ff5a00, text #ffffff, border-radius 12px, padding 4px 8px, Cosmica 12px weight 600. Its use is exclusive to YC affiliation labels — never repurpose for generic status.

### Email Input + CTA Row
**Role:** Hero email capture form

Input: background #ffffff, text #333333, border transparent, border-radius 14px, padding 12px 12px 12px 16px, Cosmica 14px weight 400, placeholder text in #a1a1aa. Paired inline with a Primary Pill Button (Book demo) in a flex row.

### Announcement Banner
**Role:** Full-width notification strip above the nav

Background #222222 or near-black, rounded-rect pill shape at border-radius 48px, text white Cosmica 14px, with a ghost inline CTA link on the right. Uses backdrop-filter blur for a frosted dark treatment.

### Stat Number Block
**Role:** Key metric highlights (20 000+, 4 000+, 70%, 40%, 60%)

Large numeral at 40–56px Cosmica weight 700 in #09090b or #18181b. Descriptor label below at 12–14px weight 400 in #71717a. No card border — sits directly on section background for raw typographic emphasis.

## Do's and Don'ts

### Do
- Put card titles and right-side status/count metadata in Ant Design `Card` `title` and `extra` when the information describes the whole card.
- Put card-level CTA buttons in the Ant Design `Card.actions` footer area, not in the card body. Keep the footer action area borderless by default.
- Treat 28-36px radii as raw Awesomic reference values for marketing/reference surfaces; use the documented TALKPIK runtime radius exception (4-8px workspace cards/panels) for study dashboards and operational UI.
- Use Ant Design components and tokens first; use Tailwind for layout/responsive work and limited token-backed visual utilities on app-owned surfaces through the `--app-*` bridge.
- Keep one clear primary action per task area, and pair every color signal with text or icon.
- Encode difficulty (1–5) with the muted Difficulty Scale by tinting the difficulty icon only; keep the label text achromatic and source colors from `difficultyFillColor`/`difficultyLabelKey` (see Tokens — Difficulty Scale).
- Apply the multi-layer button shadow (rgba(255,255,255,0.5) inset + rgba(117,123,133,0.4) inset + rgb(44,46,52) 1.5px ring + rgba(0,0,0,0.14) drop) only on the primary #09090b pill button — it defines the CTA's physicality.
- Reserve Ember (#ff5a00) exclusively for YC batch badges and Orchid Flash (#fe45e2) exclusively for single decorative card washes — these vivid colors derive their impact from appearing nowhere else.
- Use Cosmica weight 300–400 for lead-in words and weight 600–700 for the key noun/verb in the same line to create inline tonal contrast without changing size.
- Maintain a 4-step neutral surface stack (Mist → Snow → Fog → Obsidian) per page — don't introduce more than four background tones in a single section view.
- Apply border-radius 12px to all badge and tag components regardless of content length — pill tags use 10000px only for navigation-level controls.
- Use backdrop-filter blur (5–17px range) on overlaid panels and the announcement banner to create depth without hard shadows on light surfaces.

### Don't
- Don't create custom card header rows inside the card body for whole-card title/status alignment.
- Don't place card-level CTA buttons inside card body content unless the action is inline with a form field or a sentence-level control.
- Don't use any color other than #09090b/#222222 for new filled button backgrounds — the system has no chromatic CTA color; dark filled + white text is the only primary action pattern. The live landing CTA values documented in `Tokens — Landing CTA` are a preservation exception, not a reusable palette.
- Don't apply the raw 28-36px Awesomic radius scale to TALKPIK workspace cards when the runtime contract specifies the smaller app radius.
- Don't paste raw Tailwind export values into app CSS; normalize through `src/theme` and expose only approved `@theme inline` aliases.
- Don't create a separate Tailwind palette, radius scale, shadow scale, or font source.
- Don't introduce new typefaces — Cosmica's weight range handles all hierarchy; adding a second family destroys the single-voice typographic system.
- Don't apply drop shadows to cards — card depth is expressed through background color steps (#ffffff vs #ececee vs #09090b), not elevation shadows.
- Don't use #ff5a00 or #fe45e2 for UI states, hover effects, or repeated interface elements — their power is scarcity; repeated use collapses their impact.
- Don't reuse the Difficulty Scale colors (#5e9e6f / #8aa04e / #cca63a / #cf833f / #c75d4f) for any non-difficulty UI (buttons, states, hover) — like Ember/Orchid, they are scoped to one purpose.
- Don't use letter-spacing overrides on headlines — Cosmica's normal tracking at large sizes is a deliberate choice; tracked-out display text would clash with the type system.
- Don't place text directly on the vivid Orchid Flash (#fe45e2) card background at body size — it is a decorative wash only; any overlaid text must use display weight white.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Canvas | `#f4f4f5` | Page background and default section fill |
| 2 | Card White | `#ffffff` | Primary card surface on the canvas |
| 3 | Card Muted | `#ececee` | Secondary card or tag surface, slightly elevated feel against white |
| 4 | Dark Surface | `#09090b` | Dark card sections, filled button backgrounds, problem-statement panels |

## Elevation

- **Primary Action Button:** `rgba(255,255,255,0.5) 0px 0.5px 0px 0px inset, rgba(117,123,133,0.4) 0px 9px 14px -5px inset, rgb(44,46,52) 0px 0px 0px 1.5px, rgba(0,0,0,0.14) 0px 4px 6px 0px`
- **Card (inset bottom border):** `rgb(228,228,231) 0px 1px 0px 0px inset`
- **Card (subtle drop shadow):** `rgba(0,0,0,0.04) 0px 4px 12px 0px`

## Imagery

Awesomic uses full-bleed product and motion screenshots as portfolio tile fills — the work IS the image, with no lifestyle photography or human-context staging. Tiles are clipped to 36px rounded rectangles, giving raw screen captures a contained, curated feel. Video production tiles use dark cinematic stills (moody red neon on black) cropped tight to the 36px rounded container. Illustration and graphic-design work tiles show vibrant multi-color client deliverables framed inside the same tile shape, creating a gallery-wall effect. Icons throughout the UI are minimal, monochrome, single-stroke or flat fills at ~20px, never decorative. The system is imagery-dependent for the portfolio section but typography-dominant for all informational and conversion sections — roughly 60% text, 40% imagery across the full page.

## Layout

Max-width approximately 1200px, centered on the canvas (#f4f4f5). The hero is a 2-column split: large display headline left (weight 700, 56–64px) with an accented cycling word in a lighter tonal color, and a compact right column with subtext, email input, and CTA. Below the hero, a horizontal logo-strip scrolls client logos at full bleed. Subsequent sections alternate: white-canvas text+card layouts, then a full-width dark panel (#09090b) for problem-statement copy, back to a light canvas for social proof and stat blocks. The portfolio grid is a horizontal scroll row of tall rounded tiles rather than a static grid. Feature/benefit cards use a 2-3 column grid at 36px-radius white cards on the Mist canvas. Section vertical gaps are 80px; internal card padding 24–28px. Navigation is a sticky top bar at ~40px height with inline text links and a black pill 'Book demo' button at the right edge.

## Agent Prompt Guide

**Quick Color Reference**
- text (primary): #09090b / #18181b
- text (muted): #71717a
- background (canvas): #f4f4f5
- card surface: #ffffff
- border / divider: #ececee / #3f3f46
- accent (badge only): #ff5a00 (YC), #fe45e2 (decorative card)
- primary action: #09090b (filled action; see the preserved live landing CTA exception above)
- secondary link/accent: #3254F2 (legal links and secondary progress only)
- difficulty (1–5, icon tint only): #5e9e6f → #8aa04e → #cca63a → #cf833f → #c75d4f (see Tokens — Difficulty Scale)

**Example Component Prompts**

1. **Hero Headline Section**: White or Mist (#f4f4f5) background. Left column: display headline at 56px Cosmica weight 700, color #09090b, normal letter-spacing, line-height 1.12. One word in the headline renders in #a1a1aa at the same size/weight to create cycling accent. Right column: body text at 16px Cosmica weight 400, color #18181b; email input (background #ffffff, border transparent, radius 14px, padding 12px 16px, placeholder #a1a1aa) paired with a pill button (background #09090b, text #ffffff, radius 36px, padding 12px 16px, Cosmica 14px weight 500).

2. **Portfolio Tile**: 36px border-radius container clipping a full-bleed project screenshot. Overlay at bottom-left: project title in Cosmica 20px weight 600 white; category badges below (transparent background, white text, border rgba(255,255,255,0.3), radius 12px, padding 4px 8px, Cosmica 12px weight 500). One tile per grid row may use #fe45e2 as a solid card background instead of an image.

3. **Dark Problem Panel**: Background #09090b, border-radius 36px, padding 28px. Bullet rows in Cosmica 18px, line-height 1.45: lead-in word (e.g. 'Forget about') in #a1a1aa weight 400, followed by key phrase in #ffffff weight 600. Each row preceded by a circle icon in #3f3f46.

4. **Stat Block Row**: On Mist (#f4f4f5) background, no card border. Stat numeral at 40px Cosmica weight 700 color #09090b. Descriptor label at 13px Cosmica weight 400 color #71717a, line-height 1.56, placed directly beneath the numeral with 4px gap.

5. **Skill/Service Badge (dark variant)**: Background #3f3f46, text #fafafa, border-radius 12px, padding 4px 8px, Cosmica 12px weight 500. For YC labels substitute background #ff5a00, text #ffffff.

## Motion Philosophy

Awesomic uses animation expressively but purposefully. Three named scrolling loops (reverseloop, scroll-text, scroll-text-cta) drive the horizontal logo ticker and portfolio scroll strips at a slow 8–50s linear duration — continuous motion implies an always-on, high-volume output. UI micro-interactions (hover states, accordion expand) use 0.2–0.35s ease transitions on transform and opacity only. The one expressive easing (cubic-bezier 0.175, 0.885, 0.32, 1.275 — a mild overshoot spring) is reserved for entrance animations. Never animate color or background-color — only positional and opacity transforms.

## Similar Brands

- **Designjoy** — Same subscription-design-service model with dark filled pill buttons and portfolio-tile-as-hero grid layout
- **Superside** — Full-bleed portfolio tiles, single-typeface system, and dark/light alternating section bands for a design marketplace
- **Arc.dev** — Near-black primary action buttons on white canvas with a graduated gray neutral scale and rounded card containers
- **Contra** — Talent marketplace with portfolio card grids using extreme rounded corners and minimal accent color against achromatic surfaces
- **Framer** — Custom typeface used at all sizes for full system consistency, large rounded cards, and dark filled CTA buttons on a light page

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-obsidian: #09090b;
  --color-ink: #18181b;
  --color-graphite: #3f3f46;
  --color-slate: #52525b;
  --color-steel: #71717a;
  --color-ash: #a1a1aa;
  --color-pebble: #d4d4d8;
  --color-fog: #ececee;
  --color-mist: #f4f4f5;
  --color-snow: #ffffff;
  --color-link-secondary: #3254F2;
  --color-ember: #ff5a00;
  --color-orchid-flash: #fe45e2;

  /* Typography — Font Families */
  --font-cosmica: 'Cosmica', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.8;
  --text-body: 14px;
  --leading-body: 1.56;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.45;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.35;
  --text-heading: 32px;
  --leading-heading: 1.28;
  --text-heading-lg: 40px;
  --leading-heading-lg: 1.25;
  --text-display-sm: 56px;
  --leading-display-sm: 1.12;
  --text-display: 64px;
  --leading-display: 1;

  /* Typography — Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-68: 68px;
  --spacing-80: 80px;
  --spacing-120: 120px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 80px;
  --card-padding: 24-28px;
  --element-gap: 8px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;
  --radius-3xl-2: 28px;
  --radius-3xl-3: 36px;
  --radius-3xl-4: 40px;
  --radius-full: 48px;
  --radius-full-2: 56px;
  --radius-full-3: 64px;
  --radius-full-4: 80px;
  --radius-full-5: 1000px;
  --radius-full-6: 10000px;

  /* Named Radii */
  --radius-hero: 48px;
  --radius-pill: 10000px;
  --radius-cards: 36px (primary) or 28px (compact);
  --radius-icons: 40px;
  --radius-badges: 12px;
  --radius-inputs: 14px;
  --radius-buttons: 36px (pill) or 14-16px (rounded rect);

  /* Shadows */
  --shadow-subtle: rgba(255, 255, 255, 0.5) 0px 0.5px 0px 0px inset, rgba(117, 123, 133, 0.4) 0px 9px 14px -5px inset, rgb(44, 46, 52) 0px 0px 0px 1.5px, rgba(0, 0, 0, 0.14) 0px 4px 6px 0px;
  --shadow-subtle-2: rgb(228, 228, 231) 0px 1px 0px 0px inset;
  --shadow-subtle-3: rgb(255, 255, 255) 0px 0.5px 0px 0px inset;
  --shadow-subtle-4: rgb(255, 255, 255) 0px -0.5px 0px 0px;
  --shadow-subtle-5: rgb(228, 228, 231) 0px -1px 0px 0px;
  --shadow-md: rgba(0, 0, 0, 0.04) 0px 4px 12px 0px;

  /* Surfaces */
  --surface-canvas: #f4f4f5;
  --surface-card-white: #ffffff;
  --surface-card-muted: #ececee;
  --surface-dark-surface: #09090b;
}
```

### Tailwind v4 — Raw Export Reference Only

The block below shows the raw exported Tailwind token shape. In the TALKPIK app,
equivalent Tailwind utilities must be produced from `src/theme` through
`@theme inline` aliases that read resolved `--app-*` variables. If a token below
is promoted into the app bridge, update `src/theme/tokens/*`,
`src/theme/tailwind-bridge.ts`, `src/styles/foundation.css`, the real consumer,
and `tests/theme/*` together.

```css
@theme {
  /* Colors */
  --color-obsidian: #09090b;
  --color-ink: #18181b;
  --color-graphite: #3f3f46;
  --color-slate: #52525b;
  --color-steel: #71717a;
  --color-ash: #a1a1aa;
  --color-pebble: #d4d4d8;
  --color-fog: #ececee;
  --color-mist: #f4f4f5;
  --color-snow: #ffffff;
  --color-link-secondary: #3254F2;
  --color-ember: #ff5a00;
  --color-orchid-flash: #fe45e2;

  /* Typography */
  --font-cosmica: 'Cosmica', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.8;
  --text-body: 14px;
  --leading-body: 1.56;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.45;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.35;
  --text-heading: 32px;
  --leading-heading: 1.28;
  --text-heading-lg: 40px;
  --leading-heading-lg: 1.25;
  --text-display-sm: 56px;
  --leading-display-sm: 1.12;
  --text-display: 64px;
  --leading-display: 1;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-68: 68px;
  --spacing-80: 80px;
  --spacing-120: 120px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;
  --radius-3xl-2: 28px;
  --radius-3xl-3: 36px;
  --radius-3xl-4: 40px;
  --radius-full: 48px;
  --radius-full-2: 56px;
  --radius-full-3: 64px;
  --radius-full-4: 80px;
  --radius-full-5: 1000px;
  --radius-full-6: 10000px;

  /* Shadows */
  --shadow-subtle: rgba(255, 255, 255, 0.5) 0px 0.5px 0px 0px inset, rgba(117, 123, 133, 0.4) 0px 9px 14px -5px inset, rgb(44, 46, 52) 0px 0px 0px 1.5px, rgba(0, 0, 0, 0.14) 0px 4px 6px 0px;
  --shadow-subtle-2: rgb(228, 228, 231) 0px 1px 0px 0px inset;
  --shadow-subtle-3: rgb(255, 255, 255) 0px 0.5px 0px 0px inset;
  --shadow-subtle-4: rgb(255, 255, 255) 0px -0.5px 0px 0px;
  --shadow-subtle-5: rgb(228, 228, 231) 0px -1px 0px 0px;
  --shadow-md: rgba(0, 0, 0, 0.04) 0px 4px 12px 0px;
}
```
