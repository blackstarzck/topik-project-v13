# UI Redesign Feasibility And DESIGN.md Investigation

## Run Metadata

- Run id: 20260602-1515-ui-redesign-feasibility-stitch-designmd
- Created: 2026-06-02T15:15:19+09:00
- Updated: 2026-06-02T15:15:19+09:00
- Main session owner: Codex
- Host: Codex desktop
- Status: complete

## Task

- User goal: Investigate whether the project can be redesigned around `docs/Wireframe/`, whether Ant Design and `ui-ux-pro-max` can support that work, and whether Stitch-style `DESIGN.md` would materially help AI agents produce better UI.
- Accepted scope: Read relevant local docs, inspect current UI/theme/layout structure, check installed UI skills, and research DESIGN.md/Stitch references.
- Out of scope: No production UI edits, no theme edits, no route edits, no admin-scope implementation.
- Current next action: User decision on whether to create a root `DESIGN.md` / design-system source of truth and start a staged UI redesign plan.

## Docs Consulted

- Exact files read:
  - `AGENTS.md` user-provided instructions
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `docs/agent-index.md`
  - `docs/user-communication-style.md`
  - `docs/report-writing-template.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/templates/context-ledger-template.md`
  - `docs/ant-design/README.md`
  - `docs/ant-design/01-design-values.md`
  - `docs/ant-design/02-global-styles.md`
  - `docs/ant-design/03-patterns-and-components.md`
  - `docs/ant-design/04-page-patterns-for-talkpik.md`
  - `docs/ant-design/08-theme-architecture.md`
  - `docs/Wireframe/README.md`
  - `docs/ia.md`
  - `docs/sitemap.md`
  - `docs/flow/user-flow.md`
  - `.agents/skills/ant-design/SKILL.md`
  - `.codex/skills/ui-ux-pro-max/SKILL.md`
  - `.codex/skills/talkpik-ui-system/SKILL.md`
  - `.agents/skills/gstack/review/design-checklist.md`
  - Google blog: `https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/`
  - Google Labs GitHub: `https://github.com/google-labs-code/design.md`
  - DESIGNmd about page: `https://designmd.ai/about`
- Extracted requirements:
  - Current active screen source is `docs/Wireframe/` with route authority in `docs/sitemap.md` and user-flow order in `docs/flow/user-flow.md`.
  - User-facing app design must stay inside user scope; admin implementation is not part of this redesign unless separately authorized and scoped.
  - Ant Design should be used as component/token foundation, not as scattered one-off inline styling.
  - Theme decisions belong in `src/theme/`; Tailwind may only be a constrained layout/utility layer bridged from Ant Design tokens.
  - `AppCard`, `AppDrawer`, and `AppModal` are expected shared wrappers for user-facing Card/Drawer/Modal surfaces, but current source does not contain them.
  - `ui-ux-pro-max` must be used for UI structure, visual quality, accessibility, interaction, and responsive review.
  - DESIGN.md can give agents a persistent design-system reference with machine-readable tokens and human-readable rationale.
- Doc conflicts: none for investigation. Noted mismatch: `docs/ant-design/08-theme-architecture.md` has stale text saying `src/` does not exist, but the same file also documents the current `src/theme/` structure.
- Untouched relevant docs and reason:
  - `docs/spec.md` — not read because this turn did not change functional behavior.
  - Individual `docs/Wireframe/*/description.md` files — not read because the task was feasibility/method investigation, not a specific screen redesign.
  - `docs/ant-design/06-ai-development-workflow.md` and `07-review-checklist.md` — not read in full because no UI implementation or final UI review was performed.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-02T15:15+09:00 | Feasibility is positive, but redesign should start with a root design-system artifact before page edits. | Current repo has active Wireframe docs and UI code, but lacks a single agent-readable visual source of truth. | `docs/Wireframe/README.md`, `docs/ant-design/08-theme-architecture.md`, Google DESIGN.md references |
| 2026-06-02T15:15+09:00 | Treat Ant Design as the component foundation, not the visual direction by itself. | Local docs already warn against decorative layouts and scattered custom values; current source shows many direct inline styles and direct Card/Modal/Drawer imports. | `docs/ant-design/02-global-styles.md`, `docs/ant-design/03-patterns-and-components.md`, source grep |
| 2026-06-02T15:15+09:00 | Use `ui-ux-pro-max` as review and design criteria, but verify its local script path before relying on generated recommendations. | Home-global copy lacked scripts, project-local copy has scripts/data and produced results. | `.codex/skills/ui-ux-pro-max/` inspection |

