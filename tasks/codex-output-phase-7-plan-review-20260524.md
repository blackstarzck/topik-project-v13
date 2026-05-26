VERDICT: CONCERN

CONSENSUS-TO-PLAN MAPPING:
| Proposal ID | Mapped to Task # | Faithful? (YES/NO + 1-line) |
| --- | --- | --- |
| P0-1 | Task 1 | NO - auth surfaces mapped, but task row does not preserve magic-link option, resend, terms, and reset behavior clearly enough. |
| P0-2 | Task 2 | NO - says hard/recommended limits, but exact agreed values are absent. |
| P0-3 | Task 3 | YES - LongFormEditor + 3 tabs + manuscript + chart is mapped. |
| P0-4 | Task 4 | YES - 3-state EssayChecklist is mapped. |
| P1-0 | Task 0 | YES - NODE_ENV localhost/http exception is mapped. |
| P1-1 | Task 5 | YES - RetryModal wiring is mapped. |
| P1-2 | Task 6 | YES - summary + 3 alternatives are mapped, but file target is wrong. |
| P1-3 | Task 7 | YES - 4 tabs + diagnostic card are mapped. |
| P1-4 | Task 8 | YES - fixture/timer loading modal is mapped. |
| P1-5 | Task 9 | YES - 3 triggers x 3 actions is mapped. |
| P1-6 | Task 10 | YES - bio + exam info + status/help cards are mapped, but data files are missing. |
| P1-7 | Task 11 | YES - recent feedback + alerts are mapped. |
| P1-8 | Task 12 | YES - recommendation/solve-state filters are mapped, but file target is wrong. |

SUB-PHASE SPLIT FEASIBILITY:
- 7-A (Task 0): safe. Small env validation PR, no session cleanup risk.
- 7-B (Task 1): mostly safe. Needs auth route tests and explicit Supabase redirect/Mailpit handling before build.
- 7-C (Task 2+3+4+9): buildable as one PR, but not parallel-safe as written because Task 2 and Task 9 both touch `WritingEditor`, and Task 4 depends on Task 3.
- 7-D (Task 5+6+7+8+11+12): buildable, but file plan must be corrected first. Task 5 and Task 12 both touch `ProblemListView`.
- 7-E (Task 10+13): safe only as final verification PR. Task 13 depends on all earlier sub-phases, so it is not really “profile + cleanup” only.

NEW FINDINGS (P1 must fix):
| ID | Section | Issue | Suggested fix |
| --- | --- | --- | --- |
| P1-PLAN-1 | Tasks / consensus mapping | P0-2 loses exact agreed limits. | Add 51/52/53/54 `hardMin/hardMax/recommendedMin/recommendedMax` values directly to Task 2 or task detail. |
| P1-PLAN-2 | Files Likely To Change | Two listed files do not exist: `src/lib/practice/recommendations.ts`, `src/lib/practice/problems.ts`. | Replace with actual files: `src/lib/practice/next.ts`, `src/lib/practice/queries.ts`, `src/lib/practice/types.ts`, plus relevant page/tests. |
| P1-PLAN-3 | Files Likely To Change | P0-3 needs `problem.materials`, but current `getWritingProblem` selects only `id, title`; `src/lib/writing/server.ts` is missing. | Add `src/lib/writing/server.ts`, problem/material types, and seed/test fixture updates. |
| P1-PLAN-4 | Files Likely To Change | P1-6 bio migration omits required typed/data surfaces. | Add `src/lib/supabase/types.ts`, `src/lib/settings/{types,server,mutations}.ts`, `src/app/(workspace)/profile/page.tsx`, and learning-goal fetch wiring. |
| P1-PLAN-5 | Test Strategy | TDD is not enforceable. §5 is generic and does not name per-task RED tests. | Add task-by-task test surfaces: component, lib, integration, migration/type snapshot, e2e. |
| P1-PLAN-6 | LongFormEditor scope | Draft persistence is underspecified. DB already has `answer_json`, but plan says section state is client-only + combined text. | Define `answer_json` schema for 53 sections/checklist, autosave/submit behavior, reload restoration, and tests. |
| P1-PLAN-7 | OOS | Phase 6 Tier 2 OOS list is not fully carried forward; Playwright e2e also leaks into Task 13 without reopening rationale. | Explicitly list OOS-4/6/8/12, or state which one is intentionally reopened and why. |
| P1-PLAN-8 | Subagent-eligible | Several Y claims are not parallel-safe due shared files/dependencies. | Mark dependent/shared-file tasks as N or add sequencing: Task 3 before 4, Task 2 before 9, Task 5 before 12. |

NEW FINDINGS (P2 advisory):
| ID | Section | Issue | Suggested fix |
| --- | --- | --- | --- |
| P2-PLAN-1 | Risks | Mailpit risk is local-machine-specific; plan assumes availability. | Add fallback: verify `supabase status`, document Mailpit URL, and fallback manual token flow. |
| P2-PLAN-2 | Auth | Supabase redirect URLs may need origin-safe absolute URLs, not bare relative paths. | Add URL builder/verification item for `emailRedirectTo` and `redirectTo`. |
| P2-PLAN-3 | Seed / fixtures | 53 chart rendering needs seeded `materials`. Current seed inserts no `materials`. | Add `supabase/seed.sql` or test fixture update. |
| P2-PLAN-4 | Verification | I could not run `node scripts/ai-workflow-check.mjs --repo .`; command was blocked by policy. | Run checker in the implementation environment before marking review PASS. |

MISSED FILES:
- `src/lib/writing/server.ts`
- `src/lib/writing/queries.ts` if draft `answer_json` restoration is client-read
- `src/lib/supabase/types.ts`
- `src/lib/settings/types.ts`
- `src/lib/settings/server.ts`
- `src/lib/settings/mutations.ts`
- `src/app/(workspace)/profile/page.tsx`
- `src/lib/practice/next.ts`
- `src/lib/practice/queries.ts`
- `src/lib/practice/types.ts`
- `src/app/(workspace)/practice/next/page.tsx`
- `supabase/seed.sql`
- task-specific `tests/components/**`, `tests/lib/**`, `tests/integration/**`

OOS / AUDIENCE / TIER-2 LEAKS:
- Audience boundary: no direct admin folder contamination found.
- Tier 2 leaks/incomplete OOS: OOS-4 Playwright e2e, OOS-6 export queue worker, OOS-8 admin audit view/getAuditLogs, OOS-12 Edge Function service-role impersonation are not explicitly excluded.
- Task 13 reopens Playwright e2e without saying “only golden-path e2e is in scope.”

OVERALL RECOMMENDATION:
- revise with these P1s
- then proceed sub-phase by sub-phase after a quick re-review of the revised plan.