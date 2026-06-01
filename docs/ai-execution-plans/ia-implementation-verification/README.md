# IA Implementation Verification Execution Plan

This folder is the split execution plan for verifying whether all current IA pages, hosted surfaces, and route handlers are implemented well enough.

Use this README as the route map. Read only the files that match the work you are doing, then record those exact files in `Docs consulted`.

## Quick Start

| If you need to... | Read |
| --- | --- |
| Understand what this plan is and what counts as in scope | [00-overview.md](./00-overview.md) |
| Build or validate audit artifacts, JSON rows, monitor checkpoints, or agent dispatch | [01-artifacts-and-contract.md](./01-artifacts-and-contract.md) |
| Prepare the audit run, document receipts, static route checks, or Supabase seed-data preconditions | [02-setup-static-seed.md](./02-setup-static-seed.md) |
| Work on browser, hosted-surface, auth, session, owner, admin, RLS, or route-handler evidence | [03-browser-hosted-security.md](./03-browser-hosted-security.md) |
| Run AI shard review, AI-first UX review, GPT-5.5 adjudication, merge, or final validation | [04-review-and-reporting.md](./04-review-and-reporting.md) |
| Check exact execution order, completion gate, source docs, known conflicts, related ledgers, or glossary | [05-execution-order-and-reference.md](./05-execution-order-and-reference.md) |

## What This Plan Covers

This plan tells Codex, Claude, or another AI agent how to run a script-backed IA implementation audit. It covers the 34 IA entries, hosted surfaces, route handlers, Supabase seed-data preconditions, browser evidence, security evidence, AI review, independent GPT-5.5 adjudication, and final JSON-validated report assembly.

Seed data in this plan is only a precondition for testing. It cannot prove page behavior or final `PASS` by itself.

## Reading Rule For Agents

1. Start here.
2. Pick the smallest matching file from the table.
3. Read adjacent files only when a task crosses phase boundaries.
4. Keep the old compatibility path, [docs/ai-workflow/ia-implementation-verification-execution-plan.md](../../ai-workflow/ia-implementation-verification-execution-plan.md), as a pointer only.
