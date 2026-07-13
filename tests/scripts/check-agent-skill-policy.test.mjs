import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  discoverSkillPolicyTargets,
  evaluateSkillPolicy,
  validateSkillPolicy,
} from "../../scripts/check-agent-skill-policy.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const command = {
  addAll: ["git", "add", "-A"].join(" "),
  branchDelete: ["git", "branch", "-d", "feature"].join(" "),
  checkout: ["git", "checkout", "main"].join(" "),
  commitTracked: ["git", "commit", "-m", "done"].join(" "),
  merge: ["git", "merge", "feature"].join(" "),
  prCreate: ["gh", "pr", "create"].join(" "),
  push: ["git", "push", "origin", "feature"].join(" "),
  runAddAll: ["Run", "git", "add", "-A"].join(" "),
  runCheckout: ["Run", "git", "checkout", "main"].join(" "),
  runCommitTracked: ["Run", "git", "commit", "-m", "done"].join(" "),
  runMerge: ["Run", "git", "merge", "feature"].join(" "),
  runPush: ["Run", "git", "push", "origin", "feature"].join(" "),
  runWorktreeAdd: [
    "Run",
    "git",
    "worktree",
    "add",
    ".worktrees/task",
    "-b",
    "codex/task",
  ].join(" "),
  runWorktreeRemove: ["Run", "git", "worktree", "remove", "path"].join(" "),
  runWorktreeRemoveShortForce: [
    "Run",
    "git",
    "worktree",
    "remove",
    "-f",
    "path",
  ].join(" "),
  worktreeAdd: [
    "git",
    "worktree",
    "add",
    ".worktrees/task",
    "-b",
    "codex/task",
  ].join(" "),
  worktreeRemove: ["git", "worktree", "remove", "path"].join(" "),
  worktreeRemoveForced: ["git", "worktree", "remove", "path", "--force"].join(
    " ",
  ),
};

function issueIds(skillName, content) {
  return validateSkillPolicy({ skillName, content }).map((issue) => issue.id);
}

