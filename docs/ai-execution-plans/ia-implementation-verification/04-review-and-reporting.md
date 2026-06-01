# IA Implementation Verification - AI Review, GPT-5.5 Adjudication, And Report Assembly

> Part of [IA Implementation Verification](./README.md). Phase 5 and Phase 6 review, merge, final label, and validator rules.

Use this file directly only when your task matches the summary above.

## 11. Phase 5 - AI-First UX/UI Review And GPT-5.5 Adjudication

Phase 5 starts with AI because AI can cheaply scan all IA items for obvious
readiness gaps. Judgment-sensitive findings then go to an independent GPT-5.5
adjudicator rather than a person-review gate. The adjudicator must be a separate
session or child agent from the first-pass AI reviewer and shard reviewers, so it
can challenge the first-pass result with fresh context.

Use `docs/ai-workflow/ia-ai-first-ux-review-checklist.md` as the Phase 5
standard.

- [ ] **Step 5.0: Dispatch IA review agents**

  Before AI UX review starts, the coordinator reads
  `agent-dispatch-plan.json`, verifies that every required evidence input is
  present or explicitly `BLOCKED`, and prepares task packets under
  `<auditDir>/agent-packets/tasks/`.

  Default execution:

  - dispatch one child agent per IA shard,
  - keep concurrent child agents at six or fewer,
  - keep each child agent read/write scope bounded to its shard,
  - tell each child agent to recommend labels only,
  - require each child agent to return a result packet in its final response so
    the coordinator can import it under `<auditDir>/agent-packets/results/`,
  - require each delegated shard to return machine-readable IA result JSON,
  - record packet paths in the central context ledger before continuing.

  If the implementation run is done by one person without child agents, keep the
  same shard boundaries and fill `agent-integration-results.json` with
  `delegationMode: "single-session"` so the final validator can still check
  that every IA item was reviewed by shard. Single-session rows must still use
  the same IA result JSON schema as delegated rows, except child-agent
  provenance fields are marked `not-applicable`.

- [ ] **Step 5.1: Prepare the AI UX review packet**

  For every IA item, gather:

  - IA code and screen name,
  - route or host route,
  - route type,
  - audience,
  - matching `docs/Wireframe/*/description.md`,
  - `wireframe.png` when present,
  - source anchors under `src/app/**`, `src/components/**`, and `src/lib/routes.ts`,
  - Phase 1 static result,
  - Phase 1.5 seed result or seed blocker when a scenario depends on database
    rows,
  - Phase 2 browser screenshots for 360, 768, and 1280 widths,
  - Phase 3 hosted-surface evidence when applicable,
  - Phase 4 security/navigation evidence when applicable,
  - Phase 2 to Phase 4 rendered UX evidence bundle,
  - shard id,
  - task packet path,
  - result packet path or single-session review row,
  - IA result JSON row or valid unavailable reason.

  Do not start AI review for an IA item that has no matching IA document. Mark it
  `DOC-GAP`. Do not start AI review for a delegated IA item whose result packet
  or IA result JSON is missing, stale, or malformed. Mark it `BLOCKED`.

