import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SKILL_ROOT = ".codex/skills";
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
const MAX_MARKDOWN_FILES = 10_000;

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function skillNameFor(relativePath) {
  const parts = relativePath.replaceAll("\\", "/").split("/");
  const fileName = parts.at(-1);
  const rootSkillName = parts[2];
  if (rootSkillName === "subagent-driven-development") {
    if (fileName === "spec-reviewer-prompt.md") {
      return "subagent-driven-development-spec-reviewer";
    }
    if (fileName === "code-quality-reviewer-prompt.md") {
      return "subagent-driven-development-code-reviewer";
    }
    return "subagent-driven-development";
  }
  return rootSkillName;
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
      } else if (stat.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        if (stat.size > MAX_MARKDOWN_BYTES) {
          throw new Error(`skill policy Markdown is too large: ${absolutePath}`);
        }
        if (targets.length >= MAX_MARKDOWN_FILES) {
          throw new Error(`skill policy exceeds ${MAX_MARKDOWN_FILES} Markdown files`);
        }
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
      /\bnon-executable example\b/i,
    ]) || hasPriorNeverContext(lines, index)
  );
}

const GIT_VALUE = String.raw`(?:"[^"]*"|'[^']*'|[^\s]+)`;
const ENV_ASSIGNMENT = String.raw`[A-Za-z_][A-Za-z0-9_]*=${GIT_VALUE}`;
const GIT_EXECUTABLE = String.raw`(?:"(?:[^"]*[\\/])?git(?:\.exe|\.cmd)?"|'(?:[^']*[\\/])?git(?:\.exe|\.cmd)?'|(?:(?:[A-Za-z]:\\|/)(?:[^\s"'\\/]+[\\/])*)?git(?:\.exe|\.cmd)?)`;
const GIT_COMMAND_PREFIX = String.raw`(?<![A-Za-z0-9_])(?:env\s+)?(?:${ENV_ASSIGNMENT}\s+)*${GIT_EXECUTABLE}\s+(?:(?:-C|-c)\s+${GIT_VALUE}\s+|(?:--git-dir|--work-tree)(?:=${GIT_VALUE}|\s+${GIT_VALUE})\s+|--?[A-Za-z][A-Za-z0-9-]*(?:=${GIT_VALUE})?\s+)*`;
const GIT_DIRECTIVE_PREFIX = String.raw`(?<![A-Za-z0-9_])${GIT_EXECUTABLE}\s+(?:(?:-C|-c)\s+${GIT_VALUE}\s+|(?:--git-dir|--work-tree)(?:=${GIT_VALUE}|\s+${GIT_VALUE})\s+)*`;
function hasImperativeGitPrefix(prefix) {
  if (/^\s*description\s*:/i.test(prefix)) return false;
  const clause = prefix.split(/[.!?;:]/u).at(-1)?.trim() ?? "";
  return (
    /^(?:always|please|now|automatically|next\b[,]?|perform|proceed|ensure|immediately|directly|kindly|run|execute|invoke|call|use|then|command|sudo)\b/i.test(
      clause,
    ) ||
    /\b(?:must|should|shall|need to|have to)\b/i.test(clause) ||
    /\b(?:run|execute|invoke|call|use|then|command|sudo)\s*$/i.test(clause)
  );
}

function gitDirectivePattern(subcommands, suffix = String.raw`\b`) {
  return new RegExp(`${GIT_DIRECTIVE_PREFIX}(?:${subcommands})${suffix}`, "i");
}

function gitMutationDirectivePattern(subcommands) {
  return new RegExp(
    `${GIT_DIRECTIVE_PREFIX}(?:${subcommands})\\b|\\b${GIT_EXECUTABLE}\\s+(?:--?[^\\s]+\\s+)+(?:${subcommands})\\b`,
    "i",
  );
}

function matchGitCommand(block, subcommands) {
  return block.match(
    new RegExp(`${GIT_COMMAND_PREFIX}(${subcommands})\\b([^\\r\\n]*)`, "i"),
  );
}