describe("validateSkillPolicy", () => {
  test("requires plans and plan executors to preserve the current Git authority envelope", () => {
    expect(
      issueIds(
        "writing-plans",
        "Step 5: Commit\ngit add src/example.tsx\ngit commit -m \"feat: example\"",
      ),
    ).toContain("PLAN_COMMIT_AUTHORITY");
    expect(
      issueIds(
        "executing-plans",
        "Load the plan and execute every task exactly, including its Git steps.",
      ),
    ).toContain("PLAN_EXECUTION_AUTHORITY");

    const guardedPlan =
      "A plan never grants Git authority. Record a verified diff checkpoint; stage or commit only when the current user or project contract grants the exact action.";
    expect(issueIds("writing-plans", guardedPlan)).not.toContain("PLAN_COMMIT_AUTHORITY");
    expect(issueIds("executing-plans", guardedPlan)).not.toContain(
      "PLAN_EXECUTION_AUTHORITY",
    );
  });

  test("requires publish authority before design or implementer commits", () => {
    expect(
      issueIds("brainstorming", "Write design doc and commit your work."),
    ).toContain("SPEC_COMMIT_AUTHORITY");
    expect(
      issueIds(
        "brainstorming",
        "Write the design doc. Commit only when project publish authority permits it.",
      ),
    ).not.toContain("SPEC_COMMIT_AUTHORITY");
    expect(
      issueIds(
        "brainstorming",
        "Commit only when project publish authority permits it. Later: Commit the design document to git.",
      ),
    ).toContain("SPEC_COMMIT_AUTHORITY");

    expect(
      issueIds(
        "subagent-driven-development",
        "Implement, test, then Commit your work and report back.",
      ),
    ).toContain("IMPLEMENTER_COMMIT_AUTHORITY");
    expect(
      issueIds(
        "subagent-driven-development",
        "Commit only when the parent passes an authority envelope; otherwise return the verified diff.",
      ),
    ).not.toContain("IMPLEMENTER_COMMIT_AUTHORITY");
    expect(
      issueIds(
        "subagent-driven-development",
        "Commit only when the parent passes an authority envelope; otherwise return the verified diff.\n4. Commit your work.",
      ),
    ).toContain("IMPLEMENTER_COMMIT_AUTHORITY");
    expect(
      issueIds(
        "subagent-driven-development",
        `Authority envelope is local-edit-only and returns a verified diff.\n${command.commitTracked}`,
      ),
    ).toContain("IMPLEMENTER_COMMIT_AUTHORITY");
    expect(
      issueIds(
        "subagent-driven-development",
        `Authority envelope is local-edit-only and returns a verified diff.\n${command.addAll}`,
      ),
    ).toContain("IMPLEMENTER_COMMIT_AUTHORITY");
    for (const mutation of [
      command.runAddAll,
      command.runCommitTracked,
      command.runPush,
    ]) {
      expect(
        issueIds(
          "subagent-driven-development",
          `Authority envelope is local-edit-only and returns a verified diff.\n${mutation}`,
        ),
      ).toContain("IMPLEMENTER_COMMIT_AUTHORITY");
    }
    expect(
      issueIds(
        "subagent-driven-development",
        "Authority envelope defaults to local-edit-only and returns a verified diff. Record BASELINE_DIRTY_PATHS, WRITE_SCOPE, TASK_DIFF_SCOPE, and overlap. Never commit your work.",
      ),
    ).not.toContain("IMPLEMENTER_COMMIT_AUTHORITY");
    expect(
      issueIds(
        "subagent-driven-development",
        "The controller retains authority for branch creation, commit, push, PR, merge, and cleanup. Authority envelope verified diff BASELINE_DIRTY_PATHS WRITE_SCOPE TASK_DIFF_SCOPE overlap.",
      ),
    ).toContain("CONTROLLER_SELF_AUTHORITY");
    expect(
      issueIds(
        "subagent-driven-development",
        "The controller retains responsibility for enforcing boundaries. Neither controller nor child has authority unless the current user request or active project contract grants the exact action. Authority envelope verified diff BASELINE_DIRTY_PATHS WRITE_SCOPE TASK_DIFF_SCOPE overlap.",
      ),
    ).not.toContain("CONTROLLER_SELF_AUTHORITY");
  });

  test("requires authority for Git mutations and publishing in every nested skill", () => {
    for (const directive of [
      command.runPush,
      command.runCheckout,
      command.runMerge,
      `Run ${command.prCreate} --base main`,
    ]) {
      expect(issueIds("nested-executor", directive)).not.toEqual([]);
    }

    expect(
      issueIds(
        "nested-executor",
        `Only after the user selects the publish option and protected-branch checks pass.\nAuthority envelope: action=push; target=origin:feature; status=granted.\n${command.runPush}`,
      ),
    ).not.toContain("PUBLISH_AUTHORITY");
    expect(
      issueIds(
        "nested-executor",
        `Authority envelope: action=checkout; target=main; status=granted.\n${command.runCheckout}`,
      ),
    ).not.toContain("GIT_MUTATION_AUTHORITY");

    const staleIntegrationGuard = [
      "The current user or project contract grants the exact action.",
      ...Array.from({ length: 30 }, (_, index) => `Unrelated guidance ${index}.`),
      command.runMerge,
    ].join("\n");
    expect(issueIds("nested-executor", staleIntegrationGuard)).toContain(
      "INTEGRATE_AUTHORITY",
    );
    expect(
      issueIds(
        "nested-executor",
        `Authority envelope: action=merge; target=feature; status=granted.\n${command.runMerge}`,
      ),
    ).not.toContain("INTEGRATE_AUTHORITY");
  });

  test("binds stage and commit authority to the exact action and target", () => {
    const stageOnly = [
      "Authority envelope: action=stage; target=worktree; status=granted.",
      command.runCommitTracked,
    ].join("\n");
    expect(issueIds("nested-executor", stageOnly)).toContain(
      "GIT_MUTATION_AUTHORITY",
    );

    const commitOnly = [
      "Authority envelope: action=commit; target=index; status=granted.",
      command.runAddAll,
    ].join("\n");
    expect(issueIds("nested-executor", commitOnly)).toContain(
      "GIT_MUTATION_AUTHORITY",
    );

    expect(
      issueIds(
        "nested-executor",
        `Authority envelope: action=stage; target=worktree; status=granted.\n${command.runAddAll}`,
      ),
    ).not.toContain("GIT_MUTATION_AUTHORITY");
    expect(
      issueIds(
        "nested-executor",
        `Authority envelope: action=commit; target=index; status=granted.\n${command.runCommitTracked}`,
      ),
    ).not.toContain("GIT_MUTATION_AUTHORITY");
    for (const unsafeCommit of [
      "Run git commit -am x",
      "Run git commit --amend --no-edit",
      "Run git commit topic.txt -m x",
    ]) {
      expect(
        issueIds(
          "nested-executor",
          `Authority envelope: action=commit; target=index; status=granted.\n${unsafeCommit}`,
        ),
      ).toContain("GIT_MUTATION_AUTHORITY");
    }
    expect(
      issueIds(
        "nested-executor",
        "Authority envelope: action=stage; target=worktree; status=granted.\nRun git add .",
      ),
    ).not.toContain("GIT_MUTATION_AUTHORITY");
    expect(
      issueIds(
        "nested-executor",
        "Authority envelope: action=stage; target=pathspec:src/example.ts; status=granted.\nRun git add src/example.ts",
      ),
    ).not.toContain("GIT_MUTATION_AUTHORITY");
  });

  test("binds push and PR authority to the exact validated target", () => {
    const wrongPushTarget = [
      "The user selected the publish option.",
      "Authority envelope: action=push; target=origin:feature; status=granted.",
      "Protected-branch checks pass.",
      "Run git push upstream feature",
    ].join("\n");
    expect(issueIds("nested-executor", wrongPushTarget)).toContain(
      "PUBLISH_AUTHORITY",
    );

    const exactPushTarget = [
      "The user selected the publish option.",
      "Authority envelope: action=push; target=origin:feature; status=granted.",
      "Protected-branch checks pass.",
      command.runPush,
    ].join("\n");
    expect(issueIds("nested-executor", exactPushTarget)).not.toContain(
      "PUBLISH_AUTHORITY",
    );

    const wrongPrTarget = [
      "The user selected the publish option.",
      "Authority envelope: action=pr-create; target=blackstarzck/topik:develop; status=granted.",
      "Protected-branch checks pass.",
      "Run gh pr create --repo blackstarzck/topik --base main",
    ].join("\n");
    expect(issueIds("nested-executor", wrongPrTarget)).toContain(
      "PUBLISH_AUTHORITY",
    );

    const exactPrTarget = [
      "The user selected the publish option.",
      "Authority envelope: action=pr-create; target=blackstarzck/topik:main; status=granted.",
      "Protected-branch checks pass.",
      "Run gh pr create --repo blackstarzck/topik --base main",
    ].join("\n");
    expect(issueIds("nested-executor", exactPrTarget)).not.toContain(
      "PUBLISH_AUTHORITY",
    );

    const implicitRepository = [
      "The user selected the publish option.",
      "Authority envelope: action=pr-create; target=current-repo:main; status=granted.",
      "Protected-branch checks pass.",
      "Run gh pr create --base main",
    ].join("\n");
    expect(issueIds("nested-executor", implicitRepository)).toContain(
      "PUBLISH_AUTHORITY",
    );

    const chainedWithoutPrAuthority = [
      "The user selected the publish option and protected-branch checks pass.",
      "Authority envelope: action=push; target=origin:feature; status=granted.",
      "Run git push origin feature; gh pr create --repo blackstarzck/topik --base main",
    ].join("\n");
    expect(issueIds("nested-executor", chainedWithoutPrAuthority)).toContain(
      "PUBLISH_AUTHORITY",
    );

    const chainedWithExactAuthorities = [
      "The user selected the publish option and protected-branch checks pass.",
      "Authority envelope: action=push; target=origin:feature; status=granted.",
      "Authority envelope: action=pr-create; target=blackstarzck/topik:main; status=granted.",
      "Run git push origin feature; gh pr create --repo blackstarzck/topik --base main",
    ].join("\n");
    expect(issueIds("nested-executor", chainedWithExactAuthorities)).not.toContain(
      "PUBLISH_AUTHORITY",
    );
  });

  test("binds integration, navigation, and worktree authority to exact actions and targets", () => {
    expect(
      issueIds(
        "nested",
        "Authority envelope: action=merge; target=feature-a; status=granted.\nRun git rebase main.",
      ),
    ).toContain("INTEGRATE_AUTHORITY");
    expect(
      issueIds(
        "nested",
        "Authority envelope: action=pull; target=origin/main; status=granted.\nRun git checkout main.",
      ),
    ).toContain("GIT_MUTATION_AUTHORITY");
    expect(
      issueIds(
        "nested",
        "Explicit user consent and protected-branch checks pass. Authority envelope: action=worktree-add; target=codex/one; status=granted.\nRun git worktree add .worktrees/two -b codex/two.",
      ),
    ).toContain("WORKTREE_CREATE_AUTHORITY");

    expect(
      issueIds(
        "nested",
        "Authority envelope: action=rebase; target=main; status=granted.\nRun git rebase main.",
      ),
    ).not.toContain("INTEGRATE_AUTHORITY");
    expect(
      issueIds(
        "nested",
        "Authority envelope: action=checkout; target=main; status=granted.\nRun git checkout main.",
      ),
    ).not.toContain("GIT_MUTATION_AUTHORITY");
  });

  test("requires every Git command to have preceding exact authority", () => {
    expect(
      issueIds(
        "nested",
        "Run git rebase main.\nAuthority envelope: action=rebase; target=main; status=granted.",
      ),
    ).toContain("INTEGRATE_AUTHORITY");

    expect(
      issueIds(
        "nested",
        "Authority envelope: action=merge; target=allowed; status=granted. Run git merge forbidden && git merge allowed.",
      ),
    ).toContain("INTEGRATE_AUTHORITY");

    expect(
      issueIds(
        "nested",
        "Authority envelope: action=checkout; target=allowed; status=granted. Run git checkout forbidden || git checkout allowed.",
      ),
    ).toContain("GIT_MUTATION_AUTHORITY");

    expect(
      issueIds(
        "nested",
        [
          "The user selected the publish option and protected-branch checks pass.",
          "Authority envelope: action=push; target=origin:allowed; status=granted.",
          "Run git push origin allowed && git push origin forbidden.",
        ].join("\n"),
      ),
    ).toContain("PUBLISH_AUTHORITY");
  });

  test("recognizes shell control operators, Git global options, and env wrappers", () => {
    for (const chained of [
      "Authority envelope: action=merge; target=allowed; status=granted. Run git merge forbidden & git merge allowed.",
      "Authority envelope: action=merge; target=allowed; status=granted. Run git merge forbidden | git merge allowed.",
    ]) {
      expect(issueIds("nested", chained)).toContain("INTEGRATE_AUTHORITY");
    }
    expect(issueIds("nested", "Run git -C . merge forbidden.")).toContain(
      "INTEGRATE_AUTHORITY",
    );
    expect(
      issueIds("nested", "Run env GIT_DIR=.git git merge forbidden."),
    ).toContain("INTEGRATE_AUTHORITY");
    expect(issueIds("nested", "Run command git merge forbidden.")).toContain(
      "INTEGRATE_AUTHORITY",
    );
    expect(issueIds("nested", "Run sudo git checkout forbidden.")).toContain(
      "GIT_MUTATION_AUTHORITY",
    );
    expect(
      issueIds(
        "nested",
        "Authority envelope: action=merge; target=allowed; status=granted. Run git merge forbidden allowed.",
      ),
    ).toContain("INTEGRATE_AUTHORITY");
    expect(
      issueIds(
        "nested",
        [
          "The user selected the publish option and protected-branch checks pass.",
          "Authority envelope: action=push; target=origin:allowed; status=granted.",
          "Run git push origin allowed forbidden.",
        ].join("\n"),
      ),
    ).toContain("PUBLISH_AUTHORITY");
    expect(issueIds("nested", "Run git --no-pager merge forbidden.")).toContain(
      "INTEGRATE_AUTHORITY",
    );
    expect(issueIds("nested", "Run git.exe merge forbidden.")).toContain(
      "INTEGRATE_AUTHORITY",
    );
    expect(issueIds("nested", "Run git.exe add .")).toContain(
      "GIT_MUTATION_AUTHORITY",
    );
    expect(issueIds("nested", "Run git.cmd push origin main.")).toContain(
      "PUBLISH_AUTHORITY",
    );
    expect(issueIds("nested", "Run GIT_DIR=.git git merge forbidden.")).toContain(
      "INTEGRATE_AUTHORITY",
    );
    for (const executable of [
      'Run "git" merge forbidden.',
      'Run & "git.exe" merge forbidden.',
      'Run & "C:\\Program Files\\Git\\bin\\git.exe" add .',
      "Run C:\\Git\\bin\\git.exe merge forbidden.",
    ]) {
      expect(issueIds("nested", executable)).not.toEqual([]);
    }
  });

  test("fails closed for Git aliases and unclassified mutations", () => {
    for (const mutation of [
      "Run git -c alias.deploy=push deploy collab main",
      "Run git config alias.deploy push\nRun git deploy collab main",
      "Run git reset --hard HEAD~1",
      "Run git clean -fdx",
      "Run git branch -D main",
      "Run git cherry-pick deadbeef",
      "Run git --no-pager reset --hard HEAD~1",
      "Run git --paginate clean -fdx",
      "Run git --literal-pathspecs cherry-pick deadbeef",
    ]) {
      expect(issueIds("nested", mutation)).not.toEqual([]);
    }
    for (const mutation of [
      "Always git push collab main",
      "You must git push collab main",
      "Please git reset --hard HEAD~1",
      "Now git clean -fdx",
      "The agent should git commit -am done",
      "Automatically git checkout main",
      "Next, git merge feature",
      "Perform git branch -D main",
    ]) {
      expect(issueIds("nested", mutation)).not.toEqual([]);
    }
    for (const readOnly of [
      "Run git status --short --branch",
      "Run git diff --check",
      "Run git log -1",
      "Run git rev-parse HEAD",
      "Run git branch --show-current",
      "Run git worktree list --porcelain",
    ]) {
      expect(issueIds("nested", readOnly)).not.toContain("GIT_MUTATION_AUTHORITY");
    }
  });

  test("rejects negated or non-canonical authority envelopes", () => {
    expect(
      issueIds(
        "nested",
        [
          "No Authority envelope: action=push; target=origin:feature; status=granted.",
          "The user selected the publish option and protected-branch checks pass.",
          "Run git push origin feature",
        ].join("\n"),
      ),
    ).toContain("PUBLISH_AUTHORITY");
    expect(
      issueIds(
        "nested",
        "Do not grant Authority envelope: action=commit; target=index; status=granted.\nRun git commit -m done",
      ),
    ).toContain("GIT_MUTATION_AUTHORITY");
    expect(
      issueIds(
        "nested",
        "Record Authority envelope: action=commit; target=index; status=granted. as prose.\nRun git commit -m done",
      ),
    ).toContain("GIT_MUTATION_AUTHORITY");
    expect(
      issueIds(
        "nested",
        "Do not grant the following authority.\nAuthority envelope: action=commit; target=index; status=granted.\nRun git commit -m done",
      ),
    ).toContain("GIT_MUTATION_AUTHORITY");
    expect(
      issueIds(
        "nested",
        "The authority below is denied.\nAuthority envelope: action=merge; target=feature; status=granted.\nRun git merge feature",
      ),
    ).toContain("INTEGRATE_AUTHORITY");
  });

  test("rejects dynamic integration targets, branch creation options, and explicit PR heads", () => {
    for (const mutation of [
      "Authority envelope: action=merge; target=$BRANCH; status=granted.\nRun git merge $BRANCH",
      "Authority envelope: action=switch; target=topic; status=granted.\nRun git switch -c topic",
      "Authority envelope: action=checkout; target=topic; status=granted.\nRun git checkout -b topic",
      "Authority envelope: action=merge; target=topic; status=granted.\nRun git merge --no-edit topic",
      "Authority envelope: action=pull; target=$REMOTE/$BRANCH; status=granted.\nRun git pull $REMOTE $BRANCH",
    ]) {
      expect(issueIds("nested", mutation)).not.toEqual([]);
    }
    expect(
      issueIds(
        "nested",
        [
          "The user selected the publish option.",
          "Protected-branch checks pass.",
          "Authority envelope: action=pr-create; target=owner/repo:main; status=granted.",
          "Run gh pr create --repo owner/repo --base main --head other",
        ].join("\n"),
      ),
    ).toContain("PUBLISH_AUTHORITY");
    for (const shortHead of ["-H other", "-H=other", "-Hother"]) {
      expect(
        issueIds(
          "nested",
          [
            "The user selected the publish option.",
            "Protected-branch checks pass.",
            "Authority envelope: action=pr-create; target=owner/repo:main; status=granted.",
            `Run gh pr create --repo owner/repo --base main ${shortHead}`,
          ].join("\n"),
        ),
      ).toContain("PUBLISH_AUTHORITY");
    }
    for (const duplicateTarget of [
      "Run gh pr create --repo owner/repo --base main --base production",
      "Run gh pr create --repo owner/repo --base main --repo attacker/deploy",
    ]) {
      expect(
        issueIds(
          "nested",
          [
            "The user selected the publish option.",
            "Protected-branch checks pass.",
            "Authority envelope: action=pr-create; target=owner/repo:main; status=granted.",
            duplicateTarget,
          ].join("\n"),
        ),
      ).toContain("PUBLISH_AUTHORITY");
    }
  });

  test("rejects dynamic, URL, and malformed publish targets", () => {
    const action = "pu" + "sh";
    const publishGuard =
      "The user selected the publish option and protected-branch checks pass.";
    const commandText = (...parts) => ["Run", "git", action, ...parts].join(" ");
    expect(
      issueIds(
        "nested",
        `${publishGuard}\nAuthority envelope: action=${action}; target=https://github.com/o/r.git:main; status=granted.\n${commandText("https://github.com/o/r.git", "main")}`,
      ),
    ).toContain("PUBLISH_AUTHORITY");
    expect(
      issueIds(
        "nested",
        `${publishGuard}\nAuthority envelope: action=${action}; target=$REMOTE:main; status=granted.\n${commandText("$REMOTE", "main")}`,
      ),
    ).toContain("PUBLISH_AUTHORITY");
    expect(
      issueIds(
        "nested",
        `${publishGuard}\nAuthority envelope: action=pr-create; target=$REPO:$BASE; status=granted.\nRun gh pr create --repo $REPO --base $BASE`,
      ),
    ).toContain("PUBLISH_AUTHORITY");
    expect(
      issueIds(
        "nested",
        `${publishGuard}\nAuthority envelope: action=${action}; target=origin:main; status=granted.\n${commandText("origin", "-u", "main")}`,
      ),
    ).toContain("PUBLISH_AUTHORITY");
  });

  test("protects the collab deployment target on every skill surface", () => {
    const guardedCollabPush = [
      "The user selected the publish option.",
      "Authority envelope: action=push; target=collab:main; status=granted.",
      "Protected-branch checks pass and explicit deployment confirmation is present.",
      "Run git push collab main",
    ].join("\n");
    expect(issueIds("nested-executor", guardedCollabPush)).toContain(
      "COLLAB_TARGET_DIRECTIVE",
    );

    const guardedCollabPr = [
      "The user selected the publish option.",
      "Authority envelope: action=pr-create; target=collab:main; status=granted.",
      "Protected-branch checks pass and explicit deployment confirmation is present.",
      "Run gh pr create --repo collab --base main",
    ].join("\n");
    expect(issueIds("nested-executor", guardedCollabPr)).toContain(
      "COLLAB_TARGET_DIRECTIVE",
    );
  });

  test("isolates local-edit-only review scope from earlier task diffs", () => {
    expect(
      issueIds(
        "subagent-driven-development",
        "The authority envelope defaults to local-edit-only and returns the verified diff.",
      ),
    ).toContain("LOCAL_EDIT_REVIEW_SCOPE");
    expect(
      issueIds(
        "subagent-driven-development",
        "For local-edit-only record BASELINE_DIRTY_PATHS and WRITE_SCOPE. If they overlap, stop before editing. Review only the TASK_DIFF_SCOPE.",
      ),
    ).not.toContain("LOCAL_EDIT_REVIEW_SCOPE");
    expect(
      issueIds(
        "subagent-driven-development",
        "For local-edit-only record BASELINE_DIRTY_PATHS, WRITE_SCOPE, TASK_DIFF_SCOPE, and overlap. Review the cumulative working-tree diff.",
      ),
    ).toContain("CUMULATIVE_DIFF_REVIEW");
  });

  test("requires explicit authority before branch or worktree creation", () => {
    expect(
      issueIds(
        "using-git-worktrees",
        "Run git worktree add .worktrees/task -b codex/task.",
      ),
    ).toContain("WORKTREE_CREATE_AUTHORITY");
    expect(
      issueIds(
        "using-git-worktrees",
        "After explicit user consent and protected-branch checks pass.\nAuthority envelope: action=worktree-add; target=codex/task; status=granted.\nRun git worktree add .worktrees/task -b codex/task.",
      ),
    ).not.toContain("WORKTREE_CREATE_AUTHORITY");
    expect(
      issueIds(
        "using-git-worktrees",
        `Explicit user consent and protected-branch checks exist elsewhere.\nLater run ${command.worktreeAdd}.`,
      ),
    ).toContain("WORKTREE_CREATE_AUTHORITY");
    expect(
      issueIds(
        "using-git-worktrees",
        `Branch creation authority is not provided. Protected-branch checks pass.\n${command.runWorktreeAdd}`,
      ),
    ).toContain("WORKTREE_CREATE_AUTHORITY");

    expect(
      issueIds(
        "using-git-worktrees",
        "If the requested target is blocked, choose a permitted feature branch.",
      ),
    ).toContain("BRANCH_TARGET_SUBSTITUTION");
    expect(
      issueIds(
        "using-git-worktrees",
        "Native worktree tools handle cleanup automatically.",
      ),
    ).toContain("NATIVE_CLEANUP_ASSUMPTION");
    expect(
      issueIds(
        "using-git-worktrees",
        "If creation fails, work in the current directory instead.",
      ),
    ).toContain("WORKTREE_FALLBACK_OWNERSHIP");

    expect(
      issueIds(
        "using-git-worktrees",
        "Add .worktrees to .gitignore and commit the change.",
      ),
    ).toContain("IGNORE_COMMIT_AUTHORITY");
  });

  test("requires a user-selected publish or integration option", () => {
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Run git push -u origin feature and gh pr create.",
      ),
    ).toContain("PUBLISH_AUTHORITY");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Only after the user selects the publish option and protected-branch checks pass.\nAuthority envelope: action=push; target=origin:feature; status=granted.\ngit push -u origin feature.",
      ),
    ).not.toContain("PUBLISH_AUTHORITY");
    const pinnedPublish =
      `Only after the user selects the publish option and protected-branch checks pass.\n` +
      `Authority envelope: action=pr-create; target=blackstarzck/topik:main; status=granted.\n` +
      `Protected target collab requires explicit deployment confirmation.\n${command.prCreate} --repo blackstarzck/topik --base main`;
    expect(
      issueIds("finishing-a-development-branch", pinnedPublish),
    ).not.toContain("PUBLISH_AUTHORITY");
    expect(
      issueIds("finishing-a-development-branch", pinnedPublish),
    ).not.toContain("PR_BASE_PINNING");
    expect(
      issueIds("finishing-a-development-branch", pinnedPublish),
    ).not.toContain("COLLAB_PROTECTION");
    expect(
      issueIds(
        "finishing-a-development-branch",
        `The user selected publish and collab requires explicit deployment confirmation.\n${command.prCreate} --title feature`,
      ),
    ).toContain("PR_BASE_PINNING");
    const multilinePrWithoutBase = [
      "Only after the user selects the publish option and protected-branch checks pass.",
      "Authority envelope: action=pr-create; target=blackstarzck/topik:main; status=granted.",
      ["Run", "gh", "pr", "create", "\\"].join(" "),
      "  --title feature",
      "  --body body",
    ].join("\n");
    expect(
      issueIds("finishing-a-development-branch", multilinePrWithoutBase),
    ).toContain("PR_BASE_PINNING");
    const multilinePrWithBase = `${multilinePrWithoutBase}\n  --repo blackstarzck/topik\n  --base main`;
    expect(
      issueIds("finishing-a-development-branch", multilinePrWithBase),
    ).not.toContain("PR_BASE_PINNING");
    const prohibitedPr = [
      "Never",
      "use",
      "gh",
      "pr",
      "create",
      "without",
      "--base.",
    ].join(" ");
    expect(
      issueIds("finishing-a-development-branch", prohibitedPr),
    ).not.toContain("PUBLISH_AUTHORITY");
    expect(
      issueIds("finishing-a-development-branch", prohibitedPr),
    ).not.toContain("PR_BASE_PINNING");
    const chainedPrWithoutBase = [
      "Protected target collab requires explicit deployment confirmation.",
      "The user selects the publish option and protected-branch checks pass.",
      "Authority envelope: action=push; target=origin:feature; status=granted.",
      [
        "Run",
        "git",
        "push",
        "origin",
        "feature;",
        "gh",
        "pr",
        "create",
        "--title",
        "feature.",
      ].join(" "),
    ].join("\n");
    expect(
      issueIds("finishing-a-development-branch", chainedPrWithoutBase),
    ).toContain("PR_BASE_PINNING");
    expect(
      issueIds(
        "finishing-a-development-branch",
        `Present options, then execute choice. Protected target collab requires explicit deployment confirmation.\n${command.push}`,
      ),
    ).toContain("PUBLISH_AUTHORITY");

    expect(
      issueIds(
        "finishing-a-development-branch",
        "Run git merge feature or git rebase main.",
      ),
    ).toContain("INTEGRATE_AUTHORITY");
    expect(
      issueIds(
        "finishing-a-development-branch",
        `The user selected merge.\n${command.checkout}\n${command.merge}`,
      ),
    ).toContain("SHARED_CHECKOUT_INTEGRATION");
    expect(
      issueIds(
        "finishing-a-development-branch",
        `The user selected merge.\n${command.runCheckout}\n${command.runMerge}`,
      ),
    ).toContain("SHARED_CHECKOUT_INTEGRATION");
  });

  test("fails closed for destructive or harness-owned cleanup", () => {
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Run git branch -D feature and git worktree remove --force path.",
      ),
    ).toContain("DESTRUCTIVE_AUTHORITY");
    expect(
      issueIds(
        "finishing-a-development-branch",
        `Host or harness-owned worktrees are report-only.\n${command.runWorktreeRemove}`,
      ),
    ).toContain("REPORT_MODE_CLEANUP_DIRECTIVE");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Host worktrees are report-only.\n1. Invoke ExitWorktree now.",
      ),
    ).toContain("REPORT_MODE_CLEANUP_DIRECTIVE");
    expect(
      issueIds(
        "finishing-a-development-branch",
        `Type discard to confirm. Never use forced worktree cleanup.\n${command.runWorktreeRemoveShortForce}`,
      ),
    ).toContain("DESTRUCTIVE_AUTHORITY");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Host worktrees are report-only. Invoke ExitWorktree now.",
      ),
    ).toContain("REPORT_MODE_CLEANUP_DIRECTIVE");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Type discard to confirm before git branch -D feature. Never use git worktree remove --force.",
      ),
    ).not.toContain("DESTRUCTIVE_AUTHORITY");

    expect(
      issueIds(
        "finishing-a-development-branch",
        "Cleanup with git worktree remove path.",
      ),
    ).toContain("HARNESS_CLEANUP_BOUNDARY");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Host or harness-owned worktrees are report-only; do not remove them. git worktree remove is limited to owned paths.",
      ),
    ).not.toContain("HARNESS_CLEANUP_BOUNDARY");
    expect(
      issueIds(
        "finishing-a-development-branch",
        `Host or harness-owned worktrees are report-only; do not remove them.\n${command.worktreeRemove}\n${command.branchDelete}`,
      ),
    ).toContain("REPORT_MODE_CLEANUP_DIRECTIVE");
    expect(
      issueIds(
        "finishing-a-development-branch",
        `Type discard to confirm. Never use forced worktree cleanup.\n${command.worktreeRemoveForced}`,
      ),
    ).toContain("DESTRUCTIVE_AUTHORITY");
  });

  test("protects collab and keeps verification separate from authority", () => {
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Push the selected branch and create a PR.",
      ),
    ).toContain("COLLAB_PROTECTION");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Protected target collab requires explicit deployment confirmation from the project contract before push or PR.",
      ),
    ).not.toContain("COLLAB_PROTECTION");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Protected target collab requires explicit deployment confirmation.\nPush to collab now.",
      ),
    ).toContain("COLLAB_TARGET_DIRECTIVE");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Protected target collab requires explicit deployment confirmation.\n1. Open a PR against collab now.",
      ),
    ).toContain("COLLAB_TARGET_DIRECTIVE");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Open a PR against collab now.",
      ),
    ).toContain("COLLAB_TARGET_DIRECTIVE");
    expect(
      issueIds(
        "finishing-a-development-branch",
        "Protected target collab requires explicit deployment confirmation.\nMerge into collab now.",
      ),
    ).toContain("COLLAB_TARGET_DIRECTIVE");

    expect(
      issueIds(
        "verification-before-completion",
        "After verification passes, commit and create the PR.",
      ),
    ).toContain("VERIFICATION_AUTHORITY_BOUNDARY");
    expect(
      issueIds(
        "verification-before-completion",
        "Verification is necessary but not sufficient and publish authority is required.\nAfter verification passes:\n1. Stage the files.\n2. Commit and push the branch.",
      ),
    ).toContain("VERIFICATION_AUTHORITY_BOUNDARY");
    expect(
      issueIds(
        "verification-before-completion",
        "Verification is necessary but not sufficient for commit or PR; project publish authority is still required.",
      ),
    ).not.toContain("VERIFICATION_AUTHORITY_BOUNDARY");
    expect(
      issueIds(
        "verification-before-completion",
        "Verification is necessary but not sufficient for commit or PR; project publish authority is still required.\nAfter verification passes, commit and create the PR.",
      ),
    ).toContain("VERIFICATION_AUTHORITY_BOUNDARY");
    expect(
      issueIds(
        "verification-before-completion",
        "Verification is necessary but not sufficient; publish authority is required.\nAfter verification passes, stage the files, commit them, and push the branch.",
      ),
    ).toContain("VERIFICATION_AUTHORITY_BOUNDARY");
  });

  test("requires reviewer prompts to replace cumulative Git ranges with task-owned patches", () => {
    expect(
      issueIds(
        "subagent-driven-development-code-reviewer",
        "BASELINE_DIRTY_PATHS WRITE_SCOPE TASK_DIFF_SCOPE overlap. Use the standard Git range template.",
      ),
    ).toContain("REVIEWER_TASK_DIFF_CONTRACT");
    expect(
      issueIds(
        "subagent-driven-development-code-reviewer",
        "BASELINE_DIRTY_PATHS WRITE_SCOPE TASK_DIFF_SCOPE overlap. For local-edit-only, the task-owned patch replaces the Git range section; do not use BASE_SHA or HEAD_SHA.",
      ),
    ).not.toContain("REVIEWER_TASK_DIFF_CONTRACT");
    expect(
      issueIds(
        "subagent-driven-development-code-reviewer",
        "BASELINE_DIRTY_PATHS WRITE_SCOPE TASK_DIFF_SCOPE overlap. For local-edit-only, the task-owned patch replaces the Git range section; do not use BASE_SHA or HEAD_SHA. Then review the entire working tree as well.",
      ),
    ).toContain("CUMULATIVE_DIFF_REVIEW");
  });
});

