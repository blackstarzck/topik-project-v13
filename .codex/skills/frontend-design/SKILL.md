---
name: frontend-design
description: Use when implementing or reshaping the visual styling of a TALKPIK UI component or page
---

# TALKPIK Frontend Design

Use this project-local skill only for UI component or page visual styling and reshaping. Do not use it for documentation, server, data-only, test-only, or non-visual maintenance work.

## Required reading and precedence

Read `UPSTREAM_SKILL.md` completely before editing UI code. Apply its visual guidance only after these higher-priority contracts:

1. Direct user instructions, `AGENTS.md`, and the Superpowers process
2. `docs/prd.md`, `DESIGN.md`, current Ant Design/project wrappers, theme sources, and existing source behavior
3. `UPSTREAM_SKILL.md` for visual direction and critique

If the upstream guidance conflicts with a higher-priority contract, follow the higher-priority contract and explain the constraint.

## TALKPIK boundaries

- Prefer Ant Design components or existing project wrappers and the current theme.
- Do not invent or change design tokens, dependencies, product behavior, routes, or data contracts unless the user separately approves that scope and the owner documents are updated.
- Do not use React inline style. Use the project Tailwind and Ant Design theme patterns defined in `DESIGN.md`.
- Preserve responsive desktop/mobile behavior, accessibility, and all relevant loading, empty, success, error, and disabled states.
- Treat upstream suggestions about palette, typography, motion, and layout as critique prompts, not permission to replace TALKPIK's design system.
