# Auth And AI Boundary Recommendation Run Ledger

## Run Metadata

- Run id: 20260519-0841-auth-ai-boundary-recommendation
- Created: 2026-05-19 08:41 Asia/Seoul
- Updated: 2026-05-19 08:41 Asia/Seoul
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Recommend how to treat problem generation and AI collaboration boundaries, and choose between Clerk and Supabase for login.
- Accepted scope: Advisory architecture recommendation only.
- Out of scope: Implementing auth, creating schema migrations, changing PRD/spec documents, or committing changes.
- Current next action: Report the recommendation.

## Docs Consulted

- Exact files read:
  - `.codex/skills/using-superpowers/SKILL.md`
  - `docs/prd.md`
  - `docs/spec.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/runs/20260519-0834-serverless-dev-spec-recommendation.md`
- External docs consulted:
  - Context7 `/clerk/clerk-docs`
  - Context7 `/supabase/supabase`
  - Supabase MCP docs search for Auth, Next.js SSR, and RLS
  - Supabase changelog search for auth/database changes
- Extracted requirements:
  - TALKPIK AI needs learner profile, plan, language, goals, learning progress, writing drafts, feedback, subscriptions, admin user management, and AI tutor/problem generation surfaces.
  - The current frontend target stack includes React, TypeScript, Zustand, and Ant Design.
  - The earlier serverless recommendation selected Next.js, Supabase/Postgres, and Vercel AI SDK as the baseline.
  - User clarified that problem generation and AI-related work will later be coordinated with another department.
- Doc conflicts: none.
- Untouched relevant docs and reason:
  - IA, sitemap, flow, and Ant Design subdocs were not needed because this is an auth/backend boundary recommendation, not route or UI implementation.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-19 08:41 | Keep AI/problem generation behind internal service contracts rather than coupling early UI/backend code to model logic. | Another department will collaborate later; the main app should store requests/results and enforce auth/quotas while AI implementation remains replaceable. | User clarification, PRD |
| 2026-05-19 08:41 | Recommend Supabase Auth as the default login provider for this project. | The product is data/RLS-heavy and already favors Supabase as the serverless backend; one identity source simplifies policies and user-owned learning data. | Supabase docs, PRD |
| 2026-05-19 08:41 | Reconsider Clerk only if B2B organization management, polished hosted auth UX, or complex SSO becomes a near-term requirement. | Clerk has strong user-management UX and Supabase integration, but it adds a second identity plane that must be mapped into Supabase authorization. | Clerk docs |

## Active Files

- Files expected to change:
  - `docs/ai-workflow/runs/20260519-0841-auth-ai-boundary-recommendation.md`
- Files inspected:
  - `.codex/skills/using-superpowers/SKILL.md`
  - `docs/prd.md`
  - `docs/spec.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/runs/20260519-0834-serverless-dev-spec-recommendation.md`
- Files changed:
  - `docs/ai-workflow/runs/20260519-0841-auth-ai-boundary-recommendation.md`
- Files explicitly not to touch:
  - App source files, PRD, spec, and schema files.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| none | none | No child agents used. | not applicable | Main session researched and synthesized directly. |

## Verification State

- Required checks:
  - Confirm relevant project docs were read.
  - Confirm official/current auth docs were consulted.
  - Confirm no implementation was performed.
- Checks run:
  - Local file reads.
  - Context7 official documentation queries.
  - Supabase MCP docs search.
  - Supabase changelog web search.
- Latest results:
  - Recommendation is grounded in project requirements and current docs.
- Known failures:
  - None for the advisory task.
- Skipped checks and reason:
  - Tests/build are not applicable because this is advisory/spec work only.

## Fallback State

- Normal path blocked: none.
- Failure class: none.
- Fallback used: none.
- Evidence collected: project docs plus current official docs.
- Completion allowed: yes.
- Remaining fallback risk: pricing and enterprise feature limits should be rechecked before purchase or production launch.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes; no behavior implemented.
- Child result packets integrated: not applicable.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks:
  - Final auth provider choice should be written into `docs/development-spec.md` before implementation starts.
  - If another department owns AI services, API contracts and ownership boundaries must be documented before AI integration work begins.
- Assumptions:
  - Serverless remains the target architecture.
  - The main app will own learner accounts, progress data, subscriptions, and admin access.
- Follow-up needed:
  - Add an "Auth and AI Service Boundary" section to the future development spec.
