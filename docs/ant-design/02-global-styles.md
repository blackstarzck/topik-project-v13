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
4. Use custom CSS only for layout glue, app shell, and domain-specific surfaces.

Avoid:

- Scattered hardcoded colors.
- Scattered border radii.
- Scattered shadow values.
- Recreating AntD component states in CSS.
- Recreating AntD component states or surfaces in visual inline styles.

## Color

Use AntD system color semantics:

- Primary: main learning action and selected navigation.
- Success: correct answer, saved work, completed practice.
- Warning: time pressure, incomplete required step, weak-point attention.
- Error: failed submit, invalid answer, destructive action.
- Info: neutral guidance, AI tutor note, system hint.

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
