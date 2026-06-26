# Focus Page Global Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the desktop top-right global profile/notification floating actions on focus-first learning pages while preserving them on normal workspace pages.

**Architecture:** Keep the policy in `WorkspaceShell`, where workspace chrome is already route-aware. Do not change page components or SOT docs. Add route-level tests before production changes, then capture visual evidence for each affected page group.

**Tech Stack:** Next.js App Router, React, Vitest + Testing Library, Playwright screenshots.

---

### Task 1: Route Policy Test

**Files:**
- Modify: `tests/components/app/WorkspaceShell.test.tsx`
- Modify: `src/components/app/WorkspaceShell.tsx`

- [ ] **Step 1: Write failing tests**

Add tests proving that `.app-notification-corner` is absent on:
- `/writing/short-answer-writing-51`
- `/writing/feedback/short/submission-1`
- `/writing/feedback/long/submission-1`
- `/writing/reports/report-1/compare`

Also keep a dashboard assertion proving the floating actions remain on `/dashboard`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
pnpm vitest run tests/components/app/WorkspaceShell.test.tsx --testNamePattern "focus"
```

Expected: at least feedback or comparison cases fail because the current shell still renders `.app-notification-corner`.

- [ ] **Step 3: Implement minimal route policy**

In `WorkspaceShell`, add a `hidesGlobalFloatingActions` boolean that includes existing full-chrome hidden routes plus feedback detail routes and comparison report routes. Use that boolean only for the desktop floating corner and mobile actions as appropriate, without removing the sidebar from feedback/comparison pages.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```powershell
pnpm vitest run tests/components/app/WorkspaceShell.test.tsx --testNamePattern "focus"
```

Expected: focused tests pass.

### Task 2: Visual Evidence

**Files:**
- Add screenshots under `docs/qa/reports/2026-06-26-focus-page-global-actions/`

- [ ] **Step 1: Start local app**

Run a local dev server on an available port.

- [ ] **Step 2: Capture each affected page group**

Capture evidence screenshots for:
- D-01 writing page
- D-M2 analysis/loading state
- E-01 short feedback
- E-02 long feedback
- R-01 comparison report

- [ ] **Step 3: Run verification**

Run:

```powershell
pnpm vitest run tests/components/app/WorkspaceShell.test.tsx
pnpm lint
pnpm typecheck
```

If Playwright route-specific e2e can run with available env, run the focused affected specs or document the skipped credential gate.

### Critical Review Notes

- Do not hide the sidebar on feedback or comparison pages unless explicitly required.
- Do not touch notification data fetching or profile menu logic.
- Do not change active SOT documents.
- Verify screenshots show the affected page content and no top-right floating profile/notification pill.
