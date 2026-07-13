# Recommendation Card Footer CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the `이어 풀기` CTA in secondary recommendation cards into the Ant Design Card footer so every card aligns its action at the same vertical position.

**Architecture:** Keep the existing `SecondaryRecommendationCard` content and link target unchanged. Pass the CTA as the shared `AppCard` `actions` prop, while preserving the existing full-height card wrapper and matching the compact card footer padding to the small-card body.

**Tech Stack:** Next.js App Router, React, TypeScript, Ant Design `Card.actions`, Vitest, Testing Library, Playwright.

---

### Task 1: Lock the footer CTA contract with a regression test

**Files:**
- Modify: `tests/components/practice/RecommendationsView.test.tsx`

- [x] **Step 1: Add a failing test**

Render a bundle with one primary and two secondary cards, select the secondary card for question 52, and assert its `이어 풀기` button is inside `.ant-card-actions` and not inside `.ant-card-body`.

- [x] **Step 2: Run the focused test and verify it fails for the current body placement**

Run: `pnpm vitest run tests/components/practice/RecommendationsView.test.tsx -t "places secondary recommendation CTAs in the card footer"`

Expected: FAIL because the current button is rendered in the secondary card body.

### Task 2: Move the CTA into `Card.actions`

**Files:**
- Modify: `src/components/practice/RecommendationItemCards.tsx:191-234`

- [x] **Step 1: Pass the CTA as the `AppCard` actions prop**

Keep the current `Link`, `href`, button label, arrow icon, and `block` prop, but move that JSX into `actions={[...]}` and remove the body wrapper that only existed for the CTA.

- [x] **Step 2: Run the focused test and verify it passes**

Run: `pnpm vitest run tests/components/practice/RecommendationsView.test.tsx -t "places secondary recommendation CTAs in the card footer"`

Expected: PASS.

### Task 3: Verify behavior and visual alignment

**Files:**
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/screens/recommendations-fallback-ui.spec.ts`

- [x] **Step 1: Run related component tests**

Run: `pnpm vitest run tests/components/practice/RecommendationsView.test.tsx`

- [x] **Step 2: Run lint, typecheck, and formatting checks for the change**

Run: `pnpm lint -- src/components/practice/RecommendationItemCards.tsx tests/components/practice/RecommendationsView.test.tsx` and `pnpm typecheck`.

- [x] **Step 3: Open the app in a browser and verify desktop/mobile layouts**

Use the authenticated test account if the route requires login, open `/practice/recommendations`, and verify the secondary cards' `이어 풀기` buttons all render in their Card footer/actions area with no horizontal overflow at desktop and mobile viewports.

- [x] **Step 4: Review the final diff and confirm no unrelated files changed**

Run: `git diff -- src/components/practice/RecommendationItemCards.tsx src/styles/global.css tests/components/practice/RecommendationsView.test.tsx tests/e2e/screens/recommendations-fallback-ui.spec.ts` and `git status --short`.

- [x] **Step 5: Run the scoped Playwright e2e**

Run: `pnpm exec playwright test tests/e2e/screens/recommendations-fallback-ui.spec.ts`.
