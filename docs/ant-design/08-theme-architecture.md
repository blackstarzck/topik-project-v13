# Theme Architecture

> Status (2026-06-11)
>
> `src/theme/config.ts` selects the active theme preset. The current product
> preset is `awesomic`, and its normalized token source is `DESIGN/tokens.json`.
>
> `DESIGN/` is light-only today. The first Awesomic binding therefore fixes the
> user-facing appearance to light through `themeSettings.allowAppearanceSwitching
> = false`, while preserving the existing dark infrastructure for future token
> work.
>
> Tailwind has a theme adapter, not an independent design system:
> `src/styles/global.css` uses Tailwind v4 `@theme inline` to consume resolved
> `--app-*` variables from the same theme source used by the AntD adapter.
> The current code exposes a base bridge set; new bridge variables require a
> documented source-token mapping, a real Tailwind/plain-CSS use, and matching
> contract tests.

This file explains how theme configuration is organized in the TALKPIK AI codebase.

Use this document when:

- adding a new named theme such as `retro`, `glass`, or `pink`
- changing global Ant Design tokens
- changing component-specific Ant Design tokens
- importing values from Ant Design Theme Editor
- deciding whether a visual value belongs in AntD global tokens, component tokens, or plain layout CSS

## Reading Gate

Read this document before work that may change how the app looks or where theme
decisions are stored.

This is required for:

- new pages, route screens, and workspace views
- reusable UI components
- Ant Design component customization
- changes to colors, font, radius, spacing, shadows, or surface styling
- app shell layout styling
- new visual states such as loading, empty, error, success, selected, or disabled
- any work that may introduce hardcoded visual values

This is usually not required for:

- pure business logic with no UI output
- API, database, or server-only changes
- test-only changes that do not alter UI behavior

Fallback order:

1. `docs/ant-design/02-global-styles.md`
2. `https://ant.design/docs/react/customize-theme`
3. `https://ant.design/theme-editor`

If local docs conflict, follow the newest project-specific theme structure and
update the conflicting local docs before finalizing work.

## Core Principle

This project follows a config-selected project theme preset rule with two
runtime adapters: AntD for design components, and Tailwind for constrained
utility classes.

That means:

- `src/theme/config.ts` selects the active named preset through
  `themeSettings.main`
- the current product preset is `awesomic`, bound from `DESIGN/` tokens
- `src/theme` normalizes product theme tokens once, then projects them into
  both the AntD adapter and the Tailwind adapter
- AntD remains the primary component/runtime adapter through `ConfigProvider`,
  `theme.token`, and `theme.components`
- Tailwind consumes the same resolved theme through CSS variables and
  `@theme inline`; it must not own a separate palette, radius scale, shadow
  scale, or font stack
- `appearance` stays a separate light/dark axis
- `DESIGN/` is currently light-only, so `allowAppearanceSwitching` is false for
  the first Awesomic binding
- stock Ant Design remains registered as the `default` fallback preset
- add token overrides only when the product has a concrete reason, and keep
  those overrides inside the named preset

Think of the theme system as a switchboard, not a repaint tool.
Its first job is to select the active preset.
Its second job is to select the appearance supported by that preset.

## Why This Exists

Ant Design supports two important theme layers:

1. Global theme values
   - configured through `theme.token`
   - includes brand color, font, radius, and global surface decisions
2. Component theme values
   - configured through `theme.components`
   - includes adjustments for specific components such as `Button`, `Menu`, `Layout`, and `Table`

The TALKPIK AI project follows that model directly.

We do **not** keep all theme decisions in one long file.
We keep:

- one public theme entry point
- one registry of available theme presets
- one preset file per theme
- separate global and component shared rules
- a default preset that stays close to stock Ant Design
- optional preset-owned global styles for theme-specific structure that AntD
  tokens cannot express

## Current Theme Folder

```text
src/theme/
  index.ts
  config.ts
  themes.ts
  registry.ts
  create-theme.ts
  types.ts
  antdTheme.ts
  tailwind-bridge.ts
  tokens/
    awesomic.ts
  global/
    algorithms.ts
    shared-seed.ts
  components/
    shared.ts
  presets/
    default.ts
    awesomic.ts
```

