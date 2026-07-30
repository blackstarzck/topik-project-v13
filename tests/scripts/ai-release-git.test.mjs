import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const SENTINEL = "SENTINEL_CHILD_OUTPUT_MUST_NOT_LEAK";
const SHA = {
  source: "1".repeat(40),
  tree: "2".repeat(40),
  stg: "3".repeat(40),
  candidate: "4".repeat(40),
  main: "5".repeat(40),
  previous: "6".repeat(40),
  stgMerged: "7".repeat(40),
};
const BASELINE_SHA = "8".repeat(40);
const CANDIDATE_BRANCH = "chore/promote-20260723-11111111";
const OWNER_REPO = "keduall/topik-project-v13";
const roots = [];

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function temporaryRoot(prefix = "ai-release-git-") {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

async function adapters() {
  return import("../../scripts/lib/ai-release-git.mjs");
}

async function executor() {
  return import("../../scripts/lib/ai-release-executor.mjs");
}

async function promotion() {
  return import("../../scripts/lib/ai-release-promotion.mjs");
}

function recorder(responses) {
  const calls = [];
  const queue = [...responses];
  return {
    calls,
    runner(command, args, options) {
      calls.push({ command, args, options });
      const next = queue.shift();
      if (typeof next === "function") return next({ command, args, options });
      return next ?? { status: 0, stdout: "", stderr: "" };
    },
  };
}

function lsRemoteLine(sha, branch) {
  return `${sha}\trefs/heads/${branch}\n`;
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`fixture git ${args.slice(0, 2).join(" ")} failed`);
  }
  return String(result.stdout ?? "").trim();
}

function fixtureRepository() {
  const repository = temporaryRoot("ai-release-git-repo-");
  git(repository, ["init", "--initial-branch=main"]);
  git(repository, ["config", "user.name", "Release Fixture"]);
  git(repository, ["config", "user.email", "release-fixture@example.invalid"]);
  git(repository, ["config", "commit.gpgsign", "false"]);
  writeFileSync(path.join(repository, "base.txt"), "base\n");
  git(repository, ["add", "base.txt"]);
  git(repository, ["commit", "-m", "base"]);
  return repository;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("release GitHub adapter merge safety", () => {
  it("merges with --merge and --match-head-commit and never with squash or rebase", async () => {
    const { createGitHubAdapter } = await adapters();
    const view = JSON.stringify({
      state: "MERGED",
      headRefOid: SHA.candidate,
      baseRefName: "stg",
      headRefName: CANDIDATE_BRANCH,
      mergeCommit: { oid: SHA.stgMerged },
    });
    const recorded = recorder([
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: view, stderr: "" },
    ]);
    const github = createGitHubAdapter({ commandRunner: recorded.runner });

    expect(
      github.mergePullRequest({ ownerRepo: OWNER_REPO, number: 42, expectedHeadSha: SHA.candidate }),
    ).toEqual({ mergeCommitSha: SHA.stgMerged });

    expect(recorded.calls[0].command).toBe("gh");
    expect(recorded.calls[0].args).toEqual([
      "pr",
      "merge",
      "42",
      "--repo",
      OWNER_REPO,
      "--merge",
      "--match-head-commit",
      SHA.candidate,
    ]);
    const everyArgument = recorded.calls.flatMap((call) => call.args);
    expect(everyArgument).not.toContain("--squash");
    expect(everyArgument).not.toContain("--rebase");
    expect(everyArgument).not.toContain("--admin");
    expect(everyArgument).not.toContain("--delete-branch");
    for (const call of recorded.calls) {
      expect(call.options.shell).toBe(false);
      expect(call.options.windowsHide).toBe(true);
      expect(call.options.timeout).toBe(20_000);
    }
  });

  it("fails verification when the merged pull request state or head moves", async () => {
    const { createGitHubAdapter } = await adapters();
    const notMerged = recorder([
      { status: 0, stdout: "", stderr: "" },
      {
        status: 0,
        stdout: JSON.stringify({
          state: "OPEN",
          headRefOid: SHA.candidate,
          baseRefName: "stg",
          headRefName: CANDIDATE_BRANCH,
          mergeCommit: null,
        }),
        stderr: "",
      },
    ]);
    expect(() =>
      createGitHubAdapter({ commandRunner: notMerged.runner }).mergePullRequest({
        ownerRepo: OWNER_REPO,
        number: 42,
        expectedHeadSha: SHA.candidate,
      }),
    ).toThrowError("EXECUTOR_PR_MERGE_VERIFY_FAILED");

    const failedMerge = recorder([{ status: 1, stdout: "", stderr: SENTINEL }]);
    expect(() =>
      createGitHubAdapter({ commandRunner: failedMerge.runner }).mergePullRequest({
        ownerRepo: OWNER_REPO,
        number: 42,
        expectedHeadSha: SHA.candidate,
      }),
    ).toThrowError("EXECUTOR_PR_MERGE_FAILED");
  });

  it("refuses gh authentication subcommands and rewrite flags at the code level", async () => {
    const { assertSafeCommandArguments, assertSafeGitHubArguments } = await adapters();

    for (const args of [
      ["auth", "token"],
      ["auth", "switch", "--hostname", "github.com", "--user", "blackstarzck"],
      ["auth", "status"],
    ]) {
      expect(() => assertSafeGitHubArguments(args)).toThrowError(
        "EXECUTOR_GH_AUTH_COMMAND_FORBIDDEN",
      );
    }
    for (const args of [
      ["pr", "merge", "42", "--squash"],
      ["pr", "merge", "42", "--rebase"],
      ["pr", "merge", "42", "--admin"],
      ["merge", "--squash", SHA.source],
    ]) {
      expect(() => assertSafeGitHubArguments(args)).toThrowError(
        "EXECUTOR_MERGE_METHOD_FORBIDDEN",
      );
    }
    for (const args of [
      ["push", "collab", "--force"],
      ["push", "collab", "-f"],
      ["push", "collab", "--force-with-lease"],
      ["push", "collab", "--force-with-lease=refs/heads/stg"],
      ["push", "collab", "--force-if-includes"],
      ["push", "collab", "+refs/heads/stg:refs/heads/stg"],
    ]) {
      expect(() => assertSafeCommandArguments(args)).toThrowError(
        "EXECUTOR_FORCE_ARGUMENT_FORBIDDEN",
      );
    }
    expect(
      assertSafeCommandArguments(["push", "collab", "refs/heads/stg:refs/heads/stg"]),
    ).toEqual(["push", "collab", "refs/heads/stg:refs/heads/stg"]);
  });

  it("detects an existing open pull request and reuses it instead of creating another", async () => {
    const { createGitHubAdapter } = await adapters();
    const listed = JSON.stringify([
      { number: 7, headRefOid: SHA.candidate, state: "OPEN" },
    ]);
    const recorded = recorder([{ status: 0, stdout: listed, stderr: "" }]);
    const github = createGitHubAdapter({ commandRunner: recorded.runner });

    expect(
      github.findPullRequest({ ownerRepo: OWNER_REPO, base: "stg", head: CANDIDATE_BRANCH }),
    ).toEqual({ number: 7, headSha: SHA.candidate, state: "OPEN" });
    expect(recorded.calls[0].args).toContain("--state");
    expect(recorded.calls[0].args).toContain("open");

    const reuse = recorder([{ status: 0, stdout: listed, stderr: "" }]);
    expect(
      createGitHubAdapter({ commandRunner: reuse.runner }).createPullRequest({
        ownerRepo: OWNER_REPO,
        base: "stg",
        head: CANDIDATE_BRANCH,
        title: "promote",
        body: "promote body",
      }),
    ).toEqual({ number: 7, headSha: SHA.candidate });
    expect(reuse.calls).toHaveLength(1);
    expect(reuse.calls[0].args).not.toContain("create");

    const empty = recorder([{ status: 0, stdout: "[]", stderr: "" }]);
    expect(
      createGitHubAdapter({ commandRunner: empty.runner }).findPullRequest({
        ownerRepo: OWNER_REPO,
        base: "stg",
        head: CANDIDATE_BRANCH,
      }),
    ).toBeNull();
  });
});

