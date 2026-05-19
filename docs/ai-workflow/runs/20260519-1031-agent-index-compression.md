# Agent Index Compression

## Run Metadata

- Run id: 20260519-1031-agent-index-compression
- Created: 2026-05-19 10:31 KST
- Updated: 2026-05-19 10:39 KST
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Compress `AGENTS.md`, move detailed content into separate docs, and add indexing so AI agents can access project docs more reliably.
- Accepted scope: Documentation-only restructuring for AI operating contract, AI document index, harness/skill reference, and README links.
- Out of scope: Product requirement changes, implementation code, package changes, git commit/push.
- Current next action: Complete; report results to user.

## Docs Consulted

- Exact files read:
  - `.codex/skills/using-superpowers/SKILL.md`
  - `.codex/skills/gstack/document-generate/SKILL.md`
  - `AGENTS.md`
  - `README.md`
  - `docs/README.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/agent-packets.md`
  - `docs/ai-workflow/report-template.md`
- Extracted requirements:
  - Keep Superpowers startup mandatory.
  - Keep docs-before-implementation mandatory.
  - Preserve fail-closed behavior for doc conflicts and unsafe conditions.
  - Preserve ledger, review, QA, fallback, and completion gates.
  - Move detailed routing and skill/harness information out of `AGENTS.md`.
- Doc conflicts: none.
- Untouched relevant docs and reason:
  - Product docs were not deeply read because this task changes AI document navigation only, not product behavior.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 10:31 | Compress `AGENTS.md` into a short mandatory contract. | The user wants less AGENTS bloat and easier AI access through indexing. | User request |
| 10:31 | Create `docs/agent-index.md` as the AI-only routing document. | README is human-friendly; AI needs a stricter purpose-to-doc index. | Prior discussion |
| 10:31 | Move harness and skill names to `docs/ai-workflow/harness-and-skills.md`. | These details are useful but should not be in the mandatory root contract. | AGENTS analysis |

## Active Files

- Files expected to change:
  - `AGENTS.md`
  - `README.md`
  - `docs/README.md`
  - `docs/agent-index.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/README.md`
  - `docs/ai-workflow/harness-and-skills.md`
  - `docs/ai-workflow/runs/20260519-1031-agent-index-compression.md`
- Files inspected:
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/agent-packets.md`
  - `docs/ai-workflow/report-template.md`
- Files changed:
  - `AGENTS.md`
  - `README.md`
  - `docs/README.md`
  - `docs/agent-index.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/README.md`
  - `docs/ai-workflow/harness-and-skills.md`
  - `docs/ai-workflow/runs/20260519-1031-agent-index-compression.md`
- Files explicitly not to touch:
  - Product specs and source implementation.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Codex main session | Coordinator/writer | Documentation restructuring | active | No child agents used. |

## Child Result Packets

Not applicable.

## Verification State

- Required checks:
  - Markdown code fences balanced.
  - Relative links in changed Markdown files resolve.
  - `AGENTS.md` is materially shorter.
  - `docs/agent-index.md` includes purpose-based index routing.
  - Root and docs README link to agent index.
- Checks run:
  - Line and code-fence parity check for changed Markdown files.
  - Relative Markdown link checker for changed Markdown files.
  - `Select-String` checks for `agent-index` and `harness-and-skills` references.
  - `git diff --stat` for changed core docs.
  - `git status --short`.
- Latest results:
  - `AGENTS.md` is 63 lines after compression.
  - Changed Markdown files have balanced code fences.
  - 8 changed Markdown files checked; 0 missing relative links.
  - `docs/agent-index.md` contains `Goal-To-Doc Routing`, `Development Detail Routing`, `Active Vs Legacy Rule`, `Ledger Requirement Index`, and `Output Requirement`.
  - README/docs/workflow files reference `docs/agent-index.md`; AI workflow README references `harness-and-skills.md`.
- Known failures:
  - None yet.
- Skipped checks and reason:
  - No build/test run expected for docs-only changes.

## Fallback State

- Normal path blocked: no.
- Failure class: none.
- Fallback used: none.
- Evidence collected: pending.
- Completion allowed: yes.
- Remaining fallback risk: none known.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: not applicable.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks: AI agents must actually follow `AGENTS.md`; indexing improves retrieval but cannot guarantee compliance in agents that ignore project instructions.
- Assumptions: The project prefers `AGENTS.md` as a short contract and `docs/agent-index.md` as the detailed AI router.
- Follow-up needed: none identified yet.