function shellControlBoundaries(line) {
  const boundaries = [];
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    const pair = line.slice(index, index + 2);
    if (["&&", "||", "|&"].includes(pair)) {
      boundaries.push({ start: index, end: index + 2 });
      index += 1;
    } else if ([";", "&", "|"].includes(character)) {
      boundaries.push({ start: index, end: index + 1 });
    }
  }
  return boundaries;
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

    const boundaries = shellControlBoundaries(normalized);
    let segmentStart = 0;
    for (const boundary of [...boundaries, { start: normalized.length, end: normalized.length }]) {
      const rawSegment = normalized.slice(segmentStart, boundary.start);
      const leadingWhitespace = rawSegment.search(/\S/u);
      const segment = rawSegment.trim();
      const match = segment.match(pattern);
      if (match?.index !== undefined) {
        const matchIndex = segmentStart + Math.max(leadingWhitespace, 0) + match.index;
        const prefix = segment.slice(0, match.index);
        const looksExecutable =
          match.index === 0 ||
          /^(?:run|execute|invoke|call|use|with|then)\b/i.test(match[0]) ||
          /\b(?:run|execute|invoke|call|use|with|then)\b[^;:&|]*$/i.test(prefix) ||
          /(?::|;|&&|\|\|)\s*$/.test(prefix) ||
          (hasImperativeGitPrefix(prefix) &&
            new RegExp(GIT_COMMAND_PREFIX, "i").test(segment));
        if (
          looksExecutable &&
          !isProhibitedMatch(lines, index, normalized, matchIndex)
        ) {
          directives.push({
            index,
            lines,
            original,
            normalized,
            commandText: segment.slice(match.index),
            guardPrefix: normalized.slice(0, matchIndex),
          });
        }
      }
      segmentStart = boundary.end;
    }
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
    directives.push({
      index,
      lines,
      normalized,
      commandText: normalized.slice(match.index),
      guardPrefix: normalized.slice(0, match.index),
    });
  }

  return directives;
}

function actionBlock({ commandText, normalized, index, lines }) {
  const block = [commandText ?? normalized];
  let cursor = index;
  const multiline = block[0]?.trimEnd().endsWith("\\");
  while (multiline && cursor + 1 < Math.min(lines.length, index + 8)) {
    cursor += 1;
    const continuation = normalizeLine(lines[cursor]);
    if (!continuation || continuation === "```") break;
    block.push(continuation);
  }
  return block.join("\n");
}

function nearbyText({ index, lines, guardPrefix }, before = 8) {
  const priorLines = lines
    .slice(Math.max(0, index - before), index)
    .map(normalizeLine);
  if (guardPrefix?.trim()) priorLines.push(guardPrefix.trim());
  return priorLines.join("\n");
}

function authorityEnvelopes(text) {
  const pattern =
    /^authority envelope:\s*action=([a-z-]+)\s*;\s*target=([^;\r\n]+?)\s*;\s*status=granted\s*\.?$/i;
  const lines = text
    .split(/\r?\n/u)
    .map(normalizeLine);
  const envelopes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(pattern);
    if (!match || isNegativeGuardLine(line)) continue;
    const priorLine = lines.slice(0, index).findLast(Boolean);
    if (priorLine && isNegativeGuardLine(priorLine)) continue;
    envelopes.push({
      action: match[1].toLowerCase(),
      target: match[2].trim(),
    });
  }
  return envelopes;
}

function hasExactAuthorityEnvelope(text, action, target) {
  if (!target) {
    return false;
  }
  return authorityEnvelopes(text).some(
    (envelope) => envelope.action === action && envelope.target === target,
  );
}

