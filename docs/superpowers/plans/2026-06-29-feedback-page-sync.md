# Feedback Page Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 53/54 long-form feedback pages use the same report header and overview layout as 51/52 while preserving long-form scoring labels and detail panels.

**Architecture:** Keep the existing `FeedbackPageContent` as the single feedback renderer, but replace the implicit short-answer-only report condition with an explicit report overview mode that both short and long routes can enable. Keep type-specific differences in props and translation keys rather than duplicating a long-form report component.

**Tech Stack:** Next.js App Router, React, TypeScript, Ant Design, Tailwind utility classes, next-intl, Vitest, Playwright.

---

### Task 1: Lock Long-Form Report Layout Expectations

**Files:**
- Modify: `tests/components/feedback/FeedbackChrome.test.tsx`
- Modify: `tests/components/app/WorkspaceShell.test.tsx`
- Modify: `tests/e2e/screens/long-feedback.spec.ts`

- [ ] Add a component test proving `FeedbackPageContent` renders `feedback-page-header`, `feedback-report-overview`, and header-only actions for a question 53 submission.
- [ ] Add a component test proving a question 54 submission uses long-form score criteria copy and does not show the short-answer "blank score" label.
- [ ] Add a shell test proving `/writing/feedback/long/:id` gets `app-workspace-content--feedback-flush`.
- [ ] Update the long-feedback e2e expectation from legacy `feedback-summary` statistic/meta tags to the shared report overview test IDs.
- [ ] Run `pnpm vitest run tests/components/feedback/FeedbackChrome.test.tsx tests/components/app/WorkspaceShell.test.tsx` and verify the new tests fail before production changes.

### Task 2: Promote Report Overview to a Shared Feedback Layout

**Files:**
- Modify: `src/components/feedback/FeedbackPageContent.tsx`
- Modify: `src/components/feedback/FeedbackReportOverview.tsx`
- Modify: `src/app/(workspace)/writing/feedback/long/[id]/page.tsx`
- Modify: `src/components/app/WorkspaceShell.tsx`

- [ ] Add explicit `showReportOverview` and `reportVariant` props to `FeedbackPageContent`.
- [ ] Use the shared `ReportPageHeader` whenever `showReportOverview` is true.
- [ ] Keep `NextActionBar` hidden when the header action group is rendered so actions appear once.
- [ ] Pass `showReportOverview` and `reportVariant="long-form"` from the long feedback route.
- [ ] Remove the route-level `WorkspaceBody` wrapper around long feedback so shared page shell spacing is owned by `FeedbackPageContent`.
- [ ] Include long feedback routes in `WorkspaceShell` feedback flush content handling.

### Task 3: Add Type-Specific Report Labels

**Files:**
- Modify: `src/components/feedback/FeedbackReportOverview.tsx`
- Modify: `messages/ko.json`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] Replace the fixed report `criteriaTitle`, `criteriaEmpty`, and `scoreSummaryFallback` lookups with variant-aware keys.
- [ ] Keep short-answer copy as "빈칸별 점수" for 51/52.
- [ ] Add long-form copy as "영역별 점수" for 53/54.
- [ ] Preserve existing dimension labels and trait score fallback behavior.

### Task 4: Verify and Review

**Files:**
- Read: `docs/Wireframe/14-E-01-short-answer-feedback/functional-spec.md`
- Read: `docs/Wireframe/15-E-02-long-form-feedback/functional-spec.md`
- Test: `tests/components/feedback/FeedbackChrome.test.tsx`
- Test: `tests/components/app/WorkspaceShell.test.tsx`
- Test: `tests/e2e/screens/short-feedback.spec.ts`
- Test: `tests/e2e/screens/long-feedback.spec.ts`

- [ ] Run `pnpm vitest run tests/components/feedback/FeedbackChrome.test.tsx tests/components/app/WorkspaceShell.test.tsx`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run targeted Playwright feedback specs when Supabase e2e credentials are available; otherwise report that these specs were skipped by their env guard.
- [ ] Confirm `git status --short --branch` shows only this task's files.