## File Responsibilities

### Public entry points

- `src/theme/index.ts`
  - the main import entry for theme APIs
  - new code should import from here
- `src/theme/themes.ts`
  - compatibility re-export
  - kept so old imports do not break immediately
- `src/theme/antdTheme.ts`
  - helper that exposes the default AntD theme config
  - acceptable for static use, but app runtime theme selection should use `getAppTheme`
- `src/theme/tailwind-bridge.ts`
  - maps the selected theme preset to the approved project CSS variables that
    Tailwind utilities and plain CSS may consume
  - owns the Tailwind adapter contract together with `src/styles/global.css`
    `@theme inline`
  - must not define a second brand palette, radius scale, shadow scale, or font
    stack; every exposed value must map back to normalized project theme tokens,
    resolved AntD tokens, or a documented layout primitive
- `src/theme/config.ts`
  - selects the active named preset and default appearance
  - keeps theme selection separate from token definitions

### Theme assembly

- `src/theme/registry.ts`
  - registers available theme presets
  - exposes `themes`, `themePresets`, `defaultThemeName`, `defaultAppearance`, and `getAppTheme`
- `src/theme/create-theme.ts`
  - builds the final `ThemeConfig` from shared rules plus a preset
  - merges global token values and component token values
  - carries optional preset-owned global styles into the active theme definition
  - enables or preserves AntD CSS-variable output when supported by the chosen
    AntD version
  - applies the light or dark AntD algorithm automatically

### Shared theme inputs

- `src/theme/global/shared-seed.ts`
  - shared global seed tokens
  - keep this minimal and neutral
  - right now this is mainly the app font family
- `src/theme/global/algorithms.ts`
  - maps `light` and `dark` appearance to Ant Design algorithms
- `src/theme/components/shared.ts`
  - shared component-level overrides used across all presets
  - keep this empty unless the project has a documented reason to deviate from Ant Design defaults

### Theme presets

- `src/theme/presets/default.ts`
  - stock Ant Design fallback preset
  - should stay close to empty
  - its job is to say "use light mode" or "use dark mode", not to restate Ant Design defaults
- `src/theme/presets/awesomic.ts`
  - owns the first `DESIGN/` token binding for the product theme
  - maps normalized Awesomic tokens to AntD `theme.token` and
    `theme.components`
  - keeps runtime font on Pretendard until the Cosmica font asset is added to
    the repo

### Normalized design tokens

- `src/theme/tokens/awesomic.ts`
  - normalizes the `DESIGN/tokens.json` values that can be safely consumed by
    code
  - documents source tokens that need an asset or additional design decision
    before runtime use
  - exports the current allowed `--app-*` bridge variable set so tests can
    reject accidental Tailwind-side token expansion; expand this list only with
    updated docs and theme contract tests

### Types

- `src/theme/types.ts`
  - shared types for appearances, presets, and built theme definitions

## Theme Flow

The runtime theme flow is:

1. `config.ts` selects a preset key such as `awesomic`
2. a preset defines optional appearance-specific overrides
3. `createThemeFamily` builds final `ThemeConfig` objects for `light` and `dark`
4. `registry.ts` exposes the registered preset keys as `AppThemeName`
5. the app root calls `getAppTheme(themeSettings.main, appearance)`
6. the AntD adapter produces `activeTheme.antd`
7. `ConfigProvider` receives `activeTheme.antd`
8. the Tailwind adapter resolves selected preset values server-side and injects them
   as `--app-*` CSS variables on the `html` element in `app/layout.tsx`
9. Tailwind utilities read those `--app-*` variables via `@theme inline`
   in `src/styles/global.css`
10. new UI reads AntD tokens directly at render time when component logic needs
   token values

This gives the app one theme source of truth even though the adapters are split
for each library's native mechanism. The `--app-*` variables on `html` ensure
portal-rendered AntD components (Modal, Drawer, Notification) and Tailwind-authored
surfaces inherit the same resolved values.

## AntD And Tailwind Synchronization

Tailwind is a utility layer with a theme adapter, not a parallel design system.
The source of truth for theme values is the normalized project theme in
`src/theme`; AntD is the primary component/runtime adapter, and Tailwind is the
utility adapter.

