import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const codeowners = readFileSync(path.join(root, ".github", "CODEOWNERS"), "utf8");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const vitestConfig = readFileSync(path.join(root, "vitest.config.ts"), "utf8");
const pipelineDocs = readFileSync(
  path.join(root, "docs", "operations", "ai-development-pipeline.md"),
  "utf8",
);
const lifecycleTestPaths = [
  "tests/scripts/worktree-lifecycle.test.mjs",
  "tests/scripts/report-worktree-lifecycle.test.mjs",
  "tests/scripts/ai-task-lifecycle-v2.test.mjs",
  "tests/scripts/ai-task-cleanup.test.mjs",
];

function checkoutStepBlocks(source) {
  const lines = source.split(/\r?\n/u);
  const blocks = [];

  for (const [index, line] of lines.entries()) {
    const usesMatch = line.match(/^(\s*)uses:\s*actions\/checkout@v4\s*$/u);
    if (!usesMatch) continue;

    const stepIndent = Math.max(0, usesMatch[1].length - 2);
    const stepPrefix = `${" ".repeat(stepIndent)}- `;
    let start = index;
    while (start >= 0 && !lines[start].startsWith(stepPrefix)) start -= 1;
    if (start < 0) continue;

    let end = index + 1;
    while (end < lines.length) {
      const nextLine = lines[end];
      const nextIndent = nextLine.match(/^\s*/u)?.[0].length ?? 0;
      if (nextLine.trim() && nextIndent <= stepIndent) break;
      end += 1;
    }
    blocks.push({ lines: lines.slice(start, end), propertyIndent: usesMatch[1].length });
  }

  return blocks;
}

function disablesCheckoutCredentialPersistence({ lines, propertyIndent }) {
  const propertyPrefix = " ".repeat(propertyIndent);
  const valuePrefix = " ".repeat(propertyIndent + 2);
  const withIndex = lines.findIndex((line) => line === `${propertyPrefix}with:`);
  if (withIndex < 0) return false;

  for (const line of lines.slice(withIndex + 1)) {
    const lineIndent = line.match(/^\s*/u)?.[0].length ?? 0;
    if (line.trim() && lineIndent <= propertyIndent) break;
    if (line === `${valuePrefix}persist-credentials: false`) return true;
  }

  return false;
}

function jobBlock(jobId) {
  const lines = workflow.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `  ${jobId}:`);
  if (start < 0) return "";

  let end = start + 1;
  while (end < lines.length && !/^  [a-z0-9-]+:\s*$/u.test(lines[end])) {
    end += 1;
  }
  return lines.slice(start, end).join("\n");
}

function jobStepRunScript(jobId, stepName) {
  const lines = jobBlock(jobId).split(/\r?\n/u);
  const stepStart = lines.findIndex((line) => line === `      - name: ${stepName}`);
  const runStart = lines.findIndex(
    (line, index) => index > stepStart && line === "        run: |",
  );
  if (stepStart < 0 || runStart < 0) return "";

  const scriptLines = [];
  for (const line of lines.slice(runStart + 1)) {
    const indentation = line.match(/^\s*/u)?.[0].length ?? 0;
    if (line.trim() && indentation <= 8) break;
    scriptLines.push(line.startsWith("          ") ? line.slice(10) : line);
  }
  return scriptLines.join("\n");
}

