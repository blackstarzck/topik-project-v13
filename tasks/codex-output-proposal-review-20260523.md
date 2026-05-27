PER-ITEM TABLE:
| ID | Verdict (AGREE / PROPOSE-BETTER / ESCALATE-TO-USER) | Rationale (one line) | If PROPOSE-BETTER: better option + evidence |
| --- | --- | --- | --- |
| P0-1 | ESCALATE-TO-USER | Opus marked YES correctly: auth method is product/ops choice, though Supabase Auth is fixed. |  |
| P0-2 | PROPOSE-BETTER | Opus is right to hard-block max, but its `min` values would over-block 53/54 below IA’s true minimum. | Use `hardMin/hardMax/recommendedMin/recommendedMax`: 51 `10-120`, 52 `10-160`, 53 hard `120-300` with recommended `200-300`, 54 hard `300-700` with recommended `600-700`; evidence: `docs/IA/08-D-01-short-answer-writing-51/description.md:63`, `docs/IA/09-D-02-answer-writing-52/description.md:51`, `docs/IA/10-D-03-long-form-writing-53/description.md:51`, `docs/IA/11-D-04-essay-writing-54/description.md:38`. |
| P0-3 | ESCALATE-TO-USER | Opus marked YES correctly only for “full now vs defer”; A vs B implementation shape should be delegated after user confirms scope. |  |
| P0-4 | PROPOSE-BETTER | A checklist is correct, but boolean checkboxes miss the IA-required item state model. | Build `EssayChecklist` as 6 or fewer rubric items with per-item status `complete / warning / unchecked`, not just checked boolean; evidence: `docs/IA/11-D-04-essay-writing-54/description.md:50`. |
| P1-0 | AGREE | NODE_ENV-gated localhost HTTP preserves production HTTPS while unblocking local Supabase. |  |
| P1-1 | AGREE | Wiring existing `RetryModal` through `ProblemListView` is the smallest durable fix for the orphan modal. |  |
| P1-2 | AGREE | Summary cards plus three alternatives match R-02’s missing IA areas without pulling in Tier 2. |  |
| P1-3 | AGREE | Four tabs plus diagnostic card directly cover the audited X-07 gaps and can use existing dimension-score data. |  |
| P1-4 | AGREE | Fixture/timer-based steps satisfy the loading UI spec while avoiding real LLM progress, which stays OOS. |  |
| P1-5 | PROPOSE-BETTER | Error-only modal is too narrow because D-M3 covers autosave disabled, save failure, and exit/loss risk. | Trigger the modal on `autosaveStatus === failed`, user attempts to disable autosave, or leaving with dirty/failed draft; actions should include keep autosave, retry/save now, and proceed-with-risk; evidence: `docs/IA/22-D-M3-autosave-warning/description.md:12`, `docs/IA/22-D-M3-autosave-warning/description.md:13`, `docs/IA/22-D-M3-autosave-warning/description.md:61`, `docs/IA/22-D-M3-autosave-warning/description.md:73`. |
| P1-6 | AGREE | Bio should be durable schema, while target exam info should reuse `learning_goals`, avoiding duplicated profile state. |  |
| P1-7 | AGREE | Recent feedback plus in-app alerts cover B-01 without notification transport, so it stays Tier 1. |  |
| P1-8 | AGREE | Recommendation and solve-status filters are exactly the missing C-02 controls and should be durable user-facing query state. |  |

NEW USER-DECISION CANDIDATES (Opus marked NO but you think YES):
- none

TIER-2 BOUNDARY VIOLATIONS:
- none

SPOT-CHECK FALSE NEGATIVES (IA descriptions you actually read):
- `docs/IA/10-D-03-long-form-writing-53/description.md`
- `docs/IA/11-D-04-essay-writing-54/description.md`
- `docs/IA/22-D-M3-autosave-warning/description.md`
- `docs/IA/06-C-02-problem-list/description.md`
- `docs/IA/04-B-01-home-dashboard/description.md`

OVERALL VERDICT:
- Total: 8 AGREE / 3 PROPOSE-BETTER / 2 ESCALATE
- Recommendation: proceed to user decision-delegate after merging the 3 Codex corrections into the proposal document.