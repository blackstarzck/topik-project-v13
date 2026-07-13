import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SKILL_ROOT = ".codex/skills";

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function skillNameFor(relativePath) {
  const parts = relativePath.replaceAll("\\", "/").split("/");
  const fileName = parts.at(-1);
  const directoryName = parts.at(-2);
  if (directoryName === "subagent-driven-development") {
    if (fileName === "spec-reviewer-prompt.md") {
      return "subagent-driven-development-spec-reviewer";
    }
    if (fileName === "code-quality-reviewer-prompt.md") {
      return "subagent-driven-development-code-reviewer";
    }
    return "subagent-driven-development";
  }
  return directoryName;
}

function isExecutableSkillSurface(fileName) {
  return (
    fileName === "SKILL.md" ||
    fileName.endsWith("-prompt.md") ||
    fileName === "code-reviewer.md"
  );
}

export async function discoverSkillPolicyTargets({ rootDir }) {
  const absoluteRoot = path.join(rootDir, SKILL_ROOT);
  const targets = [];

  const walk = async (directory) => {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      compareNames(left.name, right.name),
    );
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const stat = await lstat(absolutePath);
      if (stat.isSymbolicLink()) {
        throw new Error(`skill policy refuses symbolic links: ${absolutePath}`);
      }
      if (stat.isDirectory()) {
        await walk(absolutePath);
      } else if (stat.isFile() && isExecutableSkillSurface(entry.name)) {
        const relativePath = path.relative(rootDir, absolutePath).replaceAll("\\", "/");
        targets.push({ skillName: skillNameFor(relativePath), relativePath });
      }
    }
  };

  await walk(absoluteRoot);
  return targets.sort((left, right) => compareNames(left.relativePath, right.relativePath));
}

function issue(id, message) {
  return { id, message };
}

function hasAny(content, patterns) {
  return patterns.some((pattern) => pattern.test(content));
}

function normalizeLine(line) {
  return line
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "")
    .replace(/`/g, "")
    .trim();
}

function isNegativeGuardLine(line) {
  return hasAny(line, [
    /\b(?:no|not|without|missing|absent|unknown)\b/i,
    /\b(?:lack|lacks|lacking|deny|denied)\b/i,
  ]);
}

function hasPositiveGuard(text, patterns) {
  return text
    .split(/\r?\n/)
    .map(normalizeLine)
    .some(
      (line) =>
        !isNegativeGuardLine(line) &&
        patterns.some((pattern) => pattern.test(line)),
    );
}

function hasPriorNeverContext(lines, index) {
  for (let cursor = index - 1; cursor >= Math.max(0, index - 20); cursor -= 1) {
    const line = lines[cursor].trim();
    if (/^\*{0,2}always\s*:/i.test(line) || /^#{1,6}\s+/.test(line)) {
      return false;
    }
    if (/^\*{0,2}never\s*:/i.test(line)) {
      return true;
    }
  }
  return false;
}

function isProhibitedMatch(lines, index, normalized, matchIndex) {
  const prefix = normalized.slice(0, matchIndex);
  const clausePrefix = prefix.split(/[.;:]/).at(-1) ?? prefix;
  return (
    hasAny(clausePrefix, [
      /\bnever\b/i,
      /\bdo not\b/i,
      /\bdon't\b/i,
      /\bmust not\b/i,
      /\bcannot\b/i,
      /\bcan't\b/i,
      /\bavoid\b/i,
      /\bprohibit(?:ed)?\b/i,
    ]) || hasPriorNeverContext(lines, index)
  );
}

function commandDirectives(content, pattern) {
  const lines = content.split(/\r?\n/);
  const directives = [];

  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index];
    const normalized = normalizeLine(original);
    if (!normalized || normalized.startsWith("#") || normalized === "```") {
      continue;
    }

    const match = normalized.match(pattern);
    if (!match || match.index === undefined) {
      continue;
    }

    const prefix = normalized.slice(0, match.index);
    const looksExecutable =
      match.index === 0 ||
      /\b(?:run|execute|invoke|call|use|with|then)\s*$/i.test(prefix) ||
      /(?::|;|&&|\|\|)\s*$/.test(prefix);
    if (
      !looksExecutable ||
      isProhibitedMatch(lines, index, normalized, match.index)
    ) {
      continue;
    }

    directives.push({ index, lines, normalized });
  }

  return directives;
}