## Active Files

- Files expected to change: none in this investigation except this ledger.
- Files inspected:
  - `package.json`
  - `src/app/layout.tsx`
  - `src/app/(workspace)/layout.tsx`
  - `src/app/providers.tsx`
  - `src/styles/global.css`
  - `src/theme/presets/default.ts`
  - `src/theme/components/shared.ts`
  - `src/components/app/WorkspaceShell.tsx`
  - `src/components/app/AppHeader.tsx`
  - `src/components/app/SidebarNav.tsx`
- Files changed:
  - `docs/ai-workflow/runs/2026/06/02/20260602-1515-ui-redesign-feasibility-stitch-designmd.md`
- Files explicitly not to touch:
  - Production UI files under `src/`
  - Admin implementation files

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Codex main | investigator | Local docs, skill availability, source structure, external DESIGN.md research | complete | This ledger |

## Child Result Packets

- None.

## Verification State

- Required checks:
  - Local file/source inspection.
  - External source check for Stitch/DESIGN.md because the topic is recent.
  - Skill availability check.
- Checks run:
  - `rg --files docs/Wireframe docs/ant-design src`
  - `rg --files -g 'DESIGN.md' -g '*design*.md' -g '*Design*.md' . docs .agents`
  - `rg -n "AppCard|AppModal|AppDrawer|DESIGN.md|design-system/MASTER|ui-ux-pro-max|Stitch|stitch" docs .agents src README.md package.json`
  - `rg -n "AppCard|AppModal|AppDrawer" src`
  - `rg -n "style=\\{\\{" src/components src/app`
  - `rg -n "<Card|<Modal|<Drawer" src/components src/app`
  - `python .codex/skills/ui-ux-pro-max/scripts/search.py ... --design-system`
  - Web search/open for Google Stitch DESIGN.md, Google Labs `design.md`, and DESIGNmd.
- Latest results:
  - Root `DESIGN.md` does not exist.
  - Expected shared surface wrappers are referenced in docs but absent in `src`.
  - Direct inline styles and direct AntD surfaces are widespread.
  - Project-local `ui-ux-pro-max` scripts/data are available; home-global copy appears incomplete.
  - Google sources confirm DESIGN.md is a recent alpha/open draft format for design rules consumed by agents.
- Known failures:
  - `python` from PATH only printed `Python`; bundled Python was needed.
  - `C:\Users\admin\.codex\skills\ui-ux-pro-max` lacked scripts; project-local `.codex/skills/ui-ux-pro-max` had scripts.
- Skipped checks and reason:
  - No lint/typecheck/build because no production code was changed.
  - No browser QA because no UI was changed.
- Cross-model review: degraded — no separate reviewer invoked for an investigation-only report.
- Architecture Pass: skipped — no architecture or production code changed.
- Light Spec: skipped — not a phase implementation ledger.
- UX/UI Consistency Pass: skipped — no UI files changed.
  - Tokens: skipped — no token edits.
  - Components: skipped — no component edits.
  - A11y: skipped — no UI behavior edits.
  - Responsive: skipped — no responsive code edits.
- QA Gate: skipped — no UI files changed.

## Fallback State

- Normal path blocked: no.
- Failure class: recover.
- Fallback used: Used project-local `ui-ux-pro-max` scripts after global-home skill copy lacked scripts.
- Evidence collected: Project-local scripts and CSV data were listed and the design-system/UX/Next.js searches ran successfully.
- Completion allowed: yes.
- Remaining fallback risk: `ui-ux-pro-max` recommendation query is generic; a full redesign should run per-flow/per-screen queries and visual QA.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes; no production behavior implemented.
- Child result packets integrated: not applicable.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks:
  - DESIGN.md spec is alpha and may change.
  - Root DESIGN.md could conflict with existing Ant Design docs if not reconciled carefully.
  - Current UI code has many scattered styles, so a one-shot redesign would be risky.
- Assumptions:
  - The redesign target is user-facing routes only, not admin routes.
  - Wireframe docs remain the information architecture and screen-content source of truth.
- Follow-up needed:
  - Draft root `DESIGN.md` or `design-system/MASTER.md` from existing docs before code changes.
  - Map the 39 Wireframe screens into user/admin/public batches and start with common shell + shared surface wrappers.
  - Run design review and browser visual QA after each batch.