describe("release git adapter push safety", () => {
  it("pushes without any force argument and re-verifies the remote SHA", async () => {
    const { createGitAdapter } = await adapters();
    const repository = temporaryRoot();
    const recorded = recorder([
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: lsRemoteLine(SHA.candidate, CANDIDATE_BRANCH), stderr: "" },
    ]);
    const adapter = createGitAdapter({ repoPath: repository, commandRunner: recorded.runner });

    expect(
      adapter.pushBranch({
        remote: "collab",
        branch: CANDIDATE_BRANCH,
        expectedSha: SHA.candidate,
      }),
    ).toEqual({ ok: true, remoteSha: SHA.candidate });

    expect(recorded.calls.map((call) => call.args)).toEqual([
      ["push", "collab", `refs/heads/${CANDIDATE_BRANCH}:refs/heads/${CANDIDATE_BRANCH}`],
      ["ls-remote", "collab", `refs/heads/${CANDIDATE_BRANCH}`],
    ]);
    const everyArgument = recorded.calls.flatMap((call) => call.args);
    for (const forbidden of ["--force", "-f", "--force-with-lease", "--force-if-includes"]) {
      expect(everyArgument).not.toContain(forbidden);
    }
    expect(everyArgument.some((argument) => argument.startsWith("+"))).toBe(false);
    for (const call of recorded.calls) {
      expect(call.command).toBe("git");
      expect(call.options.shell).toBe(false);
      expect(call.options.env.GIT_TERMINAL_PROMPT).toBe("0");
      expect(call.options.maxBuffer).toBe(1024 * 1024);
    }
  });

  it("reads a remote branch tip as a SHA or null without failing", async () => {
    const { createGitAdapter } = await adapters();
    const repository = temporaryRoot();
    const build = (response) =>
      createGitAdapter({ repoPath: repository, commandRunner: recorder([response]).runner });

    expect(
      build({ status: 0, stdout: lsRemoteLine(SHA.stgMerged, "stg"), stderr: "" }).remoteBranchSha({
        remote: "collab",
        branch: "stg",
      }),
    ).toBe(SHA.stgMerged);
    expect(
      build({ status: 0, stdout: "", stderr: "" }).remoteBranchSha({
        remote: "collab",
        branch: "stg",
      }),
    ).toBeNull();
    expect(
      build({ status: 128, stdout: "", stderr: SENTINEL }).remoteBranchSha({
        remote: "collab",
        branch: "stg",
      }),
    ).toBeNull();
    expect(
      build({ status: 0, stdout: lsRemoteLine(SHA.stgMerged, "other"), stderr: "" }).remoteBranchSha(
        { remote: "collab", branch: "stg" },
      ),
    ).toBeNull();
  });

  it("fails with EXECUTOR_PUSH_VERIFY_FAILED when the remote SHA differs or is unreadable", async () => {
    const { createGitAdapter } = await adapters();
    const repository = temporaryRoot();

    const mismatched = recorder([
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: lsRemoteLine(SHA.main, CANDIDATE_BRANCH), stderr: "" },
    ]);
    expect(() =>
      createGitAdapter({ repoPath: repository, commandRunner: mismatched.runner }).pushBranch({
        remote: "collab",
        branch: CANDIDATE_BRANCH,
        expectedSha: SHA.candidate,
      }),
    ).toThrowError("EXECUTOR_PUSH_VERIFY_FAILED");

    const unreadable = recorder([
      { status: 0, stdout: "", stderr: "" },
      { status: 1, stdout: "", stderr: SENTINEL },
    ]);
    expect(() =>
      createGitAdapter({ repoPath: repository, commandRunner: unreadable.runner }).pushBranch({
        remote: "collab",
        branch: CANDIDATE_BRANCH,
        expectedSha: SHA.candidate,
      }),
    ).toThrowError("EXECUTOR_PUSH_VERIFY_FAILED");

    const rejected = recorder([{ status: 1, stdout: "", stderr: SENTINEL }]);
    expect(() =>
      createGitAdapter({ repoPath: repository, commandRunner: rejected.runner }).pushBranch({
        remote: "collab",
        branch: CANDIDATE_BRANCH,
        expectedSha: SHA.candidate,
      }),
    ).toThrowError("EXECUTOR_PUSH_FAILED");
  });

  it("deletes only candidate branches and protects long-lived branches", async () => {
    const { createGitAdapter, PROTECTED_BRANCH_NAMES } = await adapters();
    const repository = temporaryRoot();

    for (const branch of PROTECTED_BRANCH_NAMES) {
      const recorded = recorder([]);
      expect(() =>
        createGitAdapter({ repoPath: repository, commandRunner: recorded.runner }).deleteRemoteBranch(
          { remote: "collab", branch },
        ),
      ).toThrowError("EXECUTOR_PROTECTED_BRANCH");
      expect(recorded.calls).toHaveLength(0);
    }
    expect(PROTECTED_BRANCH_NAMES).toEqual([
      "stg",
      "main",
      "master",
      "develop",
      "production",
      "staging",
    ]);

    for (const branch of ["feat/example", "chore/promote-2026072-11111111", "chore/promote-20260723-1111111g"]) {
      const recorded = recorder([]);
      expect(() =>
        createGitAdapter({ repoPath: repository, commandRunner: recorded.runner }).deleteRemoteBranch(
          { remote: "collab", branch },
        ),
      ).toThrowError("EXECUTOR_PROTECTED_BRANCH");
      expect(recorded.calls).toHaveLength(0);
    }

    const allowed = recorder([
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: "", stderr: "" },
    ]);
    expect(
      createGitAdapter({ repoPath: repository, commandRunner: allowed.runner }).deleteRemoteBranch({
        remote: "collab",
        branch: CANDIDATE_BRANCH,
      }),
    ).toEqual({ ok: true });
    expect(allowed.calls.map((call) => call.args)).toEqual([
      ["push", "collab", "--delete", `refs/heads/${CANDIDATE_BRANCH}`],
      ["ls-remote", "collab", `refs/heads/${CANDIDATE_BRANCH}`],
    ]);

    const stillPresent = recorder([
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: lsRemoteLine(SHA.candidate, CANDIDATE_BRANCH), stderr: "" },
    ]);
    expect(() =>
      createGitAdapter({ repoPath: repository, commandRunner: stillPresent.runner }).deleteRemoteBranch(
        { remote: "collab", branch: CANDIDATE_BRANCH },
      ),
    ).toThrowError("EXECUTOR_BRANCH_DELETE_FAILED");
  });

  it("keeps child process stdout and stderr out of every failure message", async () => {
    const { createGitAdapter, createGitHubAdapter } = await adapters();
    const repository = temporaryRoot();
    const noisy = () => ({ status: 128, stdout: SENTINEL, stderr: `${SENTINEL} fatal` });
    const failures = [];

    const gitAdapter = createGitAdapter({
      repoPath: repository,
      commandRunner: recorder([noisy, noisy, noisy, noisy, noisy, noisy]).runner,
    });
    for (const attempt of [
      () => gitAdapter.fetchRemote({ remote: "collab" }),
      () => gitAdapter.resolveCommit("collab/stg"),
      () => gitAdapter.commitParents(SHA.candidate),
      () => gitAdapter.isFastForward({ fromSha: SHA.stg, toSha: SHA.main }),
      () => gitAdapter.pushBranch({ remote: "collab", branch: "stg", expectedSha: SHA.main }),
      () => gitAdapter.deleteRemoteBranch({ remote: "collab", branch: CANDIDATE_BRANCH }),
    ]) {
      try {
        attempt();
        throw new Error("expected a failure");
      } catch (error) {
        failures.push(error);
      }
    }

    const github = createGitHubAdapter({
      commandRunner: recorder([noisy, noisy, noisy]).runner,
    });
    for (const attempt of [
      () => github.findPullRequest({ ownerRepo: OWNER_REPO, base: "stg", head: CANDIDATE_BRANCH }),
      () => github.getPullRequest({ ownerRepo: OWNER_REPO, number: 42 }),
      () =>
        github.mergePullRequest({
          ownerRepo: OWNER_REPO,
          number: 42,
          expectedHeadSha: SHA.candidate,
        }),
    ]) {
      try {
        attempt();
        throw new Error("expected a failure");
      } catch (error) {
        failures.push(error);
      }
    }

    expect(failures).toHaveLength(9);
    for (const error of failures) {
      expect(error.name).toBe("ReleaseGitError");
      expect(error.code).toMatch(/^[A-Z][A-Z0-9_]*$/u);
      expect(error.message).toBe(error.code);
      expect(error.message).not.toContain(SENTINEL);
      expect(JSON.stringify({ code: error.code, message: error.message, ...error })).not.toContain(
        SENTINEL,
      );
      expect(String(error.stack ?? "")).not.toContain(SENTINEL);
    }
  });
});

