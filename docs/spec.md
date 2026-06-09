# TALKPIK AI Implementation Spec

> Status: single required entry point for implementation decisions
>
> Last updated: 2026-06-01

This is the canonical implementation spec for TALKPIK AI. Read this file first
for any development, dependency, frontend, backend, auth, AI, deployment,
environment, route, or test task. Then read only the matching detailed documents
listed below.

This repository now has a foundation implementation. `src/` and `package.json`
exist, with the Next.js App Router scaffold, Supabase/auth/theme foundations, and
some learning and feedback surfaces already started.

Treat this document and the linked active docs as the target implementation
contract for intended behavior. Treat current source as the implementation
reference for behavior that already exists. Before changing behavior, reconcile
accepted docs with current source. If source and accepted docs disagree, stop and
report the exact conflict before implementing.

## Fixed Baseline

| Area | Fixed decision |
| --- | --- |
| Application architecture | Frontend + serverless application |
| Application framework | `Next.js App Router` |
| UI runtime | `React` |
| Language | `TypeScript` |
| UI system | `Ant Design` with `ConfigProvider` and theme tokens |
| Styling utilities | `Tailwind CSS` as a constrained utility layer |
| Backend | `Supabase` as the serverless backend platform |
| Database | Supabase-hosted `Postgres` |
| Auth | `Supabase Auth` |
| Storage | `Supabase Storage` |
| Deployment | `Vercel` as the serverless deployment target |
| Package manager | `pnpm` |
| Billing | Deferred; not part of the current fixed stack |

## Required Reading Map

Read this file first, then select the smallest matching set.

| Work mentions | Also read |
| --- | --- |
| framework, package, dependency, library, UI stack, state, forms, validation, chart, test | `docs/development/stack.md` |
| Supabase, database, auth, login, RLS, storage, profile, admin role, server key | `docs/development/backend-auth.md` |
| table, column, schema, migration, DDL, RLS policy SQL, index | `docs/supabase-table-inventory.md`, then `docs/development/database-schema.md` only for historical baseline/RLS design detail |
| Vercel, deploy, deployment, preview, production, environment variable, rollback, CI | `docs/development/deployment.md` |
| billing, subscription, paywall, payment, Stripe, plan pricing | `docs/development/deferred-scope.md` |
| page, route, navigation, user flow | `docs/sitemap.md`, `docs/ia.md`, `docs/flow/user-flow.md`, and matching `docs/Wireframe/<page>/description.md` when page-specific |
| visual UI, Ant Design component, theme, layout, motion | `docs/ant-design/README.md` and the matching Ant Design detail docs it routes to |

Do not read every detailed document by default. Use this map to keep the context
small and the implementation grounded.

## Source Structure

Use Next.js App Router conventions for source code.

```text
src/
  app/
    layout.tsx
    page.tsx
    (workspace)/
    api/
  components/
    app/
    shared/
  lib/
    supabase/
    validation/
  stores/
  styles/
  theme/
  types/
```

Folder responsibilities:

- `src/app/`: route tree, layouts, route handlers, loading/error boundaries, and
  server actions where appropriate.
- `src/components/app/`: app shell pieces such as sidebar, header, and settings.
- `src/components/shared/`: reusable UI blocks shared by multiple pages.
- `src/lib/`: Supabase clients, validation schemas, and server-only utilities.
- `src/stores/`: focused Zustand stores for recoverable client interaction state.
- `src/styles/`: Tailwind entrypoint and minimal global CSS used only where
  layout glue is necessary.
- `src/theme/`: Ant Design theme setup, token composition, theme presets, and
  the Tailwind token bridge.
- `src/types/`: shared TypeScript types.

Do not use `src/App.tsx` as the route authority. `docs/sitemap.md` remains the
product route map, and the Next.js `src/app/` route tree is the current
implementation reference. Reconcile both before route changes.

## Frontend Implementation Rules

- Use Ant Design components before building custom UI.
- Use Ant Design theme tokens before hardcoded colors, shadows, radii, or spacing.
- Use Tailwind CSS for constrained utility styling, responsive layout glue, and
  small one-off adjustments when Ant Design components or tokens are not enough.
- Do not use Tailwind as the design system, component library, or source of
  brand tokens. Ant Design tokens remain the styling authority.
- Keep theme decisions centralized under `src/theme/`.
- Keep Tailwind and Ant Design visually synchronized through shared theme CSS
  variables generated from the active Ant Design theme. Do not copy separate
  Tailwind color, radius, shadow, font, or spacing values by hand.
- Use `ConfigProvider` at the app root.
- Use Ant Design `App` provider for message, notification, and modal context.
- Prefer Ant Design layout and feedback primitives such as `Layout`, `Row`,
  `Col`, `Flex`, `Space`, `Card`, `Form`, `Table`, `Tabs`, `Drawer`, `Modal`,
  `Descriptions`, `Statistic`, `Alert`, `Result`, and `Progress`.
- Do not introduce deprecated Ant Design components in new UI work.
- Include loading, empty, error, success, and disabled states.
- Verify desktop and mobile layout before calling UI work complete.
- Keep route-level pages thin; domain logic belongs in focused helpers, stores,
  server actions, route handlers, or API modules.
- Do not introduce shadcn/ui, Chakra, MUI, Redux, or MobX without a written
  stack-change decision and user approval or an updated spec.

Detailed UI policy lives in `docs/ant-design/`.

## State Management Model

Use the smallest state owner that fits the data lifecycle:

