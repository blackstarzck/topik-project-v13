---
version: alpha
name: TALKPIK
description: Calm, focused Korean(TOPIK) study tool — quiet surfaces, one clear action
colors:
  primary: "#1677ff"
  text: "rgba(0,0,0,0.88)"
  text-secondary: "rgba(0,0,0,0.65)"
  border: "#d9d9d9"
  bg-layout: "#f5f5f5"
  bg-container: "#ffffff"
  primary-hover: "#4096ff"
  primary-active: "#0958d9"
typography:
  body-md:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 14px
    lineHeight: 1.5715
  body-sm:
    fontFamily: "{typography.body-md.fontFamily}"
    fontSize: 12px
    lineHeight: 1.6667
  title-md:
    fontFamily: "{typography.body-md.fontFamily}"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.5
  title-lg:
    fontFamily: "{typography.body-md.fontFamily}"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.4
  title-page:
    fontFamily: "{typography.body-md.fontFamily}"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.35
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  surface:
    backgroundColor: "{colors.bg-container}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card:
    backgroundColor: "{colors.bg-container}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-compact:
    backgroundColor: "{colors.bg-container}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg-container}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.bg-container}"
    rounded: "{rounded.md}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.bg-container}"
    rounded: "{rounded.md}"
---

# TALKPIK Design

> Single source of truth for the **visual** layer of the TALKPIK user-facing app.
> The YAML above is the machine-readable contract (exact values); the markdown
> below explains intent (why / how). Structure & binding to `src/theme` lives in
> [`docs/ant-design/08-theme-architecture.md`](docs/ant-design/08-theme-architecture.md);
> this file owns the values.
>
> **Pilot decision (minimal risk / branch 1):** the 9 global bridge tokens are
> kept at Ant Design v6.4.3 defaults. No brand-tokens manifest is introduced.
> Visual identity in the pilot comes from consistent surfaces, restrained
> component tokens (flat buttons), spacing rhythm, and the dark-mode shell fix —
> not from changing the global palette. A bolder palette is a separate
> branch-2 follow-up if the pilot screenshots show too little change.

## Overview

TALKPIK is a TOPIK (Korean proficiency) study tool. The product should feel
**calm and focused**: long Korean passages must stay readable, and each screen
should present **one clear primary action**. We deliberately avoid a loud,
game-like or AI-gradient look (see `docs/ant-design/02-global-styles.md`).

What we want a user to remember: *"quiet, trustworthy, and it always tells me
the next step."* That is why surfaces are neutral, elevation is light, motion is
short, and color is used for meaning — never for decoration.

The values here mirror Ant Design's stock light theme. We are not repainting the
framework; we are giving its tokens names and a written intent so every screen
applies them the same way.

## Colors

Color carries **meaning**, never decoration. Pair every color signal with text
or an icon (never color alone).

- Primary `{colors.primary}` — the single main action per task area (submit,
  start, continue) and the selected navigation item.
- Text `{colors.text}` — body copy and headings on neutral surfaces.
- Text secondary `{colors.text-secondary}` — helper text, captions, timestamps.
- Border `{colors.border}` — quiet separation between surfaces.
- Layout background `{colors.bg-layout}` — the page/workspace canvas.
- Container background `{colors.bg-container}` — cards, forms, and raised
  surfaces sitting on the canvas.

Semantic states (success / warning / error / info) use Ant Design's stock
semantic colors directly; they are not redefined here.

**Dark appearance** is **derived from Ant Design's `darkAlgorithm`** — we do not
hand-author a separate dark palette. For reference, the algorithm resolves these
bridge values (verified by `tests/theme/theme-bridge-parity.test.ts`):

| role | light | dark (darkAlgorithm) |
| --- | --- | --- |
| primary | `#1677ff` | `#1668dc` |
| text | `rgba(0,0,0,0.88)` | `rgba(255,255,255,0.85)` |
| text-secondary | `rgba(0,0,0,0.65)` | `rgba(255,255,255,0.65)` |
| border | `#d9d9d9` | `#424242` |
| bg-layout | `#f5f5f5` | `#000000` |
| bg-container | `#ffffff` | `#141414` |

## Typography

The UI font is the system stack (`{typography.body-md.fontFamily}`), applied to
`body`, the Ant Design `fontFamily` token, and the app shell — one consistent
font everywhere.

Base body size stays **14px** (Ant Design default). We do **not** raise the
global font size to 16 and we do not use viewport-width font scaling — Korean
text must keep a stable, predictable rhythm.

Hierarchy:

- `title-page` (24px/600) — page heading (e.g. dashboard, login).
- `title-lg` (20px/600) — major section titles.
- `title-md` (16px/600) — card titles.
- `body-md` (14px) — default body copy; line-height `1.5715` keeps long Korean
  lines comfortable.
- `body-sm` (12px) — captions, timestamps, helper text.

## Layout

Spacing follows an **8-based rhythm** (`spacing.xs`=4 → `spacing.xl`=32). Use the
scale, not arbitrary pixel values; magic numbers in inline styles are the debt
this design system replaces.