function runBashScript(source, environment = {}, options = {}) {
  const shellQuote = (value) => `'${String(value).replaceAll("'", `'\\''`)}'`;
  const exports = Object.entries(environment).map(([name, value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/u.test(name)) throw new Error(`invalid env name: ${name}`);
    return `export ${name}=${shellQuote(value)}`;
  });
  const workingDirectory = options.cwd
    ? path.resolve(options.cwd).replaceAll("\\", "/")
    : undefined;
  const changeDirectory = workingDirectory
    ? [
        `cd "$(command -v wslpath >/dev/null 2>&1 && wslpath -u ${shellQuote(workingDirectory)} || printf %s ${shellQuote(workingDirectory)})" || exit $?`,
      ]
    : [];
  const encoded = Buffer.from(
    [...changeDirectory, ...exports, source].join("\n"),
    "utf8",
  ).toString("base64");
  return spawnSync("bash", ["-c", `printf %s ${encoded} | base64 -d | bash`], {
    encoding: "utf8",
  });
}

function runGit(repository, args) {
  return runGitInput(repository, args);
}

function runGitInput(repository, args, input) {
  const result = spawnSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    input,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function createObjectDiffRepository(relativePath) {
  const repository = mkdtempSync(path.join(os.tmpdir(), "talkpik-ci-object-diff-"));
  runGit(repository, ["init", "--initial-branch=main"]);
  runGit(repository, ["config", "user.name", "CI test"]);
  runGit(repository, ["config", "user.email", "ci-test@example.invalid"]);
  runGit(repository, ["config", "core.protectNTFS", "false"]);
  runGit(repository, ["config", "core.ignoreCase", "false"]);

  const emptyTree = runGitInput(repository, ["mktree", "-z"], "");
  const baseSha = runGit(repository, ["commit-tree", emptyTree, "-m", "base"]);
  let objectId = runGitInput(repository, ["hash-object", "-w", "--stdin"], "payload\n");
  let objectType = "blob";
  let objectMode = "100644";
  const segments = relativePath.split("/");
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const treeEntry = `${objectMode} ${objectType} ${objectId}\t${segments[index]}\0`;
    objectId = runGitInput(repository, ["mktree", "-z"], treeEntry);
    objectType = "tree";
    objectMode = "040000";
  }
  const headSha = runGit(repository, [
    "commit-tree",
    objectId,
    "-p",
    baseSha,
    "-m",
    "head",
  ]);
  return { baseSha, headSha, repository };
}

function createCaseCollisionRepository() {
  const repository = mkdtempSync(path.join(os.tmpdir(), "talkpik-ci-case-diff-"));
  runGit(repository, ["init", "--initial-branch=main"]);
  runGit(repository, ["config", "user.name", "CI test"]);
  runGit(repository, ["config", "user.email", "ci-test@example.invalid"]);
  runGit(repository, ["config", "core.protectNTFS", "false"]);
  runGit(repository, ["config", "core.ignoreCase", "false"]);

  const existingBlob = runGitInput(
    repository,
    ["hash-object", "-w", "--stdin"],
    "existing\n",
  );
  const addedBlob = runGitInput(
    repository,
    ["hash-object", "-w", "--stdin"],
    "added\n",
  );
  const baseDocsTree = runGitInput(
    repository,
    ["mktree", "-z"],
    `100644 blob ${existingBlob}\tGuide.md\0`,
  );
  const headDocsTree = runGitInput(
    repository,
    ["mktree", "-z"],
    [
      `100644 blob ${existingBlob}\tGuide.md\0`,
      `100644 blob ${addedBlob}\tguide.md\0`,
    ].join(""),
  );
  const baseTree = runGitInput(
    repository,
    ["mktree", "-z"],
    `040000 tree ${baseDocsTree}\tdocs\0`,
  );
  const headTree = runGitInput(
    repository,
    ["mktree", "-z"],
    `040000 tree ${headDocsTree}\tdocs\0`,
  );
  const baseSha = runGit(repository, ["commit-tree", baseTree, "-m", "base"]);
  const headSha = runGit(repository, [
    "commit-tree",
    headTree,
    "-p",
    baseSha,
    "-m",
    "head",
  ]);
  return { baseSha, headSha, repository };
}

function createFileDirectoryCaseCollisionRepository() {
  const repository = mkdtempSync(path.join(os.tmpdir(), "talkpik-ci-tree-case-"));
  runGit(repository, ["init", "--initial-branch=main"]);
  runGit(repository, ["config", "user.name", "CI test"]);
  runGit(repository, ["config", "user.email", "ci-test@example.invalid"]);
  runGit(repository, ["config", "core.ignoreCase", "false"]);

  const emptyTree = runGitInput(repository, ["mktree", "-z"], "");
  const baseSha = runGit(repository, ["commit-tree", emptyTree, "-m", "base"]);
  const fileBlob = runGitInput(
    repository,
    ["hash-object", "-w", "--stdin"],
    "file\n",
  );
  const nestedBlob = runGitInput(
    repository,
    ["hash-object", "-w", "--stdin"],
    "nested\n",
  );
  const nestedTree = runGitInput(
    repository,
    ["mktree", "-z"],
    `100644 blob ${nestedBlob}\tbar.md\0`,
  );
  const docsTree = runGitInput(
    repository,
    ["mktree", "-z"],
    [
      `100644 blob ${fileBlob}\tFoo.md\0`,
      `040000 tree ${nestedTree}\tfoo.md\0`,
    ].join(""),
  );
  const headTree = runGitInput(
    repository,
    ["mktree", "-z"],
    `040000 tree ${docsTree}\tdocs\0`,
  );
  const headSha = runGit(repository, [
    "commit-tree",
    headTree,
    "-p",
    baseSha,
    "-m",
    "head",
  ]);
  return { baseSha, headSha, repository };
}

function writeRepositoryFile(repository, relativePath, contents) {
  const absolutePath = path.join(repository, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
}

function createDiffRepository(baseFiles, headMutation) {
  const repository = mkdtempSync(path.join(os.tmpdir(), "talkpik-ci-classifier-"));
  const indexOverrides = [];
  runGit(repository, ["init", "--initial-branch=main"]);
  runGit(repository, ["config", "user.name", "CI test"]);
  runGit(repository, ["config", "user.email", "ci-test@example.invalid"]);
  for (const [relativePath, contents] of Object.entries(baseFiles)) {
    writeRepositoryFile(repository, relativePath, contents);
  }
  runGit(repository, ["add", "--all"]);
  runGit(repository, ["commit", "-m", "base"]);
  const baseSha = runGit(repository, ["rev-parse", "HEAD"]);

  headMutation({
    remove(relativePath) {
      rmSync(path.join(repository, relativePath));
    },
    rename(from, to) {
      mkdirSync(path.dirname(path.join(repository, to)), { recursive: true });
      runGit(repository, ["mv", from, to]);
    },
    write(relativePath, contents) {
      writeRepositoryFile(repository, relativePath, contents);
    },
    symlink(relativePath, target) {
      writeRepositoryFile(repository, relativePath, target);
      indexOverrides.push({ mode: "120000", relativePath, sourcePath: relativePath });
    },
    gitlink(relativePath) {
      indexOverrides.push({ mode: "160000", objectId: baseSha, relativePath });
    },
  });
  runGit(repository, ["add", "--all"]);
  for (const override of indexOverrides) {
    const { mode, relativePath, sourcePath } = override;
    const objectId =
      override.objectId ??
      runGit(repository, ["hash-object", "-w", "--", sourcePath]);
    runGit(repository, [
      "update-index",
      "--add",
      "--cacheinfo",
      `${mode},${objectId},${relativePath}`,
    ]);
  }
  runGit(repository, ["commit", "-m", "head"]);
  const headSha = runGit(repository, ["rev-parse", "HEAD"]);
  return { baseSha, headSha, repository };
}

function cleanupDiffRepository(repository) {
  if (process.platform === "win32") {
    spawnSync("attrib", ["-H", path.join(repository, ".git")], {
      encoding: "utf8",
      windowsHide: true,
    });
  }
  rmSync(repository, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 50,
  });
}

function parseGithubOutput(contents) {
  return Object.fromEntries(
    contents
      .trim()
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function bashTimingHarness(startSetup, script) {
  return [
    'summary_path="$(mktemp)"',
    'trap \'rm -f "$summary_path"\' EXIT',
    'GITHUB_STEP_SUMMARY="$summary_path"',
    startSetup,
    script,
    'cat "$summary_path"',
  ].join("\n");
}

function topLevelBlock(source, key) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start < 0) return "";

  let end = start + 1;
  while (end < lines.length && (!lines[end].trim() || /^\s/u.test(lines[end]))) {
    end += 1;
  }
  return lines.slice(start, end).join("\n");
}

function concurrencyPolicy(source) {
  const block = topLevelBlock(source, "concurrency");
  const properties = Object.create(null);
  for (const line of block.split(/\r?\n/u).slice(1)) {
    const match = line.match(/^  ([a-z-]+):\s*(.+)$/u);
    if (match) properties[match[1]] = match[2];
  }
  return properties;
}

function configGlobPatterns(configSource, key) {
  const block = configSource.match(new RegExp(`${key}:\\s*\\[([\\s\\S]*?)\\]`, "u"));
  return block ? [...block[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]) : [];
}

function fullTestCoversLifecycle(testScript, configSource) {
  const includes = configGlobPatterns(configSource, "include");
  const excludes = configGlobPatterns(configSource, "exclude");
  return (
    testScript.trim() === "vitest run" &&
    lifecycleTestPaths.every(
      (relativePath) =>
        includes.some((pattern) => path.matchesGlob(relativePath, pattern)) &&
        !excludes.some((pattern) => path.matchesGlob(relativePath, pattern)),
    )
  );
}

describe("runBashScript", () => {
  it("changes to a safely quoted cwd before applying the requested environment", () => {
    const workingDirectory = mkdtempSync(
      path.join(os.tmpdir(), "talkpik bash 'cwd-"),
    );
    try {
      const result = runBashScript(
        "printf working > cwd-result.txt",
        { PATH: "/nonexistent" },
        { cwd: workingDirectory },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(
        readFileSync(path.join(workingDirectory, "cwd-result.txt"), "utf8"),
      ).toBe("working");
    } finally {
      rmSync(workingDirectory, { recursive: true, force: true });
    }
  });

  it("does not run the source when the requested cwd does not exist", () => {
    const temporaryRoot = mkdtempSync(
      path.join(os.tmpdir(), "talkpik-bash-missing-cwd-"),
    );
    const missingDirectory = path.join(temporaryRoot, "missing");
    const sideEffectName = `run-bash-side-effect-${path.basename(temporaryRoot)}.txt`;
    const sideEffectPath = path.join(root, sideEffectName);
    try {
      const result = runBashScript(`printf reached > ${sideEffectName}`, {}, {
        cwd: missingDirectory,
      });

      expect(result.error).toBeUndefined();
      expect(typeof result.status).toBe("number");
      expect(result.status).toBeGreaterThan(0);
      expect(existsSync(sideEffectPath)).toBe(false);
    } finally {
      rmSync(sideEffectPath, { force: true });
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});

describe("CI trusted UI contract boundary", () => {
  it("covers pull request state transitions, merge queues, and main pushes", () => {
    expect(workflow).toMatch(/\n\s*pull_request:\s*\n/u);
    expect(topLevelBlock(workflow, "on")).toContain(
      "types: [opened, synchronize, reopened, ready_for_review, converted_to_draft]",
    );
    expect(workflow).toMatch(/\n\s*merge_group:\s*\n/u);
    expect(workflow).toMatch(/\n\s*push:\s*\n\s*branches:\s*\[main\]/u);
    expect(topLevelBlock(workflow, "on")).not.toMatch(/collab/u);
    expect(concurrencyPolicy(workflow)).toMatchObject({
      group: expect.stringContaining("github.event.pull_request.number"),
      "cancel-in-progress": "${{ github.event_name == 'pull_request' }}",
    });
    for (const jobId of ["verify", "lifecycle-windows"]) {
      expect(jobBlock(jobId)).toContain("github.event.pull_request.draft == false");
    }

    const missingDraftTransition = workflow.replace(", converted_to_draft", "");
    expect(topLevelBlock(missingDraftTransition, "on")).not.toContain(
      "converted_to_draft",
    );
  });

  it("does not persist checkout credentials before candidate code runs", () => {
    const checkoutSteps = checkoutStepBlocks(workflow);

    expect(checkoutSteps).toHaveLength(4);
    for (const checkoutStep of checkoutSteps) {
      expect(disablesCheckoutCredentialPersistence(checkoutStep)).toBe(true);
    }
  });

  it("does not accept a misplaced credential setting outside checkout with", () => {
    const tamperedWorkflow = workflow
      .replace("          persist-credentials: false", "          persist-credentials: true")
      .replace("          fetch-depth: 0", "          fetch-depth: 0\n        env:\n          persist-credentials: false");

    const checkoutSteps = checkoutStepBlocks(tamperedWorkflow);

    expect(checkoutSteps).toHaveLength(4);
    expect(checkoutSteps.some(disablesCheckoutCredentialPersistence)).toBe(true);
    expect(checkoutSteps.every(disablesCheckoutCredentialPersistence)).toBe(false);
  });

  it("cancels only superseded runs for the same pull request", () => {
    const expectedPolicy = {
      group:
        "ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.event.merge_group.head_sha || github.ref }}",
      "cancel-in-progress": "${{ github.event_name == 'pull_request' }}",
    };

    expect(concurrencyPolicy(workflow)).toEqual(expectedPolicy);

    const wrongFallback = workflow.replace(
      expectedPolicy.group,
      "ci-${{ github.workflow }}-${{ github.ref }}",
    );
    expect(concurrencyPolicy(wrongFallback)).not.toEqual(expectedPolicy);

    const neverCancel = workflow.replace(
      expectedPolicy["cancel-in-progress"],
      "${{ false }}",
    );
    expect(concurrencyPolicy(neverCancel)).not.toEqual(expectedPolicy);

    const decoyOutsideConcurrency = [
      "name: decoy",
      "jobs:",
      "  fake:",
      `    group: ${expectedPolicy.group}`,
      `    cancel-in-progress: ${expectedPolicy["cancel-in-progress"]}`,
    ].join("\n");
    expect(concurrencyPolicy(decoyOutsideConcurrency)).toEqual({});
  });

  it("runs heavy required jobs only for ready pull requests and merge groups", () => {
    for (const jobId of ["verify", "lifecycle-windows"]) {
      const job = jobBlock(jobId);
      expect(job).toContain("github.event_name != 'push'");
      expect(job).toContain("github.event.pull_request.draft == false");
    }

    expect(jobBlock("verify")).toContain("name: typecheck / test / lint / build");
    expect(jobBlock("lifecycle-windows")).toContain(
      "name: report-only worktree lifecycle / windows",
    );
  });

  it("classifies the complete Git diff without workflow path filters or pull-request APIs", () => {
    const classifierJob = jobBlock("classify-changes");
    const onBlock = topLevelBlock(workflow, "on");

    expect(onBlock).not.toMatch(/paths(?:-ignore)?:/u);
    expect(workflow).not.toMatch(/pulls\/.*\/files|gh\s+api|github-script/u);
    expect(classifierJob).toContain("fetch-depth: 0");
    expect(classifierJob).toContain("persist-credentials: false");
    expect(classifierJob).toContain("run_app:");
    expect(classifierJob).toContain("run_pipeline_contracts:");
    expect(classifierJob).toContain("run_windows_lifecycle:");
    expect(classifierJob).toContain("changed_count:");
    expect(classifierJob).toContain("classification:");

    const script = jobStepRunScript("classify-changes", "Classify changed paths");
    expect(script).toContain("git diff --name-status -z --no-renames");
    expect(script).toContain("--no-ext-diff --no-textconv");
    expect(script).toContain("--ignore-submodules=none");
    expect(script).toContain("git ls-tree -r -t -z --name-only");
    expect(script).toContain('"${CI_DIFF_BASE_SHA}...${CI_DIFF_HEAD_SHA}"');
    expect(script).toContain('"${CI_DIFF_BASE_SHA}..${CI_DIFF_HEAD_SHA}"');
    expect(script).toContain("[[:cntrl:]]");
    expect(script).toContain(
      "CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]|COM¹|COM²|COM³|LPT¹|LPT²|LPT³",
    );
    expect(script).toContain("pull_request)");
    expect(script).toContain("merge_group|push)");
  });

  const classificationScenarios = [
      {
        name: "documentation only",
        baseFiles: { "docs/guide.md": "before\n" },
        mutate: ({ write }) => write("docs/guide.md", "after\n"),
        expected: {
          run_app: "false",
          run_pipeline_contracts: "false",
          run_windows_lifecycle: "false",
          changed_count: "1",
          classification: "docs-only",
        },
      },
      {
        name: "pipeline lifecycle",
        baseFiles: { "scripts/lib/ai-task-cleanup.mjs": "before\n" },
        mutate: ({ write }) =>
          write("scripts/lib/ai-task-cleanup.mjs", "after\n"),
        expected: {
          run_app: "false",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "pipeline",
        },
      },
      {
        name: "pipeline metrics entrypoint",
        baseFiles: { "scripts/ai-task.mjs": "before\n" },
        mutate: ({ write }) =>
          write("scripts/ai-task.mjs", "after\n"),
        expected: {
          run_app: "false",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "pipeline",
        },
      },
      {
        name: "pipeline one-shot sweep entrypoint",
        baseFiles: { "scripts/lib/ai-task-sweep.mjs": "before\n" },
        mutate: ({ write }) =>
          write("scripts/lib/ai-task-sweep.mjs", "after\n"),
        expected: {
          run_app: "false",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "pipeline",
        },
      },
      {
        name: "application",
        baseFiles: { "src/app/page.tsx": "before\n" },
        mutate: ({ write }) => write("src/app/page.tsx", "after\n"),
        expected: {
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "full",
        },
      },
      {
        name: "lock file",
        baseFiles: { "pnpm-lock.yaml": "before\n" },
        mutate: ({ write }) => write("pnpm-lock.yaml", "after\n"),
        expected: {
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "full",
        },
      },
      {
        name: "deletion",
        baseFiles: { "docs/obsolete.md": "before\n" },
        mutate: ({ remove }) => remove("docs/obsolete.md"),
        expected: {
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "full-fallback",
        },
      },
      {
        name: "rename",
        baseFiles: { "docs/old.md": "before\n" },
        mutate: ({ rename }) => rename("docs/old.md", "docs/new.md"),
        expected: {
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "2",
          classification: "full-fallback",
        },
      },
      {
        name: "copy",
        baseFiles: { "docs/original.md": "same contents\n" },
        mutate: ({ write }) => write("docs/copied.md", "same contents\n"),
        expected: {
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "full-fallback",
        },
      },
      {
        name: "unknown root file",
        baseFiles: { "unclassified.txt": "before\n" },
        mutate: ({ write }) => write("unclassified.txt", "after\n"),
        expected: {
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "full-fallback",
        },
      },
      {
        name: "documentation symlink",
        baseFiles: { "docs/reference.md": "before\n" },
        mutate: ({ symlink }) => symlink("docs/reference.md", "../outside.md"),
        expected: {
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "full-fallback",
        },
      },
      {
        name: "gitlink",
        baseFiles: { "README.md": "before\n" },
        mutate: ({ gitlink }) => gitlink("docs/submodule.md"),
        expected: {
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "full-fallback",
        },
      },
      {
        name: "leading dash path",
        baseFiles: { "docs/safe.md": "before\n" },
        mutate: ({ write }) => write("-unsafe.md", "after\n"),
        expected: {
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          changed_count: "1",
          classification: "full-fallback",
        },
      },
    ];

  it.each(classificationScenarios)("maps $name diff fail-closed", (scenario) => {
    const script = jobStepRunScript("classify-changes", "Classify changed paths");
    expect(script).not.toBe("");
    const { baseSha, headSha, repository } = createDiffRepository(
      scenario.baseFiles,
      scenario.mutate,
    );
    try {
      const outputPath = path.join(repository, "github-output.txt");
      const result = runBashScript(
        script,
        {
          CI_DIFF_EVENT_NAME: "pull_request",
          CI_DIFF_BASE_SHA: baseSha,
          CI_DIFF_HEAD_SHA: headSha,
          GITHUB_OUTPUT: "github-output.txt",
          RUNNER_TEMP: ".",
        },
        { cwd: repository },
      );

      expect(result.status, `${scenario.name}: ${result.stderr}`).toBe(0);
      expect(parseGithubOutput(readFileSync(outputPath, "utf8"))).toEqual(
        scenario.expected,
      );
    } finally {
      cleanupDiffRepository(repository);
    }
  });

  it("falls back to full validation when the diff cannot be established", () => {
    const script = jobStepRunScript("classify-changes", "Classify changed paths");
    const repository = mkdtempSync(path.join(os.tmpdir(), "talkpik-ci-fallback-"));
    const outputPath = path.join(repository, "github-output.txt");
    runGit(repository, ["init", "--initial-branch=main"]);

    try {
      const result = runBashScript(
        script,
        {
          CI_DIFF_EVENT_NAME: "pull_request",
          CI_DIFF_BASE_SHA: "not-a-commit",
          CI_DIFF_HEAD_SHA: "also-not-a-commit",
          GITHUB_OUTPUT: "github-output.txt",
          RUNNER_TEMP: ".",
        },
        { cwd: repository },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(parseGithubOutput(readFileSync(outputPath, "utf8"))).toEqual({
        run_app: "true",
        run_pipeline_contracts: "true",
        run_windows_lifecycle: "true",
        changed_count: "0",
        classification: "full-fallback",
      });
    } finally {
      cleanupDiffRepository(repository);
    }
  });

  it("falls back for zero and valid-looking missing commit ids", () => {
    const script = jobStepRunScript("classify-changes", "Classify changed paths");
    const repository = mkdtempSync(path.join(os.tmpdir(), "talkpik-ci-sha-fallback-"));
    runGit(repository, ["init", "--initial-branch=main"]);
    try {
      for (const [index, revision] of ["0".repeat(40), "f".repeat(40)].entries()) {
        const outputName = `github-output-${index}.txt`;
        const result = runBashScript(
          script,
          {
            CI_DIFF_EVENT_NAME: "push",
            CI_DIFF_BASE_SHA: revision,
            CI_DIFF_HEAD_SHA: revision,
            GITHUB_OUTPUT: outputName,
            RUNNER_TEMP: ".",
          },
          { cwd: repository },
        );

        expect(result.status, result.stderr).toBe(0);
        expect(
          parseGithubOutput(readFileSync(path.join(repository, outputName), "utf8")),
        ).toMatchObject({
          run_app: "true",
          run_pipeline_contracts: "true",
          run_windows_lifecycle: "true",
          classification: "full-fallback",
        });
      }
    } finally {
      cleanupDiffRepository(repository);
    }
  });

  const windowsUnsafePathScenarios = [
    { name: "reserved device", relativePath: "docs/CON.md" },
    { name: "forbidden punctuation", relativePath: "docs/foo?.md" },
    { name: "superscript device suffix", relativePath: "docs/COM¹.md" },
    { name: "non-ASCII", relativePath: "docs/한글.md" },
    { name: "escape control", relativePath: "docs/escape\u001b.md" },
    { name: "bell control", relativePath: "docs/bell\u0007.md" },
  ];

  it.each(windowsUnsafePathScenarios)(
    "falls back for Windows-unsafe path: $name",
    ({ relativePath }) => {
    const script = jobStepRunScript("classify-changes", "Classify changed paths");
    const { baseSha, headSha, repository } = createObjectDiffRepository(relativePath);
    try {
      const result = runBashScript(
        script,
        {
          CI_DIFF_EVENT_NAME: "pull_request",
          CI_DIFF_BASE_SHA: baseSha,
          CI_DIFF_HEAD_SHA: headSha,
          GITHUB_OUTPUT: "github-output.txt",
          RUNNER_TEMP: ".",
        },
        { cwd: repository },
      );
      expect(result.status, `${JSON.stringify(relativePath)}: ${result.stderr}`).toBe(0);
      expect(
        parseGithubOutput(
          readFileSync(path.join(repository, "github-output.txt"), "utf8"),
        ),
      ).toEqual({
        run_app: "true",
        run_pipeline_contracts: "true",
        run_windows_lifecycle: "true",
        changed_count: "1",
        classification: "full-fallback",
      });
    } finally {
      cleanupDiffRepository(repository);
    }
    },
  );

  it("falls back when HEAD contains ASCII case-insensitive path collisions", () => {
    const script = jobStepRunScript("classify-changes", "Classify changed paths");
    const { baseSha, headSha, repository } = createCaseCollisionRepository();
    try {
      const result = runBashScript(
        script,
        {
          CI_DIFF_EVENT_NAME: "pull_request",
          CI_DIFF_BASE_SHA: baseSha,
          CI_DIFF_HEAD_SHA: headSha,
          GITHUB_OUTPUT: "github-output.txt",
          RUNNER_TEMP: ".",
        },
        { cwd: repository },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(
        parseGithubOutput(
          readFileSync(path.join(repository, "github-output.txt"), "utf8"),
        ),
      ).toEqual({
        run_app: "true",
        run_pipeline_contracts: "true",
        run_windows_lifecycle: "true",
        changed_count: "1",
        classification: "full-fallback",
      });
    } finally {
      cleanupDiffRepository(repository);
    }
  });

  it("falls back for file-directory case collisions in the HEAD tree", () => {
    const script = jobStepRunScript("classify-changes", "Classify changed paths");
    const { baseSha, headSha, repository } =
      createFileDirectoryCaseCollisionRepository();
    try {
      const result = runBashScript(
        script,
        {
          CI_DIFF_EVENT_NAME: "pull_request",
          CI_DIFF_BASE_SHA: baseSha,
          CI_DIFF_HEAD_SHA: headSha,
          GITHUB_OUTPUT: "github-output.txt",
          RUNNER_TEMP: ".",
        },
        { cwd: repository },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(
        parseGithubOutput(
          readFileSync(path.join(repository, "github-output.txt"), "utf8"),
        ),
      ).toEqual({
        run_app: "true",
        run_pipeline_contracts: "true",
        run_windows_lifecycle: "true",
        changed_count: "2",
        classification: "full-fallback",
      });
    } finally {
      cleanupDiffRepository(repository);
    }
  });

  it("uses three-dot PR semantics and two-dot push semantics on diverged history", () => {
    const script = jobStepRunScript("classify-changes", "Classify changed paths");
    const repository = mkdtempSync(path.join(os.tmpdir(), "talkpik-ci-range-"));
    runGit(repository, ["init", "--initial-branch=main"]);
    runGit(repository, ["config", "user.name", "CI test"]);
    runGit(repository, ["config", "user.email", "ci-test@example.invalid"]);
    writeRepositoryFile(repository, "README.md", "base\n");
    runGit(repository, ["add", "--all"]);
    runGit(repository, ["commit", "-m", "base"]);
    runGit(repository, ["switch", "-c", "feature"]);
    writeRepositoryFile(repository, "docs/feature.md", "feature\n");
    runGit(repository, ["add", "--all"]);
    runGit(repository, ["commit", "-m", "feature"]);
    const headSha = runGit(repository, ["rev-parse", "HEAD"]);
    runGit(repository, ["switch", "main"]);
    writeRepositoryFile(repository, "src/base-only.ts", "export {};\n");
    runGit(repository, ["add", "--all"]);
    runGit(repository, ["commit", "-m", "advanced base"]);
    const baseSha = runGit(repository, ["rev-parse", "HEAD"]);

    try {
      for (const [eventName, expectedClassification] of [
        ["pull_request", "docs-only"],
        ["push", "full-fallback"],
        ["merge_group", "full-fallback"],
      ]) {
        const outputName = `${eventName}-output.txt`;
        const result = runBashScript(
          script,
          {
            CI_DIFF_EVENT_NAME: eventName,
            CI_DIFF_BASE_SHA: baseSha,
            CI_DIFF_HEAD_SHA: headSha,
            GITHUB_OUTPUT: outputName,
            RUNNER_TEMP: ".",
          },
          { cwd: repository },
        );
        expect(result.status, `${eventName}: ${result.stderr}`).toBe(0);
        expect(
          parseGithubOutput(readFileSync(path.join(repository, outputName), "utf8")),
        ).toMatchObject({ classification: expectedClassification });
      }
    } finally {
      cleanupDiffRepository(repository);
    }
  });

  it("always runs trust checks but skips dependency and app work for docs-only diffs", () => {
    const verifyJob = jobBlock("verify");

    expect(verifyJob).toContain("needs: [classify-changes]");
    expect(verifyJob).toContain("Check UI contract diff baseline (trusted)");
    expect(verifyJob).toContain("Check artifact hygiene diff baseline (trusted)");
    expect(verifyJob).toContain("node scripts/check-project-structure.mjs");
    expect(verifyJob).toContain("node scripts/check-agent-skill-policy.mjs");
    expect(verifyJob).toContain("node scripts/sync-agent-skills.mjs --check");
    for (const stepName of [
      "Enable corepack (pnpm)",
      "Install dependencies",
      "Typecheck",
      "Test",
      "Lint",
      "Build",
    ]) {
      const stepStart = verifyJob.indexOf(`- name: ${stepName}`);
      expect(stepStart, stepName).toBeGreaterThan(-1);
      expect(verifyJob.slice(stepStart, stepStart + 300)).toContain(
        "needs.classify-changes.outputs.run_app == 'true'",
      );
    }
  });

  it("runs focused pipeline contracts and Windows only when classification requests them", () => {
    const verifyJob = jobBlock("verify");
    const windowsJob = jobBlock("lifecycle-windows");

    expect(verifyJob).toContain("Check pipeline lifecycle contracts");
    expect(verifyJob).toContain("needs.classify-changes.outputs.run_pipeline_contracts");
    expect(verifyJob).toContain("tests/scripts/ai-task-metrics.test.mjs");
    expect(verifyJob).toContain("tests/scripts/ai-task-measure-cli.test.mjs");
    expect(windowsJob).toContain("needs: [classify-changes]");
    expect(windowsJob).toContain(
      "needs.classify-changes.outputs.run_windows_lifecycle == 'true'",
    );
  });

  it("uses a dependency-free nonrequired integrity job for main pushes", () => {
    const integrityJob = jobBlock("main-integrity");

    expect(integrityJob).toContain("github.event_name == 'push'");
    expect(integrityJob).toContain("needs: [classify-changes]");
    expect(integrityJob).toContain("name: main branch integrity (nonrequired)");
    expect(integrityJob).toContain("node scripts/check-project-structure.mjs");
    expect(integrityJob).toContain("node scripts/check-agent-skill-policy.mjs");
    expect(integrityJob).toContain("node scripts/sync-agent-skills.mjs --check");
    expect(integrityJob).not.toContain("corepack");
    expect(integrityJob).not.toContain("pnpm install");
    expect(integrityJob).not.toContain("pnpm test");
    expect(integrityJob).not.toContain("pnpm build");
  });

  it("aggregates the classifier and event-specific jobs into one stable required check", () => {
    const requiredJob = jobBlock("required");

    expect(requiredJob).toContain("name: CI required");
    expect(requiredJob).toContain("if: ${{ always() }}");
    expect(requiredJob).toContain(
      "needs: [classify-changes, verify, lifecycle-windows, main-integrity]",
    );
    expect(requiredJob).toContain("runs-on: ubuntu-latest");
    expect(requiredJob).toContain("timeout-minutes: 2");
    expect(requiredJob).toContain("CI_EVENT_NAME: ${{ github.event_name }}");
    expect(requiredJob).toContain(
      "CI_CLASSIFIER_RESULT: ${{ needs.classify-changes.result }}",
    );
    expect(requiredJob).toContain(
      "CI_CHANGED_COUNT: ${{ needs.classify-changes.outputs.changed_count }}",
    );
    expect(requiredJob).toContain(
      "CI_PULL_REQUEST_DRAFT: ${{ github.event.pull_request.draft }}",
    );
    expect(requiredJob).toContain("CI_VERIFY_RESULT: ${{ needs.verify.result }}");
    expect(requiredJob).toContain(
      "CI_LIFECYCLE_WINDOWS_RESULT: ${{ needs.lifecycle-windows.result }}",
    );
    expect(requiredJob).toContain(
      "CI_MAIN_INTEGRITY_RESULT: ${{ needs.main-integrity.result }}",
    );
    expect(requiredJob).not.toContain("actions/checkout");
    expect(requiredJob).not.toContain("actions/setup-node");
    expect(requiredJob).not.toContain("corepack");
    expect(requiredJob).not.toContain("pnpm");
    expect(requiredJob).not.toContain("continue-on-error");
  });

  it("accepts only the expected predecessor results for each supported event", () => {
    const script = jobStepRunScript("required", "Require expected CI results");
    expect(script).not.toBe("");

    const runRequired = ({
      eventName,
      draft = "",
      classifier = draft === "true" ? "skipped" : "success",
      runApp = draft === "true" ? "" : "true",
      runPipeline = draft === "true" ? "" : "true",
      runWindows = draft === "true" ? "" : "true",
      changedCount = draft === "true" ? "" : "1",
      classification = draft === "true" ? "" : "full",
      verify,
      windows,
      integrity,
    }) =>
      runBashScript(script, {
        CI_EVENT_NAME: eventName,
        CI_PULL_REQUEST_DRAFT: draft,
        CI_CLASSIFIER_RESULT: classifier,
        CI_RUN_APP: runApp,
        CI_RUN_PIPELINE_CONTRACTS: runPipeline,
        CI_RUN_WINDOWS_LIFECYCLE: runWindows,
        CI_CHANGED_COUNT: changedCount,
        CI_CLASSIFICATION: classification,
        CI_VERIFY_RESULT: verify,
        CI_LIFECYCLE_WINDOWS_RESULT: windows,
        CI_MAIN_INTEGRITY_RESULT: integrity,
      });

    for (const scenario of [
      {
        eventName: "pull_request",
        draft: "true",
        verify: "skipped",
        windows: "skipped",
        integrity: "skipped",
      },
      {
        eventName: "pull_request",
        draft: "false",
        runApp: "false",
        runPipeline: "false",
        runWindows: "false",
        classification: "docs-only",
        verify: "success",
        windows: "skipped",
        integrity: "skipped",
      },
      {
        eventName: "pull_request",
        draft: "false",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "merge_group",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "push",
        runApp: "false",
        runPipeline: "false",
        runWindows: "false",
        classification: "docs-only",
        verify: "skipped",
        windows: "skipped",
        integrity: "success",
      },
    ]) {
      const result = runRequired(scenario);
      expect(result.status, `${JSON.stringify(scenario)}\n${result.stderr}`).toBe(0);
    }

    for (const scenario of [
      // Draft PRs must not run any predecessor.
      {
        eventName: "pull_request",
        draft: "true",
        verify: "success",
        windows: "skipped",
        integrity: "skipped",
      },
      // Ready PRs and merge groups require both full suites.
      {
        eventName: "pull_request",
        draft: "false",
        verify: "failure",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "pull_request",
        draft: "false",
        runApp: "false",
        runPipeline: "false",
        runWindows: "false",
        classification: "docs-only",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "merge_group",
        runApp: "false",
        runPipeline: "true",
        runWindows: "true",
        classification: "pipeline",
        verify: "success",
        windows: "skipped",
        integrity: "skipped",
      },
      {
        eventName: "merge_group",
        verify: "success",
        windows: "cancelled",
        integrity: "skipped",
      },
      // Main pushes require the lightweight integrity job only.
      {
        eventName: "push",
        verify: "skipped",
        windows: "success",
        integrity: "success",
      },
      {
        eventName: "push",
        verify: "skipped",
        windows: "skipped",
        integrity: "failure",
      },
      // Unknown events, unknown draft state, missing values, and unexpected skips fail closed.
      {
        eventName: "workflow_dispatch",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "pull_request",
        draft: "",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "merge_group",
        runApp: "false",
        runPipeline: "false",
        runWindows: "false",
        classification: "docs-only",
        verify: "skipped",
        windows: "skipped",
        integrity: "skipped",
      },
      {
        eventName: "push",
        verify: "skipped",
        windows: "skipped",
        integrity: "",
      },
      {
        eventName: "pull_request",
        draft: "false",
        classifier: "success",
        runApp: "",
        runPipeline: "true",
        runWindows: "true",
        classification: "pipeline",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "pull_request",
        draft: "false",
        classifier: "failure",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "pull_request",
        draft: "false",
        changedCount: "",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "pull_request",
        draft: "false",
        runApp: "false",
        runPipeline: "false",
        runWindows: "false",
        classification: "full",
        verify: "success",
        windows: "skipped",
        integrity: "skipped",
      },
    ]) {
      const result = runRequired(scenario);
      expect(result.status, JSON.stringify(scenario)).not.toBe(0);
    }
  });

  it("records observed service time without inventing queue time", () => {
    for (const jobId of ["verify", "lifecycle-windows"]) {
      const job = jobBlock(jobId);
      expect(job).toContain("CI_SERVICE_STARTED_EPOCH");
      expect(job).toContain("GITHUB_STEP_SUMMARY");
      expect(job).toContain("service_time_seconds");
      expect(job).toContain("queue_time_seconds: unavailable");
      expect(job).toContain("GitHub run API");
    }

    expect(jobBlock("verify")).toContain("shell: bash");
    expect(jobBlock("lifecycle-windows")).toContain("shell: pwsh");
  });

  it("reports unavailable service time when the start epoch is invalid", () => {
    const verifyJob = jobBlock("verify");
    expect(verifyJob).toContain("CI_SERVICE_STARTED_EPOCH:-");
    expect(verifyJob).toContain("=~ ^[1-9][0-9]{0,14}$");
    expect(verifyJob).toContain("started_epoch <= ended_epoch");
    expect(verifyJob).toContain("ended_epoch - started_epoch");
    expect(verifyJob).not.toContain("10#$started_epoch");
    expect(verifyJob).toContain(
      'service_time_line="- service_time_seconds: unavailable"',
    );

    const windowsJob = jobBlock("lifecycle-windows");
    expect(windowsJob).toContain("[long]::TryParse");
    expect(windowsJob).toContain("$startedEpoch -gt 0");
    expect(windowsJob).toContain("$startedEpoch -le $endedEpoch");
    expect(windowsJob).toContain(
      '$serviceTimeLine = "- service_time_seconds: unavailable"',
    );
  });

  it("executes the Bash timing guard safely for missing, invalid, and valid epochs", () => {
    const script = jobStepRunScript("verify", "Summarize CI timing");
    expect(script).not.toBe("");

    for (const startEpoch of [undefined, "not-a-number"]) {
      const startSetup =
        startEpoch === undefined
          ? "unset CI_SERVICE_STARTED_EPOCH"
          : `CI_SERVICE_STARTED_EPOCH=${startEpoch}`;
      const result = runBashScript(bashTimingHarness(startSetup, script));

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("service_time_seconds: unavailable");
    }

    const validStart = String(Math.floor(Date.now() / 1000) - 1);
    const validResult = runBashScript(
      bashTimingHarness(`CI_SERVICE_STARTED_EPOCH=${validStart}`, script),
    );
    expect(validResult.status, validResult.stderr).toBe(0);
    expect(validResult.stdout).toMatch(/service_time_seconds: \d+/u);
    expect(validResult.stdout).not.toContain("service_time_seconds: unavailable");
  });

  it("runs the trusted check before enabling the candidate package manager", () => {
    const trustedCheck = workflow.indexOf("Check UI contract diff baseline");
    const artifactCheck = workflow.indexOf("Check artifact hygiene diff baseline (trusted)");
    const corepack = workflow.indexOf("Enable corepack (pnpm)");
    const install = workflow.indexOf("Install dependencies");

    expect(trustedCheck).toBeGreaterThan(0);
    expect(artifactCheck).toBeGreaterThan(trustedCheck);
    expect(corepack).toBeGreaterThan(artifactCheck);
    expect(corepack).toBeGreaterThan(trustedCheck);
    expect(install).toBeGreaterThan(corepack);
  });

  it("materializes the base runner in a fresh runner-owned directory", () => {
    expect(workflow).toContain('umask 077');
    expect(workflow).toContain('mktemp -d "${RUNNER_TEMP}/ui-contract.XXXXXXXX"');
    expect(workflow).toContain('trap \'rm -rf "${trusted_root}"\' EXIT');
    expect(workflow).toContain('git ls-tree');
    expect(workflow).toContain('100644');
    expect(workflow).not.toContain('trusted_root=".ui-contract-trusted-runner"');
    expect(workflow).toContain('mktemp -d "${RUNNER_TEMP}/artifact-hygiene.XXXXXXXX"');
    expect(workflow).toContain('git show "${ARTIFACT_HYGIENE_BASE_SHA}:${repo_path}"');
    expect(workflow).toContain('node "${trusted_root}/scripts/run-trusted-artifact-hygiene.mjs"');
    expect(workflow).toContain('"scripts/lib/artifact-manifest-v2.mjs"');
    expect(workflow).toContain("--allow-bootstrap");
  });

  it("pins the trusted artifact baseline for every supported event", () => {
    expect(workflow).toContain("github.event.pull_request.base.sha");
    expect(workflow).toContain("github.event.merge_group.base_sha");
    expect(workflow).toContain("github.event.before");
    expect(workflow).toContain("ARTIFACT_BASE_EVENT_UNSUPPORTED");
  });

  it("gates trusted artifact bootstrap for pull requests and merge groups", () => {
    expect(workflow).toContain("pull_request)");
    expect(workflow).toContain("merge_group)");
    expect(workflow).toContain(
      "github.event.pull_request.head.sha || vars.ARTIFACT_HYGIENE_BOOTSTRAP_APPROVED_HEAD_SHA",
    );
    expect(workflow).toContain("ARTIFACT_HYGIENE_WORKSPACE_HEAD_SHA: ${{ github.sha }}");
    expect(workflow).toContain('git merge-base --is-ancestor "${ARTIFACT_HYGIENE_BASE_SHA}" HEAD');
    expect(workflow).toContain("ARTIFACT_BOOTSTRAP_PARTIAL_BASE");
    expect(workflow).toContain("vars.ARTIFACT_HYGIENE_BOOTSTRAP_APPROVED_HEAD_SHA");
    expect(workflow).toContain("ARTIFACT_BOOTSTRAP_EXTERNAL_APPROVAL_REQUIRED");
    const candidateBinding =
      "ARTIFACT_HYGIENE_CANDIDATE_HEAD_SHA: ${{ github.event.pull_request.head.sha || vars.ARTIFACT_HYGIENE_BOOTSTRAP_APPROVED_HEAD_SHA }}";
    const candidateArgument =
      '--candidate-head-sha "${ARTIFACT_HYGIENE_CANDIDATE_HEAD_SHA}"';
    const candidateBindingIndex = workflow.indexOf(candidateBinding);
    const candidateArgumentIndex = workflow.indexOf(
      candidateArgument,
      candidateBindingIndex,
    );
    expect(candidateBindingIndex).toBeGreaterThan(-1);
    expect(candidateArgumentIndex).toBeGreaterThan(candidateBindingIndex);
    expect(workflow).toContain("workspace_head_sha");
    expect(workflow).toContain("ARTIFACT_BOOTSTRAP_WORKSPACE_HEAD_MISMATCH");
    expect(workflow).toContain(
      "ARTIFACT_HYGIENE_PR_BASE_REF: ${{ github.event.pull_request.base.ref }}",
    );
    expect(workflow).toContain(
      "ARTIFACT_HYGIENE_MERGE_GROUP_BASE_REF: ${{ github.event.merge_group.base_ref }}",
    );
    expect(workflow).toContain(
      '[[ "${ARTIFACT_HYGIENE_PR_BASE_REF}" == "main" ]]',
    );
    expect(workflow).toContain(
      '[[ "${ARTIFACT_HYGIENE_MERGE_GROUP_BASE_REF}" == "refs/heads/main" ]]',
    );
    expect(workflow).toContain("ARTIFACT_BOOTSTRAP_TARGET_NOT_MAIN");
  });

  it("gates trusted artifact updates on an externally approved exact head", () => {
    expect(
      workflow.match(/name: Check artifact hygiene diff baseline \(trusted\)/gu),
    ).toHaveLength(2);
    expect(jobBlock("main-integrity")).toContain(
      "ARTIFACT_HYGIENE_TRUSTED_UPDATE_APPROVED_HEAD_SHA",
    );
    expect(jobBlock("main-integrity")).toContain("--allow-trusted-update");
    expect(workflow).toContain(
      "vars.ARTIFACT_HYGIENE_TRUSTED_UPDATE_APPROVED_HEAD_SHA",
    );
    expect(workflow).toContain(
      "ARTIFACT_HYGIENE_EVENT_CANDIDATE_HEAD_SHA: ${{ github.event.pull_request.head.sha }}",
    );
    expect(workflow).toContain(
      "ARTIFACT_TRUSTED_UPDATE_EXTERNAL_APPROVAL_REQUIRED",
    );
    expect(workflow).toContain("ARTIFACT_TRUSTED_UPDATE_BASE_NOT_CONTAINED");
    expect(workflow).toContain(
      "ARTIFACT_TRUSTED_UPDATE_CANDIDATE_NOT_CONTAINED",
    );
    expect(workflow).toContain(
      "ARTIFACT_TRUSTED_UPDATE_CANDIDATE_SURFACE_INVALID",
    );
    expect(workflow).toContain("ARTIFACT_TRUSTED_UPDATE_SURFACE_MISMATCH");
    expect(workflow).toContain(
      'ARTIFACT_HYGIENE_TRUSTED_UPDATE_APPROVED_HEAD_SHA="${approved_head}"',
    );
    expect(workflow).toContain(
      '--candidate-head-sha "${candidate_head}"',
    );
    expect(workflow).toContain("--allow-trusted-update");
    expect(workflow).toContain("--allow-bootstrap");
  });

  it("keeps lifecycle coverage in Windows and the Linux full test suite", () => {
    expect(workflow.match(/run: pnpm check:worktree-lifecycle/gu)).toHaveLength(
      1,
    );
    expect(workflow.match(/run: pnpm check:task-lifecycle/gu)).toHaveLength(1);
    expect(jobBlock("verify")).toContain("run: pnpm test");
    expect(fullTestCoversLifecycle(packageJson.scripts.test, vitestConfig)).toBe(true);

    for (const relativePath of lifecycleTestPaths) {
      expect(readFileSync(path.join(root, relativePath), "utf8").length).toBeGreaterThan(0);
    }

    expect(fullTestCoversLifecycle("vitest run tests/unit", vitestConfig)).toBe(false);
    expect(
      fullTestCoversLifecycle(
        packageJson.scripts.test,
        vitestConfig.replace(
          'include: ["tests/**/*.{test,spec}.{ts,tsx,mjs}"]',
          'include: ["tests/unit/**/*.{test,spec}.{ts,tsx,mjs}"]',
        ),
      ),
    ).toBe(false);
    expect(
      fullTestCoversLifecycle(
        packageJson.scripts.test,
        vitestConfig.replace(
          "exclude: [",
          'exclude: [\n      "tests/scripts/ai-task-cleanup.test.mjs",',
        ),
      ),
    ).toBe(false);
    expect(
      fullTestCoversLifecycle(
        packageJson.scripts.test,
        vitestConfig.replace(
          "exclude: [",
          'exclude: [\n      "tests/scripts/ai-task-*.test.mjs",',
        ),
      ),
    ).toBe(false);
  });

  it("blocks new Black PR findings and leaves full collab history to promotion", () => {
    expect(packageJson.scripts["check:security-artifacts:ci"]).toBe(
      "node scripts/security-artifact-audit.mjs --repo . --mode check --refs HEAD --baseline-ref origin/main",
    );
    expect(workflow.match(/name: Prepare security artifact audit refs/gu)).toHaveLength(2);
    expect(workflow.match(
      /run: node scripts\/security-artifact-audit\.mjs --repo \. --mode check --refs HEAD --baseline-ref origin\/main/gu,
    )).toHaveLength(2);
    expect(workflow.match(/normalize_github_remote\(\)/gu)).toHaveLength(2);
    expect(workflow.match(
      /normalize_github_remote "\$\(git remote get-url origin\)"\)/gu,
    )).toHaveLength(2);
    expect(workflow).toContain("https://github.com/blackstarzck/topik-project-v13");
    expect(workflow).not.toContain(
      "git remote add collab https://github.com/keduall/topik-project-v13.git",
    );
    expect(workflow).not.toContain("+refs/heads/main:refs/remotes/collab/main");
    expect(pipelineDocs).toContain(
      "Black PR CI는 `origin/main` 이후 각 커밋에서 새로 추가되거나 수정된 보안 산출물만 차단하고 순수 삭제는 허용한다. production `release:start`는 승인된 기준점 이후 항상 `origin/main`과 `collab/main`을 고정 ref 차분 감사하고, `stg` 준비 뒤에는 `collab/stg`를 추가한다.",
    );
  });

  it("keeps task:prepare documentation on the public CLI contract", () => {
    expect(pipelineDocs).toContain("task:prepare -- --repo <기준-checkout> --intent read-only");
    expect(pipelineDocs).toContain(
      "task:prepare -- --repo <기준-checkout> --intent code --branch feat/example-task --actor codex",
    );
    expect(pipelineDocs).not.toMatch(/task:prepare[^\n]*--mode/u);
  });

  it("uses only a base-owned minimal npm runtime before candidate install", () => {
    expect(workflow).toContain("config/ui-contract-runtime/package.json");
    expect(workflow).toContain("config/ui-contract-runtime/package-lock.json");
    expect(workflow).toContain("npm ci --ignore-scripts --no-audit --no-fund");
    expect(workflow).toContain("npm_config_userconfig");
    expect(workflow).toContain("BOOTSTRAP_NOT_INDEPENDENTLY_TAMPER_PROOF");
    expect(codeowners).toMatch(
      /^\/config\/ui-contract-runtime\/[ \t]+@blackstarzck[ \t]+@guestkeduall-design$/mu,
    );
  });

  it("requires owner review for every workflow enforcement surface", () => {
    for (const ownedPath of [
      "/.github/",
      "/.gitignore",
      "/.claude/skills/",
      "/.claude/CLAUDE.md",
      "/scripts/sync-agent-skills.mjs",
      "/scripts/lib/task-lifecycle-registry.mjs",
      "/scripts/lib/task-lifecycle-schema.mjs",
      "/scripts/lib/worktree-lifecycle.mjs",
      "/scripts/report-worktree-lifecycle.mjs",
      "/scripts/run-trusted-artifact-hygiene.mjs",
      "/scripts/lib/artifact-hygiene.mjs",
      "/scripts/lib/ai-task-lifecycle-v2.mjs",
      "/scripts/lib/ai-task-cleanup.mjs",
      "/scripts/ai-task.mjs",
      "/scripts/check-github-owner-auth.mjs",
      "/scripts/lib/github-owner-auth.mjs",
      "/scripts/",
      "/package.json",
      "/pnpm-lock.yaml",
      "/vitest.config.ts",
      "/config/",
      "/tests/scripts/",
      "/tests/scripts/ci-trust-boundary.test.mjs",
      "/tests/scripts/ai-task-*.test.mjs",
      "/tests/scripts/*worktree-lifecycle.test.mjs",
      "/tests/scripts/artifact-hygiene.test.mjs",
    ]) {
      expect(codeowners).toContain(`${ownedPath} @blackstarzck`);
    }
  });

  describe("security artifact audit origin identity", () => {
    const stepName = "Prepare security artifact audit refs";
    const guardJobs = ["verify", "main-integrity"];

    function runGuardWithOrigin(originUrl) {
      const script = jobStepRunScript("verify", stepName);
      expect(script).not.toBe("");
      const repository = mkdtempSync(path.join(os.tmpdir(), "talkpik-audit-origin-"));
      try {
        runGit(repository, ["init", "--initial-branch=main"]);
        runGit(repository, ["remote", "add", "origin", originUrl]);
        // Refusing the https transport turns the fetch into an instant, offline,
        // identical failure everywhere. Without it the accepted cases depend on
        // whether the runner can reach GitHub and what credentials it holds, and
        // git words those outcomes differently — a missing-credential error names
        // only the host, not the repository.
        return runBashScript(
          script,
          { GIT_ALLOW_PROTOCOL: "file", GIT_TERMINAL_PROMPT: "0" },
          { cwd: repository },
        );
      } finally {
        rmSync(repository, { recursive: true, force: true });
      }
    }

    // The step is what fetches the audit baseline, so it proves who origin is
    // before trusting the ref. Pinning that to the development repository alone
    // made the job die in setup on every Keduall pull request and skip the audit,
    // structure check, typecheck, test, lint and build with it.
    it.each([
      "https://github.com/blackstarzck/topik-project-v13.git",
      "https://github.com/keduall/topik-project-v13.git",
    ])("accepts %s as the baseline origin", (originUrl) => {
      const result = runGuardWithOrigin(originUrl);
      const output = `${result.stdout}${result.stderr}`;
      // Exit 3 and the mismatch line are the only rejection the guard emits.
      expect(result.status).not.toBe(3);
      expect(output).not.toContain("SECURITY_AUDIT_ORIGIN_IDENTITY_MISMATCH");
      // "was not rejected" would also hold if the script died before it ever got
      // to the fetch, so require evidence that it did. Only the fetch can produce
      // this refusal, and a rejected origin exits before reaching it.
      expect(output).toMatch(/transport .https. not allowed/u);
    });

    it.each([
      "https://github.com/attacker/topik-project-v13.git",
      "https://github.com/keduall/topik-project-v13-evil.git",
    ])("refuses %s before fetching anything", (originUrl) => {
      const result = runGuardWithOrigin(originUrl);
      expect(result.status).toBe(3);
      expect(result.stderr).toContain(
        `SECURITY_AUDIT_ORIGIN_IDENTITY_MISMATCH: ${originUrl.replace(/\.git$/u, "")}`,
      );
    });

    it("keeps every copy of the guard byte-identical", () => {
      // The guard is duplicated across jobs, which is how it came to be wrong in
      // two places at once. Running the behavioural cases against one copy only
      // holds for the other while they stay identical, so pin that here.
      const scripts = guardJobs.map((jobId) => jobStepRunScript(jobId, stepName));
      for (const script of scripts) expect(script).not.toBe("");
      expect(new Set(scripts).size).toBe(1);
    });
  });
});