- Keep route and data fetching decisions in Next.js Server Components, route
  handlers, or server actions where practical.
- Use React local state for component-private UI state.
- Use URL search params for shareable filters, tabs, pagination, or route-level
  view state.
- Use React Hook Form for form-local state and validation flow.
- Use TanStack Query only for client-side server state that cannot stay purely
  server-rendered, including cache, mutation, retry, and invalidation state.
- Use Zustand only for client interaction state that benefits from local
  recovery, cross-component coordination, or temporary UI continuity.
- Do not duplicate server-derived data in Zustand unless the UI needs a
  temporary editable draft or optimistic interaction state.

Target stores:

- `useUserStore`: learner profile display state, plan, language, and goal basics.
- `useLearningStore`: dashboard learning metrics and current progress UI state.
- `usePracticeStore`: reading/listening practice solving state.
- `useWritingStore`: writing setup, draft, autosave, and submission flow.
- `useFeedbackStore`: writing feedback list/detail UI state.
- `useThemeStore`: light/dark theme preference.

Draft-like user input must be recoverable. Long-form writing surfaces need
autosave or clear draft-preservation cues.

## Backend And Auth Rules

- Use Supabase as the serverless backend platform.
- Use Supabase-hosted Postgres for relational data.
- Use Supabase Auth for authentication.
- Use Supabase Storage for user files or generated exports when storage is
  required.
- Enforce data access with RLS policies.
- Keep server-only keys on the server. Never expose Supabase `service_role` or
  other secrets in browser-visible variables.
- Use browser-visible Supabase variables only for publishable configuration.
- Read `docs/development/backend-auth.md` before implementing auth, RLS,
  storage, profile, or admin-role behavior.

## Serverless Architecture Rules

- Build the project as a frontend + serverless application.
- Treat Supabase and Vercel as the fixed serverless stack for backend capability,
  runtime boundaries, hosting, deployment, and environment management.
- Prefer managed Supabase capabilities and Vercel-supported Next.js serverless
  boundaries over self-managed backend servers.
- Do not introduce a separate long-running backend service without an approved
  architecture decision and updated spec.

## Deployment And Environment Rules

- Deploy on Vercel as the serverless deployment target.
- Use `pnpm` and commit `pnpm-lock.yaml` once packages exist.
- Configure Vercel project environments before sharing Preview links.
- Keep secrets out of committed files.
- Keep environment-variable names and visibility aligned with
  `docs/development/deployment.md`.
- Read `docs/development/deployment.md` before deployment, preview, production,
  rollback, CI, or environment-variable work.

## Testing And Quality

The implementation must provide scripts for:

- `dev`
- `build`
- `start`
- `lint`
- `typecheck`
- `test`
- `test:e2e`
- `format`

Follow the exact script expectations in `docs/development/stack.md` unless that
file is updated by an approved stack-change decision.

Before calling implementation work complete:

- run the relevant focused tests,
- run lint/typecheck/build when available and proportionate,
- check desktop and mobile layout for UI work,
- apply the Ant Design review checklist for UI work,
- run browser or visual QA for user-facing flows,
- and report what works, what does not work yet, and what risk remains.

## Non-Negotiable Rules

- Do not skip this file for implementation work.
- Do not add framework-level dependencies without a stack-change note and user
  approval or an updated spec.
- Do not add billing SDKs or payment flows unless billing scope is explicitly
  reopened.
- Do not expose secrets in browser-visible variables.
- Do not share Preview links until Vercel environment variables are configured.
- Do not silently invent product behavior. Use `docs/prd.md`, `docs/sitemap.md`,
  `docs/ia.md`, `docs/flow/user-flow.md`, and matching `docs/Wireframe/` page
  docs for product, route, and flow requirements.

## Implementation Change Checklist

Before changing app code or adding a new implementation surface:

- Re-read this file.
- Read only the matching detailed files from the Required Reading Map.
- Re-read `docs/ant-design/README.md` for UI work.
- Use `docs/sitemap.md` as the product route map and reconcile it with
  `src/app/`.
- Keep `package.json` and `pnpm-lock.yaml` aligned.
- Configure Supabase env variables with publishable keys only in browser-visible
  variables.
- Configure Vercel project environments before sharing Preview links.
- Keep secrets out of committed files.
- Create initial tests before non-trivial implementation unless a documented TDD
  exception applies.

## Detailed Development Docs

- `docs/development/stack.md` - framework, packages, frontend stack, testing,
  and package snapshot.
- `docs/development/backend-auth.md` - Supabase, Auth, RLS, Storage, and Clerk
  decision.
- `docs/supabase-table-inventory.md` - current Supabase table, RPC, storage,
  and code usage inventory. Update it when schema or Supabase usage changes.
- `docs/development/database-schema.md` - initial Tier 1 MVP table baseline,
  RLS policy patterns, ER diagram, and original migration index.
- `docs/development/deployment.md` - Vercel environments, build settings,
  deployment gates, and rollback.
- `docs/development/deferred-scope.md` - billing and other deferred areas.

## Relationship To Other Active Docs

- `docs/prd.md` defines product scope and value.
- `docs/sitemap.md` defines the target route map.
- `docs/ia.md` and `docs/Wireframe/` define information architecture and page-level
  screen requirements.
- `docs/flow/user-flow.md` defines user journey order and transitions.
- `docs/ant-design/` defines UI implementation rules.

If this file conflicts with another active doc on implementation technology,
stop and report the conflict before implementing.