function cleanCommandToken(token) {
  return token?.replace(/^["']|["'.,]$/g, "");
}

function shellWords(text) {
  const words = [];
  let word = "";
  let quote = null;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === "\\" && index + 1 < text.length) {
        index += 1;
        word += text[index];
      } else if (character === quote) {
        quote = null;
      } else {
        word += character;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (/\s/u.test(character)) {
      if (word) {
        words.push(word);
        word = "";
      }
    } else {
      word += character;
    }
  }
  if (word) words.push(word);
  return words.map(cleanCommandToken).filter(Boolean);
}

function isLiteralRemote(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}

function isLiteralRef(value) {
  return (
    /^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._/-]*)?$/u.test(value) &&
    !value.includes("..") &&
    !value.includes("@{")
  );
}

function isLiteralRepository(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}

function stageTarget(directive) {
  const block = actionBlock(directive);
  const match = matchGitCommand(block, "add");
  if (!match) {
    return null;
  }
  const rawArgs = match[2].trim().split(/\s+/);
  const args = rawArgs.map(cleanCommandToken);
  if (
    args.includes("-A") ||
    args.includes("--all") ||
    rawArgs.some((argument) => cleanCommandToken(argument) === "" && /^['"]?\.['"]?[.,]?$/.test(argument))
  ) {
    return "worktree";
  }
  const pathspecs = args.filter((argument) => argument && !argument.startsWith("-"));
  return pathspecs.length > 0 ? `pathspec:${pathspecs.join(",")}` : null;
}

function pushTarget(directive) {
  const block = actionBlock(directive);
  const command = matchGitCommand(block, "push");
  if (!command) {
    return null;
  }
  const rawArgs = command[2]
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  if (["-u", "--set-upstream"].includes(rawArgs[0])) rawArgs.shift();
  if (rawArgs.some((argument) => argument.startsWith("-"))) return null;
  const args = rawArgs.map(cleanCommandToken);
  if (
    args.length !== 2 ||
    !isLiteralRemote(args[0]) ||
    !isLiteralRef(args[1])
  ) {
    return null;
  }
  return `${args[0]}:${args[1]}`;
}

function prTarget(directive) {
  const block = actionBlock(directive);
  const args = shellWords(block);
  if (
    args.some(
      (argument) =>
        argument === "--head" ||
        argument.startsWith("--head=") ||
        argument === "-H" ||
        argument.startsWith("-H=") ||
        /^-H\S+/u.test(argument),
    )
  ) {
    return null;
  }
  const repositories = [...block.matchAll(/--repo(?:=|\s+)([^\s;]+)/gi)];
  const bases = [...block.matchAll(/--base(?:=|\s+)([^\s;]+)/gi)];
  if (repositories.length !== 1 || bases.length !== 1) return null;
  const repository = repositories[0][1];
  const base = bases[0][1];
  const cleanRepository = cleanCommandToken(repository);
  const cleanBase = cleanCommandToken(base);
  if (
    !cleanRepository ||
    !cleanBase ||
    !isLiteralRepository(cleanRepository) ||
    !isLiteralRef(cleanBase)
  ) {
    return null;
  }
  return `${cleanRepository}:${cleanBase}`;
}

function gitActionTarget(directive, allowedActions) {
  const block = actionBlock(directive);
  const actionPattern = allowedActions.join("|");
  const match = matchGitCommand(block, actionPattern);
  if (!match) return null;
  const action = match[1].toLowerCase();
  const args = shellWords(match[2]);
  if (args.some((argument) => argument.startsWith("-"))) return null;
  const expectedOperands = action === "pull" ? 2 : 1;
  if (args.length !== expectedOperands) return null;
  if (
    action === "pull"
      ? !isLiteralRemote(args[0]) || !isLiteralRef(args[1])
      : !isLiteralRef(args[0])
  ) {
    return null;
  }
  const target = action === "pull" ? `${args[0]}/${args[1]}` : args[0];
  return { action, target };
}

function isIndexOnlyCommit(directive) {
  const command = matchGitCommand(actionBlock(directive), "commit");
  if (!command) return false;
  const args = shellWords(command[2]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (["-m", "--message", "-F", "--file"].includes(argument)) {
      index += 1;
      if (!args[index] || args[index].startsWith("-")) return false;
      continue;
    }
    if (
      /^-(?:m|F).+/u.test(argument) ||
      /^--(?:message|file)=.+/u.test(argument) ||
      ["-n", "--no-verify", "-s", "--signoff", "--no-gpg-sign"].includes(argument) ||
      /^(?:-S.*|--gpg-sign(?:=.*)?)$/u.test(argument) ||
      /^--(?:author|date|cleanup)=.+/u.test(argument)
    ) {
      continue;
    }
    return false;
  }
  return true;
}

function isReadOnlyGitCommand(action, args) {
  const alwaysReadOnly = new Set([
    "status",
    "diff",
    "log",
    "show",
    "rev-parse",
    "check-ignore",
    "ls-files",
    "ls-tree",
    "rev-list",
    "merge-base",
    "name-rev",
    "describe",
    "cat-file",
    "for-each-ref",
  ]);
  if (alwaysReadOnly.has(action)) return true;
  if (action === "branch") {
    return args.length === 0 || args.every((argument) => argument === "--show-current");
  }
  if (action === "worktree") {
    return args[0] === "list";
  }
  if (action === "remote") {
    return args.length === 0 || ["-v", "--verbose", "show", "get-url"].includes(args[0]);
  }
  if (action === "config") {
    return ["--get", "--get-all", "--get-regexp", "--list", "-l"].includes(args[0]);
  }
  return false;
}

function hasUnclassifiedGitMutation(content) {
  const directives = commandDirectives(
    content,
    new RegExp(`${GIT_COMMAND_PREFIX}([a-z][a-z0-9-]*)\\b([^\\r\\n]*)`, "i"),
  );
  const classified = new Set([
    "add",
    "commit",
    "push",
    "merge",
    "rebase",
    "checkout",
    "switch",
    "pull",
  ]);
  return directives.some((directive) => {
    const prefix = directive.guardPrefix?.trim() ?? "";
    const inlineExample =
      !prefix && /`[^`]*\bgit(?:\.exe|\.cmd)?\b[^`]*`\s*\S+/i.test(directive.original ?? "");
    if ((prefix && !hasImperativeGitPrefix(prefix)) || inlineExample) return false;
    const match = actionBlock(directive).match(
      new RegExp(`${GIT_COMMAND_PREFIX}([a-z][a-z0-9-]*)\\b([^\\r\\n]*)`, "i"),
    );
    if (!match) return true;
    const action = match[1].toLowerCase();
    const args = shellWords(match[2]);
    if (classified.has(action)) return false;
    if (action === "worktree" && args[0] === "add") return false;
    return !isReadOnlyGitCommand(action, args);
  });
}

function worktreeTarget(directive) {
  const block = actionBlock(directive);
  const command = matchGitCommand(block, String.raw`worktree\s+add`);
  const branchFlag = command?.[2].match(/(?:-b|-B)\s+([^\s;]+)/i);
  if (branchFlag) return cleanCommandToken(branchFlag[1]);
  const args = command?.[2]
    .trim()
    .split(/\s+/u)
    .map(cleanCommandToken)
    .filter((argument) => argument && !argument.startsWith("-"));
  return args && args.length > 1 ? args.at(-1) : null;
}

function hasUnguardedWorktreeCreate(content) {
  const directives = commandDirectives(
    content,
    gitMutationDirectivePattern(String.raw`worktree\s+add`),
  );

  return directives.some((directive) => {
    const guard = nearbyText(directive, 16);
    const hasIsolationConsent = hasPositiveGuard(guard, [
      /explicit user consent/i,
      /isolation consent (?:is )?(?:present|confirmed|verified)/i,
      /user has asked for an isolated workspace/i,
    ]);
    const hasExactBranchAuthority = hasExactAuthorityEnvelope(
      guard,
      "worktree-add",
      worktreeTarget(directive),
    );
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
    ...commandDirectives(content, gitMutationDirectivePattern("push")).map((directive) => ({
      ...directive,
      publishAction: "push",
    })),
    ...commandDirectives(content, /\bgh\s+pr\s+create\b/i).map((directive) => ({
      ...directive,
      publishAction: "pr-create",
    })),
    ...naturalDirectives(
      content,
      /^(?:push|publish)\b(?!\s+back\b)|^(?:open|create)\s+(?:a\s+)?PR\b/i,
    ).map((directive) => ({ ...directive, publishAction: "natural" })),
  ];
}

function hasUnguardedPublish(content) {
  return publishDirectives(content).some((directive) => {
    const guard = nearbyText(directive, 8);
    const selected = hasPositiveGuard(guard, [
      /user selects? the publish option/i,
      /user selected (?:the )?publish option/i,
    ]);
    const authorized = directive.publishAction === "push"
      ? hasExactAuthorityEnvelope(guard, "push", pushTarget(directive))
      : directive.publishAction === "pr-create"
        ? hasExactAuthorityEnvelope(guard, "pr-create", prTarget(directive))
        : false;
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

  const stageDirectives = [
    ...commandDirectives(content, gitMutationDirectivePattern("add")),
    ...naturalDirectives(content, /^(?:stage)(?:\s|$)/i),
  ];
  const commitDirectives = [
    ...commandDirectives(content, gitMutationDirectivePattern("commit")),
    ...naturalDirectives(content, /^(?:commit)(?:\s|$)|\bthen commit(?:\s|$)/i),
  ];
  const gitMutationDirectives = [...stageDirectives, ...commitDirectives];
  const hasUnguardedStage = stageDirectives.some((directive) => {
    const guard = nearbyText(directive, 10);
    const target = gitDirectivePattern("add").test(actionBlock(directive))
      ? stageTarget(directive)
      : "worktree";
    return !hasExactAuthorityEnvelope(guard, "stage", target);
  });
  const hasUnguardedCommit = commitDirectives.some((directive) => {
    const guard = nearbyText(directive, 10);
    return (
      !isIndexOnlyCommit(directive) ||
      !hasExactAuthorityEnvelope(guard, "commit", "index")
    );
  });
  if (hasUnguardedStage || hasUnguardedCommit || hasUnclassifiedGitMutation(content)) {
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
    gitMutationDirectivePattern("merge|rebase"),
  );
  const hasUnguardedIntegration = integrationDirectives.some((directive) => {
    const guard = nearbyText(directive, 10);
    const command = gitActionTarget(directive, ["merge", "rebase"]);
    return !command || !hasExactAuthorityEnvelope(guard, command.action, command.target);
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
    gitMutationDirectivePattern("checkout|switch|pull"),
  );
  if (
    checkoutDirectives.some((directive) => {
      const guard = nearbyText(directive, 10);
      const command = gitActionTarget(directive, ["checkout", "switch", "pull"]);
      return !command || !hasExactAuthorityEnvelope(guard, command.action, command.target);
    })
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

  const collabCommands = [
    ...commandDirectives(
      content,
      gitDirectivePattern("push|merge|rebase", String.raw`\b[^\n]*\bcollab\b`),
    ),
    ...commandDirectives(
      content,
      /\bgh\s+pr\s+create\b[^\n]*(?:--repo(?:=|\s+))collab\b/i,
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
        "The collab deployment target must never appear as an executable default on any skill surface.",
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
      gitMutationDirectivePattern("add|commit|push"),
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
      gitMutationDirectivePattern("checkout|switch|pull|merge|rebase"),
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
      gitMutationDirectivePattern(String.raw`worktree\s+(?:remove|prune)|branch\s+-[dD]`),
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
        gitDirectivePattern(String.raw`branch\s+-D`),
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
      new RegExp(
        `${GIT_DIRECTIVE_PREFIX}(?:add|commit|push)\\b|\\bgh\\s+pr\\s+create\\b`,
        "i",
      ),
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
