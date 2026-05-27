# Codex Decision Request · P2 Scope Selection

You are GPT-5 acting as a senior engineer / tech lead. The user wants you to **make a binding decision** on how to scope the P2 (lowest priority) follow-up items from a recent AI workflow audit. The user explicitly said "Codex에 호출해서 결정하도록 해" (call Codex and let it decide), so this is not a recommendation — it's an authoritative choice you commit to.

## Project context

- This is a TALKPIK project (Korean TOPIK learning app). Current state: post-implementation of Phase 8 + audit fixes.
- Branches: only `main` remains. Recent merges: PR #6 (audit-fixes), PR #7 (phase-3 audience correction).
- Audit report: `reports/ai-workflow-audit-20260527.html` found P0 3건 + P1 5건 + P2 5건. P0/P1 all closed via PRs #6/#7. P2 is the remaining backlog.
- Workflow rigor applied: every non-trivial change → plan + ledger + cross-model review. Memory rule `feedback-docs-only-gate-rightsizing.md` allows docs-only quantitative corrections to skip discussion + round-cap 1.
- User profile: 바이브 코더 (code-literate but not professional dev). Wants high-leverage decisions, dislikes excessive process for low-value items.

## The 5 P2 items (from audit report §여유 있을 때)

### P2-1: RLS 우회 위험 패턴 grep 자동화
- **What**: `review-gates.md:111` defines 3 dangerous patterns (admin RPC called from user route, page guard 누락, content_admin → platform_admin 권한 상승 차단 누락). Currently checked by human eyeball in Architecture Pass. Add automated grep rules.
- **Complexity**: 🔴 Large. Need to design grep patterns, build into `scripts/ai-workflow-check.mjs`, add fixtures, plan + Codex review cycle.
- **Estimated time**: 2-3 hours.
- **Value**: High when admin code is touched. Currently no admin work in flight, so impact deferred.

### P2-2: em-dash 함정 완화
- **What**: `REQUIRED_PLAN_SECTIONS = ["## Out of Scope — Intentional Cuts", ...]` requires exact em-dash (`—`, U+2014). Hyphen (`-`) or en-dash (`–`) → instant FAIL. Common typo trap.
- **Complexity**: 🟢 Trivial. 1-line regex change in `scripts/ai-workflow-check.mjs` to accept all 3 dash types.
- **Estimated time**: 15 min.
- **Value**: Low frequency but high frustration when it hits.

### P2-3: phase-N false positive
- **What**: `PHASE_FILENAME_PATTERN = /phase-\d+/` matches anywhere in path. Slug containing "phase-1" (e.g., `20260601-phase-1-meta-audit.md` even if it's not a real phase-1 work) is incorrectly classified as phase ledger.
- **Complexity**: 🟢 Trivial. Anchor regex to specific patterns.
- **Estimated time**: 15 min.
- **Value**: Low impact — would only matter if someone deliberately uses "phase-N" slug for non-phase work.

### P2-4: Communication Style 자동 검사
- **What**: AGENTS.md/CLAUDE.md mandates Korean + vibe-coder tone for user-facing replies. Auto-detecting English responses or wrong tone requires LLM-based analysis, not regex.
- **Complexity**: ⚠️ Infeasible with current checker architecture. Would need separate LLM judge or post-hoc transcript scan.
- **Estimated time**: Unknown — research project, not implementation task.
- **Value**: Real (past incident where Claude responded in English). But may exceed the value of checker tooling investment.

### P2-5: runs/ 폴더 일괄 감사
- **What**: During audit we found 1 malformed ledger (`20260526-auth-error-callback-ux-review.md` missing `-HHMM-`). Sweep entire `docs/ai-workflow/runs/` for similar non-conforming files (naming convention, required sections, etc).
- **Complexity**: 🟡 Medium. Write audit script, run it, report findings. If migrations needed, they're mechanical.
- **Estimated time**: 30 min (audit only) to 1 hour (audit + migration).
- **Value**: One-shot cleanup — useful but won't recur if discipline holds.

## The 4 options presented to user

- **A**: P2-2 + P2-3 only (~30 min). Small parser tweaks.
- **B**: A + P2-5 audit (~1 hour). Adds investigative sweep.
- **C**: A + B + P2-1 (~half day). Full plan + Codex review cycle for grep automation.
- **D**: All 4 + attempt P2-4 (~day+). Includes infeasible research.

## Your job

Make a binding decision. Output:

```
DECISION: A | B | C | D | <alternative letter you define, e.g., E>
RATIONALE: <2-4 sentences>
EXECUTION ORDER: <ordered list of items to do, with brief justification per item>
EXPLICITLY DEFERRED: <items NOT in this decision and why>
```

Then a short paragraph on:
- **Risk if we don't do this now**: What gets worse if we skip?
- **Risk if we do this now**: What opportunity cost or scope creep?

## Decision criteria (suggested priority order)

1. **Value per hour invested** — vibe coder time is finite, prefer high-leverage fixes.
2. **Risk reduction** — items that prevent recurring confusion/failure beat items that just polish.
3. **Avoid sunk-cost into infeasible items** — P2-4 may not be solvable with checker tooling.
4. **Compatibility with current state** — branch is clean, main is up-to-date, ideal moment for any-size change.
5. **User stated they want a decision, not options** — be opinionated, not hedging.

Begin.
