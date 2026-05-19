# Context Ledger: Practical Agent Skills

## Run Metadata

- Run id: 20260519-1503-practical-agent-skills
- Created: 2026-05-19 15:03 KST
- Updated: 2026-05-19 15:24 KST
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Install the practical development skills mentioned for Codex and Claude use, and update related project documentation.
- Accepted scope: Project-local skill installation for Next/React, Supabase/Postgres, Ant Design, Playwright/Vitest, and RHF/Zod; sync Codex and Claude mirrors; update related workflow/skills documentation.
- Out of scope: Global skill installation, production app code, dependency changes to application package files, commits, pushes, or PR creation.
- Current next action: None. Installation, documentation, sync, and verification are complete.

## Docs Consulted

- Exact files read:
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `.agents/skills/talkpik-orchestrator/SKILL.md`
  - `C:\Users\admin\.agents\skills\find-skills\SKILL.md`
  - `docs/agent-index.md`
  - `docs/spec.md`
  - `docs/development/stack.md`
  - `docs/development/backend-auth.md`
  - `docs/development/deployment.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/harness-and-skills.md`
  - `docs/ai-workflow/context-ledger-template.md`
  - `docs/ai-workflow/git-publication-decision.md`
  - `.agents/README.md`
  - `.gitignore`
  - `skills-lock.json`
  - `scripts/sync-agent-skills.mjs`
- Extracted requirements:
  - Use project-local skills; do not install global copies for this project.
  - `.agents/skills` is the shared source for project-local skills, mirrored into `.codex/skills` and `.claude/skills`.
  - TALKPIK skills take precedence over external advisory skills.
  - The fixed stack is Next.js App Router, React, TypeScript, Ant Design, Tailwind CSS as constrained utility layer, Supabase/Postgres/Auth/Storage, Vercel, pnpm, Zustand, TanStack Query, React Hook Form, Zod, Recharts, Dayjs, Vitest, Testing Library, and Playwright.
  - Workflow-governing skill changes require a context ledger and verification.
- Doc conflicts: none.
- Untouched relevant docs and reason:
  - `docs/ant-design/*`: not read in full because this task installs skill support and updates harness documentation, not UI implementation rules.
  - Page IA and flow docs: not relevant because no user-facing route or behavior is being implemented.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-19 15:03 | Install skills project-locally, not globally. | Codex and Claude should share the repo-local skill set. | `docs/ai-workflow/harness-and-skills.md` |
| 2026-05-19 15:03 | Keep `talkpik-*` as the governing layer over external practical skills. | External skills are advisory and may conflict with fixed stack choices. | `docs/spec.md`, `talkpik-orchestrator` |
| 2026-05-19 15:18 | Mirror practical skills as full directories, not only `SKILL.md`. | Several external skills include scripts, helpers, templates, references, or metadata needed for correct operation. | Installed skill contents |
| 2026-05-19 15:21 | Document high-caution practical skills rather than excluding them. | The user asked for all mentioned skills installed, but side-effectful skills need explicit routing constraints. | Scanner output and local inspection |

## Active Files

- Files expected to change:
  - `.agents/skills/**`
  - `.codex/skills/**`
  - `.claude/skills/**`
  - `skills-lock.json`
  - `docs/ai-workflow/harness-and-skills.md`
  - `.gitignore` if generated skill metadata requires ignore rules
  - this ledger
- Files inspected:
  - listed under Docs Consulted
- Files changed:
  - `.agents/README.md`
  - `.agents/skills/ant-design/**`
  - `.agents/skills/deploy-to-vercel/**`
  - `.agents/skills/next-best-practices/**`
  - `.agents/skills/next-cache-components/**`
  - `.agents/skills/next-upgrade/**`
  - `.agents/skills/playwright-skill/**`
  - `.agents/skills/react-hook-form-zod/**`
  - `.agents/skills/supabase/**`
  - `.agents/skills/supabase-postgres-best-practices/**`
  - `.agents/skills/vercel-cli-with-tokens/**`
  - `.agents/skills/vercel-composition-patterns/**`
  - `.agents/skills/vercel-react-best-practices/**`
  - `.agents/skills/vercel-react-native-skills/**`
  - `.agents/skills/vercel-react-view-transitions/**`
  - `.agents/skills/vitest-testing/**`
  - `.agents/skills/web-design-guidelines/**`
  - `.agents/skills/talkpik-orchestrator/SKILL.md`
  - `.gitignore`
  - `skills-lock.json`
  - `docs/agent-index.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/harness-and-skills.md`
  - `docs/ai-workflow/report-template.md`
  - `scripts/sync-agent-skills.mjs`
  - `docs/ai-workflow/runs/20260519-1503-practical-agent-skills.md`
