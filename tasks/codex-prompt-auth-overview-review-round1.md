# Cross-Model Review · Round 1
# `docs/development/auth-overview.md` — Auth Consolidated Reference

You are GPT-5.5 (Codex) acting as senior reviewer on a consolidated authentication reference document authored by Claude Opus 4.7 at the user's request. The document aggregates IA specs, user flow, code locations, and operational policies for TALKPIK AI's auth surface (signup, login, callback, error, verify-email, password reset).

## Document to review

**File:** `docs/development/auth-overview.md` (newly created, ~250 lines)

The doc has 11 sections:
1. Docs consulted
2. 한 줄 결론
3. 큰 그림 (Mermaid)
4. 화면 ↔ 라우트 ↔ 코드 매핑 (IA + helpers)
5. 흐름별 상세 (signup / login / reset / callback / error)
6. 인증 에러 사유 11종 매핑 표
7. 운영 정책 (cleanup, storage hardening, rate limit, session expiry, app_role)
8. 환경 변수 + Supabase Dashboard 체크리스트
9. 관리 포인트 (8 monitoring signals + 정기 점검)
10. 자주 묻는 운영 시나리오 (Q1-Q5)
11. 변경 시 함께 봐야 할 곳 + 빠른 디버깅 SQL

## Required reading (ground truth)

Read these IN FULL before scoring — your job is to verify the doc against the actual code and specs, not just opine.

**Code (live state, 2026-05-27):**
- `src/app/auth/callback/page.tsx` — server callback dispatcher
- `src/components/auth/CallbackFragmentFallback.tsx` — implicit-flow fragment fallback
- `src/app/auth/error/page.tsx` + `src/components/auth/AuthErrorCard.tsx`
- `src/app/auth/verify-email/page.tsx` + `src/components/auth/VerifyEmailCard.tsx`
- `src/app/sign-up/page.tsx` + `src/components/auth/SignUpForm.tsx`
- `src/app/login/page.tsx` + `src/components/auth/LoginForm.tsx`
- `src/app/password-reset/page.tsx` + `src/components/auth/PasswordResetRequestForm.tsx`
- `src/app/password-reset/confirm/page.tsx` + `src/components/auth/PasswordResetConfirmForm.tsx`
- `src/lib/auth/session.ts`, `profile.ts`, `roles.ts`, `admin-guard.ts`, `error-mapping.ts`, `redirect-url.ts`
- `src/proxy.ts` (middleware)
- `src/lib/routes.ts` (PUBLIC_PATHS)
- `.env.example`

**Migrations (auth-related):**
- `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql` (#17 — on_auth_user_created trigger)
- `supabase/migrations/20260520121400_profiles_protected_columns.sql` (#15 — app_role write protection)
- `supabase/migrations/20260526180000_cleanup_unconfirmed_users.sql` (#22 — cleanup function)
- `supabase/migrations/20260527110000_register_cleanup_cron.sql` (#23 — pg_cron schedule)
- `supabase/migrations/20260527113000_storage_email_confirmed_hardening.sql` (#24 — storage RLS)

**Specs:**
- `docs/IA/01-A-01-sign-up/description.md`, `02-A-02-login`, `28-X-06-password-reset`, `33-X-11-auth-error`, `34-X-12-auth-verify-email`
- `docs/flow/user-flow.md`
- `docs/development/backend-auth.md`

## Review dimensions

For each dimension below, give an explicit verdict (PASS / CONCERN / FAIL) with file:line citations. Cite exact line numbers in the doc-under-review when pointing at claims.

1. **Accuracy of code references** — Every code path mentioned (file, function name, behavior) must exist as described. Spot-check at least: PKCE callback dispatch order, `sanitizeNext` rules, `error-mapping.ts:REASON_CONTENT` table contents, `proxy.ts` session_expired logic, `profiles.app_role` protection trigger.

2. **Accuracy of operational policies** — cleanup retention (30 days), cron schedule (`0 4 * * *` UTC), SMTP rate limits (2/hour built-in, 30/hour project OTP, 60s same-user cooldown), storage email-confirmed hardening scope (which buckets/policies). Cross-check against migrations + Supabase official docs where applicable.

3. **Accuracy of the 11-reason table (§5)** — Each row's primary/secondary CTA, email field flag, countdown flag must match `REASON_CONTENT` in `src/lib/auth/error-mapping.ts`. Find any drift.

4. **Drift risk in "Single Source of Truth" matrix (§10)** — Are the listed update locations correct and complete? Anything missing? (e.g., when a `?reason=` is added, what besides `error-mapping.ts` + IA X-11 + this doc must also change — tests? user-flow.md?)

5. **Honesty about project state** — The doc opens by saying it consolidates "정본" (canonical) info. But `CLAUDE.md` declares the project pre-implementation. Is the doc honest about that mismatch? Are there any claims of behavior that don't actually exist yet?

6. **Vibe-coder readability vs technical accuracy tradeoff** — `CLAUDE.md` mandates 바이브 코더 tone for user-facing communication. This doc lives in `docs/development/` so engineering vocabulary is acceptable. Did Opus strike the right balance, or is it too jargon-heavy / too vague?

7. **Completeness — missing scenarios** — What auth scenarios exist in code or migrations but are NOT covered in the doc? Specifically check: email change flow (`type=email_change`), magic link expiry, OAuth provider errors (`?error_code` in query), CSRF / PKCE storage location, refresh token rotation behavior, what happens when `NEXT_PUBLIC_SITE_URL` mismatches Supabase Redirect URLs whitelist.

8. **Quick-debug SQL accuracy (§11)** — Are the three SQL snippets correct against the actual schema? (`private.cleanup_unconfirmed_users` signature, `cron.job` table columns, the `auth.users` ↔ `profiles` left join).

9. **Mermaid diagram fidelity (§2)** — Compare against `docs/flow/user-flow.md`'s diagram. The doc admits it's a "summary cut" — are there edges that ARE shown but contradict the full diagram?

10. **Cross-doc conflicts** — Any claim in `auth-overview.md` that contradicts `backend-auth.md`, IA `description.md` files, or actual code? Especially constraints like "ID 4-80자, PW 8-64자" in A-02 vs the actual `SignUpForm` validation (`min: 8`, no max stated).

## Output format

Open with a single verdict block:

```
VERDICT: PASS | CONCERN | FAIL
SUMMARY: <2-3 sentences>
```

Then for each dimension:

```
### <n>. <name>
Verdict: PASS | CONCERN | FAIL
Finding: <specific finding with file:line cites — both the doc-under-review and the ground-truth file>
Suggested fix: <if not PASS, exact text/edit. Be specific: "change line 87 from X to Y">
```

End with a "## Cross-cutting concerns" section for anything not fitting the 10 dimensions, and a "## Recommended next steps" section listing what (if anything) Opus should change before the doc is treated as stable.

## Discipline

- Cite both sides: the line in `docs/development/auth-overview.md` AND the ground-truth file:line that contradicts it.
- Don't manufacture concerns. If a section is fine, mark PASS.
- If a claim is *technically true but misleading* (e.g., "60일 sliding" — true default but configurable), flag as CONCERN, not FAIL.
- If you find a claim you can't verify because the source is unavailable to you, mark it explicitly: "UNVERIFIED — needs <source>".
- Single round expected. If FAIL, list the top 3 blockers concretely so Opus can fix in one pass.

Begin.