- [ ] **Step 5.2: Run the AI first-pass UX review**

  Create:

  - `<auditDir>/ai-ux-review.json`
  - `<auditDir>/ai-ux-review.md`

  For every IA item, record the review card shape defined in
  `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`.

  The Markdown card must be generated from, or traceable to, the matching JSON
  row. A Markdown-only AI review cannot contribute to final `PASS`.

  Required AI checks:

  - page job and first impression,
  - IA and wireframe fidelity,
  - user flow and navigation continuity,
  - direct URL, refresh, and browser back expectations,
  - human-AI behavior and user control,
  - status, loading, empty, and error states,
  - forms, labels, and instructions,
  - keyboard, focus, and modal behavior,
  - responsive and touch UX,
  - policy, trust, security, billing, notification, and deferred-scope copy.

  The AI reviewer must return:

  - result: `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, `DOC-GAP`, or `DEFERRED`,
  - confidence: `high`, `medium`, or `low`,
  - GPT-5.5 adjudication need: `ready`, `needs-adjudication`, or `not-ready`,
  - shard id,
  - agent recommendation when delegated,
  - coordinator integration decision,
  - document receipt id,
  - phase result ids used,
  - evidence used,
  - top gaps,
  - exact questions for the GPT-5.5 adjudicator,
  - missing screenshots or browser evidence.

- [ ] **Step 5.3: Apply AI no-pass rules**

  The AI review cannot mark an item `PASS` when:

  - no rendered screenshot or browser evidence exists,
  - only route existence or HTTP status was verified,
  - seed data is the only supporting evidence for rendered behavior,
  - a seed-dependent scenario has no valid `seed-results.json` row, `seedRunId`,
    or explicit seed blocker,
  - the matching IA `description.md` was not read,
  - a required shard result packet is missing,
  - a required IA result JSON row is missing, stale, or malformed,
  - `runId`, `sourceCommit`, or `evidenceBundleId` does not match the evidence
    bundle being merged,
  - a child-agent recommendation conflicts with JSON evidence and the coordinator has not resolved it,
  - a hosted modal was reviewed as a standalone component instead of through its host route,
  - modal trigger, focus entry, focus return, close, cancel, or `Esc` behavior is missing,
  - direct URL, browser back, auth, role, owner-id, or refresh evidence is required but absent,
  - deferred billing or notification copy implies live production behavior,
  - active docs conflict or omit the rule needed to judge the UX.

- [ ] **Step 5.4: Delegate judgment-sensitive items to GPT-5.5**

  Create or update:

  - `<auditDir>/manual-review.json`
  - `<auditDir>/manual-review.md`

  `manual-review.json` is a legacy-compatible filename used by the current merge
  scripts. In this plan it contains GPT-5.5 adjudication rows, not human review
  rows.

  Independent GPT-5.5 adjudication is required when:

  - AI confidence is `low` or `medium`,
  - AI result is `PARTIAL`, `FAIL`, `BLOCKED`, or `DOC-GAP`,
  - the IA item includes a modal, form, AI output, auth recovery, billing,
    notifications, admin action, or policy-sensitive copy,
  - the AI flags visual hierarchy, wording, tone, trust, mobile readability, or
    Korean copy naturalness as a judgment question.

  The GPT-5.5 adjudicator should not repeat every mechanical check. It should
  inspect the questions surfaced by the AI card, challenge unsupported
  assumptions, and record the final UX/UI and policy judgment.

  The GPT-5.5 adjudication JSON must include:

  - IA code,
  - AI UX review row id,
  - adjudicator model: `gpt-5.5`,
  - adjudicator role: `independent-gpt-5.5-adjudicator`,
  - source: `delegated-gpt-5.5-review`,
  - adjudication reference, such as a child-agent id, session id, result packet
    path, or signed review artifact id,
  - adjudicated timestamp,
  - adjudication status: `confirmed`, `rejected`, `needs-follow-up`, or
    `candidate-note-only`,
  - questions reviewed,
  - final UX/UI result,
  - policy or wording concerns,
  - accepted risk, if any,
  - status and blocking reasons.

  A Markdown note without a matching JSON row cannot unblock final `PASS`. A
  same-session AI note, `source: "agent-note"`, or first-pass reviewer note can
  record candidate questions, but it cannot satisfy required adjudication or
  unblock final `PASS`. A separate GPT-5.5 delegated review with the fields above
  can satisfy this gate.

  Operational protocol:

  1. Create `<auditDir>/gpt-5.5-adjudication-request.md` from AI UX questions and
     policy-sensitive items that require second-pass judgment.
  2. Write required-but-unconfirmed rows in `<auditDir>/manual-review.json` as
     `adjudication status: "candidate-note-only"` with `status: "BLOCKED"`.
  3. Dispatch a separate GPT-5.5 adjudicator with the request file, Phase 0.5 to
     Phase 4 evidence, the AI UX row, and the relevant screenshots.
  4. Import the adjudicator result into `<auditDir>/manual-review.json` and link
     the result packet or session id.
  5. Pause Phase 6 final `PASS` for affected rows until the GPT-5.5 adjudication
     row is recorded, linked, and imported.
  6. Record the owner, requested question, blocker, adjudicator model, and resume
     condition in `audit-flow-monitor.json`.
  7. If no GPT-5.5 adjudication is available, keep the affected final label
     `BLOCKED`, `PARTIAL`, `FAIL`, `DOC-GAP`, or `CONCERN_ACCEPTED` as
     appropriate. Do not emit final `PASS`.

- [ ] **Step 5.5: Check hierarchy, wireframe, keyboard, focus, and policy**

  The combined AI-first and GPT-5.5 adjudication notes must answer:

  - can the user identify the screen from the first heading,
  - does one primary CTA dominate,
  - do heading, explanation, content, and CTA follow task order,
  - are `Wireframe Number Map` items `present`, `superseded`, `missing`, or
    `unclear`,
  - does `Tab` order follow visual and task order,
  - is the focus indicator visible,
  - do modal focus entry and return work,
  - do loading, saving, submitting, and failure states use plain language,
  - do paywall, subscription, notification, auth, privacy, and account-policy
    copy respect active docs.

## 12. Phase 6 - Report Assembly

- [ ] **Step 6.1: Merge results**

  Combine:

  - `ia-manifest.json`,
  - `doc-receipts.json`,
  - `source-map-results.json`,
  - `static-results.json`,
  - `seed-plan.json`,
  - `seed-results.json`,
  - `audit-flow-monitor.json`,
  - `browser-results.json`,
  - `hosted-surface-results.json`,
  - `security-navigation-results.json`,
  - `agent-dispatch-plan.json`,
  - `agent-integration-results.json`,
  - `ai-ux-review.json`,
  - `manual-review.json` (GPT-5.5 adjudication rows).

  Run:

  ```powershell
  pnpm test:ia:merge -- --audit-dir $auditDir
  ```

  This script creates:

  - `<auditDir>/ia-implementation-audit.json`,
  - `<auditDir>/ia-implementation-audit.md`.

- [ ] **Step 6.2: Apply result labels**

  `scripts/merge-ia-audit-results.mjs` applies these rules:

  - `FAIL` beats `PARTIAL`.
  - `BLOCKED` blocks a final `PASS`.
  - `BLOCKED` for missing evidence is valid only when the matching collector
    attempt or impossible precondition appears in `audit-flow-monitor.json`.
  - missing or invalid document receipts block a final `PASS`.
  - missing required JSON rows block a final `PASS`.
  - missing delegated result packets block a final `PASS`.
  - child-agent recommendations do not become final labels until coordinator merge accepts them.
  - unresolved child-agent conflicts block a final `PASS`.
  - fixture-only evidence cannot become `PASS`.
  - seed-only evidence cannot become final `PASS`.
  - a seed-dependent IA item cannot receive final `PASS` without a matching
    `seed-results.json` row and `seedRunId`, or an explicit non-`PASS` seed
    blocker.
  - seed results from production or `unknown-treat-as-prod` targets block final
    `PASS`.
  - seed actors without matching `profiles` rows, role checks that use auth
    metadata instead of `profiles.app_role`, and missing owner, wrong-owner, or
    admin target ids block final `PASS`.
  - stale evidence, mixed `runId`s, or mismatched `sourceCommit` /
    `evidenceBundleId` blocks final `PASS`.
  - first-pass AI judgments cannot become final `PASS` when GPT-5.5
    adjudication is required.
  - GPT-5.5 adjudication cannot be auto-marked `PASS` without the matching
    evidence scope.
  - same-session AI notes, `source: agent-note`, or missing-model
    `manual-review.json` rows cannot satisfy required GPT-5.5 adjudication.
  - security/data blockers from cross-cutting evidence lanes override primary
    shard `PASS` recommendations.
  - `DEFERRED` applies only when active docs explicitly keep the behavior out of scope.
  - `DOC-GAP` applies when active docs conflict, omit the rule, or leave policy unclear.
  - Markdown notes can explain a result but cannot override a JSON blocking reason.

- [ ] **Step 6.3: Create final report**

  Create the final report through `scripts/merge-ia-audit-results.mjs`. Do not
  handwrite final labels.

  Required columns:

  - IA code,
  - screen name,
  - route or host route,
  - route type,
  - audience,
  - packs,
  - planning result,
  - AI UX result,
  - AI confidence,
  - GPT-5.5 adjudication,
  - final UX/UI result,
  - development result,
  - data/security result,
  - operations result,
  - policy result,
  - seed evidence,
  - QA evidence,
  - shard id,
  - agent recommendation,
  - coordinator decision,
  - final label,
  - top gaps,
  - next owner or reason.

  If the current merger emits legacy column names such as `humanConfirmation`,
  interpret them as GPT-5.5 adjudication fields until the scripts are renamed.

- [ ] **Step 6.4: Validate final audit report**

  Run:

  ```powershell
  pnpm test:ia:validate -- --audit-dir $auditDir
  ```

  Automation gap (2026-06-01): the current validator enforces only a subset of
  the rules below. Until the validator catches up, validator `PASS` is necessary
  but not sufficient for a full IA audit `PASS`; the coordinator must run this
  checklist explicitly or mark the run `BLOCKED` / `CONCERN_ACCEPTED` with the
  exact unsupported validator rule.

  `scripts/validate-ia-audit-report.mjs` must fail when:

  - `ia-implementation-audit.md` and `ia-implementation-audit.json` disagree,
  - an IA item has `PASS` without a valid document receipt,
  - an IA item has `PASS` without required browser/security/hosted-surface
    evidence,
  - an IA item has `PASS` while any phase result has unresolved
    `blockingReasons`,
  - an IA item or phase has `BLOCKED` for missing evidence without a matching
    collector attempt or impossible precondition in `audit-flow-monitor.json`,
  - `audit-flow-monitor.json` has a `FAIL` checkpoint that was not resolved or
    accepted with a coordinator reason,
  - AI confidence is `low` or `medium` and GPT-5.5 adjudication is missing,
  - a modal, form, AI output, auth, billing, notification, admin, or
    policy-sensitive item has no GPT-5.5 adjudication,
  - a delegated IA item has no result packet,
  - a delegated or single-session IA item has no valid IA result JSON row,
  - a child-agent result packet was not integrated into
    `agent-integration-results.json`,
  - a child-agent result packet has missing provenance, missing hash, stale
    `baseCommit`, or mismatched `sourceRunId`,
  - a child-agent recommendation conflicts with JSON evidence and has no
    coordinator decision,
  - mixed `runId`, stale `sourceCommit`, or mismatched `evidenceBundleId` feeds
    a final `PASS`,
  - a seed-dependent IA item has `PASS` without a valid `seed-results.json` row,
    `seedRunId`, and matching seed precondition,
  - a seed row is treated as behavior evidence instead of setup evidence,
  - seed data was written against production or an unknown target classified as
    production,
  - a seeded actor lacks a matching `profiles` row,
  - role evidence is derived from auth metadata instead of `profiles.app_role`,
  - owner, wrong-owner, admin target, published/private, empty, error, or
    success-state ids required by the seed plan are missing,
  - seed results are stale against the browser, hosted-surface, or
    security/navigation evidence bundle,
  - an auth-related IA item, auth route handler, login/session/logout check, or
    Public/Auth shard result has `PASS` without a valid
    `docs/development/auth-overview.md` receipt,
  - an auth/RLS/backend-sensitive item has `PASS` without a valid
    `docs/development/backend-auth.md` receipt,
  - required GPT-5.5 adjudication is satisfied only by a same-session AI note,
    missing-model row, or `source: agent-note` row,
  - legacy docs are used as authority over active docs,
  - final labels were edited manually without matching JSON evidence.
