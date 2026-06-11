# Theme Architecture

> Status (2026-06-11)
>
> `src/theme/`는 이미 구현되어 있습니다(아래 "Current Theme Folder" 참고). 본 문서는
> 그 구현이 따라야 하는 **테마 구조 계약**을 정의합니다.
>
> 시각 기준(색·타이포·간격·컴포넌트 토큰의 의도와 실제 값)의 단일 출처는 저장소 루트
> [`AWESOMIC-DESIGN.md`](../../AWESOMIC-DESIGN.md)입니다. 역할 분담: 본 문서는 그 값이
> `src/theme/`와 `--app-*` 브릿지에 **어떻게 바인딩되는지**(구조)를 정의하고,
> `AWESOMIC-DESIGN.md`는 **무엇을 어떤 값으로** 정하는지(의도·값)를 정의합니다.
>
> 현재 사용자 화면은 **Awesomic light-fixed**입니다. `DESIGN.md`는 삭제하지 않고
> legacy reference로만 보관합니다. Cosmica는 디자인 기준이지만 로컬 font asset이
> 없으므로 실제 앱은 Pretendard 단일 계열을 사용합니다.

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

This project now follows an AntD-first Awesomic theme rule.

That means:

- bind Awesomic visual decisions through Ant Design `theme.token` and
  `theme.components`
- keep Tailwind as a consumer of the approved `--app-*` bridge only
- keep user-facing rendering light-fixed until a real Awesomic dark contract is
  approved
- keep legacy dark infrastructure available for future work, but do not expose it
  through initial render or user-facing controls

Think of the theme system as a binding layer. Its job is to bind Awesomic values
into Ant Design without creating a parallel Tailwind palette or scattered
page-specific overrides.

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
- a default preset that binds Awesomic values to Ant Design
- optional preset-owned global styles for theme-specific structure that AntD
  tokens cannot express

## Current Theme Folder

```text
src/theme/
  index.ts
  themes.ts
  registry.ts
  create-theme.ts
  types.ts
  awesomic.ts
  tailwind-bridge.ts
  global/
    algorithms.ts
    shared-seed.ts
  components/
    shared.ts
  presets/
    default.ts
```

## File Responsibilities

### Public entry points

- `src/theme/index.ts`
  - the main import entry for theme APIs
  - new code should import from here
- `src/theme/themes.ts`
  - compatibility re-export
  - kept so old imports do not break immediately
- `src/theme/awesomic.ts`
  - stores the code-level Awesomic color, radius, shadow, and bridge constants
  - must stay aligned with `AWESOMIC-DESIGN.md` and theme contract tests
- `src/theme/tailwind-bridge.ts`
  - maps the approved subset of active AntD tokens to project CSS variables that
    Tailwind utilities may consume
  - must not define a second brand palette, radius scale, shadow scale, or font
    stack

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
  - applies the selected AntD algorithm; user-facing entry points currently
    normalize appearance to light

### Shared theme inputs

- `src/theme/global/shared-seed.ts`
  - shared global seed tokens
  - keep this minimal and neutral
  - right now this is mainly the app font family
- `src/theme/global/algorithms.ts`
  - preserves `light` and `dark` algorithm mapping for future work
- `src/theme/components/shared.ts`
  - shared component-level overrides used across all presets
  - binds component-family Awesomic decisions such as primary button shadow,
    pill radius, card radius, input radius, and tag radius

### Theme presets

- `src/theme/presets/default.ts`
  - the current default theme preset
  - binds Awesomic global tokens to Ant Design
  - includes a dark appearance entry only to preserve the type/infra boundary;
    current user-facing code normalizes to light

### Types

- `src/theme/types.ts`
  - shared types for appearances, presets, and built theme definitions

## Theme Flow

The runtime theme flow is:

1. `defaultThemePreset` defines Awesomic token overrides
2. `createThemeFamily` builds final `ThemeConfig` objects for `light` and `dark`
3. `registry.ts` exposes the available themes
4. user-facing entry points normalize appearance to light
5. the app root calls `getAppTheme(themeName, appearance)`
6. `ConfigProvider` receives `activeTheme.antd`
7. the theme bridge resolves Awesomic token values server-side and injects them as
   `--app-*` CSS variables on the `html` element in `app/layout.tsx`
8. Tailwind utilities read only those `--app-*` variables via `@theme inline`
   in `src/styles/global.css`
9. new UI reads AntD tokens directly at render time when component logic needs
   token values

This gives the app one source of truth at runtime even though the files are split
for maintainability. The `--app-*` variables on `html` ensure portal-rendered
AntD components (Modal, Drawer, Notification) inherit the correct values.