describe("release git adapter lineage reading", () => {
  it("parses zero, one, and two parent commits exactly", async () => {
    const { createGitAdapter } = await adapters();
    const repository = temporaryRoot();

    const cases = [
      [`${SHA.candidate}\n`, []],
      [`${SHA.candidate} ${SHA.stg}\n`, [SHA.stg]],
      [`${SHA.candidate} ${SHA.stg} ${SHA.source}\n`, [SHA.stg, SHA.source]],
    ];
    for (const [stdout, expected] of cases) {
      const recorded = recorder([{ status: 0, stdout, stderr: "" }]);
      const adapter = createGitAdapter({ repoPath: repository, commandRunner: recorded.runner });
      expect(adapter.commitParents(SHA.candidate)).toEqual(expected);
      expect(recorded.calls[0].args).toEqual(["rev-list", "--parents", "-n", "1", SHA.candidate]);
    }

    const wrongHead = recorder([{ status: 0, stdout: `${SHA.main} ${SHA.stg}\n`, stderr: "" }]);
    expect(() =>
      createGitAdapter({ repoPath: repository, commandRunner: wrongHead.runner }).commitParents(
        SHA.candidate,
      ),
    ).toThrowError("EXECUTOR_REF_LOOKUP_FAILED");
  });

  it("reads ancestry as a boolean and separates lookup failures", async () => {
    const { createGitAdapter } = await adapters();
    const repository = temporaryRoot();
    const build = (response) =>
      createGitAdapter({ repoPath: repository, commandRunner: recorder([response]).runner });

    expect(
      build({ status: 0, stdout: "", stderr: "" }).isFastForward({
        fromSha: SHA.stg,
        toSha: SHA.main,
      }),
    ).toBe(true);
    expect(
      build({ status: 1, stdout: "", stderr: "" }).isFastForward({
        fromSha: SHA.stg,
        toSha: SHA.main,
      }),
    ).toBe(false);
    expect(() =>
      build({ status: 128, stdout: "", stderr: SENTINEL }).isFastForward({
        fromSha: SHA.stg,
        toSha: SHA.main,
      }),
    ).toThrowError("EXECUTOR_ANCESTRY_LOOKUP_FAILED");
  });
});

