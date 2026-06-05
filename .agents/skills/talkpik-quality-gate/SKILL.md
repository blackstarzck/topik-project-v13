---
name: talkpik-quality-gate
description: Use before claiming TALKPIK work complete, when verifying implementation, reviewing code, checking tests, validating UI flows, or preparing final reports.
---

# TALKPIK Quality Gate

This skill turns "done" into evidence.

## Required Docs

Read these before final verification:

1. The run ledger when one is required
2. The active docs that governed the change

## Verification Order

1. Re-read the accepted scope and changed files.
2. Confirm docs consulted still match the implementation.
3. Run focused tests for the changed behavior when a runnable test surface exists.
4. Run proportionate broader checks: lint, typecheck, test, build.
5. For UI or user-facing flows, run browser or visual QA and check responsive layout.
6. For Supabase or auth changes, verify RLS, secrets, and access boundaries.
7. For AI or deployment changes, verify server boundary, env vars, and runtime behavior.

## Review Gate

Every code change needs review. If an independent reviewer or host-specific review skill is unavailable, run a self-review and record degraded mode:

- Scope matches the accepted task.
- No unrelated refactors were introduced.
- Tests or documented equivalent verification cover the change.
- Error, empty, loading, success, and disabled states are considered.
- Security-sensitive paths fail closed.

## Final Report

For non-trivial work, include:

- files changed,
- docs consulted and extracted requirements,
- context ledger path or allowed exception,
- workflow gates used,
- commands/checks run and results,
- skipped checks and why,
- git publication decision,
- remaining risks.

Do not claim completion when verification failed, output was not read, or remaining risk is unknown.
