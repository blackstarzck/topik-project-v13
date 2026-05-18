# Ant Design AI Development Rules

This folder turns Ant Design's official design and component guidance into local,
project-specific rules for TALKPIK AI.

The goal is not to mirror the official documentation. The goal is to make an AI
coding agent consistently choose Ant Design components, tokens, layout patterns,
feedback patterns, and review criteria when building this project.

## Required Reading Order

Before implementing UI, read these files in order:

1. `00-source-map.md` - authoritative sources and official Design menu map.
2. `01-design-values.md` - the four Ant Design design values as decision gates.
3. `02-global-styles.md` - color, token, font, layout, icon, shadow rules.
4. `03-patterns-and-components.md` - component and interaction pattern rules.
5. `04-page-patterns-for-talkpik.md` - TALKPIK page-level application rules.
6. `05-visual-motion-illustration.md` - charts, motion, illustration rules.
7. `06-ai-development-workflow.md` - step-by-step AI coding workflow.
8. `07-review-checklist.md` - final review checklist.
9. `08-theme-architecture.md` - current project theme structure and management rules.

## How To Use These Rules

- Use official Ant Design components first.
- Use Ant Design theme tokens before hardcoded CSS values.
- Use AntD MCP or official component docs when a component API is uncertain.
- Treat this folder as the local project policy for Ant Design usage.
- When a rule here conflicts with older local docs that mention another UI
  system, use this Ant Design rule set for new UI work unless the user says
  otherwise.

## Important Scope Note

`https://ant.design/llms-full.txt` is useful for Ant Design component usage,
API details, and examples. It is not enough by itself for Ant Design's broader
Design section, including values, global styles, design patterns, motion, and
illustrations. This folder fills that gap for this project.
