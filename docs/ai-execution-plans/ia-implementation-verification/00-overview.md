# IA Implementation Verification - Overview

> Part of [IA Implementation Verification](./README.md). Goal, current baseline, scope, and execution roles.

Use this file directly only when your task matches the summary above.


> For agentic workers: execute this plan task by task. Use checkbox status for tracking. Keep the procedure document at `docs/ai-workflow/ia-page-implementation-verification.md` as the policy source.

**Goal:** turn the IA verification procedure into a repeatable, script-backed execution flow that proves whether all current IA pages, hosted surfaces, and route handlers are implemented well enough.

**Architecture:** use a script-backed, manifest-driven, run-isolated, multi-agent audit. First derive the 34 IA entries from docs, then require document-read receipts, then run static route/code checks, then create or verify the Supabase seed-data preconditions needed by data-backed routes, then run browser checks, hosted-surface checks, and security/navigation checks, then freeze an evidence bundle, then dispatch bounded IA review agents by IA shard, then run an AI-first UX/UI review, then delegate judgment-sensitive items to an independent GPT-5.5 adjudicator, then merge every script-readable result into one IA report. Seed data proves test preconditions only; it never proves page behavior or final `PASS` by itself. The final `PASS` label is computed and validated by scripts; prose-only notes or child-agent recommendations cannot override script evidence.

**Tech Stack:** Node.js scripts, JSON schemas, Vitest, Playwright, Next.js App Router, Supabase auth state fixtures, Supabase seed-data evidence for dev/preview-only audit rows, agent task packets, agent result packets, AI UX review packets, GPT-5.5 adjudication packets, Markdown reports, and machine-readable JSON audit results.

---

## 1. Current Baseline (2026-06-01)

- `docs/Wireframe/README.md` currently lists 34 IA folders.
- `docs/sitemap.md` is the route-table authority. Any remaining 32-screen prose
  is a `DOC-GAP`, not an implementation failure by itself.
- The repository now has `package.json`, `src/`, IA audit package scripts,
  `tests/e2e/auth-state/{role}.json`, `src/app/auth/sign-out/route.ts`,
  `tests/e2e/coverage/ia-catalog.ts`, hosted/security/auth E2E specs, and
  browser/hosted/security result-builder scripts.
- Do not reuse older baseline claims that hosted surfaces, `X-11`/`X-12`,
  `/auth/sign-out`, auth-state files, or the IA catalog are absent without
  rechecking the current tree.
- Current automation gaps remain:
  - the seed verifier is narrower than this full plan, so seed evidence can
    support only the scenarios it actually emits;
  - the final validator currently enforces a subset of this written contract, so
    validator `PASS` alone is not enough for full IA audit `PASS` until the
    validator catches up;
  - the current `evidenceBundleId` implementation is weaker than the canonical
    row-hash/freeze contract defined in this plan;
  - helper scripts that hardcode old run ids are historical utilities only, not
    canonical collectors for a new IA audit run.
- This split plan remains the future-state audit contract. When current
  automation is weaker than the contract, record an automation gap or `BLOCKED`
  result rather than silently lowering the evidence requirement.

## 2. Scope

### In Scope

- Build a repeatable IA verification process for all 34 IA entries.
- Add script-backed gates for every phase.
- Require machine-readable JSON evidence before any final `PASS`.
- Require document-read receipts so agents cannot pass an IA item without recording the active docs they used.
- Include page routes, hosted modals, modal states, toast states, and auth route handlers.
- Separate automated evidence, AI UX review evidence, and independent GPT-5.5 adjudication evidence.
- Use bounded multi-agent review lanes for independent IA shards.
- Require task packets and result packets for every delegated IA review.
- Cover planning, UX/UI, development, data/security, operations, and policy checks.
- Cover external entry scenarios such as direct URL, browser back, refresh, logout, invalid id, malformed id, and wrong-owner id.
- Create or verify Supabase seed-data preconditions for protected, admin,
  owner-id, hosted-surface, empty/error/success, and RLS-sensitive scenarios
  before those scenarios can support final evidence.
- Produce one final report that labels every IA item as `PASS`, `PARTIAL`, `FAIL`, `DEFERRED`, `DOC-GAP`, or `BLOCKED`.

### Out Of Scope

- Fixing product defects found during the audit.
- Changing product scope, billing scope, notification transport, or policy decisions.
- Treating legacy-only routes as current implementation targets.
- Calling a page complete only because the URL opens or returns a non-500 response.
- Letting handwritten Markdown override script-readable audit evidence.
- Letting a child agent's `PASS` recommendation become the final `PASS` label without coordinator merge and script validation.

## 3. Execution Roles

- **Coordinator:** owns source priority, run order, multi-agent dispatch, task packets, result packet integration, result labels, final report, and unresolved risk calls.
- **Planning reviewer:** checks PRD, sitemap, IA docs, and flow alignment.
- **Automation owner:** owns Node/Vitest/Playwright checks, script gates, JSON schemas, result merging, final report validation, and machine-readable outputs.
- **Audit flow monitor:** watches the coordinator's run order, collector attempts, phase transitions, evidence/prose alignment, and premature `PASS` or `BLOCKED` decisions.
- **IA shard reviewer:** owns one assigned IA shard, reads only the assigned docs/evidence, writes a result packet, and recommends but does not finalize labels.
- **Reconciliation reviewer:** samples high-risk or disputed IA items after shard review and checks whether child-agent results conflict with JSON evidence.
- **AI UX reviewer:** owns the first-pass IA-by-IA UX readiness review using `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`.
- **GPT-5.5 UX/UI adjudicator:** owns delegated final judgment for visual hierarchy, natural language, mobile readability, keyboard/focus feel, modal behavior, and policy-sensitive copy after AI-first review flags the judgment questions.
- **Security/data reviewer:** owns auth, role, owner, route handler, session, logout, raw error, RLS, and data exposure checks.
- **Operations/policy reviewer:** owns failure recovery, logging expectations, cooldowns, deferred billing, notification transport, and copy overpromising checks.

One person may hold multiple roles, but the final report must keep evidence separated by role area.
