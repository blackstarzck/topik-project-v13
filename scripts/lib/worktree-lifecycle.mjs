const DISPOSABLE_IGNORED_PREFIXES = [
  "node_modules/",
  ".next/",
  "coverage/",
  ".cache/",
  ".turbo/",
  "dist/",
  "build/",
  "out/",
];
const PR_EVIDENCE_MAX_AGE_MS = 15 * 60 * 1000;

function normalizeRepoPath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\r?\n$/, "");
}

function isDisposableIgnoredPath(value) {
  const normalized = normalizeRepoPath(value);
  return DISPOSABLE_IGNORED_PREFIXES.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
}

function hasFreshPullRequestEvidence(evidence, now) {
  if (!evidence || evidence.source !== "github-api") return false;
  const checkedAt = Date.parse(evidence.checkedAt);
  const nowAt = Date.parse(now);
  return (
    Number.isFinite(checkedAt) &&
    Number.isFinite(nowAt) &&
    checkedAt <= nowAt &&
    nowAt - checkedAt <= PR_EVIDENCE_MAX_AGE_MS
  );
}

function result(disposition, reasons, preserveReasons, nextReviewChecks, owner) {
  return {
    disposition,
    owner: owner ?? "unknown",
    reasons: [...new Set(reasons)],
    preserveReasons: [...new Set(preserveReasons)],
    nextReviewChecks: [...new Set(nextReviewChecks)],
    cleanupReady: false,
    deletionAuthorized: false,
    notice: "review-only; deletion not authorized",
  };
}

