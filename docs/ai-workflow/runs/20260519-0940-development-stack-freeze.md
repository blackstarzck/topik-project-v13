# Development Stack Freeze Run Ledger

## Run Metadata

- Run id: 20260519-0940-development-stack-freeze
- Created: 2026-05-19 09:40 Asia/Seoul
- Updated: 2026-05-19 10:10 Asia/Seoul
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Fix the development framework, libraries, and related technical stack before implementation.
- User follow-up: Billing should not be considered at the current stage.
- User follow-up: Deployment-related spec was missing or insufficient.
- User follow-up: `docs/development-spec.md` is too large and should be split without increasing the risk that agents miss required docs.
- Accepted scope: Create a durable development spec document that fixes framework/library choices and decision rules.
- Accepted scope update: Split detailed development specs into focused files while keeping `docs/development-spec.md` as the required router.
- Out of scope: Installing packages, bootstrapping application source, creating database schema, or committing changes.
- Current next action: Report the fixed development stack.

## Docs Consulted

- Exact files read:
  - `.codex/skills/using-superpowers/SKILL.md`
  - `.codex/skills/gstack/document-generate/SKILL.md`
  - `docs/prd.md`
  - `docs/spec.md`
  - `docs/ant-design/README.md`
  - `docs/ant-design/00-source-map.md`
  - `docs/ant-design/08-theme-architecture.md`
  - `docs/ai-workflow/runs/20260519-0834-serverless-dev-spec-recommendation.md`
  - `docs/ai-workflow/runs/20260519-0841-auth-ai-boundary-recommendation.md`
- External docs consulted:
  - Context7 `/vercel/next.js`
  - Context7 `/supabase/supabase`
  - Context7 `/ant-design/ant-design`
  - npm registry version checks for selected packages
  - Vercel official deployment, Git deployment, environments, and environment variable docs
- Extracted requirements:
  - The project is serverless.
  - It is currently pre-implementation, with no `src/` or `package.json`.
  - Target UI stack already includes React, TypeScript, Zustand, Ant Design, ConfigProvider, and Ant Design tokens.
  - Product requires learner accounts, profiles, goals, progress, problem solving, writing drafts, feedback, vocabulary, mock exams, notices, subscription/admin surfaces, AI tutor, and generated problem workflows.
  - Authentication should default to Supabase Auth unless B2B/SSO requirements make Clerk necessary.
  - AI/problem generation must be isolated behind service contracts for later collaboration with another department.
- Doc conflicts:
  - none.
- Untouched relevant docs and reason:
  - IA, sitemap, and user-flow docs were not needed for framework/library selection because this task does not define routes or screen behavior.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-19 09:40 | Use Next.js App Router as the application framework. | It supports React Server Components, Route Handlers, Server Actions, and serverless deployment. | Next.js docs |
| 2026-05-19 09:40 | Use Supabase as the backend platform and Supabase Auth as the default auth provider. | Product data is relational/user-owned and benefits from Postgres, RLS, Auth, Storage, and SSR support. | Supabase docs, prior auth decision |
| 2026-05-19 09:40 | Use Ant Design as the UI system. | Existing project spec already mandates AntD-first UI and theme tokens. | `docs/spec.md`, AntD docs |
| 2026-05-19 09:40 | Keep AI/model provider logic outside the main app and integrate via serverless API contracts. | Another department will later collaborate on AI/problem generation. | User clarification |
| 2026-05-19 09:47 | Defer billing and remove Stripe from the fixed stack. | User explicitly said billing should not be considered at the current stage. | User clarification |
| 2026-05-19 09:55 | Add Vercel deployment and environment spec to the fixed stack document. | The previous document only named Vercel and lacked deployment gates, environment rules, and rollback policy. | Vercel docs, user question |
| 2026-05-19 10:10 | Split `development-spec.md` into a short router plus focused `docs/development/` files. | Large always-read docs increase miss and context risk; a router with goal mapping lowers that risk. | User concern |