- Page padding uses `{spacing.lg}` (24px) on the workspace content area.
- Card internal padding uses `{spacing.lg}`; compact/list cards use
  `{spacing.md}`.
- Gaps between stacked sections use `{spacing.lg}`; gaps inside a group use
  `{spacing.sm}`–`{spacing.md}`.

Structure stays an app/workspace shell (stable sidebar + header + content), not
a marketing hero. The primary task is visible without unnecessary scrolling.

## Elevation & Depth

Elevation separates floating surfaces from the page — it is **not** decoration.

- Page sections and study content sit flat on the canvas (no card-like shadow).
- Only genuinely floating surfaces (dropdowns, popovers, drawers, modals) use the
  elevated shadow (Ant Design `boxShadowSecondary`, exposed as
  `--app-shadow-elevated`).
- Buttons are **flat**: the default Ant Design primary/default/danger drop
  shadows are removed via component tokens (calm, not game-like). See Components.
- Avoid heavy shadows on long reading or writing content — they hurt readability.

## Shapes

Corner radius uses the `rounded` scale (Ant Design's stock radius family):

- `{rounded.sm}` (4px) — tags, small controls.
- `{rounded.md}` (6px) — buttons, inputs (Ant Design default `borderRadius`).
- `{rounded.lg}` (8px) — cards and raised surfaces (`borderRadiusLG`).

## Components

Components inherit the tokens above. Variants are listed as separate items.

- `surface` / `card` — the shared raised surface (`.app-surface` / `.app-card`
  hook). Container background, `{rounded.lg}` corners, `{spacing.lg}` padding.
- `card-compact` — list/repeated items inside a section: `{rounded.md}`,
  `{spacing.md}` padding. (Do not nest a full card inside a card; use a compact
  row instead.)
- `button-primary` — the one primary action per task area. Primary background,
  container-color text, `{rounded.md}`, **no drop shadow**.
- `button-primary-hover` — `{colors.primary-hover}`.
- `button-primary-active` — `{colors.primary-active}`.

Motion on interactive components is limited to `transform`/`opacity`, 150–300ms,
and is suppressed under `prefers-reduced-motion`. No motion on exam/writing
content.

## Do's and Don'ts

- **Do:** prefer Ant Design tokens and components; keep one primary action per
  task area; use a layout-matched skeleton for loads over ~300ms; keep motion to
  `transform`/`opacity` at 150–300ms; respect `prefers-reduced-motion`; pair
  color with text/icon.
- **Don't:** scatter inline magic numbers; signal meaning with color alone; nest
  a card inside a card; animate writing/exam content; use large page-transition
  motion; hand-author a separate dark palette (use `darkAlgorithm`).

## Appendix — Token ↔ AntD binding

Values live in `src/theme`; the `--app-*` bridge exposes the approved 9 to
Tailwind/plain CSS. Parity (bridge ↔ resolved AntD token) is guarded by
`tests/theme/theme-bridge-parity.test.ts`. The 9 approved bridge variables are
the **only** allowed `--app-*` names (enforced by `scripts/ai-workflow-check.mjs`).

| DESIGN.md token | class | antdPath | sourceFile | bridge var |
| --- | --- | --- | --- | --- |
| `colors.primary` | antd.global | `theme.token.colorPrimary` | AntD v6.4.3 default (unchanged) | `--app-color-primary` |
| `colors.bg-layout` | antd.global | `theme.token.colorBgLayout` | AntD default / algorithm | `--app-color-bg-layout` |
| `colors.bg-container` | antd.global | `theme.token.colorBgContainer` | AntD default / algorithm | `--app-color-bg-container` |
| `colors.text` | antd.global | `theme.token.colorText` | AntD default / algorithm | `--app-color-text` |
| `colors.text-secondary` | antd.global | `theme.token.colorTextSecondary` | AntD default / algorithm | `--app-color-text-secondary` |
| `colors.border` | antd.global | `theme.token.colorBorder` | AntD default / algorithm | `--app-color-border` |
| `rounded.md` | antd.global | `theme.token.borderRadius` | AntD default (unchanged) | `--app-radius` |
| `typography.body-md.fontFamily` | antd.global | `theme.token.fontFamily` | `src/theme/global/shared-seed.ts` (font only) | `--app-font-family` |
| (elevation) | antd.global | `theme.token.boxShadowSecondary` | AntD default / algorithm | `--app-shadow-elevated` |
| `components.card` | antd.component | `theme.components.Card` | `src/theme/components/shared.ts` | — |
| `components.button-primary` | antd.component | `theme.components.Button` | `src/theme/components/shared.ts` | — |
| `spacing.*` | layout-primitive | (Tailwind / layout) | — | — |

> Rule: `bridge` = the approved 9 names only. Unchanged defaults' source is
> "AntD default / darkAlgorithm"; only real overrides name a repo file. All
> values must match `src/theme`, guarded by the parity test.