## AntD And Tailwind Synchronization

Tailwind is a utility layer, not a parallel design system. The source of truth
for visual decisions remains the active Ant Design theme.

Synchronization rule:

- AntD `theme.token` owns brand color, font family, radius, base surfaces,
  semantic colors, shadows, and motion-level decisions.
- AntD `theme.components` owns component-family customization such as Button,
  Menu, Layout, Table, Tabs, Form, Drawer, and Modal adjustments.
- `tailwind-bridge.ts` may expose only a small approved subset of resolved AntD
  tokens as project CSS variables.
- Tailwind configuration or CSS may alias utilities to those variables, but must
  not contain copied hex colors, copied radius values, copied shadows, or a
  separate font stack.
- Tailwind classes are allowed for layout composition, responsive behavior,
  width/height constraints, grid/flex helpers, and small spacing adjustments.
- Tailwind classes should not be used to restyle AntD component internals when
  an AntD prop, variant, token, or component token can express the change.

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
--app-color-primary: #09090b;
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

#### Correct data flow (one direction only)

```
AntD design tokens
  → resolved actual values  (server-side, from active ThemeConfig)
  → --app-* on html element (app/layout.tsx via <html style={...}>)
  → @theme inline           (src/styles/global.css)
  → Tailwind utilities
```

#### Bridge targets

The following `--app-*` variables are the approved bridge set. Each must hold a
resolved actual value injected from `layout.tsx`:

```
--app-color-primary        resolved hex (Awesomic `#09090b`)
--app-color-bg-layout      resolved hex
--app-color-bg-container   resolved hex
--app-color-text           resolved hex
--app-color-text-secondary resolved hex
--app-color-border         resolved hex
--app-radius               resolved px (Awesomic `14px`)
--app-font-family          resolved font stack
--app-shadow-elevated      resolved box-shadow value
```

Generate these values from `src/theme/` token resolution at request time, not by
hand. Do not add new bridge variables unless the token has a documented use in
Tailwind utilities or plain CSS rules outside AntD components.

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
html[data-theme='futureTheme'] .app-card .ant-tag {
  /* Theme-specific Card context only */
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
- `Layout.headerBg`
- `Table.rowHoverBg`

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

1. Start with the Awesomic token contract
2. Use Theme Editor only to inspect AntD behavior, not to replace Awesomic values
3. Export the values
4. Move the relevant global values into `token`
5. Move component-specific values into `components`
6. Keep only the overrides that are actually needed by the project

Do **not** blindly paste every exported value if many of them are just derived alias tokens.

Prefer this order:

1. keep shared structural rules in `global/shared-seed.ts`
2. keep Awesomic global values in `src/theme/presets/default.ts`
3. keep shared Awesomic constants in `src/theme/awesomic.ts`
4. keep per-component theme overrides in `components` or in the preset's `components` block only when Ant Design defaults are not enough

## Rules For Future Edits

- New theme work should import from `src/theme/index.ts`
- Do not turn `registry.ts` into a long token file
- Do not put all preset values back into one giant `themes.ts`
- Do not duplicate the same color in three places without reason
- Do not add visual values to Tailwind unless they reference the project
  `--app-*` bridge variables or are layout-only values with no design-token
  meaning
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
- [ ] No `--app-*` variable holds a `var(--ant-*)` chain. Every `--app-*`
      variable holds a resolved actual value (hex, px, font stack, or
      box-shadow).
- [ ] Resolved `--app-*` values are injected server-side so they are present on
      first render before any client JS runs.
- [ ] `src/styles/global.css` uses `@theme inline { ... }` (not bare `@theme`)
      for Tailwind v4 variable bridging.
- [ ] Active theme appearance is stored in React state or context, not computed
      at module level outside a React component.
- [ ] `tests/theme/theme-contract.test.ts` is consistent with the current
      `--app-*` values and data flow (no assertion of a `var(--ant-*)` chain if
      the new architecture is in place).
- [ ] Verified in a running build that a portal-rendered AntD component (Modal
      or Drawer) displays the correct `--app-color-primary` color.

### General Checks

Before calling theme work complete, verify:

- the app renders with the Awesomic light-fixed contract
- global changes still come from AntD tokens
- component-specific overrides still live in `theme.components`
- Tailwind utilities consume project bridge variables instead of copied theme
  values
- AntD components and Tailwind-authored surfaces match in the current light
  appearance
- the default preset contains only documented Awesomic global bindings
- dark mode remains inaccessible to user-facing entry points unless a separate
  Awesomic dark contract is approved
- no new hardcoded color values were scattered into unrelated components
- desktop and mobile layouts still render correctly
