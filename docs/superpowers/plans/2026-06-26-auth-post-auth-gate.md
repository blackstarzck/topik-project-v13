# Auth Post-Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all email confirmation, confirmation resend, magic-link, and OAuth success paths through `/auth/post-auth`, then use `/auth/consent` as the single page for missing profile fields and required legal consent before onboarding.

**Architecture:** Reuse the existing `/auth/post-auth` and `/auth/consent` gate. Keep the change narrow by updating only auth redirect URL construction and tests that assert those URLs. Do not modify active SOT files; record the SOT conflict in `docs/sot-change-proposals/2026-06-26-auth-post-auth-gate.md`.

**Tech Stack:** Next.js App Router, React, Supabase Auth, Vitest, Playwright.

---

## Agent Debate Summary

- Planner recommendation: keep `/auth/post-auth` as the single gate, reuse existing consent page/action, and update only auth redirect sources plus tests.
- Critic concerns: email confirmation has three separate resend/sign-up call sites; magic link currently defaults to `/dashboard`; active SOT still says email confirmation goes directly to onboarding; Supabase redirect allowlist must include the callback origin.
- Test-engineer recommendation: change redirect expectations first, then implementation; add screenshot capture to `consent-completion` e2e.

## Files

- Modify: `src/components/auth/SignUpForm.tsx`
- Modify: `src/components/auth/VerifyEmailCard.tsx`
- Modify: `src/components/auth/AuthErrorCard.tsx`
- Modify: `src/components/auth/LoginForm.tsx`
- Modify: `tests/components/auth/SignUpForm.test.tsx`
- Modify: `tests/components/auth/VerifyEmailCard.test.tsx`
- Modify: `tests/components/auth/AuthErrorCard.test.tsx`
- Modify: `tests/components/auth/LoginForm.test.tsx`
- Modify: `tests/e2e/flows/sign-up.spec.ts`
- Modify: `tests/e2e/screens/verify-email.spec.ts`
- Modify: `tests/e2e/screens/auth-error.spec.ts`
- Modify: `tests/e2e/flows/consent-completion.spec.ts`
- Create: `docs/sot-change-proposals/2026-06-26-auth-post-auth-gate.md`

## Task 1: Lock Redirect Expectations

- [ ] Update component tests so email sign-up and sign-up resend expect `https://talkpik.example.com/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up`.
- [ ] Update magic-link component test so default magic-link login expects `https://talkpik.example.com/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dlogin`.
- [ ] Update e2e tests so parsed `redirectTo.searchParams.get("next")` equals `/auth/post-auth?intent=sign-up` for email sign-up and resends.
- [ ] Run focused tests and verify they fail before source changes:

```powershell
pnpm vitest run tests/components/auth/SignUpForm.test.tsx tests/components/auth/VerifyEmailCard.test.tsx tests/components/auth/AuthErrorCard.test.tsx tests/components/auth/LoginForm.test.tsx
pnpm exec playwright test tests/e2e/flows/sign-up.spec.ts tests/e2e/screens/verify-email.spec.ts tests/e2e/screens/auth-error.spec.ts --project=desktop-1280 --no-deps
```

Expected before implementation: redirect URL expectations fail.

## Task 2: Route Email and Magic-Link Callbacks Through Post-Auth

- [ ] In `SignUpForm.tsx`, build `emailRedirectTo` with `/auth/callback?next=${encodeURIComponent("/auth/post-auth?intent=sign-up")}`.
- [ ] In `VerifyEmailCard.tsx`, use the same sign-up post-auth callback.
- [ ] In `AuthErrorCard.tsx`, use the same sign-up post-auth callback.
- [ ] In `LoginForm.tsx`, make magic-link `emailRedirectTo` use `/auth/post-auth?intent=login` instead of the final `nextTarget`.
- [ ] Keep password login and Google OAuth behavior otherwise unchanged.
- [ ] Run the focused component tests and fix any import/type issues.

## Task 3: Add Screenshot Evidence to Consent E2E

- [ ] In `tests/e2e/flows/consent-completion.spec.ts`, save a deterministic screenshot after the consent page renders required profile fields and two required documents.
- [ ] Save screenshots under `docs/qa/reports/auth-post-auth-gate/`.
- [ ] Keep the existing Supabase env skips so production safety and missing credential behavior remain intact.
- [ ] Run:

```powershell
pnpm exec playwright test tests/e2e/flows/consent-completion.spec.ts --project=desktop-1280 --no-deps
```

Expected with Supabase test env: screenshot file is written and tests pass. Expected without env: tests skip and no real consent screenshot can be produced.

## Task 4: Verify

- [ ] Run focused Vitest files.
- [ ] Run focused public auth e2e files with `--no-deps`.
- [ ] If Supabase e2e env vars are present, run `consent-completion.spec.ts` for desktop and mobile and confirm screenshot files.
- [ ] Run `pnpm lint` and `pnpm typecheck` if dependencies are available.
- [ ] Report any verification blocked by missing `node_modules` or missing Supabase env vars.

## Risk Controls

- Do not edit active SOT files in this change.
- Do not touch unrelated dirty files in the detached worktree.
- Do not change Supabase schema or RLS.
- Do not change password-login destination unless a separate product decision requests it.
- Report the Supabase redirect allowlist requirement in the final answer.
