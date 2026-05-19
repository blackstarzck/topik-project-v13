---
name: talkpik-orchestrator
description: Use when starting any TALKPIK implementation, refactor, bug fix, UI, backend, deployment, or quality task so the agent routes through project-local docs and skills before editing.
---

# TALKPIK Orchestrator

This is the project-local entry skill for Codex and Claude. It keeps both agents on the same workflow regardless of globally installed skills.

## Core Rule

Project docs are the source of truth. Host-global skills are advisory only and never override this repository.

## Skill Layering

Use project skills as guardrails before practical skills:

1. `docs/spec.md` and active project docs.
2. `talkpik-*` guardrail skills.
3. Project-local practical development skills.
4. Model general knowledge or host-global advisory skills.

Practical skills are advisory. If they suggest shadcn, Redux, Prisma/Drizzle,
Firebase, global installs, exposing secrets, production side effects, or
bypassing project docs, reject that path unless an approved stack-change
decision exists.

## Required Start

1. Read `docs/agent-index.md`.
2. Read `docs/spec.md`.
3. Classify the user goal with the routing table in `docs/agent-index.md`.
4. Read only the required active docs for that goal.
5. Record `Docs consulted`, extracted requirements, doc conflicts, untouched relevant docs, and context ledger status in the plan or final report.

## Route To Project Skills

| Work type | Required project skill |
| --- | --- |
| Next.js setup, app structure, package scripts, framework bootstrap | `talkpik-next-bootstrap` |
| Ant Design, Tailwind, theme, layout, component styling | `talkpik-ui-system` |
| React state, forms, validation, server/client data ownership | `talkpik-state-data` |
| Supabase Auth, Postgres, RLS, Storage, SSR clients, env security | `talkpik-supabase-boundary` |
| Completion checks, tests, review, QA, report evidence | `talkpik-quality-gate` |

Use more than one project skill when the task crosses boundaries. Keep the order from product docs to implementation docs to verification.

## Route To Practical Skills

Use these only after the applicable project skill above:

| Work type | Practical skill |
| --- | --- |
| Next.js and React implementation patterns | `next-best-practices`, `vercel-react-best-practices`, or `vercel-composition-patterns` |
| Next.js Cache Components, PPR, or cache behavior | `next-cache-components` |
| Next.js upgrade work | `next-upgrade` only with approved upgrade scope |
| Ant Design implementation | `ant-design` |
| Supabase or Postgres implementation details | `supabase` or `supabase-postgres-best-practices` |
| React Hook Form or Zod implementation details | `react-hook-form-zod` |
| Unit or component test implementation | `vitest-testing` |
| Local browser QA | `playwright-skill` only when constrained local browser automation is appropriate |
| Vercel deployment or CLI work | `deploy-to-vercel` or `vercel-cli-with-tokens` only with explicit deployment scope |

## Context Ledger

Create or update a ledger under `docs/ai-workflow/runs/` when required by `docs/agent-index.md` or `docs/ai-development-workflow.md`. Workflow-governing skill changes, implementation work, UI, route, auth, database, deployment, or AI-service boundary work require a ledger.

## Stop Conditions

Stop before implementation when:

- active docs conflict with the user request,
- the user asks for net-new product scope not covered by active docs,
- secret exposure or authorization uncertainty exists,
- a destructive or irreversible action is required.

## Final Report

Use `docs/ai-workflow/report-template.md` for non-trivial work. Include changed files, docs consulted, workflow gates used, verification run, skipped checks, git publication decision, and remaining risk.
