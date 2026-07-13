---
name: finishing-a-development-branch
description: Use when implementation is complete, tests pass, and the verified branch needs an authorized publish, integration handoff, preservation, or report-only discard record
---

# Finishing a Development Branch

## Overview

Finish verified work without turning a workflow option into new Git or cleanup authority.

**Core principle:** Verify evidence → inspect the actual branch and base → reuse or present options → execute only the authorized non-destructive action → preserve the workspace.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## Project Authority Guard

The user's selected option is necessary but not sufficient. The active project contract separately controls publish, integration, deletion, and cleanup authority.

Protected target `collab` is a deployment branch. Any publish, merge, rebase, or PR involving `collab` requires the contract's explicit deployment confirmation. If that confirmation is absent, return `BLOCKED` and preserve the verified branch. Do not silently choose a different target.

Codex Desktop cleanup mode is currently `report`. This skill never mutates a shared base checkout and never deletes a branch or worktree, runs cleanup/prune, or invokes a native workspace-exit action. A future guarded-cleanup supervisor must prove owner, lease, PR head, dirty state, sensitive files, and process guards outside this task.

If the current user request already selected an allowed option, reuse it without presenting the menu again. Reusing an explicit choice avoids a redundant question; it does not grant any unmentioned action.

## The Process

### Step 1: Verify Fresh Evidence

Run the verification commands appropriate to the completed work. If any required check fails, report the failure and stop before publish or integration handoff.

### Step 2: Inspect State Read-Only

Record:

- current workspace path and whether it is app/harness managed
- current branch or detached HEAD
- current head SHA
- tracked, untracked, and ignored-sensitive status
- intended base from the user's request or existing PR
- whether the intended base is protected or deployment-connected

Do not infer ownership from a path prefix. Do not change branch, base, index, or another checkout during inspection.

### Step 3: Validate the Intended Base

The base must come from an explicit user request, an existing task/PR record, or the active project default. Record the exact validated base before offering a publish or integration option.

If the base is unknown, mismatched, or protected without the required confirmation, return `BLOCKED`. Never substitute another base automatically.

### Step 4: Present Options

When the user has not already selected one, present exactly these four options for a named feature branch:

1. Prepare an integration handoff for the validated base; do not merge in this task
2. Selected branch publication + PR against the explicit validated base
3. Keep the branch and workspace as-is
4. Record a discard request; preserve everything in report-only mode

For detached HEAD, omit option 1 and explain that branch creation requires separate authority.

### Step 5: Execute Choice

#### Option 1: Integration Handoff

Merge or rebase requires separate integration authority. This task does not switch, update, or merge a shared base checkout.

Return a handoff containing the source branch/head, exact validated base, fresh verification evidence, dirty-state evidence, and the requested integration method. Preserve the branch and workspace. A separately authorized neutral integration owner performs any actual integration.

#### Option 2: Publish and Create PR

Enter this section only after the user selects the publish option.

Proceed only when the current head, remote head, and exact validated base are known and the user or project contract supplies a matching structured envelope for each operation:

- `Authority envelope: action=push; target=<remote>:<ref>; status=granted.`
- `Authority envelope: action=pr-create; target=<repo>:<base>; status=granted.`

- The push target must match the selected remote and branch; never redirect it to a protected branch.
- PR creation must use explicit repository and base arguments matching the validated target.
- If the validated base is `collab`, require the separate deployment warning and confirmation before either action.
- Preserve the worktree for review feedback.

Report the actual pushed branch, PR base, PR URL, and draft/ready state. Do not claim a PR was published unless the remote operation succeeded.

#### Option 3: Preserve

Report the current branch, head, and workspace path. Make no Git or lifecycle mutation.

#### Option 4: Report-Only Discard

Explain what the discard would affect and require the exact word `discard` to record the user's destructive intent. Even after confirmation, current report mode performs no deletion. Return a `NEEDS_ATTENTION` cleanup candidate with branch, head, workspace path, dirty state, and preservation reasons.

### Step 6: Report-Only Cleanup

Always preserve the branch and workspace in the current operating mode. Host- or harness-owned worktrees are report-only; do not remove them or invoke an exit action.

The completion report must distinguish:

- verified
- committed
- pushed
- PR created
- integration requested or completed elsewhere
- cleanup candidate recorded
- workspace preserved

## Quick Reference

| Option                 | Action in this task                            | Workspace result |
| ---------------------- | ---------------------------------------------- | ---------------- |
| 1. Integration handoff | report exact source/base/evidence              | preserved        |
| 2. Publish + PR        | authorized push and explicit validated PR base | preserved        |
| 3. Keep                | report only                                    | preserved        |
| 4. Discard request     | typed intent + `NEEDS_ATTENTION` record        | preserved        |

## Red Flags

**Never:**

- treat test success or an option label as authority
- change an unknown or blocked base to a convenient alternative
- target `collab` without explicit deployment confirmation
- mutate a shared base checkout from a task worktree
- delete or prune a branch/worktree in current report mode
- infer cleanup ownership from a directory name
- invoke native workspace exit as a cleanup shortcut
- use a force flag for publish or cleanup

**Always:**

- verify first
- record the exact current head and validated base
- fail closed on target mismatch or missing authority
- preserve the workspace after publish or handoff
- report actual states separately