export function classifyWorktreeSnapshot(snapshot, { now = new Date().toISOString() } = {}) {
  const reasons = [];
  const preserveReasons = [];
  const nextReviewChecks = [];
  const add = (reason, nextCheck, preserveReason) => {
    reasons.push(reason);
    if (nextCheck) nextReviewChecks.push(nextCheck);
    if (preserveReason) preserveReasons.push(preserveReason);
  };

  if (snapshot.statusEvidence !== "complete") {
    add("STATUS_COMMAND_FAILED", "rerun the read-only status inspection");
  }
  if (snapshot.ignoredEvidence !== "complete") {
    add("IGNORED_SCAN_FAILED", "rerun the complete ignored-file inspection");
  }
  if (snapshot.snapshotStable !== true) {
    add("SNAPSHOT_CHANGED", "repeat inventory after repository state is stable");
  }
  if ((snapshot.trackedChanges?.length ?? 0) > 0) {
    add(
      "TRACKED_CHANGES_PRESENT",
      "identify the task owner for tracked changes",
      "tracked changes must be preserved",
    );
  }
  if ((snapshot.untrackedFiles?.length ?? 0) > 0) {
    add(
      "UNTRACKED_FILES_PRESENT",
      "identify the task owner for untracked files",
      "untracked files must be preserved",
    );
  }
  const unexpectedIgnored = (snapshot.ignoredEntries ?? []).filter(
    (entry) => !isDisposableIgnoredPath(entry),
  );
  if (unexpectedIgnored.length > 0) {
    add(
      "IGNORED_SENSITIVE_OR_UNKNOWN_PRESENT",
      "review every non-disposable ignored entry",
      "ignored entries outside the disposable allowlist must be preserved",
    );
  }
  if (!snapshot.owner || snapshot.ownerEvidence === "unknown") {
    add("OWNER_UNKNOWN", "resolve the owning task or person", "unknown ownership requires preservation");
  } else if (
    !snapshot.isBaseCheckout &&
    !["task-metadata", "manual-confirmation"].includes(snapshot.ownerEvidence)
  ) {
    add(
      "OWNER_EVIDENCE_DISPLAY_ONLY",
      "confirm ownership from task metadata or manual review",
      "display-only owner hints cannot establish remediation ownership",
    );
  }
  if (snapshot.branchOwnership !== "exclusive") {
    add("BRANCH_OWNERSHIP_CONFLICT", "resolve every branch owner before review");
  }
  if (snapshot.pathOwnership !== "exclusive") {
    add("PATH_OWNERSHIP_CONFLICT", "resolve every worktree path owner before review");
  }
  if (snapshot.detached || !snapshot.branch) {
    add("DETACHED_OR_BRANCH_UNKNOWN", "link the detached HEAD to verified task identity");
  }
  if (!snapshot.isBaseCheckout && ["main", "collab"].includes(snapshot.branch)) {
    add(
      "PROTECTED_BRANCH",
      "move review to a task-owned non-protected branch",
      "main and collab worktrees are never remediation candidates",
    );
  }
  if (snapshot.worktreeFlags?.bare) {
    add("BARE_WORKTREE", "exclude bare repositories from lifecycle remediation");
  }
  if (snapshot.worktreeFlags?.locked) {
    add("WORKTREE_LOCKED", "resolve the Git worktree lock owner");
  }
  if (snapshot.worktreeFlags?.prunable) {
    add("WORKTREE_PRUNABLE_METADATA", "reconcile stale metadata without deleting work");
  }
  for (const [state, activeReason, unknownReason] of [
    [snapshot.processState, "PROCESS_ACTIVE", "PROCESS_STATE_UNKNOWN"],
    [snapshot.portState, "PORT_ACTIVE", "PORT_STATE_UNKNOWN"],
    [snapshot.fileLockState, "FILE_LOCK_ACTIVE", "FILE_LOCK_STATE_UNKNOWN"],
  ]) {
    if (state === "active") add(activeReason, "stop and verify the owning runtime first");
    else if (state !== "inactive") add(unknownReason, "verify runtime and lock ownership");
  }

  const pr = snapshot.livePullRequestEvidence;
  if (!snapshot.isBaseCheckout) {
    if (!pr) {
      add(
        "LIVE_PR_EVIDENCE_MISSING",
        "obtain fresh GitHub API evidence in a separately authorized phase",
        "registry PR hints are display-only",
      );
    } else if (!hasFreshPullRequestEvidence(pr, now)) {
      add(
        "LIVE_PR_EVIDENCE_STALE_OR_UNTRUSTED",
        "refresh PR evidence from GitHub API",
        "stale or non-live PR evidence cannot authorize deletion",
      );
    } else if (
      !snapshot.repositoryIdentity ||
      pr.repository !== snapshot.repositoryIdentity
    ) {
      add(
        "PR_REPOSITORY_MISMATCH",
        "reconcile the local repository and GitHub PR identity",
        "a PR from another or unknown repository cannot support remediation",
      );
    } else if (pr.state === "CLOSED") {
      add(
        "PR_CLOSED_UNMERGED",
        "decide whether to resume or explicitly preserve the task",
        "closed-unmerged work must be preserved",
      );
    } else if (pr.state === "MERGED") {
      if (pr.base !== "main") {
        add(
          "PR_BASE_NOT_APPROVED",
          "confirm the intended integration target",
          "non-main and protected deployment targets need separate review",
        );
      }
      if (!snapshot.publishedHeadSha || pr.headSha !== snapshot.publishedHeadSha) {
        add(
          "PUBLISHED_HEAD_MISMATCH",
          "reconcile task, branch, and PR head identity",
          "unmatched published history must be preserved",
        );
      }
      if (!snapshot.headSha || snapshot.headSha !== snapshot.publishedHeadSha) {
        add(
          "WORKTREE_HEAD_MISMATCH",
          "reconcile current worktree HEAD with the published task head",
          "unpublished or diverged local history must be preserved",
        );
      }
    } else if (pr.state !== "OPEN") {
      add(
        "PR_STATE_UNKNOWN",
        "obtain an explicit merged or open state",
        "unknown PR state requires preservation",
      );
    }
  }

  if (reasons.length > 0) {
    return result("NEEDS_ATTENTION", reasons, preserveReasons, nextReviewChecks, snapshot.owner);
  }

  if (snapshot.isBaseCheckout) {
    return result(
      "PRESERVED",
      ["BASE_CHECKOUT"],
      ["baseline checkout must remain"],
      ["confirm user-owned changes before any separate remediation"],
      snapshot.owner,
    );
  }

  if (pr.state === "OPEN") {
    return result(
      "ACTIVE",
      [snapshot.isCurrent ? "CURRENT_TASK" : "PR_OPEN"],
      ["open task worktree remains active"],
      ["continue monitoring without cleanup"],
      snapshot.owner,
    );
  }
  if (snapshot.isCurrent) {
    return result(
      "ACTIVE",
      ["CURRENT_TASK"],
      ["the current task worktree remains active"],
      ["finish the task before any separate remediation review"],
      snapshot.owner,
    );
  }
  return result(
    "REVIEW_CANDIDATE",
    ["ALL_REPORT_EVIDENCE_PRESENT"],
    ["candidate remains review-only"],
    ["obtain separate deletion authority and rerun all guards immediately before action"],
    snapshot.owner,
  );
}