- Files explicitly not to touch:
  - Production app source, package manifests, secrets, deployment config, unrelated existing dirty files.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Main session | coordinator/implementer | Install skills, update docs, verify | complete | Direct execution; no child agents used |

## Child Result Packets

Not applicable.

## Verification State

- Required checks:
  - Project-local skill install succeeds.
  - Codex and Claude skill mirrors are synced.
  - AI workflow checker passes.
  - Git diff scope is inspected.
- Checks run:
  - `npx skills add vercel-labs/agent-skills -y`
  - `npx skills add supabase/agent-skills -y`
  - `npx skills add ant-design/antd-skill@ant-design -y`
  - `npx skills add lackeyjb/playwright-skill -y`
  - `npx skills add vercel-labs/next-skills -y`
  - `npx skills add secondsky/claude-skills@vitest-testing -y`
  - `npx skills add jezweb/claude-skills@react-hook-form-zod -y`
  - `npx skills add ovachiever/droid-tings@react-hook-form-zod -y`
  - `node scripts/sync-agent-skills.mjs --list`
  - `node scripts/sync-agent-skills.mjs`
  - `node scripts/sync-agent-skills.mjs --check`
  - `node scripts/ai-workflow-check.mjs --repo .`
  - `git diff --check -- .gitignore scripts/sync-agent-skills.mjs docs/agent-index.md docs/ai-development-workflow.md docs/ai-workflow/harness-and-skills.md docs/ai-workflow/report-template.md .agents/README.md .agents/skills/talkpik-orchestrator/SKILL.md docs/ai-workflow/runs/20260519-1503-practical-agent-skills.md`
  - Local risk search for `child_process`, token handling, and destructive shell patterns in high-caution skills.
- Latest results:
  - Practical skills installed under `.agents/skills/`.
  - `.codex/skills` and `.claude/skills` contain the practical skill mirrors.
  - `node scripts/sync-agent-skills.mjs --check`: pass.
  - `node scripts/ai-workflow-check.mjs --repo .`: pass.
  - `git diff --check`: pass.
- Known failures:
  - Initial `react-hook-form-zod` install attempt from `jezweb/claude-skills@react-hook-form-zod` failed because that repo did not contain a matching skill. Fallback source `ovachiever/droid-tings@react-hook-form-zod` installed successfully.
- Skipped checks and reason:
  - App tests/lint/typecheck/build: no production app/package surface exists for this skill/documentation task.

## Fallback State

- Normal path blocked: one community skill source did not contain the requested RHF/Zod skill.
- Failure class: package/source mismatch.
- Fallback used: installed `react-hook-form-zod` from `ovachiever/droid-tings@react-hook-form-zod`.
- Evidence collected: successful installer output and mirror sync check.
- Completion allowed: yes.
- Remaining fallback risk: community skill quality may vary; TALKPIK docs and guardrail skills remain authoritative.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes
- Docs consulted match implemented behavior: yes
- Child result packets integrated: not applicable
- Verification state current: yes
- Remaining risks listed: yes

## Risks And Follow-Up

- Remaining risks:
  - External skills may encode defaults that conflict with TALKPIK; documentation states that `talkpik-*` and `docs/spec.md` take precedence.
  - `playwright-skill` scanner output reported elevated risk and contains a runner using `child_process.execSync`; documentation constrains it to local QA and no secrets.
  - `deploy-to-vercel` and `vercel-cli-with-tokens` are side-effectful deployment skills; documentation requires explicit deployment scope before use.
- Assumptions: "Mentioned skills" refers to the practical skill layer shown in the user's image: Next/React, Supabase/Postgres, Ant Design, Playwright/Vitest, and RHF/Zod.
- Follow-up needed: none
