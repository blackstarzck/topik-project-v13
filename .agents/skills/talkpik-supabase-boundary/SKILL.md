---
name: talkpik-supabase-boundary
description: Use when working on TALKPIK Supabase Auth, Postgres schema, RLS policies, Storage, server/client Supabase clients, profile data, admin roles, migrations, or database security.
---

# TALKPIK Supabase Boundary

Use this skill for any Supabase or database-affecting work.

## Required Docs

Read these before editing:

1. `docs/spec.md`
2. `docs/development/backend-auth.md`
3. Relevant product, page, or flow docs for the data being changed

## Security Rules

- Never expose `service_role` or other secret keys to browser-visible code.
- Browser-visible Supabase variables are publishable configuration only.
- Enable RLS on every table in exposed schemas.
- Write policies that match the actual access model; do not default every table to the same policy.
- Do not use user-editable metadata for authorization decisions.
- Keep privileged SQL functions out of exposed schemas.
- Treat admin-role behavior as security-sensitive and verify it explicitly.

## Client Boundary

- Keep browser clients, server clients, and admin/server-only clients separate.
- Initialize server-only clients lazily when runtime environment values are required.
- Do not import server-only helpers into client components.
- Keep auth/session reads aligned with Next.js server/client boundaries.

## Schema And Migration Rules

1. Draft schema changes from documented product behavior.
2. Include RLS and indexes with table changes.
3. Prefer explicit migrations once the design is settled.
4. Verify policy behavior with representative authenticated and unauthenticated cases.
5. Record any degraded verification path in the ledger and final report.

## Completion Evidence

Report changed tables, policies, storage buckets, auth assumptions, verification commands, and remaining security risk.
