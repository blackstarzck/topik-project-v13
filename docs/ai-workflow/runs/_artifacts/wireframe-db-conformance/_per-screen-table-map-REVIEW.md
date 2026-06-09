# Per-screen → DB table/RPC mapping — REVIEW PACKET

This is a claim I (Claude) compiled from the `wireframe-db-conformance` workflow's
per-screen matrices. **Verify each row for factual accuracy** against the actual
source code and schema. (Table/RPC names are English; do not rely on Korean docs —
they may garble when read here. Use SOURCE CODE as primary ground truth.)

## What to check (per row)
1. Does the screen's source actually READ/WRITE the listed tables/RPCs? Open the page +
   its components under `src/app/(workspace)/...` / `src/app/...` and the data helpers,
   and grep for `.from('<table>')`, `.rpc('<fn>')`, storage `.from('<bucket>')`.
2. **Missing**: a table/RPC the screen clearly uses but is NOT listed.
3. **Wrong/hallucinated**: a listed table/RPC the screen does NOT actually use.
4. **Mislabeled status**: 🟢 (connected) vs 🟡 (has an escalated "decision needed" item).
   Status correctness matters less than the table set; focus on the table set.

## Ground-truth sources
- Source code: `src/app/**`, `src/components/**`, data helpers (e.g. `*-data.ts`, `next.ts`).
- Schema: `supabase/migrations/*.sql`, `src/lib/supabase/types.ts`.
- Wireframe contracts (Korean, secondary): `docs/Wireframe/<NN-CODE-...>/screen-data-summary.md`.
- Admin codes H-01 / X-08 / X-10 / X-15 are intentionally OUT OF SCOPE (frozen). Ignore them.

## Table/RPC glossary
profiles=user(name/role/status/locale); learning_goals=study goal; problems=problem source
(prompt/materials/answer_key/rubric jsonb); problem_assets=image/audio; problem_attempts=attempt log;
writing_drafts=autosave draft; writing_submissions=immutable submission; writing_feedback +
feedback_dimension_scores + sentence_feedback=AI feedback; comparison_reports=progress compare;
recommendation_runs/recommendation_items=recommendation bundle/items; library_items=library;
export_files=PDF export; study_events=activity log; subscription_plans/subscriptions/payment_history=
billing; notification_settings/notification_log=notifications. `name()` = a SQL RPC/function.

## The mapping under review

| IA | Screen | Tables / RPCs used (claim) | Status | Decision-needed note (escalated, not a bug) |
|----|--------|----------------------------|--------|---------------------------------------------|
| A-01 | Sign up | profiles | 🟡 | terms-consent *record* persistence undecided |
| A-02 | Login | profiles | 🟡 | login-attempt *audit log* undecided |
| A-03 | Learning-goal setup | learning_goals, profiles, recommendation_runs | 🟡 | initial-recommendation *rule* catalog undecided |
| B-01 | Home dashboard | get_dashboard_kpi(), profiles, recommendation_items, writing_drafts, writing_feedback, study_events | 🟢 | — |
| C-01 | Problem-type recommendations | recommendation_runs, recommendation_items, problems, feedback_dimension_scores | 🟡 | per-type entitlement lock; recommendation-rule catalog |
| C-02 | Problem list | list_user_problems(), problems, problem_attempts, problem_assets, writing_drafts, writing_submissions | 🟡 | problem "expiry" semantics |
| C-03 | Retry modal | problems, problem_attempts, writing_drafts, writing_submissions, study_events | 🟡 | retry-policy copy |
| D-01 | Writing 51 (short answer) | problems, problem_assets, writing_drafts, writing_submissions, study_events, submit_writing_with_feedback() | 🟢 | — |
| D-02 | Writing 52 | (same as D-01 family) profiles, problems, problem_assets, writing_drafts, writing_submissions, study_events, submit_writing_with_feedback() | 🟢 | — |
| D-03 | Writing 53 (long form) | (same family) problems, problem_assets, writing_drafts, writing_submissions, study_events, submit_writing_with_feedback() | 🟢 | — |
| D-04 | Writing 54 (essay) | (same family + writing_submissions.parent_submission_id for re-submit) | 🟢 | — |
| D-M1 | Submission-confirm modal | writing_drafts, writing_submissions, submit_writing_with_feedback(), study_events | 🟡 | submit-consent *record* undecided |
| D-M2 | AI analysis loading | writing_submissions, writing_feedback, (private.* feedback-status fn) | 🟡 | progress-step copy (handled in app/i18n) |
| D-M3 | Autosave warning | writing_drafts, study_events | 🟡 | warning copy / retry policy (app) |
| E-01 | Short-answer feedback | writing_submissions, writing_feedback, feedback_dimension_scores, sentence_feedback, library_items, comparison_reports, export_files, study_events | 🟡 | feedback-label catalog (app) |
| E-02 | Long-form feedback | (E-01 set) + create_comparison_report_with_metrics() | 🟢 | — |
| R-01 | Comparison report | comparison_reports, writing_feedback, feedback_dimension_scores, writing_submissions, library_items, create_comparison_report_with_metrics(), study_events | 🟢 | — |
| R-02 | Next-problem recommendation | recommendation_runs, recommendation_items, problems, writing_feedback, feedback_dimension_scores, profiles, study_events | 🟡 | recommendation-rule related |
| F-01 | My library | library_items, writing_submissions, comparison_reports, export_files, problems, problem_attempts, recommendation_runs, study_events | 🟡 | review-set / folder / share write-path |
| F-M1 | PDF export modal | export_files, profiles, storage(bucket) | 🟢 | — |
| G-01 | Language settings | profiles | 🟡 | translation copy (i18n) |
| X-01 | Product landing | profiles, subscription_plans | 🟢 | — |
| X-02 | Growth dashboard | get_dashboard_kpi(), learning_goals, writing_feedback, feedback_dimension_scores, recommendation_items, study_events, profiles | 🟢 | — |
| X-03 | Paywall | subscription_plans, subscriptions, profiles | 🟡 | per-type lock; checkout integration |
| X-04 | Subscription management | subscriptions, subscription_plans, payment_history, profiles | 🟢 | — |
| X-05 | Profile editing | profiles, learning_goals, storage(avatars) | 🟡 | follow / visibility scope (out of scope) |
| X-06 | Password reset | profiles (+ Supabase Auth) | 🟡 | resend counter |
| X-07 | Weakness-based recommendations | recommendation_items, problems, feedback_dimension_scores, writing_feedback, study_events, profiles | 🟡 | weakness→problem mapping rule |
| X-09 | Notification settings | notification_settings, notification_log, profiles | 🟡 | notification template |
| X-11 | Auth error | profiles (static notice) | 🟢 | — |
| X-12 | Verify email | profiles (+ auth rpc) | 🟢 | — |
| X-13 | Terms | (no DB table — static content) | 🟡 | terms version/publish-date persistence |
| X-14 | Privacy policy | (no DB table — static content) | 🟡 | same as X-13 |
| X-16 | Password-reset confirm | (no DB table — auth flow) | 🟡 | password-policy copy |
| X-17 | Auth callback fragment | (no DB table — auth flow) | 🟡 | callback observability |

## Output requested from reviewer
For each row: VERDICT = correct | missing-tables | wrong-tables | uncertain, with the specific
file:line evidence (e.g. `src/.../page.tsx:NN` showing `.from('x')` / `.rpc('y')`). List the net
corrections at the end. Keep it concise; cite code, not Korean prose.
