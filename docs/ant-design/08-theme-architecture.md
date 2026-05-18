# Theme Architecture

> Status (2026-05-18)
>
> 이 저장소는 현재 pre-implementation 상태이며 `src/`가 아직 없습니다.
> 본 문서는 `src/theme/`이 생성될 때 따라야 할 **목표 테마 구조**를 정의합니다.

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

1. `docs/ant-design/06-ai-development-workflow.md`
2. `docs/ant-design/02-global-styles.md`
3. `https://ant.design/docs/react/customize-theme`
4. `https://ant.design/theme-editor`

If local docs conflict, follow the newest project-specific theme structure and
update the conflicting local docs before finalizing work.

## Core Principle

This project now follows an AntD-first theme rule.

That means:

- start from stock Ant Design light and dark behavior
- keep the default preset close to empty
- add token overrides only when the product has a concrete reason
- do not restate Ant Design defaults inside our own theme files

Think of the theme system as a switchboard, not a repaint tool.
Its first job is to select light or dark mode.
Its second job is to hold only the overrides the product truly needs.

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
  themes.ts
  registry.ts
  create-theme.ts
  types.ts
  antdTheme.ts
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
- `src/theme/antdTheme.ts`
  - helper that exposes the default AntD theme config
  - acceptable for static use, but app runtime theme selection should use `getAppTheme`

### Theme assembly

- `src/theme/registry.ts`
  - registers available theme presets
  - exposes `themes`, `themePresets`, `defaultThemeName`, `defaultAppearance`, and `getAppTheme`
- `src/theme/create-theme.ts`
  - builds the final `ThemeConfig` from shared rules plus a preset
  - merges global token values and component token values
  - carries optional preset-owned global styles into the active theme definition
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
  - the current default theme preset
  - should stay close to empty
  - its job is to say "use light mode" or "use dark mode", not to restate Ant Design defaults
- `src/theme/presets/liquid-glass.ts`
  - owns both the Liquid Glass AntD token overrides and the Liquid Glass
    structural global styles
  - keep pseudo-elements, backdrop filters, overlay first-frame rules, and
    Liquid Glass CSS variables here instead of in `src/styles/global.css`

### Types

- `src/theme/types.ts`
  - shared types for appearances, presets, and built theme definitions

## Theme Flow

The runtime theme flow is:

1. a preset such as `defaultThemePreset` defines optional appearance-specific overrides
2. `createThemeFamily` builds final `ThemeConfig` objects for `light` and `dark`
3. `registry.ts` exposes the available themes
4. `main.tsx` calls `getAppTheme(themeName, appearance)`
5. `ConfigProvider` receives `activeTheme.antd`
6. new UI reads AntD tokens directly at render time

This gives the app one source of truth at runtime even though the files are split for maintainability.

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
- If a shared component token starts growing large, split it into per-component files under `src/theme/components/`
- If a preset becomes large, keep its values inside the preset file instead of spreading them across random UI components
- Do not add a preset override just to make Ant Design look the same as it already does by default

## Review Checklist For Theme Changes

Before calling theme work complete, verify:

- the app still works with stock Ant Design light and dark algorithms
- global changes still come from AntD tokens
- component-specific overrides still live in `theme.components`
- the default preset is still close to empty unless there is a documented reason otherwise
- dark mode still uses AntD dark algorithm unless there is a documented reason otherwise
- no new hardcoded color values were scattered into unrelated components
- desktop and mobile layouts still render correctly
