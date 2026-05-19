---
name: talkpik-ui-system
description: Use when building or changing TALKPIK UI, Ant Design components, Tailwind utility usage, theme tokens, light/dark appearance, layout, visual states, or design-system consistency.
---

# TALKPIK UI System

This skill keeps UI work Ant Design-first while allowing Tailwind as a constrained utility layer.

## Required Docs

Read these before editing:

1. `docs/spec.md`
2. `docs/ant-design/README.md`
3. `docs/ant-design/08-theme-architecture.md`
4. `docs/ant-design/07-review-checklist.md`
5. Matching page, route, or flow docs when the work changes user-facing behavior

## Design-System Rules

- Use Ant Design components before custom UI.
- Use Ant Design tokens before hardcoded color, radius, shadow, font, or spacing values.
- Keep theme decisions under `src/theme/`.
- Use Tailwind for responsive layout glue, sizing constraints, grid/flex helpers, and small one-off adjustments.
- Do not keep an independent Tailwind palette, radius scale, shadow scale, or font stack.
- Keep Tailwind aligned through project CSS variables generated from the active Ant Design theme.

## Theme Implementation

1. Build theme config from `src/theme/`.
2. Keep global token decisions in Ant Design `theme.token`.
3. Keep component-family changes in Ant Design `theme.components`.
4. Use `src/theme/tailwind-bridge.ts` for the approved AntD-to-Tailwind variable bridge.
5. Verify light and dark appearance when theme behavior changes.

## UI Completion Checklist

- Loading, empty, error, success, and disabled states exist where relevant.
- Desktop and mobile layouts have no text overlap or horizontal overflow.
- Cards are not nested inside cards.
- Tailwind-authored surfaces still visually match AntD components.
- User-facing flows answer the learner's next action clearly.

## Forbidden Shortcuts

- Do not style AntD internals with Tailwind when an AntD prop, variant, token, or component token can express the change.
- Do not introduce theme-named component forks.
- Do not hardcode brand colors in page components.