Synchronization rule:

- AntD `theme.token` owns brand color, font family, radius, base surfaces,
  semantic colors, shadows, and motion-level decisions.
- AntD `theme.components` owns component-family customization such as Button,
  Menu, Layout, Table, Tabs, Form, Drawer, and Modal adjustments.
- `tailwind-bridge.ts` plus `src/styles/global.css` form the Tailwind adapter.
  They may expose the documented project theme variables needed by Tailwind
  utilities or plain CSS surfaces.
- The current implementation exposes a base bridge set. A new theme or token
  can expand that set only when the token has a documented use, maps back to
  the same source used by the AntD adapter, and updates the theme contract
  tests.
- Tailwind configuration or CSS may alias utilities to those variables, but
  must not contain copied hex colors, copied radius values, copied shadows, or
  a separate font stack.
- Tailwind classes are allowed for layout composition, responsive behavior,
  width/height constraints, grid/flex helpers, and small spacing adjustments.
- Tailwind classes should not be used to restyle AntD component internals when
  an AntD prop, variant, token, or component token can express the change.
- When a theme is changed or added, update the AntD adapter and Tailwind adapter
  together. A theme change that updates only one side is incomplete.

### Styling Ownership Rule

Use this order before writing any visual override:

1. AntD component prop, variant, or semantic slot.
2. Root `ConfigProvider` `theme.token` for app-wide language changes.
3. Root or preset `theme.components.<Component>` for one AntD component family.
4. Scoped `ConfigProvider` around a feature or wrapper when one product area
   needs different component tokens.
5. Stable project class plus Tailwind/layout CSS for sizing, positioning, or
   responsive glue.
6. Narrow CSS escape hatch under a stable project hook when AntD has no prop,
   semantic slot, or token for the behavior.

The last option is an exception path. It must not target generated AntD classes
such as `css-dev-only-do-not-override-*`, and it must not be a broad `.ant-*`
override in page or global CSS. Scope it to a project-owned hook such as
`.app-sidebar-shell` or `.app-drawer`, document why a token was insufficient,
and verify the affected desktop and mobile screens.

Project-authored inline style is also custom CSS. Do not use `style={{ ... }}`
for visual decisions such as color, background, border, radius, padding, or
selected/hover/active/disabled states. Acceptable exceptions are:

- server-side `--app-*` bridge injection on `<html>`
- runtime geometry or measurement that cannot be known statically
- third-party or AntD-generated inline style attributes that are not authored
  by project code

AntD's `classNames` semantic slot API is preferred for stable slot targeting.
AntD's `styles` semantic slot API may be used only when the value comes from the
theme/token system or when no class/token path can express the required runtime
style. Do not use it to hide scattered visual decisions inside JSX.

### Component State Examples

| Concern | Owner | Do not use |
| --- | --- | --- |
| App-wide brand color, radius, font, base surfaces | `theme.token` in the active preset | Tailwind palette copies, feature-level hardcoded values |
| Button primary, hover, border, shadow | `theme.components.Button` or global tokens | `className="bg-..."` on AntD `Button` for the state |
| Sidebar `Menu` selected background/text/active bar | scoped `ConfigProvider` with `theme.components.Menu` when sidebar-only, otherwise preset `Menu` tokens | `.ant-menu-item-selected` global overrides, Tailwind selected-state utilities |
| Drawer/Modal surface, body padding, mask, motion-sensitive surface behavior | `AppDrawer`/`AppModal` wrappers plus `theme.components.Drawer`/`Modal` and scoped project hooks when tokens cannot express structure | raw page CSS against generated AntD classes |
| Layout-only width, height, grid/flex behavior | Tailwind utilities or project layout CSS consuming `--app-*` where relevant | new theme tokens without product reuse |

### CSS Variable Architecture Contract

> **Required reading gate.** Read this section before writing any `--app-*`
> variable assignment. These constraints prevent two classes of silent production
> bugs: portal color failures and SSR flash-of-unstyled-content.

#### Rule 1 — Scope `--app-*` on `html` or `:root` only

