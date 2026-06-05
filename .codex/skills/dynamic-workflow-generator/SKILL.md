---
name: dynamic-workflow-generator
description: Use when a user wants to design, create, save, adapt, or package a Claude Code dynamic workflow, ultracode workflow, workflow.js, or reusable multi-agent orchestration prompt for Claude Code or Codex-assisted preparation.
---

# Dynamic Workflow Generator

## Core Principle

Create a workflow brief first, then turn it into the runtime-specific artifact.
Do not invent undocumented Claude Code workflow JavaScript APIs. If the actual
workflow script API is unavailable, produce a Claude Code prompt or skill wrapper
that asks Claude Code to generate and save the workflow.

## Runtime Decision

| Environment | Output |
| --- | --- |
| Claude Code with dynamic workflows available | Ask Claude Code to create/run a workflow, then save it from `/workflows` when it works. |
| Codex or another agent without Claude workflow runtime | Create a reusable workflow brief, Claude Code prompt, and optional `.claude/skills/<name>/SKILL.md` wrapper. |
| Existing saved workflow script is provided | Edit or adapt that script, preserving known runtime APIs and comments. |
| User asks for cross-agent portability | Keep the skill frontmatter to `name` and `description`; put runtime-specific behavior in the body. |

## Gather These Fields

If the user did not provide a field, infer a conservative default and state it.

| Field | What to capture |
| --- | --- |
| `name` | Lowercase hyphenated workflow name, under 64 characters. |
| `goal` | One sentence describing the finished outcome. |
| `runtime` | Claude Code dynamic workflow, Codex-prepared prompt, or both. |
| `inputs` | Arguments such as target path, issue id, mode, budget, or rubric. |
| `scope` | Include paths, exclude paths, and files never to touch. |
| `mode` | `audit`, `plan`, `fix`, `verify`, `research`, or `triage`. |
| `phases` | Discover, split, fan out, verify, synthesize, report. |
| `agents` | Roles, prompts, tools, model/effort preference, and isolation policy. |
| `budget` | Token, time, agent-count, and concurrency limits. |
| `safety` | Secrets policy, destructive-action policy, deployment policy, and approval points. |
| `verification` | Tests, builds, screenshots, source citations, reproducible evidence, or reviewer rubric. |
| `output` | Final report shape and required evidence fields. |
| `stop_condition` | Exact condition for done, pause, or escalation. |

## Build The Brief

Use this shape before writing any prompt or file:

```markdown
# <workflow-name>

Goal: <finished outcome>
Runtime: Claude Code dynamic workflow and/or Codex-prepared artifact
Mode: <audit|plan|fix|verify|research|triage>

Inputs:
- target: <path/query/list>
- budget: <token/time/agent cap>
- rubric: <quality bar>

Scope:
- Include: <paths/systems>
- Exclude: <paths/systems>
- Never touch: secrets, deployment, production data, unrelated files

Phases:
1. Discover the relevant surface.
2. Split work into independent units.
3. Fan out focused agents per unit.
4. Run independent verifier/refuter agents against the rubric.
5. Deduplicate and synthesize only confirmed results.
6. Return a concise report with evidence.

Safety:
- Do not run destructive commands.
- Do not read or print secrets.
- Do not let multiple agents edit the same file at once.
- Prefer read-only mode unless the user requested fixes.

Stop condition:
- Stop when all units are checked and no unresolved verifier objections remain,
  or when the budget is reached.
```

## Claude Code Prompt Template

Use this when the caller is in Claude Code or wants a prompt to paste into Claude Code:

```text
ultracode: Create a reusable dynamic workflow named <workflow-name>.

Goal:
<goal>

Inputs:
- target: <target path, issue list, data source, or question>
- mode: <audit|plan|fix|verify|research|triage>
- budget: <token/time/agent cap>
- rubric: <verification criteria>

Scope:
Include:
- <include paths or sources>

Exclude:
- <exclude paths or sources>

Workflow phases:
1. Discover: map relevant files, sources, constraints, and risks.
2. Split: divide the work into independent units that avoid write conflicts.
3. Execute: spawn focused agents per unit.
4. Verify: spawn separate verifier or refuter agents for each result.
5. Synthesize: dedupe, resolve disagreements, and keep only confirmed results.
6. Report: return evidence, file paths or source links, checks run, and risks.

Agent rules:
- Use cheaper/faster workers for broad search when the runtime supports it.
- Use stronger reasoning for final judgment, synthesis, and high-risk decisions.
- Use worktree or file ownership isolation for edits.
- Do not allow two agents to edit the same file concurrently.

Safety rules:
- Do not read or expose secrets.
- Do not deploy, delete, reset git history, or modify production data.
- Prefer read-only audit unless mode is fix.
- Ask before irreversible actions.

Verification:
- Run <tests/build/static checks/source checks>.
- Treat verifier objections as blockers until resolved or explicitly reported.

Output format:
- Confirmed findings or changes
- Evidence
- Verification run
- Open risks
- Suggested next action
```

## Optional Cross-Compatible Skill Wrapper

When the user wants a reusable command instead of a one-off prompt, create this
file in both `.claude/skills/<workflow-name>/SKILL.md` and
`.codex/skills/<workflow-name>/SKILL.md`:

```markdown
---
name: <workflow-name>
description: Use when <specific trigger for this workflow, without summarizing the whole process>.
---

# <Workflow Title>

Use the dynamic workflow brief below. In Claude Code, create or run a dynamic
workflow from it. In Codex, prepare the Claude Code prompt and any supporting
files instead of pretending to execute Claude Code's workflow runtime.

<paste workflow brief here>
```

## Quality Checks

Before finishing, verify:

- The skill or prompt states the runtime explicitly.
- The scope has include and exclude lists.
- The budget is bounded.
- The workflow has a verifier/refuter stage.
- The stop condition is concrete.
- The output asks for evidence, not impressions.
- The artifact does not rely on undocumented JavaScript workflow APIs unless an
  existing saved script supplied those APIs.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Writing a fake `workflow.js` API from memory | Produce a Claude Code generation prompt, or edit an existing saved script only. |
| Using workflows for a tiny one-file edit | Recommend a normal agent session or a regular skill. |
| No budget | Add token, time, agent-count, or slice limits. |
| No verifier | Add adversarial verification before synthesis. |
| Vague success | Define tests, citations, evidence, or acceptance criteria. |
| Cross-agent conflict | Assign file ownership or require worktree isolation. |