describe("release git adapter candidate merge", () => {
  it("uses --no-ff and reports the measured candidate lineage in a real repository", async () => {
    const { createGitAdapter } = await adapters();
    const repository = fixtureRepository();
    const baseSha = git(repository, ["rev-parse", "--verify", "HEAD^{commit}"]).toLowerCase();
    git(repository, ["switch", "-c", "source-line"]);
    writeFileSync(path.join(repository, "source.txt"), "source\n");
    git(repository, ["add", "source.txt"]);
    git(repository, ["commit", "-m", "source"]);
    const sourceSha = git(repository, ["rev-parse", "--verify", "HEAD^{commit}"]).toLowerCase();
    git(repository, ["switch", "main"]);
    writeFileSync(path.join(repository, "base.txt"), "base updated\n");
    git(repository, ["add", "base.txt"]);
    git(repository, ["commit", "-m", "base update"]);
    const stgBaseSha = git(repository, ["rev-parse", "--verify", "HEAD^{commit}"]).toLowerCase();
    expect(stgBaseSha).not.toBe(baseSha);

    const calls = [];
    const adapter = createGitAdapter({
      repoPath: repository,
      commandRunner: (command, args, options) => {
        calls.push({ command, args, options });
        return spawnSync(command, args, options);
      },
    });
    const worktreeRoot = path.join(temporaryRoot("ai-release-git-worktrees-"), "candidates");
    const result = adapter.createCandidateMerge({
      candidateBranch: CANDIDATE_BRANCH,
      baseSha: stgBaseSha,
      sourceSha,
      worktreeRoot,
    });

    expect(result.cleanupFailed).toBe(false);
    expect(result.actualParents).toEqual([stgBaseSha, sourceSha]);
    expect(result.candidateSha).toMatch(/^[a-f0-9]{40}$/u);
    expect(result.candidateSha).not.toBe(sourceSha);
    expect(adapter.commitParents(result.candidateSha)).toEqual([stgBaseSha, sourceSha]);
    expect(adapter.isFastForward({ fromSha: stgBaseSha, toSha: result.candidateSha })).toBe(true);
    expect(adapter.isFastForward({ fromSha: result.candidateSha, toSha: stgBaseSha })).toBe(false);
    expect(adapter.resolveCommit(CANDIDATE_BRANCH)).toBe(result.candidateSha);

    const mergeCall = calls.find((call) => call.args[0] === "merge");
    expect(mergeCall.args).toEqual(["merge", "--no-ff", "--no-edit", sourceSha]);
    expect(calls.some((call) => call.args.includes("--squash"))).toBe(false);
    expect(calls.some((call) => call.args[0] === "rebase")).toBe(false);
    expect(calls.some((call) => call.args[0] === "worktree" && call.args[1] === "add")).toBe(true);
    expect(calls.some((call) => call.args[0] === "worktree" && call.args[1] === "remove")).toBe(true);
    for (const call of calls) {
      expect(call.options.shell).toBe(false);
      expect(call.options.windowsHide).toBe(true);
      expect(call.options.timeout).toBe(20_000);
    }
    expect(git(repository, ["worktree", "list", "--porcelain"])).not.toContain("candidate-");
  });

  it("reports a merge conflict and still attempts temporary worktree cleanup", async () => {
    const { createGitAdapter } = await adapters();
    const repository = fixtureRepository();
    git(repository, ["switch", "-c", "conflicting"]);
    writeFileSync(path.join(repository, "base.txt"), "conflict side\n");
    git(repository, ["add", "base.txt"]);
    git(repository, ["commit", "-m", "conflict side"]);
    const sourceSha = git(repository, ["rev-parse", "--verify", "HEAD^{commit}"]).toLowerCase();
    git(repository, ["switch", "main"]);
    writeFileSync(path.join(repository, "base.txt"), "main side\n");
    git(repository, ["add", "base.txt"]);
    git(repository, ["commit", "-m", "main side"]);
    const stgBaseSha = git(repository, ["rev-parse", "--verify", "HEAD^{commit}"]).toLowerCase();

    const calls = [];
    const adapter = createGitAdapter({
      repoPath: repository,
      commandRunner: (command, args, options) => {
        calls.push({ command, args, options });
        return spawnSync(command, args, options);
      },
    });
    const worktreeRoot = path.join(temporaryRoot("ai-release-git-conflict-"), "candidates");

    let thrown = null;
    try {
      adapter.createCandidateMerge({
        candidateBranch: CANDIDATE_BRANCH,
        baseSha: stgBaseSha,
        sourceSha,
        worktreeRoot,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown?.code).toBe("EXECUTOR_CANDIDATE_MERGE_CONFLICT");
    expect(thrown?.cleanupFailed).toBe(false);
    expect(calls.some((call) => call.args[0] === "worktree" && call.args[1] === "remove")).toBe(true);
    expect(git(repository, ["worktree", "list", "--porcelain"])).not.toContain("candidate-");
  });

  it("exposes a failed temporary worktree cleanup as cleanupFailed", async () => {
    const { createGitAdapter } = await adapters();
    const repository = temporaryRoot();
    const worktreeRoot = path.join(temporaryRoot("ai-release-git-cleanup-"), "candidates");
    const recorded = recorder([
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: `${SHA.candidate}\n`, stderr: "" },
      { status: 0, stdout: `${SHA.candidate} ${SHA.stg} ${SHA.source}\n`, stderr: "" },
      { status: 1, stdout: SENTINEL, stderr: SENTINEL },
    ]);
    const adapter = createGitAdapter({ repoPath: repository, commandRunner: recorded.runner });

    const result = adapter.createCandidateMerge({
      candidateBranch: CANDIDATE_BRANCH,
      baseSha: SHA.stg,
      sourceSha: SHA.source,
      worktreeRoot,
    });

    expect(result).toEqual({
      candidateSha: SHA.candidate,
      actualParents: [SHA.stg, SHA.source],
      cleanupFailed: true,
    });
    expect(recorded.calls.at(-1).args.slice(0, 2)).toEqual(["worktree", "remove"]);
    expect(recorded.calls[0].args.slice(0, 3)).toEqual(["worktree", "add", "--detach"]);
    expect(recorded.calls[1].args).toEqual(["switch", "-c", CANDIDATE_BRANCH]);
    expect(recorded.calls[2].args).toEqual(["merge", "--no-ff", "--no-edit", SHA.source]);
    expect(existsSync(worktreeRoot)).toBe(true);
    for (const call of recorded.calls) {
      expect(call.options.shell).toBe(false);
    }
  });

  it("rejects a non-candidate branch before touching the repository", async () => {
    const { createGitAdapter } = await adapters();
    const repository = temporaryRoot();
    const recorded = recorder([]);
    const adapter = createGitAdapter({ repoPath: repository, commandRunner: recorded.runner });

    expect(() =>
      adapter.createCandidateMerge({
        candidateBranch: "stg",
        baseSha: SHA.stg,
        sourceSha: SHA.source,
        worktreeRoot: path.join(repository, "worktrees"),
      }),
    ).toThrowError("EXECUTOR_CANDIDATE_BRANCH_INVALID");
    expect(recorded.calls).toHaveLength(0);
  });
});

describe("release git observation mapping", () => {
  function securityAudit() {
    const payload = {
      schemaVersion: 1,
      recordType: "SecurityArtifactDiffAuditV1",
      baseline: { ref: BASELINE_SHA, commitHash: digest(BASELINE_SHA) },
      refs: ["collab/main", "collab/stg", "origin/main"],
      snapshots: [
        { ref: "collab/main", commitHash: digest(SHA.stg) },
        { ref: "collab/stg", commitHash: digest(SHA.stg) },
        { ref: "origin/main", commitHash: digest(SHA.source) },
      ],
      findings: [],
      summary: { refCount: 3, scannedPathCount: 24, findingCount: 0 },
    };
    return { ...payload, fingerprint: digest(JSON.stringify(payload)) };
  }

  function migrationEvidence() {
    return {
      productionProjectIdentityHash: digest("production-project"),
      remoteTrackerDigest: digest("tracker"),
      trackerIsExactManifestPrefix: true,
      schemaRpcRlsGrantFingerprint: digest("schema-rpc-rls-grant"),
      appliedMigrationManifestDigest: digest("applied-migrations"),
      backupPitrEvidenceDigest: digest("backup-pitr"),
      pinnedToolchainDigest: digest("supabase-cli-action"),
      previousMaxTimestamp: "20260722000000",
      newMigrations: [
        {
          path: "supabase/migrations/20260723000000_forward_fix.sql",
          timestamp: "20260723000000",
          sha256: digest("forward migration"),
        },
      ],
      historicalChanges: [],
      dryRunDigest: digest("planned apply"),
      applyDigest: digest("planned apply"),
      destructiveSql: false,
      grantRevocation: false,
      compatibilityBreak: false,
      nMinusOneTopikDevPassed: true,
      nTopikDevPassed: true,
      autoApplyEnabled: false,
    };
  }

  async function walkWithObservations() {
    const { advancePromotionRun, createApprovalPolicy, createPromotionRun } = await promotion();
    const {
      buildCandidateVerifiedEvent,
      buildCleanupVerifiedEvent,
      buildDbGateEvaluatedEvent,
      buildMainMergeVerifiedEvent,
      buildMainPrOpenEvent,
      buildProductionEvaluatedEvent,
      buildStgPrOpenEvent,
      buildStgReadyEvent,
    } = await executor();
    const {
      candidateMergeObservation,
      cleanupObservation,
      mainMergeObservation,
      mainPullRequestObservation,
      stgPullRequestObservation,
      stgReadyObservation,
    } = await adapters();

    let record = createPromotionRun({
      runId: "promotion-20260723-11111111",
      now: "2026-07-23T10:00:00.000Z",
      sourceSha: SHA.source,
      sourceTreeHash: SHA.tree,
      stgBaseSha: SHA.stg,
      securityAudit: securityAudit(),
      expectedSecurityRefs: ["collab/main", "collab/stg", "origin/main"],
      expectedBaselineSha: BASELINE_SHA,
      controlPlaneReady: true,
      stgReady: true,
      vercelDomain: "talkpik.example.com",
      vercelProject: "topik-project-v13",
    });
    let policy = createApprovalPolicy({
      contractFingerprint: record.contractFingerprint,
      profileFingerprint: record.profileFingerprint,
    });
    const advance = (event) => {
      const result = advancePromotionRun(record, {
        expectedRevision: record.revision,
        expectedFingerprint: record.fingerprint,
        policy,
        event,
      });
      record = result.record;
      policy = result.policy;
    };

    advance(
      buildCandidateVerifiedEvent({
        at: "2026-07-23T10:01:00.000Z",
        record,
        observed: candidateMergeObservation({
          candidateBranch: record.target.candidateBranch,
          candidateSha: SHA.candidate,
          baseSha: SHA.stg,
          sourceSha: SHA.source,
          parents: [SHA.stg, SHA.source],
        }),
      }),
    );
    advance(
      buildStgPrOpenEvent({
        at: "2026-07-23T10:02:00.000Z",
        record,
        observed: stgPullRequestObservation({
          headBranch: record.target.candidateBranch,
          headSha: SHA.candidate,
        }),
      }),
    );
    advance(
      buildStgReadyEvent({
        at: "2026-07-23T10:03:00.000Z",
        record,
        observed: stgReadyObservation({
          stgSha: SHA.stgMerged,
          parents: [SHA.stg, SHA.candidate],
          preview: {
            deploymentId: "dpl_preview_001",
            commitSha: SHA.stgMerged,
            project: "topik-project-v13",
            state: "READY",
            target: "preview",
            branch: "stg",
            environmentScope: "topik-dev",
          },
        }),
      }),
    );
    advance(
      buildDbGateEvaluatedEvent({
        at: "2026-07-23T10:04:00.000Z",
        record,
        observed: { migrationEvidence: migrationEvidence() },
      }),
    );
    advance({
      type: "PROD_APPROVAL_GRANTED",
      at: "2026-07-23T10:05:00.000Z",
      approvalFingerprint: record.approval.approvalFingerprint,
    });
    advance(
      buildMainPrOpenEvent({
        at: "2026-07-23T10:06:00.000Z",
        record,
        observed: mainPullRequestObservation({ headSha: record.target.stgSha }),
      }),
    );
    advance(
      buildMainMergeVerifiedEvent({
        at: "2026-07-23T10:07:00.000Z",
        record,
        observed: mainMergeObservation({
          mainBaseSha: SHA.previous,
          mainSha: SHA.main,
          headSha: record.target.stgSha,
          parents: [SHA.previous, record.target.stgSha],
        }),
      }),
    );
    advance(
      buildProductionEvaluatedEvent({
        at: "2026-07-23T10:08:00.000Z",
        record,
        observed: {
          deployment: {
            deploymentId: "dpl_production_001",
            commitSha: SHA.main,
            project: "topik-project-v13",
            state: "READY",
            target: "production",
            alias: "talkpik.example.com",
            domain: "talkpik.example.com",
            smokeReadOnly: true,
            smokePassed: true,
            aliasSwitched: true,
          },
        },
      }),
    );
    advance(
      buildCleanupVerifiedEvent({
        at: "2026-07-23T10:09:00.000Z",
        record,
        observed: cleanupObservation({ stgFastForwardedToMain: true }),
      }),
    );
    return record;
  }

  it("feeds the real event assemblers from PLANNED to CLEANED without mocks", async () => {
    const record = await walkWithObservations();

    expect(record.state).toBe("CLEANED");
    expect(record.target.candidateSha).toBe(SHA.candidate);
    expect(record.target.stgSha).toBe(SHA.stgMerged);
    expect(record.target.mainSha).toBe(SHA.main);
    expect(record.journal.map((entry) => entry.event)).toEqual([
      "PLAN_CREATED",
      "CANDIDATE_VERIFIED",
      "STG_PR_OPEN",
      "STG_READY",
      "DB_GATE_EVALUATED",
      "PROD_APPROVAL_GRANTED",
      "MAIN_PR_OPEN",
      "MAIN_MERGE_VERIFIED",
      "PRODUCTION_EVALUATED",
      "CLEANUP_VERIFIED",
    ]);
  });

  it("keeps candidate parent order and rejects a swapped lineage through the real assembler", async () => {
    const { buildCandidateVerifiedEvent } = await executor();
    const { candidateMergeObservation } = await adapters();
    const { createPromotionRun } = await promotion();
    const record = createPromotionRun({
      runId: "promotion-20260723-11111111",
      now: "2026-07-23T10:00:00.000Z",
      sourceSha: SHA.source,
      sourceTreeHash: SHA.tree,
      stgBaseSha: SHA.stg,
      securityAudit: securityAudit(),
      expectedSecurityRefs: ["collab/main", "collab/stg", "origin/main"],
      expectedBaselineSha: BASELINE_SHA,
      controlPlaneReady: true,
      stgReady: true,
      vercelDomain: "talkpik.example.com",
      vercelProject: "topik-project-v13",
    });

    expect(
      candidateMergeObservation({
        candidateBranch: record.target.candidateBranch,
        candidateSha: SHA.candidate,
        baseSha: SHA.stg,
        sourceSha: SHA.source,
        parents: [SHA.stg, SHA.source],
      }),
    ).toEqual({
      candidateBranch: record.target.candidateBranch,
      candidateSha: SHA.candidate,
      targetBranch: "stg",
      noFastForward: true,
      mergeMethod: "merge",
      directMainPush: false,
      baseSha: SHA.stg,
      sourceSha: SHA.source,
      parents: [SHA.stg, SHA.source],
    });

    expect(() =>
      buildCandidateVerifiedEvent({
        at: "2026-07-23T10:01:00.000Z",
        record,
        observed: candidateMergeObservation({
          candidateBranch: record.target.candidateBranch,
          candidateSha: SHA.candidate,
          baseSha: SHA.stg,
          sourceSha: SHA.source,
          parents: [SHA.source, SHA.stg],
        }),
      }),
    ).toThrowError("EXECUTOR_LINEAGE_MISMATCH");
  });

  it("builds a preflight observation the real preflight evaluator accepts", async () => {
    const { evaluatePreflight } = await executor();
    const { preflightObservation } = await adapters();
    const { createPromotionRun } = await promotion();
    const record = createPromotionRun({
      runId: "promotion-20260723-11111111",
      now: "2026-07-23T10:00:00.000Z",
      sourceSha: SHA.source,
      sourceTreeHash: SHA.tree,
      stgBaseSha: SHA.stg,
      securityAudit: securityAudit(),
      expectedSecurityRefs: ["collab/main", "collab/stg", "origin/main"],
      expectedBaselineSha: BASELINE_SHA,
      controlPlaneReady: true,
      stgReady: true,
      vercelDomain: "talkpik.example.com",
      vercelProject: "topik-project-v13",
    });

    expect(
      evaluatePreflight({
        record,
        observed: preflightObservation({
          stgSha: SHA.stg,
          stgParents: [],
          sourceRepositoryIdentity: "blackstarzck/topik-project-v13",
          targetRepositoryIdentity: "keduall/topik-project-v13",
          registryLockPresent: false,
          verifiedAccounts: ["blackstarzck"],
        }),
      }),
    ).toEqual({ ok: true, blockers: [] });

    expect(
      evaluatePreflight({
        record,
        observed: preflightObservation({
          stgSha: SHA.main,
          stgParents: null,
          sourceRepositoryIdentity: "blackstarzck/topik-project-v13",
          targetRepositoryIdentity: "keduall/topik-project-v13",
          registryLockPresent: true,
          verifiedAccounts: [],
        }),
      }),
    ).toEqual({
      ok: false,
      blockers: ["PROMOTION_BASE_MOVED", "PROMOTION_REGISTRY_LOCKED", "EXECUTOR_ACCOUNT_UNAVAILABLE"],
    });
    expect(() =>
      preflightObservation({
        stgSha: SHA.stg,
        stgParents: ["not-a-sha"],
        sourceRepositoryIdentity: "blackstarzck/topik-project-v13",
        targetRepositoryIdentity: "keduall/topik-project-v13",
        registryLockPresent: false,
        verifiedAccounts: ["blackstarzck"],
      }),
    ).toThrowError("EXECUTOR_LINEAGE_MISMATCH");
  });

  it("rejects observations that are not measured booleans or SHAs", async () => {
    const { cleanupObservation, mainMergeObservation, stgReadyObservation } = await adapters();

    expect(() => cleanupObservation({ stgFastForwardedToMain: "true" })).toThrowError(
      "EXECUTOR_OBSERVATION_INVALID",
    );
    expect(() =>
      stgReadyObservation({ stgSha: SHA.stgMerged, parents: [SHA.stg], preview: null }),
    ).toThrowError("EXECUTOR_PREVIEW_EVIDENCE_INVALID");
    expect(() =>
      mainMergeObservation({
        mainBaseSha: SHA.previous,
        mainSha: SHA.main,
        headSha: SHA.stgMerged,
        parents: [SHA.previous, "not-a-sha"],
      }),
    ).toThrowError("EXECUTOR_LINEAGE_MISMATCH");
  });
});

describe("pipeline repository profiles", () => {
  it("adds the blackstarzck-to-keduall combination without changing the existing entries", async () => {
    const { PIPELINE_REPOSITORY_PROFILES } = await import("../../scripts/lib/ai-task-sweep.mjs");

    expect(PIPELINE_REPOSITORY_PROFILES.origin).toEqual({
      authLogin: "blackstarzck",
      owner: "blackstarzck",
      repository: "topik-project-v13",
    });
    expect(Object.keys(PIPELINE_REPOSITORY_PROFILES.origin).sort()).toEqual([
      "authLogin",
      "owner",
      "repository",
    ]);
    expect(PIPELINE_REPOSITORY_PROFILES.collab).toEqual({
      authLogin: "guestkeduall-design",
      owner: "keduall",
      repository: "topik-project-v13",
    });
    expect(Object.keys(PIPELINE_REPOSITORY_PROFILES.collab).sort()).toEqual([
      "authLogin",
      "owner",
      "repository",
    ]);
    expect(PIPELINE_REPOSITORY_PROFILES.collabSource).toEqual({
      authLogin: "blackstarzck",
      owner: "keduall",
      repository: "topik-project-v13",
    });
    expect(Object.keys(PIPELINE_REPOSITORY_PROFILES.collabSource).sort()).toEqual([
      "authLogin",
      "owner",
      "repository",
    ]);
    expect(Object.keys(PIPELINE_REPOSITORY_PROFILES)).toEqual([
      "origin",
      "collab",
      "collabSource",
    ]);
    expect(Object.isFrozen(PIPELINE_REPOSITORY_PROFILES)).toBe(true);
    expect(Object.isFrozen(PIPELINE_REPOSITORY_PROFILES.collabSource)).toBe(true);
    const combinations = Object.values(PIPELINE_REPOSITORY_PROFILES).map(
      (profile) => `${profile.authLogin} ${profile.owner}/${profile.repository}`,
    );
    expect(new Set(combinations).size).toBe(combinations.length);
  });
});

describe("promotion executor stg fast-forward", () => {
  it("fast-forwards only stg, only forward, and only after re-reading the remote", async () => {
    const { createGitAdapter, FAST_FORWARD_ALLOWED_BRANCHES } = await adapters();
    const repository = temporaryRoot();

    expect(FAST_FORWARD_ALLOWED_BRANCHES).toEqual(["stg"]);
    for (const branch of ["main", "master", "production", CANDIDATE_BRANCH]) {
      const blocked = recorder([]);
      expect(() =>
        createGitAdapter({
          repoPath: repository,
          commandRunner: blocked.runner,
        }).fastForwardRemoteBranch({ remote: "collab", branch, expectedSha: SHA.main }),
      ).toThrowError("EXECUTOR_FAST_FORWARD_BRANCH_FORBIDDEN");
      expect(blocked.calls).toHaveLength(0);
    }

    const alreadySynced = recorder([
      { status: 0, stdout: lsRemoteLine(SHA.main, "stg"), stderr: "" },
    ]);
    expect(
      createGitAdapter({
        repoPath: repository,
        commandRunner: alreadySynced.runner,
      }).fastForwardRemoteBranch({ remote: "collab", branch: "stg", expectedSha: SHA.main }),
    ).toEqual({ ok: true, alreadySynced: true, remoteSha: SHA.main });
    expect(alreadySynced.calls.map((call) => call.args)).toEqual([
      ["ls-remote", "collab", "refs/heads/stg"],
    ]);

    const behind = recorder([
      { status: 0, stdout: lsRemoteLine(SHA.stgMerged, "stg"), stderr: "" },
      { status: 1, stdout: "", stderr: SENTINEL },
    ]);
    expect(() =>
      createGitAdapter({
        repoPath: repository,
        commandRunner: behind.runner,
      }).fastForwardRemoteBranch({ remote: "collab", branch: "stg", expectedSha: SHA.main }),
    ).toThrowError("EXECUTOR_FAST_FORWARD_NOT_POSSIBLE");
    expect(behind.calls.map((call) => call.args)).toEqual([
      ["ls-remote", "collab", "refs/heads/stg"],
      ["merge-base", "--is-ancestor", SHA.stgMerged, SHA.main],
    ]);

    const synced = recorder([
      { status: 0, stdout: lsRemoteLine(SHA.stgMerged, "stg"), stderr: "" },
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: lsRemoteLine(SHA.main, "stg"), stderr: "" },
    ]);
    expect(
      createGitAdapter({
        repoPath: repository,
        commandRunner: synced.runner,
      }).fastForwardRemoteBranch({ remote: "collab", branch: "stg", expectedSha: SHA.main }),
    ).toEqual({ ok: true, alreadySynced: false, remoteSha: SHA.main });
    expect(synced.calls.map((call) => call.args)).toEqual([
      ["ls-remote", "collab", "refs/heads/stg"],
      ["merge-base", "--is-ancestor", SHA.stgMerged, SHA.main],
      ["push", "collab", `${SHA.main}:refs/heads/stg`],
      ["ls-remote", "collab", "refs/heads/stg"],
    ]);
    for (const call of synced.calls) {
      expect(call.args.some((arg) => /^(?:-f|--force|\+)/u.test(arg))).toBe(false);
    }

    const unverified = recorder([
      { status: 0, stdout: lsRemoteLine(SHA.stgMerged, "stg"), stderr: "" },
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: lsRemoteLine(SHA.stgMerged, "stg"), stderr: "" },
    ]);
    expect(() =>
      createGitAdapter({
        repoPath: repository,
        commandRunner: unverified.runner,
      }).fastForwardRemoteBranch({ remote: "collab", branch: "stg", expectedSha: SHA.main }),
    ).toThrowError("EXECUTOR_PUSH_VERIFY_FAILED");

    const missing = recorder([{ status: 2, stdout: "", stderr: SENTINEL }]);
    expect(() =>
      createGitAdapter({
        repoPath: repository,
        commandRunner: missing.runner,
      }).fastForwardRemoteBranch({ remote: "collab", branch: "stg", expectedSha: SHA.main }),
    ).toThrowError("EXECUTOR_REF_LOOKUP_FAILED");
  });
});