describe("evaluateSkillPolicy", () => {
  test("fails closed when a Markdown policy surface exceeds the bounded size", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "skill-policy-large-"));
    try {
      const skill = path.join(root, ".codex", "skills", "large", "SKILL.md");
      mkdirSync(path.dirname(skill), { recursive: true });
      writeFileSync(skill, "x".repeat(2 * 1024 * 1024 + 1), "utf8");

      await expect(discoverSkillPolicyTargets({ rootDir: root })).rejects.toThrow(/too large/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("discovers every regular Markdown skill surface recursively instead of filtering by filename", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "skill-policy-"));
    try {
      const nested = path.join(root, ".codex", "skills", "nested", "deeper", "SKILL.md");
      const reference = path.join(
        root,
        ".codex",
        "skills",
        "nested",
        "references",
        "codex-tools.md",
      );
      mkdirSync(path.dirname(nested), { recursive: true });
      mkdirSync(path.dirname(reference), { recursive: true });
      writeFileSync(nested, "Commit your work.\n", "utf8");
      writeFileSync(reference, "Stage the files now.\n", "utf8");

      const targets = await discoverSkillPolicyTargets({ rootDir: root });
      expect(targets).toEqual([
        expect.objectContaining({
          relativePath: ".codex/skills/nested/deeper/SKILL.md",
          skillName: "nested",
        }),
        expect.objectContaining({
          relativePath: ".codex/skills/nested/references/codex-tools.md",
        }),
      ]);
      expect((await evaluateSkillPolicy({ rootDir: root })).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "GIT_MUTATION_AUTHORITY",
            path: ".codex/skills/nested/deeper/SKILL.md",
          }),
          expect.objectContaining({
            id: "GIT_MUTATION_AUTHORITY",
            path: ".codex/skills/nested/references/codex-tools.md",
          }),
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps nested Markdown owned by its root skill policy", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "skill-policy-owner-"));
    try {
      const reference = path.join(
        root,
        ".codex",
        "skills",
        "writing-plans",
        "references",
        "helper.md",
      );
      mkdirSync(path.dirname(reference), { recursive: true });
      writeFileSync(reference, "Plans should use frequent commits after each task.\n", "utf8");

      const result = await evaluateSkillPolicy({ rootDir: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "PLAN_COMMIT_AUTHORITY",
            path: ".codex/skills/writing-plans/references/helper.md",
          }),
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("accepts the repository skill set only when every authority boundary is satisfied", async () => {
    const result = await evaluateSkillPolicy({ rootDir: repoRoot });
    expect(result.errors).toEqual([]);
  });
});
