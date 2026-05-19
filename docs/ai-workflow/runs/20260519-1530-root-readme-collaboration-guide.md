# Context Ledger: Root README Collaboration Guide

## Run Metadata

- Run id: 20260519-1530-root-readme-collaboration-guide
- Created: 2026-05-19 15:30 KST
- Updated: 2026-05-19 15:42 KST
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Rewrite root `README.md` as an easy project explanation and collaboration guide for vibe coders, non-developer outsiders, and development collaborators while preserving the existing indexing/document-map section.
- Accepted scope: Root README rewrite; related documentation consistency fixes if conflicts or stale/corrupted guidance is found; verification and report.
- Out of scope: Product behavior changes, production source code, package/dependency changes, commits, pushes, PR creation, broad PRD/IA encoding restoration.
- Current next action: None. README rewrite, related docs-map fix, and verification are complete.

## Docs Consulted

- Exact files read:
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `.agents/skills/talkpik-orchestrator/SKILL.md`
  - `README.md`
  - `docs/agent-index.md`
  - `docs/spec.md`
  - `docs/prd.md`
  - `docs/README.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/context-ledger-template.md`
  - `docs/sitemap.md`
  - `docs/ia.md`
  - `docs/flow/user-flow.md`
  - `docs/ai-workflow/git-publication-decision.md`
- Extracted requirements:
  - Root README is the human-friendly project overview.
  - Existing document indexing/document map should remain.
  - Project is pre-implementation; `docs/` is the source of truth until source exists.
  - Fixed implementation stack is Next.js App Router, React, TypeScript, Ant Design, Tailwind CSS, Supabase/Postgres/Auth/Storage, Vercel, and pnpm.
  - Active docs win over legacy docs.
  - AI agents must read `docs/agent-index.md`, consult exact docs for the goal, keep a ledger when required, and verify before claiming completion.
- Doc conflicts:
  - Root README and `docs/README.md` contained mojibake/corrupted Korean example prompts. This is a documentation quality/encoding inconsistency, not a product requirement conflict.
- Untouched relevant docs and reason:
  - `docs/IA/**`: not read individually because this task explains repository navigation, not a specific screen.
  - `docs/ant-design/**`: not read in detail because no UI implementation or design-system rule is changing.
  - Full corrupted legacy/product docs are not restored in this task because that is a broad content recovery effort outside the requested README collaboration guide.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-19 15:30 | Preserve the root document map and expand around it. | User explicitly asked to keep the existing indexing portion. | User request |
| 2026-05-19 15:30 | Fix corrupted example prompts in `docs/README.md` if editing README exposes the same inconsistency. | The root README should not point readers to a docs guide with unreadable examples. | `README.md`, `docs/README.md` |
| 2026-05-19 15:30 | Report broader mojibake in PRD/sitemap/IA/flow as remaining risk, not silently rewrite it. | Restoring those large docs would require source recovery and could accidentally change product meaning. | Local inspection |

## Active Files

- Files expected to change:
  - `README.md`
  - `docs/README.md`
  - `docs/ai-workflow/runs/20260519-1530-root-readme-collaboration-guide.md`
- Files inspected:
  - listed under Docs Consulted
- Files changed:
  - `README.md`
  - `docs/README.md`
  - `docs/ai-workflow/runs/20260519-1530-root-readme-collaboration-guide.md`
- Files explicitly not to touch:
  - Production app source, package manifests, secrets, deployment config, unrelated existing dirty files.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Main session | coordinator/implementer | Rewrite docs, verify consistency | complete | Direct execution; no child agents used |

## Child Result Packets

Not applicable.

## Verification State

- Required checks:
  - README preserves document indexing.
  - Directly related docs-map examples are readable and consistent.
  - `git diff --check` passes for touched files.
  - `node scripts/ai-workflow-check.mjs --repo .` passes.
- Checks run:
  - `rg -n "湲|쒖|�|留|怨|瑜|濡" README.md docs/README.md`
  - `git diff --check -- README.md docs/README.md docs/ai-workflow/runs/20260519-1530-root-readme-collaboration-guide.md`
  - `node scripts/ai-workflow-check.mjs --repo .`
  - `git status --short -- README.md docs/README.md docs/ai-workflow/runs/20260519-1530-root-readme-collaboration-guide.md`
  - `git diff --stat -- README.md docs/README.md docs/ai-workflow/runs/20260519-1530-root-readme-collaboration-guide.md`
- Latest results:
  - Root README now includes audience-specific project explanation, visual diagrams, collaboration guide, AI workflow guide, and the preserved `Document Map` section.
  - `docs/README.md` example requests were repaired to readable Korean.
  - Mojibake search on `README.md` and `docs/README.md`: no matches.
  - `git diff --check`: pass after removing trailing whitespace.
  - `node scripts/ai-workflow-check.mjs --repo .`: pass.
- Known failures:
  - Initial `git diff --check` found trailing whitespace in `README.md`; fixed.
- Skipped checks and reason:
  - App lint/typecheck/test/build: not applicable because this is docs-only and the project has no production app/package surface yet.

## Fallback State

- Normal path blocked: none
- Failure class: none
- Fallback used: none
- Evidence collected: verification checks listed above.
- Completion allowed: yes
- Remaining fallback risk: none identified

## Ledger/File-State Consistency

- Files changed match accepted scope: yes
- Docs consulted match implemented behavior: yes
- Child result packets integrated: not applicable
- Verification state current: yes
- Remaining risks listed: yes

## Risks And Follow-Up

- Remaining risks: Larger product/IA docs such as `docs/prd.md`, `docs/sitemap.md`, `docs/ia.md`, and `docs/flow/user-flow.md` contain mojibake in places and may need a separate source-recovery pass. This task fixed the directly related root/docs entry guides only.
- Assumptions: "기존 indexing한 부분" means the root README's `Document Map`/entry-point table should remain and be expanded, not removed.
- Follow-up needed: Optional separate cleanup/recovery task for mojibake in larger historical/product docs.