function naturalDirectives(content, pattern) {
  const lines = content.split(/\r?\n/);
  const directives = [];

  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index];
    if (/^\s*#{1,6}\s+/.test(original)) {
      continue;
    }

    const normalized = normalizeLine(original);
    const match = normalized.match(pattern);
    if (
      !match ||
      match.index === undefined ||
      isProhibitedMatch(lines, index, normalized, match.index)
    ) {
      continue;
    }
    directives.push({ index, lines, normalized });
  }

  return directives;
}

function actionBlock({ index, lines }) {
  const block = [];
  for (
    let cursor = index;
    cursor < Math.min(lines.length, index + 8);
    cursor += 1
  ) {
    const normalized = normalizeLine(lines[cursor]);
    if (cursor > index && (!normalized || normalized === "```")) {
      break;
    }
    block.push(normalized);
  }
  return block.join("\n");
}

function nearbyText({ index, lines }, before = 8) {
  return lines
    .slice(Math.max(0, index - before), index + 1)
    .map(normalizeLine)
    .join("\n");
}

function hasUnguardedWorktreeCreate(content) {
  const directives = commandDirectives(content, /\bgit\s+worktree\s+add\b/i);

  return directives.some((directive) => {
    const guard = nearbyText(directive, 14);
    const hasIsolationConsent = hasPositiveGuard(guard, [
      /explicit user consent/i,
      /isolation consent (?:is )?(?:present|confirmed|verified)/i,
      /user has asked for an isolated workspace/i,
    ]);
    const hasExactBranchAuthority = hasPositiveGuard(guard, [
      /exact named branch creation authority/i,
      /exact .*branch.*authorized/i,
      /branch creation authority.*must be authorized/i,
      /BRANCH_NAME.*authorized/i,
    ]);
    const protectedChecksPass = hasPositiveGuard(guard, [
      /protected-?branch checks? (?:must )?pass/i,
      /protected-?branch rules? (?:must )?pass/i,
    ]);
    return !(
      hasIsolationConsent &&
      hasExactBranchAuthority &&
      protectedChecksPass
    );
  });
}

function publishDirectives(content) {
  return [
    ...commandDirectives(content, /\bgit\s+push\b/i),
    ...commandDirectives(content, /\bgh\s+pr\s+create\b/i),
    ...naturalDirectives(
      content,
      /^(?:push|publish)\b(?!\s+back\b)|^(?:open|create)\s+(?:a\s+)?PR\b/i,
    ),
  ];
}

function hasUnguardedPublish(content) {
  return publishDirectives(content).some((directive) => {
    const guard = `${nearbyText(directive, 8)}\n${actionBlock(directive)}`;
    const selected = hasPositiveGuard(guard, [
      /user selects? the publish option/i,
      /user selected (?:the )?publish option/i,
    ]);
    const authorized = hasPositiveGuard(guard, [
      /publish authority is present/i,
      /publish authority (?:has been )?(?:granted|confirmed)/i,
    ]);
    const targetChecked = hasPositiveGuard(guard, [
      /protected-?branch checks? (?:must )?pass/i,
      /exact validated base/i,
      /--base\s+\S+/i,
    ]);
    return !(selected && authorized && targetChecked);
  });
}

