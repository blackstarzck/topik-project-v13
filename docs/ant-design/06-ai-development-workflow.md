# AI Development Workflow

This file defines the required workflow for AI-assisted UI development in this
project.

## Before Coding

1. Read the product docs in `docs/`.
2. Read `docs/ant-design/README.md`.
3. Read all files listed in the required reading order.
4. Identify the page pattern:
   - dashboard/workbench
   - form page
   - problem solving page
   - writing editor
   - list page
   - detail page
   - result page
   - exception page
   - exam workspace
5. Choose AntD components before writing custom UI.
6. Complete the AntD component API mapping before implementation:
   - extract visible data, states, actions, and layout roles from IA documents
     and user requirements
   - list the selected AntD components for each visible UI area
   - inspect each selected component's official API through AntD MCP, AntD CLI,
     AntD LLM-ready docs, or official component docs
   - map the extracted requirements to built-in props, slots, variants,
     semantic DOM hooks, and design tokens before custom implementation
   - record why any remaining custom markup, custom CSS, or custom interaction
     logic is necessary
   - do not proceed to UI implementation until this mapping is recorded

## During Coding

Use this order:

1. Implement from the completed AntD component API mapping.
2. Structure with AntD layout and components.
3. Configure global theme tokens.
4. Use component tokens for targeted customization.
5. Add local CSS only for project layout glue.
6. Add responsive behavior.
7. Add loading, empty, success, error, and disabled states.
8. Verify accessibility labels and keyboard behavior.

## Overlay Workflow Rule

`src/`가 아직 생성되지 않은 pre-implementation 상태에서는 이 규칙이 "처음 만들 때
이 구조로 만들어라"를 의미합니다. `src/`가 생성된 이후에는 강제 규칙으로 적용됩니다.

For user-facing surfaces and overlays:

- use `src/components/shared/AppCard.tsx` instead of importing AntD `Card`
  directly for user-facing Card surfaces
- use `src/components/shared/AppDrawer.tsx` instead of importing AntD `Drawer`
  directly
- use `src/components/shared/AppModal.tsx` instead of importing AntD `Modal`
  directly

Reason:

- shared wrappers provide stable project classes for surface and overlay theme
  rules
- theme presets can scope contextual surface styling to stable hooks such as
  `.app-card`, while preserving AntD child component defaults unless there is a
  confirmed product reason to override them
- transparent or glass-like themes can flicker if overlay motion fades the
  surface on the first frame
- this is an overlay behavior rule, not only a styling rule

If a new theme changes overlay surface behavior, verify the first visible frame
of the overlay, not only the final open state.

Do not create theme-named wrappers such as `LiquidGlassCard` or
`CustomThemeACard`. Keep one role-based wrapper and let each theme preset own
the visual expression.

## AntD MCP Usage

Use MCP when:

- Starting the required AntD component API mapping for visible UI work.
- A component prop is uncertain.
- A demo pattern is needed.
- A design token is needed.
- Semantic DOM hooks are needed.
- A component has changed across versions.

If MCP is unavailable:

- Read `https://ant.design/llms-full.txt`.
- Read single component markdown, for example:
  - `https://ant.design/components/button.md`
  - `https://ant.design/components/form.md`
  - `https://ant.design/components/table.md`
- Read semantic docs where relevant, for example:
  - `https://ant.design/components/button/semantic.md`

## Theme Implementation Rule

`src/`가 아직 생성되지 않은 pre-implementation 상태에서는 아래 구조가 "생성 시
따라야 할 목표 구조"입니다. `src/`가 생성된 이후에는 단일 **public theme entry
point**를 유지하되, 책임에 따라 내부 테마 파일을 분리하는 것을 권장합니다.

Target structure:

```text
src/theme/
  index.ts
  registry.ts
  create-theme.ts
  global/
  components/
  presets/
```

Rules:

- `index.ts` is the public entry point.
- `registry.ts` registers available named themes.
- `presets/` contains optional theme-specific overrides and, when AntD tokens are
  insufficient, preset-owned structural global styles. The default preset should
  stay close to empty so the app uses stock Ant Design decisions first.
- `global/` contains shared seed tokens and algorithm helpers.
- `components/` contains shared component token rules only when the project has a
  documented reason to deviate from Ant Design defaults.

This theme system should still centrally own:

- `token`
- `components`
- optional algorithm choice
- optional preset-owned global styles
- font family

Do not spread theme decisions across unrelated components.
See `08-theme-architecture.md` for the project-specific theme structure.

### CSS Variable Scoping — Mandatory Enforcement

Read this section before writing any `--app-*` variable assignment. These rules
are machine-enforced by `scripts/ai-workflow-check.mjs`. Violations produce
silent production failures.

**Five prohibited patterns:**

1. Setting `--app-*` via `style={}` on any React component other than the root
   `html` element. Portal-rendered AntD components target `document.body` by
   default and cannot inherit CSS variables from a React subtree.

2. Assigning `--app-*: var(--ant-*)`. AntD CSS variables are generated by
   client-side JS and are absent during SSR. The chain has no resolved value on
   the server, causing flash-of-unstyled-content.

3. Using bare `@theme { --color-x: var(--app-x) }` in Tailwind v4. Use
   `@theme inline { ... }` instead to avoid an extra variable indirection layer.

4. Setting `cssVar: { key: 'name' }` and expecting CSS variable names to change.
   `key` is a cache identifier only. Use `cssVar: { prefix: 'name' }` to rename
   generated CSS variable prefixes.

5. Computing `activeTheme` or calling `getAppTheme()` at module level outside a
   React component. Module-level evaluation runs once at import time and does not
   react to state changes, blocking runtime dark mode switching.

**Required architecture:**

```
AntD tokens
  → resolved actual values  (computed server-side from active ThemeConfig)
  → --app-* on html element (app/layout.tsx, <html style={...}>)
  → @theme inline           (src/styles/global.css)
  → Tailwind utilities
```

**Before writing any `--app-*` assignment, confirm all five:**

1. Target is `html` or `:root`.
2. Value is a resolved actual value, not a `var(--ant-*)` chain.
3. Value is available on first render (present in `<html style={...}>` from `layout.tsx`).
4. Tailwind bridging uses `@theme inline`.
5. Theme appearance is in React state, not module scope.

Do not proceed to component implementation if any of the five conditions cannot
be confirmed. If `tests/theme/theme-contract.test.ts` asserts a `var(--ant-*)`
chain while the new architecture is in place, update the test in the same commit.

## CSS Rule

Custom CSS should not compete with AntD's component system.

Allowed:

- app shell layout
- page-level responsive layout
- local font registration
- domain-specific editor/exam surface sizing
- print/export styling when needed

Avoid:

- rebuilding AntD buttons
- rebuilding AntD inputs
- custom dropdowns
- custom modals
- custom table behavior
- arbitrary color/radius/shadow values
- visual inline styles that redraw AntD component surfaces or interaction states

## Verification Rule

For UI work, verify:

- desktop viewport
- mobile viewport
- no horizontal overflow
- no overlapping text
- loading state
- empty state
- error state
- primary workflow interaction
- console errors

When a dev server is available, use browser verification and screenshots.

## Conflict Rule

If old docs mention shadcn/ui or Tailwind as the UI system but the current user
direction says Ant Design, follow Ant Design for new UI work. Keep old docs as
product context unless the user asks to rewrite them.
