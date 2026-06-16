# Testing

TALKPIK AI uses **Vitest** for unit/integration tests and **Playwright** for end-to-end browser tests (introduced incrementally per phase).

## Commands

```bash
pnpm test           # Vitest, headless. Unit + mock-based integration. Default run.
pnpm test:watch     # Vitest watch mode.
pnpm test:e2e       # Playwright (introduced in later phases as routes ship).
pnpm format         # Prettier check.
```

## Supabase-dependent integration tests

A small number of integration tests require a running **Supabase local stack** (docker-based) and the live schema applied. They are **skipped by default** so `pnpm test` stays green on machines without docker.

Affected files:
- `tests/integration/profile-trigger.test.ts` — verifies the `on_auth_user_created` trigger added in `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql`.
- `tests/integration/rls-smoke.test.ts` — verifies anonymous read blocking and user-A/user-B row isolation under RLS.

### Enabling them locally

Prerequisites: Docker Desktop (or compatible) and the Supabase CLI on PATH (`pnpm dlx supabase --version`).

```bash
# 1. Start the local stack (first run pulls images).
pnpm dlx supabase start

# 2. Apply migrations to a clean DB.
pnpm dlx supabase db reset

# 3. Run the gated tests. The env var unlocks the describe.skipIf gates.
pnpm test:supabase:local
```

### How they are gated

Each Supabase-dependent test wraps its `describe` in `describe.skipIf(process.env.SUPABASE_LOCAL_STACK !== "1", ...)`. Without the env var, vitest reports them as `skipped` (not failed). With `SUPABASE_LOCAL_STACK=1`, they execute against the local stack listening on `http://127.0.0.1:54321` and use the publishable anon key Supabase CLI prints after `supabase start`.

Put the local URL and anon key in `.env.test.local` (this file is git-ignored):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<value printed by `supabase start`>
```

> **Note**: this HTTP URL is **only** for the SUPABASE_LOCAL_STACK-gated tests, which call `createClient(url, anonKey)` directly and bypass `getPublicEnv()`. The app's own runtime env validator (`src/lib/supabase/env.ts`) rejects any non-HTTPS URL — do not point `NEXT_PUBLIC_SUPABASE_URL` at `http://127.0.0.1:54321` in `.env.local` for normal `pnpm dev`; use the project's HTTPS URL there.

### CI

CI does **not** run these tests by default — Supabase local stack inside GitHub Actions would slow every PR. Run them locally before any PR that touches `supabase/migrations/*.sql` or the auth/RLS code path.

## Test layout

```
tests/
  lib/
    supabase/env.test.ts             # zod env validation
    auth/session.test.ts             # getCurrentUser / requireUser
    auth/profile.test.ts             # bootstrapProfile
    auth/profile-getCurrentProfile.test.ts  # getCurrentProfile / requireRole
  middleware/middleware.test.ts      # proxy.ts (renamed from middleware.ts in cleanup PR)
  integration/
    route-matrix.test.ts             # PUBLIC_PATHS/PROTECTED_ROUTE_CASES × anon/auth
    profile-trigger.test.ts          # SUPABASE_LOCAL_STACK gated
    rls-smoke.test.ts                # SUPABASE_LOCAL_STACK gated
```

Admin UI routes are intentionally absent from this repository. Admin-role
preservation infrastructure is covered through route/RLS smoke tests and
Supabase migration review, not an active admin page matrix.