export function validateSkillPolicy({ skillName, content }) {
  const issues = [];

  const gitMutationDirectives = [
    ...commandDirectives(content, /\bgit\s+(?:add|commit)\b/i),
    ...naturalDirectives(content, /^(?:stage|commit)(?:\s|$)|\bthen commit(?:\s|$)/i),
  ];
  const hasUnguardedGitMutation = gitMutationDirectives.some((directive) => {
    const guard = `${nearbyText(directive, 10)}\n${actionBlock(directive)}`;
    return !hasPositiveGuard(guard, [
      /current user or project contract grants? the exact action/i,
      /exact (?:stage|commit|git) authority (?:is )?(?:present|granted|confirmed)/i,
      /project publish authority permits? it/i,
      /authority envelope is `?commit-authorized`?/i,
    ]);
  });
  if (hasUnguardedGitMutation) {
    issues.push(
      issue(
        "GIT_MUTATION_AUTHORITY",
        "Executable skill surfaces must not stage or commit without exact current authority.",
      ),
    );
  }

  const publishes = publishDirectives(content);
  if (publishes.length > 0 && hasUnguardedPublish(content)) {
    issues.push(
      issue(
        "PUBLISH_AUTHORITY",
        "Push and PR actions in every executable skill need an adjacent selected option, publish authority, and validated target.",
      ),
    );
  }

  const prDirectives = commandDirectives(content, /\bgh\s+pr\s+create\b/i);
  if (
    prDirectives.some(
      (directive) => !/--base(?:\s+|=)\S+/i.test(actionBlock(directive)),
    )
  ) {
    issues.push(
      issue(
        "PR_BASE_PINNING",
        "PR creation in every executable skill must pin the verified non-deployment base explicitly.",
      ),
    );
  }

  const integrationDirectives = commandDirectives(
    content,
    /\bgit\s+(?:merge|rebase)\b/i,
  );
  const hasUnguardedIntegration = integrationDirectives.some((directive) => {
    const guard = `${nearbyText(directive, 10)}\n${actionBlock(directive)}`;
    return !hasPositiveGuard(guard, [
      /user selected (?:the )?(?:merge|integration) option/i,
      /current user or project contract grants? the exact action/i,
      /exact (?:merge|rebase|integration) authority (?:is )?(?:present|granted|confirmed)/i,
    ]);
  });
  if (hasUnguardedIntegration) {
    issues.push(
      issue(
        "INTEGRATE_AUTHORITY",
        "Merge and rebase actions in every executable skill require exact current integration authority.",
      ),
    );
  }

  const checkoutDirectives = commandDirectives(
    content,
    /\bgit\s+(?:checkout|switch|pull)\b/i,
  );
  if (
    checkoutDirectives.some((directive) =>
      !hasPositiveGuard(`${nearbyText(directive, 10)}\n${actionBlock(directive)}`, [
        /current user or project contract grants? the exact action/i,
        /exact (?:checkout|switch|pull|branch) authority (?:is )?(?:present|granted|confirmed)/i,
      ]),
    )
  ) {
    issues.push(
      issue(
        "GIT_MUTATION_AUTHORITY",
        "Checkout, switch, and pull actions in every executable skill require exact current authority.",
      ),
    );
  }

  if (hasUnguardedWorktreeCreate(content)) {
    issues.push(
      issue(
        "WORKTREE_CREATE_AUTHORITY",
        "Worktree creation in every executable skill needs isolation consent, exact branch authority, and protected-branch checks at the action.",
      ),
    );
  }

  if (skillName === "writing-plans") {
    const plansCommit =
      gitMutationDirectives.length > 0 ||
      naturalDirectives(content, /^(?:stage|commit)\b/i).length > 0 ||
      /frequent commits/i.test(content);
    const preservesAuthority =
      /plan never grants Git authority/i.test(content) &&
      /verified diff checkpoint/i.test(content) &&
      /current user or project contract grants? the exact action/i.test(content);
    if (plansCommit || !preservesAuthority) {
      issues.push(
        issue(
          "PLAN_COMMIT_AUTHORITY",
          "Plans must express Git work as an authority-aware checkpoint, not an automatic step.",
        ),
      );
    }
  }

  if (skillName === "executing-plans") {
    const preservesAuthority =
      /plan never grants Git authority/i.test(content) &&
      /verified diff checkpoint/i.test(content) &&
      /current user or project contract grants? the exact action/i.test(content);
    if (!preservesAuthority) {
      issues.push(
        issue(
          "PLAN_EXECUTION_AUTHORITY",
          "Plan execution must convert unauthorized Git steps into verified diff checkpoints.",
        ),
      );
    }
  }

  if (skillName === "brainstorming") {
    const requiresCommit = hasAny(content, [
      /\band commit\b/i,
      /spec written and committed/i,
    ]);
    const hasUnconditionalDesignCommit =
      /commit the design document to git/i.test(content);
    const hasCommitBoundary = hasAny(content, [
      /commit only when[^.\n]*publish authority/i,
      /project publish authority/i,
    ]);
    if (
      hasUnconditionalDesignCommit ||
      (requiresCommit && !hasCommitBoundary)
    ) {
      issues.push(
        issue(
          "SPEC_COMMIT_AUTHORITY",
          "Design/spec creation must not imply commit authority.",
        ),
      );
    }
  }

  if (skillName.startsWith("subagent-driven-development")) {
    const directGitMutation = commandDirectives(
      content,
      /\bgit\s+(?:add|commit|push)\b/i,
    ).length;
    const unconditionalCommit =
      naturalDirectives(content, /\bcommit your work\b/i).length > 0 ||
      /implements?, tests?, commits?/i.test(content) ||
      directGitMutation > 0;
    const hasAuthorityEnvelope =
      /authority envelope/i.test(content) && /verified diff/i.test(content);
    const isReviewer = /-reviewer$/.test(skillName);
    if (unconditionalCommit || (!isReviewer && !hasAuthorityEnvelope)) {
      issues.push(
        issue(
          "IMPLEMENTER_COMMIT_AUTHORITY",
          "Implementers need an explicit authority envelope before staging or committing.",
        ),
      );
    }

    if (/controller retains authority/i.test(content)) {
      issues.push(
        issue(
          "CONTROLLER_SELF_AUTHORITY",
          "The controller enforces external authority boundaries but cannot grant itself Git authority.",
        ),
      );
    }

    const requiresScopeContract =
      /local-edit-only/i.test(content) || isReviewer;
    const hasIsolatedReviewScope =
      /BASELINE_DIRTY_PATHS/i.test(content) &&
      /WRITE_SCOPE/i.test(content) &&
      /TASK_DIFF_SCOPE/i.test(content) &&
      /overlap/i.test(content);
    if (requiresScopeContract && !hasIsolatedReviewScope) {
      issues.push(
        issue(
          "LOCAL_EDIT_REVIEW_SCOPE",
          "Local-edit-only tasks and reviewers must isolate their scope from earlier diffs.",
        ),
      );
    }

    const entireTreeReview = naturalDirectives(
      content,
      /\breview (?:the )?(?:entire|whole) working tree\b/i,
    ).length;
    if (
      /otherwise working-tree diff/i.test(content) ||
      /review the cumulative working-tree diff/i.test(content) ||
      entireTreeReview > 0
    ) {
      issues.push(
        issue(
          "CUMULATIVE_DIFF_REVIEW",
          "Local-edit-only review must use an explicit task-owned patch, not a cumulative diff.",
        ),
      );
    }

    if (skillName === "subagent-driven-development-code-reviewer") {
      const replacesGitRange =
        /local-edit-only/i.test(content) &&
        /task-owned patch/i.test(content) &&
        /replaces? the Git range/i.test(content) &&
        /do not use `?BASE_SHA`? or `?HEAD_SHA`?/i.test(content);
      if (!replacesGitRange) {
        issues.push(
          issue(
            "REVIEWER_TASK_DIFF_CONTRACT",
            "Local-edit-only code review must replace the SHA range with a task-owned patch.",
          ),
        );
      }
    }
  }

  if (skillName === "using-git-worktrees") {
    const commitsIgnoreChange =
      /\.gitignore/i.test(content) &&
      /\bcommit(?: the change)?\b/i.test(content);
    const hasIgnoreCommitBoundary = hasAny(content, [
      /commit only when[^.\n]*authority/i,
      /commit authority/i,
    ]);
    if (commitsIgnoreChange && !hasIgnoreCommitBoundary) {
      issues.push(
        issue(
          "IGNORE_COMMIT_AUTHORITY",
          "Adding a worktree ignore entry does not itself authorize a commit.",
        ),
      );
    }

    if (/choose a permitted feature branch/i.test(content)) {
      issues.push(
        issue(
          "BRANCH_TARGET_SUBSTITUTION",
          "A blocked branch target cannot be replaced without exact authority for the replacement.",
        ),
      );
    }

    if (
      /native[^.\n]*(?:handle|perform)[^.\n]*cleanup automatically/i.test(
        content,
      )
    ) {
      issues.push(
        issue(
          "NATIVE_CLEANUP_ASSUMPTION",
          "Native worktree creation does not prove automatic cleanup ownership.",
        ),
      );
    }

    const fallsBackInPlace = hasAny(content, [
      /work(?:ing)? in the current (?:directory|checkout) instead/i,
      /work in place/i,
    ]);
    const provesTaskOwnership =
      /current task-owned (?:checkout|worktree)/i.test(content) &&
      /BLOCKED/i.test(content);
    if (fallsBackInPlace && !provesTaskOwnership) {
      issues.push(
        issue(
          "WORKTREE_FALLBACK_OWNERSHIP",
          "A failed isolation attempt must not fall back to an unowned checkout.",
        ),
      );
    }
  }

  if (skillName === "finishing-a-development-branch") {
    const sharedCheckoutCommands = commandDirectives(
      content,
      /\bgit\s+(?:checkout|switch|pull|merge|rebase)\b/i,
    );
    if (sharedCheckoutCommands.length > 0) {
      issues.push(
        issue(
          "SHARED_CHECKOUT_INTEGRATION",
          "Task worktrees must not mutate a shared base checkout for integration.",
        ),
      );
    }

    const cleanupCommands = commandDirectives(
      content,
      /\bgit\s+(?:worktree\s+(?:remove|prune)|branch\s+-[dD]\b)/i,
    );
    const nativeExitCommands = naturalDirectives(
      content,
      /\b(?:invoke|invokes|run|execute|call)\s+(?:a\s+)?(?:native\s+)?(?:ExitWorktree|workspace[- ]exit)\b/i,
    );
    const cleanupDirectives = [...cleanupCommands, ...nativeExitCommands];
    if (cleanupDirectives.length > 0) {
      issues.push(
        issue(
          "REPORT_MODE_CLEANUP_DIRECTIVE",
          "Current report mode must not contain executable cleanup or native-exit directives.",
        ),
      );
    }

    const destructiveCleanup = cleanupCommands.some((directive) =>
      hasAny(actionBlock(directive), [
        /\bgit\s+branch\s+-D\b/i,
        /(?:^|\s)(?:--force|-f)(?:\s|$)/i,
      ]),
    );
    if (destructiveCleanup) {
      issues.push(
        issue(
          "DESTRUCTIVE_AUTHORITY",
          "Forced or destructive cleanup is prohibited in report-only mode.",
        ),
      );
    }

    const protectsHarness =
      /(?:host|harness)(?:-owned)?/i.test(content) &&
      hasAny(content, [/do not remove/i, /report-only/i]);
    if (cleanupCommands.length > 0 && !protectsHarness) {
      issues.push(
        issue(
          "HARNESS_CLEANUP_BOUNDARY",
          "Host- or harness-owned worktrees must be report-only.",
        ),
      );
    }

    const protectsCollab =
      /collab/i.test(content) &&
      /explicit deployment confirmation/i.test(content);
    if (!protectsCollab) {
      issues.push(
        issue(
          "COLLAB_PROTECTION",
          "Publishing guidance must preserve the collab deployment confirmation guard.",
        ),
      );
    }

    const collabCommands = [
      ...commandDirectives(
        content,
        /\b(?:git\s+(?:push|merge|rebase)|gh\s+pr\s+create)\b[^\n]*\bcollab\b/i,
      ),
      ...naturalDirectives(
        content,
        /\b(?:open|create)\s+(?:a\s+)?PR\s+(?:against|to)\s+collab\b|\b(?:push|merge|rebase)\b[^.\n]*\b(?:to|into|onto)\s+collab\b/i,
      ),
    ];
    if (collabCommands.length > 0) {
      issues.push(
        issue(
          "COLLAB_TARGET_DIRECTIVE",
          "The collab deployment target must never appear as an executable default.",
        ),
      );
    }
  }

  if (skillName === "verification-before-completion") {
    const mentionsPublishing = hasAny(content, [
      /commit/i,
      /push/i,
      /\bPRs?\b/i,
    ]);
    const separatesAuthority =
      /verification is necessary but not sufficient/i.test(content) &&
      /publish authority/i.test(content);
    const commandMutations = commandDirectives(
      content,
      /\b(?:git\s+(?:add|commit|push)|gh\s+pr\s+create)\b/i,
    );
    const verificationFollowups = naturalDirectives(
      content,
      /after verification (?:passes|succeeds)[^.\n]*(?:stage|commit|push|open|create)/i,
    );
    const lines = content.split(/\r?\n/);
    const splitVerificationFollowup = lines.some((line, index) => {
      if (!/after verification (?:passes|succeeds)\s*:/i.test(line)) {
        return false;
      }
      return lines.slice(index + 1, index + 7).some((candidate, offset) => {
        const normalized = normalizeLine(candidate);
        const match = normalized.match(
          /\b(?:stage|commit|push|open|create)\b/i,
        );
        return (
          match &&
          match.index !== undefined &&
          !isProhibitedMatch(lines, index + 1 + offset, normalized, match.index)
        );
      });
    });
    if (
      commandMutations.length > 0 ||
      verificationFollowups.length > 0 ||
      splitVerificationFollowup ||
      (mentionsPublishing && !separatesAuthority)
    ) {
      issues.push(
        issue(
          "VERIFICATION_AUTHORITY_BOUNDARY",
          "Passing verification does not grant stage, commit, push, or PR authority.",
        ),
      );
    }
  }

  return issues;
}

export async function evaluateSkillPolicy({ rootDir }) {
  const errors = [];

  const targets = await discoverSkillPolicyTargets({ rootDir });
  for (const { skillName, relativePath } of targets) {
    const absolutePath = path.join(rootDir, relativePath);
    const content = await readFile(absolutePath, "utf8");
    for (const policyIssue of validateSkillPolicy({ skillName, content })) {
      errors.push({ ...policyIssue, path: relativePath });
    }
  }

  return { errors };
}

async function main() {
  const result = await evaluateSkillPolicy({ rootDir: process.cwd() });
  if (result.errors.length === 0) {
    console.log("Agent skill policy check: PASS");
    return;
  }

  console.error("Agent skill policy check: FAIL");
  for (const policyIssue of result.errors) {
    console.error(
      `- ${policyIssue.id} ${policyIssue.path}: ${policyIssue.message}`,
    );
  }
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
