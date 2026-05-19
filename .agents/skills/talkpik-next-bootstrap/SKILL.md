---
name: talkpik-next-bootstrap
description: Use when creating or changing the TALKPIK Next.js App Router foundation, source tree, package scripts, TypeScript setup, Tailwind setup, Ant Design root providers, or initial app bootstrap.
---

# TALKPIK Next Bootstrap

Use this skill to create the initial app foundation or change framework-level setup.

## Required Docs

Read these before editing:

1. `docs/spec.md`
2. `docs/development/stack.md`
3. `docs/ai-development-workflow.md`
4. `docs/ant-design/README.md` when the bootstrap touches UI providers or styles

## Required Decisions

- Use Next.js App Router under `src/app/`.
- Use `pnpm` and commit `pnpm-lock.yaml` once packages exist.
- Use TypeScript.
- Use Ant Design as the component system.
- Use Tailwind only as the constrained utility layer described in `docs/spec.md`.
- Use the source structure from `docs/spec.md`.
- Do not create `src/App.tsx` as route authority.

## Bootstrap Checklist

1. Create or update `package.json` with the required scripts from `docs/development/stack.md`.
2. Keep app code under `src/`.
3. Add root layout providers for Ant Design `ConfigProvider` and Ant Design `App` provider.
4. Add `src/styles/` for the Tailwind entrypoint and minimal global CSS only.
5. Add `src/theme/` for theme setup and the Tailwind token bridge.
6. Add `src/lib/`, `src/types/`, and `src/stores/` only when the implementation needs them.
7. Keep route-level pages thin and defer domain logic to focused helpers.

## Forbidden Shortcuts

- Do not introduce shadcn/ui, Chakra, MUI, Redux, or MobX.
- Do not use Tailwind as the primary design system.
- Do not add framework-level dependencies without an updated spec or explicit stack-change decision.
- Do not create browser-visible secrets.

## Verification

When `package.json` exists, run the proportionate checks: install integrity, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` when available. If no runnable test surface exists yet, record the documented TDD exception and inspect generated files.