## Active Files

- Files expected to change:
  - `AGENTS.md`
  - `docs/ai-development-workflow.md`
  - `docs/development-spec.md`
  - `docs/development/README.md`
  - `docs/development/stack.md`
  - `docs/development/backend-auth.md`
  - `docs/development/ai-boundary.md`
  - `docs/development/deployment.md`
  - `docs/development/deferred-scope.md`
  - `docs/ai-workflow/runs/20260519-0940-development-stack-freeze.md`
- Files inspected:
  - `.codex/skills/using-superpowers/SKILL.md`
  - `.codex/skills/gstack/document-generate/SKILL.md`
  - `docs/prd.md`
  - `docs/spec.md`
  - `docs/ant-design/README.md`
  - `docs/ant-design/00-source-map.md`
  - `docs/ant-design/08-theme-architecture.md`
  - `docs/ai-workflow/runs/20260519-0834-serverless-dev-spec-recommendation.md`
  - `docs/ai-workflow/runs/20260519-0841-auth-ai-boundary-recommendation.md`
- Files changed:
  - `AGENTS.md`
  - `docs/ai-development-workflow.md`
  - `docs/development-spec.md`
  - `docs/development/README.md`
  - `docs/development/stack.md`
  - `docs/development/backend-auth.md`
  - `docs/development/ai-boundary.md`
  - `docs/development/deployment.md`
  - `docs/development/deferred-scope.md`
  - `docs/ai-workflow/runs/20260519-0940-development-stack-freeze.md`
- Files explicitly not to touch:
  - Application source and package files, because implementation has not started.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| none | none | No child agents used. | not applicable | Main session handled docs and verification directly. |

## Verification State

- Required checks:
  - Confirm no `package.json` exists before avoiding install changes.
  - Confirm selected framework/library docs were consulted.
  - Confirm the new development spec is internally consistent.
- Checks run:
  - Local file reads.
  - `rg --files` for package/lock files.
  - Context7 documentation queries.
  - npm registry version checks.
  - Markdown fenced code block balance check for `docs/development-spec.md`.
  - Inspection for obsolete `next lint` usage after confirming Next.js 16 removed it.
  - Inspection for remaining `stripe` / `Stripe Billing` fixed-stack references after billing defer patch.
  - Inspection for deployment section, Vercel environment model, environment variable rules, and deployment gates.
  - Inspection for split development docs and required router mapping.
- Latest results:
  - No package or lock file exists yet.
  - `docs/development-spec.md` exists.
  - Markdown code fences are balanced.
  - Lint script uses `eslint .`, not removed `next lint`.
  - Stripe is no longer in the fixed package snapshot or architecture diagram.
  - Deployment spec now covers Local, Preview, Production, Vercel Git deployment, environment variables, gates, and rollback.
  - `docs/development-spec.md` is now a short required router.
  - Detailed specs are split under `docs/development/`.
  - `AGENTS.md` and `docs/ai-development-workflow.md` now map development tasks to the router.
- Known failures:
  - Initial npm version check used `&&`, which is invalid in this PowerShell version; recovered with a PowerShell loop.
- Skipped checks and reason:
  - Build/test checks are not applicable because this is documentation-only.

## Fallback State

- Normal path blocked: initial npm command syntax only.
- Failure class: recoverable command syntax failure.
- Fallback used: reran npm version checks with a PowerShell `foreach` loop.
- Evidence collected: package versions were successfully read.
- Completion allowed: yes.
- Remaining fallback risk: exact package patch versions should be rechecked during actual bootstrap.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: not applicable.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks:
  - Exact dependency patch versions can change before the first real `package.json` is generated.
  - Ant Design latest major is now v6; existing local AntD docs are mostly version-neutral but must be checked when writing UI code.
- Assumptions:
  - "고정" means fixing the official project stack and dependency policy, not installing packages yet.
- Follow-up needed:
  - Bootstrap the app from `docs/development-spec.md` once the user asks to start implementation.