`--app-*` variables must be declared on `html` or `:root`. They must not be
declared via `style={}` on any React component below `html`.

AntD `Modal`, `Drawer`, `Notification`, and `Tooltip` render via portals that
target `document.body` by default. Those portal elements sit outside any React
component subtree. A `style={}` prop on a wrapper div creates a CSS inheritance
boundary; portal-rendered content lives outside that boundary and receives no
value for any variable declared only on the wrapper.

Exception: `getContainer={false}` and custom `getContainer` props attach the
overlay to the current DOM position instead of `body`. If every overlay in the
project uses this prop, portal inheritance is not a concern. Do not rely on this
exception unless it is explicitly documented per-component.

```tsx
/* REQUIRED — portals always inherit from html/root */
// app/layout.tsx (server component)
<html style={{ '--app-color-primary': resolvedToken.colorPrimary } as React.CSSProperties}>
```

#### Rule 2 — `--app-*` must hold resolved actual values, not CSS variable chains

`--app-*` variables must hold resolved actual values (hex, px, font stack, or
box-shadow value). They must not reference `--ant-*` via `var()`.

AntD CSS variables (`--ant-*`) are emitted by client-side JavaScript when
`ConfigProvider` mounts. They do not exist in any CSS context during server-side
rendering. A chain like `--app-color-primary: var(--ant-color-primary)` resolves
to an empty/invalid value on the first server render, causing visible flash.

```css
/* PROHIBITED — --ant-* does not exist at SSR time */
--app-color-primary: var(--ant-color-primary);

/* REQUIRED — resolved actual value, safe at SSR */
--app-color-primary: #1677ff;
```

Resolved values must be injected server-side. The recommended pattern is a
server component in `app/layout.tsx` that reads a theme cookie via `cookies()`
from `next/headers` and writes resolved token values to `<html style={...}>`.
Note: calling `cookies()` makes the route dynamically rendered.

When a docs or code change affects `--app-*` variable values, update
`tests/theme/theme-contract.test.ts` in the same commit. A contract test that
asserts a `var(--ant-*)` chain while the docs prohibit it is a contradiction that
will mislead future agents.

#### Rule 3 — Use `@theme inline` in Tailwind v4

In Tailwind v4, `@theme { --color-x: var(--app-x) }` generates utilities that
reference `var(--color-x)`, creating an extra indirection layer. Use
`@theme inline` instead: it writes `var(--app-x)` directly into each generated
utility class.

```css
/* REQUIRED in Tailwind v4 */
@theme inline {
  --color-primary: var(--app-color-primary);
  /* produces: .bg-primary { background-color: var(--app-color-primary) } */
}
```

#### Rule 4 — `cssVar.prefix` controls CSS variable names; `cssVar.key` does not

In AntD v6, `cssVar.key` is a deduplication cache identifier only. It does not
change generated CSS variable names. The prefix that produces `--ant-color-primary`
is `cssVar.prefix`, which defaults to `ant`.

To change variable names from `--ant-*` to a custom prefix, set
`cssVar: { prefix: 'myapp', key: 'myapp' }` explicitly.

#### Correct data flow (one source, two adapters)

```
Project theme source (DESIGN/tokens.json or active preset source)
  → normalized tokens in src/theme
  → AntD adapter: ThemeConfig for ConfigProvider
  → Tailwind adapter: resolved --app-* variables on html
  → @theme inline in src/styles/global.css
  → Tailwind utilities
```

#### Bridge targets

The following `--app-*` variables are the current base bridge set. Each must
hold a resolved actual value injected from `layout.tsx`:

```
--app-color-primary        resolved hex (e.g. #1677ff)
--app-color-bg-layout      resolved hex
--app-color-bg-container   resolved hex
--app-color-text           resolved hex
--app-color-text-secondary resolved hex
--app-color-border         resolved hex
--app-radius               resolved px (e.g. 6px)
--app-font-family          resolved font stack
--app-shadow-elevated      resolved box-shadow value
```

Generate these values from `getResolvedBridgeVars(themeName, appearance)` at
request time, not by hand.

The base set is not a permanent maximum. Add a new bridge variable only when all
of these are true:

