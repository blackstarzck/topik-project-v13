# Global Styles

This file turns Ant Design Global Styles into implementation rules for TALKPIK
AI.

## Theme Token Policy

Use Ant Design theme tokens through `ConfigProvider` before custom CSS.
Treat JSX `style={{...}}` as custom CSS as well. Moving visual rules from a
stylesheet into a component does not make them part of the Ant Design system.

Preferred path:

1. Keep one public theme entry point, with internal theme files split by responsibility when needed.
2. Use AntD component props and variants.
3. Use component tokens when a specific AntD component needs adjustment.
4. Use the Tailwind theme adapter only for constrained utility classes that
   consume shared project CSS variables.
5. Use custom CSS only for layout glue, app shell, and domain-specific surfaces.

Tailwind is allowed to have a Tailwind-native theme adapter (`@theme inline`),
but that adapter must read values derived from the same project theme source as
AntD. Do not paste raw colors, radii, shadows, font stacks, or component states
into Tailwind as a second design system.

Detailed ownership rules live in `08-theme-architecture.md`. This page is the
short global-style policy; do not treat it as permission to move component
state styling into CSS.

Avoid:

- Scattered hardcoded colors.
- Scattered border radii.
- Scattered shadow values.
- Recreating AntD component states in CSS.
- Recreating AntD component states or surfaces in visual inline styles.
- Recreating AntD component states with Tailwind utility classes.

## Global CSS Ownership

`src/styles/global.css` is allowed to contain:

- Tailwind imports and the Tailwind v4 `@theme inline` bridge.
- Stable app shell and layout glue that AntD tokens cannot express directly.
- Plain CSS surfaces that consume approved `--app-*` variables.
- Narrow, documented escape hatches scoped under a stable project class.

`src/styles/global.css` must not contain:

- New design-token sources or raw palettes separate from `src/theme`.
- Broad `.ant-*` overrides for selected, hover, active, disabled, border, or
  radius states.
- Selectors that target AntD's generated `css-dev-only-do-not-override-*`
  classes.
- Workarounds that duplicate an available AntD component token.

Project-authored inline style is custom CSS. Do not use `style={{ ... }}` for
visual design choices such as color, background, border, radius, padding, or
component state. Exceptions are runtime geometry/measurement that cannot be
known statically, server-side `--app-*` bridge injection on `<html>`, and
library-generated inline styles that are not authored by project code.

## Color

Use AntD system color semantics:

- Primary: main learning action and selected navigation.
- Success: correct answer, saved work, completed practice.
- Warning: time pressure, incomplete required step, weak-point attention.
- Error: failed submit, invalid answer, destructive action.
- Info: neutral guidance and system hint.

Rules:

- Do not rely on color alone. Pair color with text or icon.
- Keep one primary action per task area.
- Use neutral surfaces for study content so long Korean text remains readable.
- Use chart colors only when the chart communicates comparison or trend.

TALKPIK default intent:

- Primary should support a calm learning product, not a loud game UI.
- AI-specific UI may use subtle accent treatment, but must not dominate the app.
- Avoid purple/blue gradient-heavy AI styling as the main visual identity.

## Typography

Use the local project font as the default UI font.

Current project asset:

- `fonts/`

Implementation expectation when app code is added:

- Register the local font with `@font-face`.
- Apply it to `body`, AntD theme `fontFamily`, and app shell text.
- Keep text sizes stable. Do not use viewport-width font scaling.
- Use clear hierarchy: page title, section title, card title, body, helper text.
- For Korean text, preserve readable line height and avoid awkward line breaks.

## Layout

Use Ant Design's enterprise layout bias:

- App shell with stable navigation.
- Dense but readable work areas.
- Clear separation between navigation, content, and secondary panels.
- Predictable responsive behavior.

Rules:

- Use `Layout`, `Menu`, `Breadcrumb`, `Tabs`, `Steps`, `Grid`, `Flex`, and
  `Space` where appropriate.
- Keep major learning workflows visible without forcing unnecessary scrolling.
- Do not put cards inside cards.
- Inside an existing card, repeated actions or summaries should default to flat
  rows separated by spacing, typography, and a light hover background when
  interactive. Do not add persistent internal dividers by default, and do not
  wrap every row in a permanent `border + radius` box unless the row must stand
  alone as a selectable tile or a form/input group needs a visible boundary.
- Place card-level CTA buttons in Ant Design `Card.actions`, not inside the card
  body. Keep that footer/actions area visually borderless unless a specific
  product requirement needs a divider.
- Put whole-card titles in Ant Design `Card` `title` and right-side status or
  count metadata in `extra`. Do not build a separate title/status row inside the
  card body when sibling cards need the same header alignment.
- Use cards for repeated items, summaries, or bounded content groups.
- Do not use a marketing hero as the first screen for the actual app.

## Icons

Use AntD icons or a chosen icon library consistently.

Rules:

- Icon-only buttons require accessible labels and tooltips.
- Use familiar symbols for common actions: save, edit, delete, previous, next,
  search, filter, close, help.
- Do not use decorative icons where status text is more useful.

## Shadow And Elevation

Use shadow only to show hierarchy or floating surfaces.

Rules:

- Normal page sections should not look like floating cards.
- Use light elevation for dropdowns, drawers, popovers, and modals.
- Avoid heavy shadows on study content because it reduces readability.

## Dark Mode

If dark mode is added:

- Use AntD `theme.darkAlgorithm`.
- Do not handcraft a separate dark palette from scratch.
- Verify charts, feedback colors, focus states, and code/content panels.

## Accessibility Baseline

- Every form control needs a visible label or accessible name.
- Every error needs text, not only red color.
- Focus states must remain visible.
- Dialog and drawer close behavior must be predictable.
- Timed exam controls must remain reachable by keyboard.
