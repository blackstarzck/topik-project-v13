# Development Stack

> Last updated: 2026-05-19

This file fixes the framework, runtime, package, and frontend library choices
for TALKPIK AI.

## Runtime And Tooling

| Area | Fixed Choice | Version Policy | Reason |
| --- | --- | --- | --- |
| Runtime | `Node.js` | `24.x LTS` | Current active LTS line; suitable for modern Next.js/Vercel work. |
| Package manager | `pnpm` | latest stable major at bootstrap | Deterministic lockfile, efficient installs, good monorepo path if needed later. |
| Framework | `next` | `16.x` | App Router, Route Handlers, Server Actions, serverless deployment fit. |
| UI runtime | `react`, `react-dom` | `19.x` | Current React line used by modern Next.js. |
| Language | `typescript` | `6.x` unless Next.js compatibility requires latest supported `5.x` | Strong domain models and API contracts. |
| Linting | `eslint` + `eslint-config-next` | latest stable major supported by Next.js | Required before completion. |
| Formatting | `prettier` | `3.x` | Consistent formatting without style debates. |

Implementation rule:

- The first `package.json` must include a `packageManager` field.
- The first lockfile must be `pnpm-lock.yaml`.
- Do not mix npm, yarn, and pnpm lockfiles.

## Frontend Stack

| Area | Fixed Choice | Version Policy | Reason |
| --- | --- | --- | --- |
| App framework | `Next.js App Router` | `16.x` | File-system routing, layouts, server components, route handlers. |
| Component system | `Ant Design` | `6.x` | Enterprise-grade app UI, forms, tables, layout, feedback, theme tokens. |
| Styling utilities | `tailwindcss` | `4.x` | Constrained utility layer for responsive layout glue and one-off styling. |
| CSS processing | `@tailwindcss/postcss` + `postcss` | same stable major as Tailwind / latest compatible `8.x` PostCSS | Tailwind v4 PostCSS integration for Next.js. |
| Icons | `lucide-react` | latest stable major | Simple consistent app icons where AntD icons are not enough. |
| Client state | `zustand` | `5.x` | Lightweight state for UI/task state. |
| Server state | `@tanstack/react-query` | `5.x` | Caching and mutation state for client-side data that cannot stay purely server-rendered. |
| Forms | `react-hook-form` | `7.x` | Complex forms with low render overhead. |
| Validation | `zod` | `4.x` | Shared schema validation for forms and API payloads. |
| Charts | `recharts` | `3.x` | Progress charts and mock exam result visualization. |
| Dates | `dayjs` | `1.x` | Date formatting, exam date, subscription date, and learning history display. |

Frontend rules:

- Use Ant Design components before custom UI.
- Use Ant Design tokens before hardcoded colors, radius, spacing, or shadows.
- Use Tailwind CSS only as a constrained utility layer. Do not let utility
  classes replace Ant Design components, theme tokens, or centralized theme
  decisions.
- Tailwind theme values must come from the active Ant Design theme through a
  CSS-variable bridge. Do not maintain an independent Tailwind palette, radius
  scale, shadow scale, or font stack.
- Keep theme configuration under `src/theme/`.
- Use `ConfigProvider` at the app root.
- Use Ant Design `App` provider for message, notification, and modal context.
- Keep route-level pages thin; domain logic belongs in focused helpers, stores, server actions, or API modules.
- State ownership order: Server Components/server actions for server-owned data, React local state for component-private UI, URL search params for shareable view state, React Hook Form for form state, TanStack Query for client-side server state, and Zustand for recoverable cross-component client interaction state.
- Do not introduce shadcn/ui, Chakra, MUI, Redux, or MobX without a written stack-change decision.

## Testing And Quality

| Area | Fixed Choice | Version Policy | Reason |
| --- | --- | --- | --- |
| Unit tests | `vitest` | `4.x` | Fast TypeScript test runner. |
| UI component tests | `@testing-library/react` | latest stable major | User-oriented component assertions. |
| Browser/e2e tests | `playwright` | `1.x` | Required for route, auth, and visual workflow checks. |
| API validation tests | `vitest` + `zod` schemas | same as above | Validate contracts without requiring full browser flows. |

Required scripts once `package.json` exists:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "format": "prettier --check .",
    "format:write": "prettier --write ."
  }
}
```

## Initial Package Snapshot

These versions were checked from npm on 2026-05-19. They are not a substitute
for the lockfile. The first implementation setup must recheck and write the
actual versions into `package.json` and `pnpm-lock.yaml`.

| Package | Observed version |
| --- | --- |
| `next` | `16.2.6` |
| `react` | `19.2.6` |
| `typescript` | `6.0.3` |
| `antd` | `6.4.3` |
| `@supabase/supabase-js` | `2.106.0` |
| `@supabase/ssr` | `0.10.3` |
| `tailwindcss` | `4.3.0` |
| `@tailwindcss/postcss` | `4.3.0` |
| `postcss` | `8.5.14` |
| `@tanstack/react-query` | `5.100.11` |
| `zustand` | `5.0.13` |
| `react-hook-form` | `7.76.0` |
| `zod` | `4.4.3` |
| `vitest` | `4.1.6` |
| `playwright` | `1.60.0` |
| `recharts` | `3.8.1` |
| `lucide-react` | `1.16.0` |
| `dayjs` | `1.11.20` |
| `eslint` | `10.4.0` |
| `eslint-config-next` | `16.2.6` |
| `prettier` | `3.8.3` |
| `@testing-library/react` | `16.3.2` |
| `pnpm` | `11.1.3` |

## Rejected Defaults

| Rejected | Reason |
| --- | --- |
| Firebase as primary backend | Product data is relational and benefits from Postgres/RLS. |
| Tailwind as the primary UI system | Local project spec remains Ant Design-first. |
| shadcn/ui | Historical references only; not the current implementation standard. |
| Redux Toolkit | Zustand is enough for focused client UI state. |
| Prisma/Drizzle at MVP start | Direct Supabase SQL/types are simpler and keep RLS visible. |