1. the token has a documented Tailwind utility or plain CSS use outside AntD
   component internals
2. the value maps back to normalized project theme tokens, resolved AntD tokens,
   or a documented layout primitive
3. `src/theme/tokens/*`, `src/theme/tailwind-bridge.ts`,
   `src/styles/global.css`, and `tests/theme/*` are updated together
4. no raw palette, radius, shadow, or font value is copied into Tailwind as an
   independent source

When adding or changing `--app-*` declarations, run the checker before marking
work complete.

## Overlay Surface Rule

`Card`, `Drawer`, and `Modal` are not just visual values. They are shared app
surfaces that themes may need to style in context.

`Drawer` and `Modal` also have an opening lifecycle.

For themes with transparent, blurred, or glass-like surfaces, the first frame
of an overlay matters. If the overlay motion fades the surface on entry, users
can see a weak/default-looking surface before the themed surface is fully
visible.

Treat that as an overlay behavior rule, not only a token rule.

Project rule:

- user-facing `Card` surfaces should use `src/components/shared/AppCard.tsx`
  instead of importing AntD `Card` directly
- user-facing `Drawer` components should use `src/components/shared/AppDrawer.tsx`
- user-facing `Modal` components should use `src/components/shared/AppModal.tsx`
- those wrappers provide stable project classes for surface and overlay theme
  behavior
- theme presets still own the visual values
- preset-owned global styles may provide structural layers such as blur or
  highlight when AntD tokens cannot express them

In short:

- tokens decide the material
- shared wrappers provide stable hooks such as `.app-card`, `.app-surface`,
  `.app-drawer`, and `.app-modal`
- preset-owned global styles decide extra surface structure only when AntD
  tokens are not enough

Do not create theme-named component forks such as `LiquidGlassCard` or
`CustomThemeACard`. Create one role-based shared wrapper such as `AppCard`, then
let each theme preset style that stable hook.

When child AntD components need to adapt to a themed surface, preserve AntD
defaults first. If a confirmed product requirement needs a contextual override,
scope that rule to the surface hook:

```css
html[data-theme='liquidGlass'] .app-card .ant-tag {
  /* Liquid Glass Card context only */
}
```

This keeps the component API stable while allowing each preset to define how
inputs, tags, or other AntD children behave inside the surface. Do not add
Card-scoped Button styling unless the request explicitly calls for a non-default
Button appearance.

## Global vs Component Rules

Use this decision rule:

### Put a value in global tokens when it changes the app's overall design language

Examples:

- `colorPrimary`
- `fontFamily`
- `borderRadius`
- `colorBgLayout`
- `colorBgContainer`

### Put a value in component tokens when it only changes one AntD component family

Examples:

- `Button.primaryShadow`
- `Menu.itemSelectedBg`
- `Menu.itemSelectedColor`
- `Menu.activeBarBorderWidth`
- `Layout.headerBg`
- `Table.rowHoverBg`

When the component-family change should apply only inside one product surface,
use a scoped `ConfigProvider` near that surface instead of global tokens. The
workspace sidebar `Menu` is the canonical example: sidebar navigation state can
have sidebar-specific `Menu` tokens without changing every menu in the app.

### Put a value in plain layout CSS only when AntD is not expressing that concern

Examples:

- a custom print rule
- a canvas-like editor sizing rule
- a layout-only spacing helper that is not a theme decision

Do not create a theme override just to restate what Ant Design already does.

## How To Add A New Theme

Example target:

- `retro`
- `glass`
- `black`
- `pink`

Steps:

1. Create a new preset file in `src/theme/presets/`
   - example: `src/theme/presets/retro.ts`
2. Export a preset object that satisfies `AppThemePreset<'retro'>`
3. Define only the `light` and `dark` overrides that the new theme really needs
4. Register the preset in `src/theme/registry.ts`
5. If the user should be able to choose it, extend theme selection state and settings UI
6. Verify desktop and mobile layouts after switching themes

Example shape:

```ts
import type { AppThemePreset } from '../types';

export const retroThemePreset = {
  name: 'retro',
  label: 'Retro',
  description: 'Warm and editorial theme',
  appearances: {
    light: {
      token: {
        colorPrimary: '#b45309',
      },
    },
    dark: {
      token: {
        colorPrimary: '#f59e0b',
      },
    },
  },
} satisfies AppThemePreset<'retro'>;
```

