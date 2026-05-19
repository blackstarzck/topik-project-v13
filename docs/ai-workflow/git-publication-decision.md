# Git Publication Decision Gate

Use this gate after implementation, review, and verification are complete, but before
any `git commit`, `git push`, or PR creation action.

The purpose is to separate "the work is implemented" from "the work is safe to
publish." A completed implementation does not automatically imply that it should be
committed, pushed, or opened as a PR.

## Decision Outcomes

| Outcome | Meaning | Allowed actions |
| --- | --- | --- |
| `no-commit` | Work is not ready to preserve as a commit. | Report blockers and leave the worktree unchanged. |
| `local-commit` | Work should be preserved locally but is not ready for remote review. | Create local commit only. Do not push or create a PR. |
| `push-and-pr` | Work is ready for remote review. | Create logical commit(s), push the branch, and create or update a PR. |
| `blocked` | Publication decision cannot be made safely. | Stop and report the missing decision, evidence, or authority. |

Direct push to `main` is not a normal outcome. Use it only when the user explicitly
requests it and the workflow has fail-closed checks for branch, remote, and scope.

## Required Inputs

Before choosing an outcome, inspect and record:

- Current branch and upstream.
- `git status --short`.
- Diff scope: changed, deleted, renamed, and untracked files.
- Whether unrelated or generated local artifacts are present.
- Review status.
- Verification status.
- Context ledger path and whether it is current when required.
- Fallback/degraded-mode status.
- Whether the user asked for publication, local preservation, or analysis only.
- `node scripts/ai-workflow-check.mjs --repo .` result when Node is available.

## Outcome Criteria

Choose `no-commit` when any of these are true:

- Tests, lint, typecheck, build, or nearest available verification failed.
- Required review is missing or unresolved.
- Changed files include unrelated, generated, secret, credential, or local runtime
  artifacts.
- Scope is ambiguous or conflicts with active docs.
- The user asked for analysis only.

Choose `local-commit` when all of these are true:

- The changed scope is intentional and coherent.
- Verification evidence exists, or the no-runnable-test-surface exception is recorded.
- Review status is recorded.
- The work should be preserved for later continuation.
- Remote publication is not yet justified, requested, or safe.

Choose `push-and-pr` when all of these are true:

- The branch is not `main`.
- Worktree scope is clean except for intended files.
- Required review findings are addressed or explicitly rejected with reasons.
- Required verification passed or an allowed fallback is documented.
- Context ledger is current when required.
- PR title/body can truthfully describe scope, verification, skipped checks, and risks.
- GitHub/network publication is available, or the fallback protocol is followed.

Choose `blocked` when the agent cannot distinguish the correct outcome without a
material user decision, missing authority, or unsafe side effect.

## Decision Record Template

Use this in the final report, context ledger, and PR body when applicable.

```text
Git publication decision: <no-commit|local-commit|push-and-pr|blocked>
Reason: <why this outcome is correct>
Branch: <current branch>
Upstream: <upstream or none>
Dirty scope: <intended files plus notable excluded/untracked files>
Review status: <completed|degraded|missing|not applicable>
Verification status: <passed|degraded|failed|not runnable>
Ledger: <path or allowed exception>
Fallback status: <none or summary>
Next git action: <none|commit only|push branch and create PR|blocked>
```

## Commit Message Convention

Use Conventional Commits for the header and the project Lore protocol for the
trailers. This keeps the history readable by developers and compatible with
automation such as changelog generation, semantic versioning, and commit linting.

Required header format:

```text
<type>[optional scope][!]: <description>
```

Common types:

| Type | Use for |
| --- | --- |
| `feat` | New user-facing or application behavior. |
| `fix` | Bug fixes. |
| `docs` | Documentation-only changes. |
| `test` | Test-only changes. |
| `refactor` | Behavior-preserving code changes. |
| `perf` | Performance improvements. |
| `build` | Build system or dependency changes. |
| `ci` | CI configuration or pipeline changes. |
| `chore` | Maintenance tasks that do not fit another type. |
| `style` | Formatting-only changes. |
| `revert` | Reverting previous commit(s). |

Use `!` after the type or scope for breaking API/user-flow changes, or add a
`BREAKING CHANGE:` footer. Keep the body short and use git-native trailers for
decision context.

Before committing from a prepared message file, validate the message with:

```bash
node scripts/ai-workflow-check.mjs --commit-message path/to/message.txt
```

This check verifies the Conventional Commit header and required Lore/publication
trailers. It complements `.gitmessage`; the template alone does not enforce
that trailers were filled in.

```text
<type>[optional scope][!]: <description>

<optional concise body: constraints, approach, or publication decision rationale>

Constraint: <external or project constraint that shaped the change>
Rejected: <alternative considered> | <reason it was rejected>
Confidence: <low|medium|high>
Scope-risk: <narrow|moderate|broad>
Directive: <forward-looking warning for future modifiers>
Tested: <verification run and result>
Not-tested: <known verification gaps>
Publication-decision: <no-commit|local-commit|push-and-pr|blocked>
Review: <review gate used or reason not applicable>
Ledger: <context ledger path or allowed lightweight exception>
```

Example:

```text
docs(workflow): add git publication decision gate

Separate implementation completion from Git publication so agents decide whether
to skip commit, commit locally, or push and open a PR.

Constraint: Workflow requires review, verification, and ledger evidence before completion
Rejected: Auto-push after implementation | it can publish unverified or unrelated changes
Confidence: high
Scope-risk: narrow
Directive: Do not use push-and-pr unless the publication gate passes
Tested: git diff --check
Not-tested: App tests not runnable because package.json is not present
Publication-decision: local-commit
Review: self-review, docs-only workflow change
Ledger: docs/ai-workflow/runs/20260518-1751-git-publication-decision.md
```

## PR Body Convention

When the decision is `push-and-pr`, the PR body must include:

- What changed.
- Why it changed.
- Docs consulted.
- Review status.
- Verification commands and results.
- Context ledger path or allowed exception.
- Fallback/degraded-mode status.
- Known risks and skipped checks.
- Git publication decision record.
