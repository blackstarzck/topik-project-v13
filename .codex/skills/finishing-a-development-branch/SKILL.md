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

Canonical production target: collab/main is the local remote alias for https://github.com/keduall/topik-project-v13.git refs/heads/main; a Keduall clone calls the same ref origin/main. This checkout's unqualified `origin/main` still means the `blackstarzck` repository, so normalize the repository identity before applying authority.

A user request to promote to production starts release orchestration; it does not authorize an immediate collab/main update.

For each contract version, the first two successful production promotions pause once at AWAITING_PROD_APPROVAL before the main merge; later runs may use AUTO. An explicit production-mutation request does not bypass those first two confirmations.

Reset the two-confirmation policy after a pipeline contract, DB workflow or compatibility policy, Vercel project environment or domain, remote branch or auth profile change, or after a deployment failure, rollback, or security incident.

Before promotion, require a secret-safe security artifact audit, credential rotation, and the approved history response. Production DB automatic apply stays disabled until the baseline and trusted workflow gates pass.

An explicit production request selects the release workflow and target, but not every internal Git action. Record the matching authority envelope, start or resume the `PromotionRunV1`, and stop at `AWAITING_PROD_APPROVAL` when the policy requires it. A discussion, status question, or PR-only request does not authorize updating production.

Managed task workspaces may be cleaned automatically only after their exact merge and ownership are proved by the lifecycle supervisor. Shared slots are retained, isolated worktrees may be removed non-force, and host/adopted folders are preserved. This skill never runs ad-hoc cleanup, mutates a shared base checkout, or invokes a native workspace-exit shortcut.

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

Treat `collab/main`, `keduall/topik-project-v13` `main`, and a Keduall clone's `origin/main` as the canonical production target above. Do not ask which of these aliases the user means. Before mutation, validate that the collab remote URL matches https://github.com/keduall/topik-project-v13.git. Accept an authenticated transport form only after normalizing it to that exact GitHub owner and repository.

If the base is unknown, the normalized repository differs, or the requested action lacks authority, return `BLOCKED`. Never substitute another base automatically.

### Step 4: Present Options

When the user has not already selected one, present exactly these four options for a named feature branch:

1. Prepare an integration handoff for the validated base; do not merge in this task
2. Selected branch publication + PR against the explicit validated base
3. Keep the branch and workspace as-is
4. Record a discard request; preserve everything in report-only mode

For detached HEAD, omit option 1 and explain that branch creation requires separate authority.

### Step 5: Execute Choice

#### Option 1: Integration Handoff

Local merge or rebase requires separate integration authority. This task does not switch, update, or merge a shared base checkout. A remote PR merge may be completed through the hosting API without mutating that checkout only when the current user explicitly requested that exact merge and all repository checks permit it.

When actual integration is not authorized, return a handoff containing the source branch/head, exact validated base, fresh verification evidence, dirty-state evidence, and the requested integration method. Preserve the branch and workspace for the separately authorized integration owner.

When the user requests production promotion, start or resume the release record. Do not merge the production PR from this generic branch-finishing step. The release workflow first proves the exact Black source SHA, candidate lineage, Keduall `stg` result, DB evidence, security precondition, and Vercel Preview. It then pauses at `AWAITING_PROD_APPROVAL` for the first two successful runs of the same contract or proceeds under `AUTO` only after that policy is proven.

#### Option 2: Publish and Create PR

Enter this section only after the user selects the publish option.

Proceed only when the current head, remote head, and exact validated base are known and the user or project contract supplies a matching structured envelope for each operation:

- `Authority envelope: action=push; target=<remote>:<ref>; status=granted.`
- `Authority envelope: action=pr-create; target=<repo>:<base>; status=granted.`

- The push target must match the selected remote and branch; never redirect it to a protected branch.
- PR creation must use explicit repository and base arguments matching the validated target.
- A PR targeting the canonical production branch does not update production by itself and never grants later merge authority.
- Direct push to Keduall `main` is not a release path. Use candidate → `stg` → `main` PRs with exact-parent validation.
- Preserve the worktree for review feedback.

Before mutation, validate that the collab remote URL matches https://github.com/keduall/topik-project-v13.git.

After a Keduall production mutation, verify that the Vercel production deployment for the exact resulting SHA reaches READY. A successful Git update with a missing, `ERROR`, `BLOCKED`, cancelled, or timed-out deployment is Git-reflected but deployment-incomplete; report that state and do not repeat the Git mutation.

Report the actual pushed branch, PR base, PR URL, draft/ready state, resulting production SHA, and Vercel result that applies to the chosen action. Do not claim a PR was published unless the remote operation succeeded, and do not claim production was deployed unless the exact-SHA deployment reached `READY`.

#### Option 3: Preserve

Report the current branch, head, and workspace path. Make no Git or lifecycle mutation.

#### Option 4: Report-Only Discard

Explain what the discard would affect and require the exact word `discard` to record the user's destructive intent. Even after confirmation, current report mode performs no deletion. Return a `NEEDS_ATTENTION` cleanup candidate with branch, head, workspace path, dirty state, and preservation reasons.

### Step 6: Lifecycle-Owned Cleanup

Do not run cleanup directly from this skill. Report the task or release identity to the v3 lifecycle supervisor. It keeps `.worktrees/shared-dev`, removes only merge-proven managed isolated worktrees and non-protected task branches with non-force operations, and preserves host/adopted or ambiguous workspaces. `stg` and `main` are never cleanup candidates.

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
| 1. Integration handoff | report exact source/base/evidence              | lifecycle-owned  |
| 2. Publish + PR        | authorized push and explicit validated PR base | lifecycle-owned  |
| 3. Keep                | report only                                    | preserved        |
| 4. Discard request     | typed intent + `NEEDS_ATTENTION` record        | preserved        |

## Red Flags

**Never:**

- treat test success or an option label as authority
- change an unknown or blocked base to a convenient alternative
- treat merely mentioning the canonical production target as mutation authority
- treat explicit push or merge wording as a bypass for the first two production confirmations
- update Keduall `main` before the release record passes `stg`, DB, approval, and Vercel evidence gates
- accept a `collab` remote whose normalized GitHub owner or repository differs
- report a Git update as deployed before the exact-SHA Vercel production result is `READY`
- mutate a shared base checkout from a task worktree
- delete or prune a branch/worktree outside the lifecycle supervisor
- infer cleanup ownership from a directory name
- invoke native workspace exit as a cleanup shortcut
- use a force flag for publish or cleanup

**Always:**

- verify first
- record the exact current head and validated base
- fail closed on target mismatch or missing authority
- start or resume `PromotionRunV1` for a production request
- distinguish Git-reflected from deployment-complete
- leave workspace cleanup to the v3 lifecycle supervisor
- report actual states separately