## How To Use Ant Design Theme Editor

Reference:

- `https://ant.design/theme-editor`

Use Theme Editor as a design tool, not as a dump target for every possible token.

Recommended workflow:

1. Start with stock Ant Design defaults
2. Use Theme Editor only when the product has a concrete branding or component requirement
3. Export the values
4. Move the relevant global values into `token`
5. Move component-specific values into `components`
6. Keep only the overrides that are actually needed by the project

Do **not** blindly paste every exported value if many of them are just derived alias tokens.

Prefer this order:

1. keep shared structural rules in `global/shared-seed.ts`
2. keep the default preset nearly empty
3. keep per-theme brand values in a preset file only when the product actually needs them
4. keep per-component theme overrides in `components` or in the preset's `components` block only when Ant Design defaults are not enough

## Rules For Future Edits

- New theme work should import from `src/theme/index.ts`
- Do not turn `registry.ts` into a long token file
- Do not put all preset values back into one giant `themes.ts`
- Do not duplicate the same color in three places without reason
- Do not add visual values to Tailwind unless they reference the project
  `--app-*` bridge variables, are generated from the same theme source as the
  AntD adapter, or are layout-only values with no design-token meaning
- Do not use project-authored visual inline style for theme, component, or state
  styling
- Do not target AntD generated classes such as `css-dev-only-do-not-override-*`
- Prefer scoped `ConfigProvider` component-token overrides over broad `.ant-*`
  CSS overrides
- If a shared component token starts growing large, split it into per-component files under `src/theme/components/`
- If a preset becomes large, keep its values inside the preset file instead of spreading them across random UI components
- Do not add a preset override just to make Ant Design look the same as it already does by default

## Review Checklist For Theme Changes

### CSS Variable Gate (check these first)

These items catch structural defects. Do not proceed to the remaining checklist
until all of these pass.

- [ ] All `--app-*` CSS variables are declared on `html` or `:root` (via
      `app/layout.tsx`). No `--app-*` variable is set through `style={}` on a
      React component.
- [ ] The theme source of truth for the change is explicit, and both the AntD
      adapter and Tailwind adapter read from that same source.
- [ ] No `--app-*` variable holds a `var(--ant-*)` chain. Every `--app-*`
      variable holds a resolved actual value (hex, px, font stack, or
      box-shadow).
- [ ] Resolved `--app-*` values are injected server-side so they are present on
      first render before any client JS runs.
- [ ] `src/styles/global.css` uses `@theme inline { ... }` (not bare `@theme`)
      for Tailwind v4 variable bridging.
- [ ] Any newly added bridge variable has an updated source-token mapping,
      documented use case, and `tests/theme/*` coverage.
- [ ] Active theme appearance is stored in React state or context, not computed
      at module level outside a React component.
- [ ] `tests/theme/theme-contract.test.ts` is consistent with the current
      `--app-*` values and data flow (no assertion of a `var(--ant-*)` chain if
      the new architecture is in place).
- [ ] Verified in a running build that a portal-rendered AntD component (Modal
      or Drawer) displays the correct `--app-color-primary` color.

### General Checks

Before calling theme work complete, verify:

- the app still works with stock Ant Design light and dark algorithms
- global changes still come from AntD tokens
- component-specific overrides still live in `theme.components`
- component selected, hover, active, disabled, border, radius, and active-bar
  states are not recreated with Tailwind utilities or project-authored inline
  styles
- Tailwind utilities consume project bridge variables from the same theme source
  instead of copied theme values
- any scoped CSS escape hatch is under a project-owned hook and has a documented
  reason a token, prop, or scoped `ConfigProvider` was insufficient
- AntD components and Tailwind-authored surfaces still match after switching
  light/dark appearance
- the default preset is still close to empty unless there is a documented reason otherwise
- dark mode still uses AntD dark algorithm unless there is a documented reason otherwise
- no new hardcoded color values were scattered into unrelated components
- desktop and mobile layouts still render correctly
