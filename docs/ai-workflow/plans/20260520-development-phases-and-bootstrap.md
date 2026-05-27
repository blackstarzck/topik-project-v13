# TALKPIK Development Phases And Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the Codex/Claude development phases for TALKPIK AI and begin the first implementation phase with a verified Next.js App Router foundation.

**Architecture:** Development proceeds from fixed documentation contracts into a minimal app foundation, then route, auth, data, learning, writing, feedback, and deployment slices. Each phase closes with tests, review evidence, ledger updates, and a publication decision before the next phase starts.

**Tech Stack:** Next.js App Router 16, React 19, TypeScript, pnpm, Ant Design 6, Tailwind CSS 4 as a constrained utility layer, Supabase, Vitest, Testing Library, Playwright.

---

## Out of Scope — Intentional Cuts

- Native mobile build (iOS/Android). Web responsive only in this plan.
- Server-side rendering of admin-only routes; admin tooling is Phase 6.
- Real-time collaboration features on writing drafts; autosave only.
- Stripe/billing integration; learner free tier only across all phases.
- Internationalization beyond Korean; English fallback strings only where existing.
- Worker queues / background jobs; everything is request-scoped or `unstable_after`.
- Custom auth provider; Supabase Auth only.
- ORM layer; Supabase client + generated types only (no Drizzle/Prisma in this plan).

## Smallest Buildable Unit

Phase 1 alone (Next.js App Router foundation + theme registry + a single thin page that renders) is a ship-shaped slice. Each subsequent phase adds one user-visible capability (auth, navigation, learning, writing, admin) on top of the previous one. The smallest path to a working learner experience is Phase 1 → 2 → 3 → 4; Phase 5 and 6 extend rather than gate the core learning flow.

## Phase Contract

| Phase | Name | Scope | Completion Gate |
| --- | --- | --- | --- |
| 0 | Development Contract | Align docs, stack boundaries, agent roles, phase acceptance criteria, and unresolved stack notes such as whether Axios is added later as a Route Handler HTTP client. | Phase plan exists, docs conflicts are recorded as none or resolved, ledger is current, and Architecture Pass passed. |
| 1 | App Foundation | Next.js App Router source tree, TypeScript/ESLint/PostCSS config, root layout, Ant Design providers, theme registry, Tailwind bridge, and a thin first page. | `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and workflow checker pass or have documented blockers, and Architecture Pass passed. |
| 2 | Data And Auth Foundation | Supabase SSR/browser clients, env validation, schema-generated types, auth/session boundary, profile bootstrap, and RLS verification. | Auth/profile tests pass, secrets remain server-only, RLS access checks are documented, and Architecture Pass passed. |
| 3 | App Shell And IA Routes | Protected workspace layout, navigation, loading/error boundaries, empty route shells, and target route map alignment. | All active sitemap routes have intentional App Router handling, basic e2e navigation coverage, and Architecture Pass passed. |
| 4 | Learning Core | Dashboard, learning goals, problem recommendations, problem list, solving state, attempt submission, and progress summaries. | Core learner path works from dashboard to attempt persistence with tests and browser QA, and Architecture Pass passed. |
| 5 | Writing And Feedback | Writing setup, short/long answer drafts, autosave, submission, feedback list/detail, comparison reports, and recommendations. | Draft preservation and feedback retrieval are covered by tests plus browser QA, and Architecture Pass passed. |
| 6 | Admin, Export, And Hardening | Admin problem/user management, exports, notifications/settings, accessibility, performance, deployment gates, and release checks. | Playwright smoke suite, lint/typecheck/build, deployment readiness, final review pass, and Architecture Pass passed. |

## Operating Model

- Codex is the default implementer in this workspace unless a later task assigns Claude Code as implementer.
- Claude Code is the preferred independent reviewer when available; otherwise the current agent records a degraded self-review.
- Every implementation or route/UI/auth/data phase requires a run ledger under `docs/ai-workflow/runs/YYYY/MM/DD/`.
- Production code starts with RED tests unless the change is docs-only, config-only, generated output, or explicitly has no runnable test surface.
- Stack changes are not slipped into implementation. Axios, additional Ant Design registry packages, billing SDKs, or ORM choices require an explicit stack-change note or spec update before adoption.

## Phase 1 File Map

| Path | Responsibility |
| --- | --- |
| `tests/theme/theme-contract.test.ts` | RED/GREEN contract for theme registry and Tailwind bridge behavior. |
| `src/theme/index.ts` | Public theme API entry point. |
| `src/theme/types.ts` | Shared theme names, appearance, preset, and built-theme types. |
| `src/theme/global/algorithms.ts` | Light/dark Ant Design algorithm mapping. |
| `src/theme/global/shared-seed.ts` | Minimal shared seed tokens, including project font family fallback. |
| `src/theme/components/shared.ts` | Shared component token overrides; initially empty unless needed. |
| `src/theme/presets/default.ts` | Default theme preset close to stock Ant Design. |
| `src/theme/create-theme.ts` | Theme assembly from shared tokens and preset overrides. |
| `src/theme/registry.ts` | Registered themes and `getAppTheme` lookup. |
| `src/theme/tailwind-bridge.ts` | Approved `--app-*` CSS variable bridge values. |
| `src/theme/antdTheme.ts` | Static default Ant Design theme export for simple imports. |
| `src/theme/themes.ts` | Compatibility re-export. |
| `src/app/providers.tsx` | Client root providers for Ant Design `ConfigProvider` and `App`. |
| `src/app/layout.tsx` | App Router root layout and global CSS import. |
| `src/app/page.tsx` | Thin initial app page that proves the app renders. |
| `src/styles/global.css` | Tailwind import and minimal global/app-shell CSS. |
| `next-env.d.ts` | Next.js generated type reference file. |
| `next.config.ts` | Minimal Next.js config. |
| `tsconfig.json` | TypeScript config aligned with Next.js. |
| `postcss.config.mjs` | Tailwind v4 PostCSS plugin config. |
| `eslint.config.mjs` | Next.js flat ESLint config. |

## Phase 1 Tasks

### Task 1: Record Phase Plan And Ledger

**Files:**
- Create: `docs/ai-workflow/plans/20260520-development-phases-and-bootstrap.md`
- Create: `docs/ai-workflow/runs/2026/05/20/20260520-1535-development-phases-bootstrap.md`

- [x] **Step 1: Save this phase plan**

Run: `Test-Path docs/ai-workflow/plans/20260520-development-phases-and-bootstrap.md`

Expected: `True`

- [ ] **Step 2: Save the run ledger**

Run: `Test-Path docs/ai-workflow/runs/2026/05/20/20260520-1535-development-phases-bootstrap.md`

Expected: `True`

### Task 2: RED Theme Contract

**Files:**
- Create: `tests/theme/theme-contract.test.ts`
- Create: `src/theme/index.ts`

- [ ] **Step 1: Write the failing theme contract test**

```ts
import { describe, expect, test } from 'vitest';
import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getTailwindBridgeVars,
} from '../../src/theme';

describe('app theme contract', () => {
  test('exposes a default Ant Design theme with CSS variables enabled', () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);

    expect(theme.name).toBe('default');
    expect(theme.appearance).toBe('light');
    expect(theme.antd.cssVar).toEqual({ key: 'talkpik' });
    expect(theme.antd.token?.fontFamily).toContain('system-ui');
  });

  test('maps the approved Tailwind bridge variables to Ant Design CSS variables', () => {
    expect(getTailwindBridgeVars()).toEqual({
      '--app-color-primary': 'var(--ant-color-primary)',
      '--app-color-bg-layout': 'var(--ant-color-bg-layout)',
      '--app-color-bg-container': 'var(--ant-color-bg-container)',
      '--app-color-text': 'var(--ant-color-text)',
      '--app-color-text-secondary': 'var(--ant-color-text-secondary)',
      '--app-color-border': 'var(--ant-color-border)',
      '--app-radius': 'var(--ant-border-radius)',
      '--app-font-family': 'var(--ant-font-family)',
      '--app-shadow-elevated': 'var(--ant-box-shadow-secondary)',
    });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm test tests/theme/theme-contract.test.ts`

Expected: `FAIL` because `../../src/theme` does not exist yet.

### Task 3: GREEN Theme Foundation

**Files:**
- Create: `src/theme/index.ts`
- Create: `src/theme/types.ts`
- Create: `src/theme/global/algorithms.ts`
- Create: `src/theme/global/shared-seed.ts`
- Create: `src/theme/components/shared.ts`
- Create: `src/theme/presets/default.ts`
- Create: `src/theme/create-theme.ts`
- Create: `src/theme/registry.ts`
- Create: `src/theme/tailwind-bridge.ts`
- Create: `src/theme/antdTheme.ts`
- Create: `src/theme/themes.ts`

- [ ] **Step 1: Implement the minimal theme registry**

Create the files listed above with one default preset, light/dark algorithm support, CSS-variable output, and the exact bridge variables tested in Task 2.

- [ ] **Step 2: Run the focused test and confirm GREEN**

Run: `pnpm test tests/theme/theme-contract.test.ts`

Expected: `PASS`.

### Task 4: App Router Bootstrap

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/providers.tsx`
- Create: `src/app/page.tsx`
- Create: `src/styles/global.css`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`

- [ ] **Step 1: Add Next.js and tooling config**

Add minimal config files so `pnpm lint`, `pnpm typecheck`, and `pnpm build` can run through the fixed scripts already present in `package.json`.

- [ ] **Step 2: Add root providers and first page**

Use `ConfigProvider` and Ant Design `App` provider in `src/app/providers.tsx`, import global CSS from `src/app/layout.tsx`, and keep `src/app/page.tsx` thin.

- [ ] **Step 3: Run broad verification**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
node scripts/ai-workflow-check.mjs --repo .
```

Expected: all commands pass.

## Self-Review

- Spec coverage: Phase plan maps `docs/spec.md` fixed baseline, source structure, frontend rules, state ownership, backend/auth boundaries, and testing requirements into sequential implementation phases.
- Placeholder scan: No phase is left as a vague task; later phases intentionally define acceptance gates rather than implementation code because they are future phase plans, not active implementation tasks.
- Type consistency: Phase 1 tests target `getAppTheme`, `getTailwindBridgeVars`, `defaultThemeName`, and `defaultAppearance`, all implemented by the theme registry task.
