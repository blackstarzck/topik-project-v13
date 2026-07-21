import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { evaluateArtifactHygiene } from "../../scripts/lib/artifact-hygiene.mjs";
import { TRUSTED_ARTIFACT_PATHS } from "../../scripts/run-trusted-artifact-hygiene.mjs";

const temporaryRoots = [];
const fixtureArtifactLibraryMarker = "FIXTURE_ARTIFACT_LIBRARY_EXECUTED";

function git(rootDir, ...args) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function write(rootDir, relativePath, content = "fixture\n") {
  const target = path.join(rootDir, ...relativePath.split("/"));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function defaultPolicy(extra = {}) {
  return {
    schemaVersion: 1,
    kind: "ArtifactHygienePolicy",
    rootAllowlist: [
      ".codex",
      ".gitignore",
      ".tmp",
      "artifacts",
      "config",
      "docs",
      "package.json",
      "scripts",
      "src",
      "tests",
    ],
    legacyOnlyRoots: [".tmp", "artifacts"],
    approvedProductionPaths: [],
    ...extra,
  };
}

function createRepository({ policy = defaultPolicy() } = {}) {
  const rootDir = mkdtempSync(path.join(tmpdir(), "artifact-hygiene-"));
  temporaryRoots.push(rootDir);
  git(rootDir, "init", "--initial-branch=main");
  git(rootDir, "config", "user.email", "test@example.com");
  git(rootDir, "config", "user.name", "Test User");
  write(rootDir, ".gitignore", ".codex/work/\n");
  write(
    rootDir,
    "config/artifact-hygiene-policy.json",
    `${JSON.stringify(policy, null, 2)}\n`,
  );
  write(rootDir, "package.json", "{}\n");
  git(rootDir, "add", ".");
  git(rootDir, "commit", "-m", "baseline");
  git(rootDir, "update-ref", "refs/remotes/origin/main", "HEAD");
  return rootDir;
}

function createBootstrapRepository({
  omittedTrustedPaths = [],
  invalidTrustedPath,
  trustedPathContents = {},
} = {}) {
  const rootDir = mkdtempSync(path.join(tmpdir(), "artifact-bootstrap-"));
  temporaryRoots.push(rootDir);
  git(rootDir, "init", "--initial-branch=main");
  git(rootDir, "config", "user.email", "test@example.com");
  git(rootDir, "config", "user.name", "Test User");
  write(rootDir, ".gitignore", ".codex/work/\n");
  write(rootDir, "package.json", "{}\n");
  git(rootDir, "add", ".");
  git(rootDir, "commit", "-m", "baseline without trusted files");
  git(rootDir, "update-ref", "refs/remotes/origin/main", "HEAD");
  const baseSha = git(rootDir, "rev-parse", "HEAD");

  git(rootDir, "switch", "-c", "candidate");
  for (const relativePath of TRUSTED_ARTIFACT_PATHS) {
    if (!omittedTrustedPaths.includes(relativePath)) {
      write(
        rootDir,
        relativePath,
        trustedPathContents[relativePath] ?? readFileSync(relativePath),
      );
    }
  }
  write(rootDir, "src/change.ts", "export const change = true;\n");
  git(rootDir, "add", ".");
  if (invalidTrustedPath) {
    const blob = git(rootDir, "hash-object", invalidTrustedPath);
    git(
      rootDir,
      "update-index",
      "--add",
      "--cacheinfo",
      "120000",
      blob,
      invalidTrustedPath,
    );
  }
  git(rootDir, "commit", "-m", "candidate with trusted surface");
  const candidateHead = git(rootDir, "rev-parse", "HEAD");
  return { baseSha, candidateHead, rootDir };
}

function runBootstrap({ approvedHead, baseSha, candidateHead, rootDir }) {
  return spawnSync(
    process.execPath,
    [
      path.join(rootDir, "scripts", "run-trusted-artifact-hygiene.mjs"),
      "--workspace",
      rootDir,
      "--base-sha",
      baseSha,
      "--candidate-head-sha",
      candidateHead,
      "--allow-bootstrap",
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        ARTIFACT_HYGIENE_BOOTSTRAP_APPROVED_HEAD_SHA: approvedHead ?? "",
      },
    },
  );
}

function checkoutSyntheticMerge(rootDir, baseSha, candidateHead) {
  git(rootDir, "switch", "-c", "synthetic-merge", baseSha);
  git(rootDir, "merge", "--no-ff", candidateHead, "-m", "synthetic PR merge");
  return git(rootDir, "rev-parse", "HEAD");
}

function commitBaseline(rootDir, relativePath, content = "legacy\n") {
  write(rootDir, relativePath, content);
  git(rootDir, "add", relativePath);
  git(rootDir, "commit", "-m", `baseline ${relativePath}`);
  git(rootDir, "update-ref", "refs/remotes/origin/main", "HEAD");
}

function codes(result) {
  return result.violations.map(({ code }) => code);
}

function manifestFor(files) {
  return {
    schemaVersion: 2,
    recordType: "ArtifactManifest",
    taskId: "example-task",
    files: files.map(({ content, path: artifactPath }) => ({
      path: artifactPath,
      sha256: createHash("sha256").update(content).digest("hex"),
      purpose: "final-ui-evidence",
    })),
    updatedAt: "2026-07-21T00:00:00.000Z",
  };
}

afterEach(() => {
  for (const rootDir of temporaryRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("artifact hygiene legacy and root policy", () => {
  it.each([".tmp/new.log", "artifacts/new-screenshot.png"])(
    "rejects a new path below a legacy-only root: %s",
    (relativePath) => {
      const rootDir = createRepository();
      write(rootDir, relativePath);
      git(rootDir, "add", "--force", relativePath);

      const result = evaluateArtifactHygiene({ rootDir });

      expect(result.ok).toBe(false);
      expect(result.violations).toContainEqual({
        code: "LEGACY_PATH_ADDED",
        path: relativePath,
      });
    },
  );

  it("rejects modification of an exact legacy path", () => {
    const rootDir = createRepository();
    commitBaseline(rootDir, "artifacts/legacy.png", "before\n");
    write(rootDir, "artifacts/legacy.png", "after\n");
    expect(evaluateArtifactHygiene({ rootDir }).violations).toContainEqual({
      code: "LEGACY_PATH_MODIFIED",
      path: "artifacts/legacy.png",
    });
  });

  it("allows deletion of an exact legacy path", () => {
    const rootDir = createRepository();
    commitBaseline(rootDir, "artifacts/legacy.png", "before\n");
    rmSync(path.join(rootDir, "artifacts", "legacy.png"));
    expect(evaluateArtifactHygiene({ rootDir }).violations).toEqual([]);
  });

  it("fails closed when the comparison base cannot be resolved", () => {
    const rootDir = createRepository();
    const untrustedBase = "f".repeat(40);

    const result = evaluateArtifactHygiene({
      rootDir,
      baseRef: untrustedBase,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { code: "BASE_REF_INVALID", path: "<unresolved>" },
    ]);
    expect(JSON.stringify(result)).not.toContain(untrustedBase);
  });

  it.each(["HEAD", "main", "origin/feature"])(
    "rejects a moving or non-canonical base ref without echoing it: %s",
    (untrustedBase) => {
      const rootDir = createRepository();
      const result = evaluateArtifactHygiene({ rootDir, baseRef: untrustedBase });
      expect(result.violations).toEqual([
        { code: "BASE_REF_INVALID", path: "<invalid>" },
      ]);
      expect(JSON.stringify(result)).not.toContain(untrustedBase);
    },
  );

  it("rejects a new arbitrary top-level entry", () => {
    const rootDir = createRepository();
    write(rootDir, "surprise/output.txt");

    expect(evaluateArtifactHygiene({ rootDir }).violations).toContainEqual({
      code: "ROOT_ENTRY_NOT_ALLOWED",
      path: "surprise",
    });
  });

  it("permits an intentionally allowlisted top-level entry", () => {
    const rootDir = createRepository({
      policy: defaultPolicy({
        rootAllowlist: [...defaultPolicy().rootAllowlist, "messages"],
      }),
    });
    write(rootDir, "messages/ko.json");

    expect(evaluateArtifactHygiene({ rootDir }).violations).toEqual([]);
  });
});

describe("artifact hygiene local work products", () => {
  it("confirms the canonical work directory is ignored", () => {
    const rootDir = createRepository();
    write(rootDir, ".codex/work/example-task/session.log");

    expect(evaluateArtifactHygiene({ rootDir }).violations).toEqual([]);
  });

  it("rejects a tracked work product even in the canonical directory", () => {
    const rootDir = createRepository();
    write(rootDir, ".codex/work/example-task/session.log");
    git(
      rootDir,
      "add",
      "--force",
      ".codex/work/example-task/session.log",
    );

    expect(evaluateArtifactHygiene({ rootDir }).violations).toContainEqual({
      code: "WORK_PATH_TRACKED",
      path: ".codex/work/example-task/session.log",
    });
  });

  it("fails when the canonical work path is not ignored", () => {
    const rootDir = createRepository();
    write(rootDir, ".gitignore", "node_modules/\n");

    expect(codes(evaluateArtifactHygiene({ rootDir }))).toContain(
      "WORK_PATH_NOT_IGNORED",
    );
  });

  it("rejects invalid work slugs and temporary products outside .codex/work", () => {
    const rootDir = createRepository();
    write(rootDir, ".codex/work/Bad_Slug/session.log");
    git(rootDir, "add", "--force", ".codex/work/Bad_Slug/session.log");
    write(rootDir, "scripts/session.pid");
    git(rootDir, "add", "--force", "scripts/session.pid");

    const result = evaluateArtifactHygiene({ rootDir });
    expect(codes(result)).toEqual(
      expect.arrayContaining(["WORK_SLUG_INVALID", "EPHEMERAL_PATH_TRACKED"]),
    );
  });
});

describe("artifact hygiene final evidence", () => {
  it("accepts a final evidence file registered by a safe v2 manifest", () => {
    const rootDir = createRepository();
    const folder = "docs/qa/reports/2026-07-21-example-task";
    const content = Buffer.from("final screenshot\n");
    write(rootDir, `${folder}/desktop.png`, content);
    write(
      rootDir,
      `${folder}/artifact-manifest.json`,
      `${JSON.stringify(
        manifestFor([{ content, path: "desktop.png" }]),
        null,
        2,
      )}\n`,
    );

    expect(evaluateArtifactHygiene({ rootDir }).violations).toEqual([]);
  });

  it("lets a registered final screenshot override the ephemeral-name rule", () => {
    const rootDir = createRepository();
    const folder = "docs/qa/reports/2026-07-21-example-task";
    const content = Buffer.from("final screenshot\n");
    write(rootDir, `${folder}/final-screenshot.png`, content);
    write(
      rootDir,
      `${folder}/artifact-manifest.json`,
      `${JSON.stringify(
        manifestFor([{ content, path: "final-screenshot.png" }]),
      )}\n`,
    );

    expect(evaluateArtifactHygiene({ rootDir }).violations).toEqual([]);
  });

  it("requires a Markdown file inside a dated evidence folder to be registered", () => {
    const rootDir = createRepository();
    write(
      rootDir,
      "docs/qa/reports/2026-07-21-example-task/notes.md",
      "# Notes\n",
    );

    expect(codes(evaluateArtifactHygiene({ rootDir }))).toContain(
      "EVIDENCE_MANIFEST_MISSING",
    );
  });

  it.each([
    ["missing manifest", undefined, "EVIDENCE_MANIFEST_MISSING"],
    [
      "unregistered file",
      manifestFor([]),
      "EVIDENCE_FILE_UNREGISTERED",
    ],
  ])("rejects final evidence with %s", (_label, manifest, expectedCode) => {
    const rootDir = createRepository();
    const folder = "docs/qa/reports/2026-07-21-example-task";
    write(rootDir, `${folder}/desktop.png`, "final screenshot\n");
    if (manifest) {
      write(
        rootDir,
        `${folder}/artifact-manifest.json`,
        `${JSON.stringify(manifest)}\n`,
      );
    }

    expect(codes(evaluateArtifactHygiene({ rootDir }))).toContain(expectedCode);
  });

  it("allows a Markdown report without an evidence manifest", () => {
    const rootDir = createRepository();
    write(rootDir, "docs/qa/reports/2026-07-21-implementation.md", "# Result\n");

    expect(evaluateArtifactHygiene({ rootDir }).violations).toEqual([]);
  });

  it.each([
    ["../escape.png", "EVIDENCE_MANIFEST_INVALID"],
    ["C:/escape.png", "EVIDENCE_MANIFEST_INVALID"],
    ["Desktop.PNG", "EVIDENCE_MANIFEST_INVALID"],
  ])("rejects unsafe manifest entry %s", (manifestPath, expectedCode) => {
    const rootDir = createRepository();
    const folder = "docs/qa/reports/2026-07-21-example-task";
    const content = Buffer.from("final screenshot\n");
    write(rootDir, `${folder}/desktop.png`, content);
    const files = [
      ...manifestFor([{ content, path: "desktop.png" }]).files,
      {
        path: manifestPath,
        sha256: "0".repeat(64),
        purpose: "final-ui-evidence",
      },
    ];
    write(
      rootDir,
      `${folder}/artifact-manifest.json`,
      `${JSON.stringify({ schemaVersion: 2, recordType: "ArtifactManifest", taskId: "example-task", files, updatedAt: "2026-07-21T00:00:00.000Z" })}\n`,
    );

    expect(codes(evaluateArtifactHygiene({ rootDir }))).toContain(expectedCode);
  });

  it("rejects final evidence outside a dated task folder", () => {
    const rootDir = createRepository();
    write(rootDir, "docs/qa/reports/random.png");

    expect(codes(evaluateArtifactHygiene({ rootDir }))).toContain(
      "EVIDENCE_LOCATION_INVALID",
    );
  });
});

describe("artifact hygiene path safety", () => {
  it("rejects a new one-off production script without exact policy approval", () => {
    const rootDir = createRepository();
    write(rootDir, "scripts/one-off-investigation.mjs");

    expect(evaluateArtifactHygiene({ rootDir }).violations).toContainEqual({
      code: "PRODUCTION_PATH_NOT_APPROVED",
      path: "scripts/one-off-investigation.mjs",
    });
  });

  it.each(["bin/one-off-investigation.cmd", "tools/debug-experiment.sh"])(
    "rejects an unapproved executable outside scripts: %s",
    (relativePath) => {
      const rootDir = createRepository({
        policy: defaultPolicy({
          rootAllowlist: [...defaultPolicy().rootAllowlist, "bin", "tools"],
        }),
      });
      write(rootDir, relativePath);
      expect(codes(evaluateArtifactHygiene({ rootDir }))).toContain(
        "PRODUCTION_PATH_NOT_APPROVED",
      );
    },
  );

  it("rejects an evidence-like file outside a dated manifest folder", () => {
    const rootDir = createRepository();
    write(rootDir, "docs/final.png");
    expect(evaluateArtifactHygiene({ rootDir }).violations).toContainEqual({
      code: "EVIDENCE_LIKE_PATH_UNAPPROVED",
      path: "docs/final.png",
    });
  });

  it("rejects a workspace policy expansion against a trusted base policy", () => {
    const trustedPolicy = defaultPolicy();
    const rootDir = createRepository({
      policy: defaultPolicy({
        approvedProductionPaths: ["scripts/one-off-investigation.mjs"],
      }),
    });
    write(rootDir, "scripts/one-off-investigation.mjs");

    expect(codes(evaluateArtifactHygiene({ rootDir, trustedPolicy }))).toContain(
      "POLICY_EXPANSION_UNTRUSTED",
    );
  });

  it("rejects case-insensitive collisions in the Git candidate inventory", () => {
    const rootDir = createRepository();
    git(rootDir, "config", "core.ignorecase", "false");
    write(rootDir, "src/example.ts");
    const blob = git(rootDir, "hash-object", "src/example.ts");
    git(
      rootDir,
      "update-index",
      "--add",
      "--cacheinfo",
      "100644",
      blob,
      "src/Example.ts",
    );
    git(
      rootDir,
      "update-index",
      "--add",
      "--cacheinfo",
      "100644",
      blob,
      "src/example.ts",
    );

    expect(codes(evaluateArtifactHygiene({ rootDir }))).toContain(
      "PATH_CASE_COLLISION",
    );
  });

  it("rejects a case-only variant of an exact legacy path", () => {
    const rootDir = createRepository();
    git(rootDir, "config", "core.ignorecase", "false");
    commitBaseline(rootDir, "artifacts/Legacy.png");
    rmSync(path.join(rootDir, "artifacts", "Legacy.png"));
    write(rootDir, "artifacts/legacy.png");

    expect(codes(evaluateArtifactHygiene({ rootDir }))).toEqual(
      expect.arrayContaining(["PATH_CASE_VARIANT", "LEGACY_PATH_ADDED"]),
    );
  });

  it.each([
    ["Artifacts/new.png", "ROOT_ENTRY_CASE_VARIANT"],
    [".codex/WORK/example-task/note.txt", "WORK_PATH_CASE_VARIANT"],
    [
      "docs/QA/reports/2026-07-21-example-task/desktop.png",
      "EVIDENCE_PATH_CASE_VARIANT",
    ],
  ])("rejects a canonical path case bypass: %s", (relativePath, expectedCode) => {
    const rootDir = createRepository();
    write(rootDir, relativePath);
    git(rootDir, "add", "--force", relativePath);

    expect(codes(evaluateArtifactHygiene({ rootDir }))).toContain(expectedCode);
  });

  it("rejects an added symbolic link without reading its target", () => {
    const rootDir = createRepository();
    write(rootDir, "outside.txt", "do not read\n");
    const link = path.join(rootDir, "src", "linked.txt");
    mkdirSync(path.dirname(link), { recursive: true });
    try {
      symlinkSync(path.join(rootDir, "outside.txt"), link, "file");
    } catch (error) {
      if (process.platform === "win32" && error.code === "EPERM") return;
      throw error;
    }

    expect(codes(evaluateArtifactHygiene({ rootDir }))).toContain(
      "PATH_LINK_OR_REPARSE",
    );
  });
});

describe("artifact hygiene package contract", () => {
  it("accepts an approved candidate inside a synthetic merge checkout", () => {
    const fixture = createBootstrapRepository({
      trustedPathContents: {
        "scripts/lib/artifact-hygiene.mjs": `export function evaluateArtifactHygiene() {
  process.stdout.write("${fixtureArtifactLibraryMarker}\\n");
  return { ok: true, violations: [] };
}
`,
      },
    });
    const syntheticHead = checkoutSyntheticMerge(
      fixture.rootDir,
      fixture.baseSha,
      fixture.candidateHead,
    );
    expect(syntheticHead).not.toBe(fixture.candidateHead);

    const result = runBootstrap({
      ...fixture,
      approvedHead: fixture.candidateHead,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(fixtureArtifactLibraryMarker);
  });

  it("accepts the approved candidate on the one-time post-merge main push", () => {
    const fixture = createBootstrapRepository();
    const mainHead = checkoutSyntheticMerge(
      fixture.rootDir,
      fixture.baseSha,
      fixture.candidateHead,
    );
    git(fixture.rootDir, "update-ref", "refs/remotes/origin/main", mainHead);

    const result = runBootstrap({
      ...fixture,
      approvedHead: fixture.candidateHead,
    });

    expect(result.status).toBe(0);
  });

  it.each([
    ["missing", undefined],
    ["mismatched", "f".repeat(40)],
  ])("rejects %s external candidate approval", (_label, approvedHead) => {
    const fixture = createBootstrapRepository();
    checkoutSyntheticMerge(
      fixture.rootDir,
      fixture.baseSha,
      fixture.candidateHead,
    );

    const result = runBootstrap({ ...fixture, approvedHead });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "ARTIFACT_BOOTSTRAP_EXTERNAL_APPROVAL_REQUIRED",
    );
    expect(result.stderr).not.toContain(fixture.candidateHead);
  });

  it("rejects a candidate that is not contained in workspace HEAD", () => {
    const fixture = createBootstrapRepository();
    git(fixture.rootDir, "switch", "-c", "alternate", fixture.baseSha);
    git(
      fixture.rootDir,
      "checkout",
      fixture.candidateHead,
      "--",
      ...TRUSTED_ARTIFACT_PATHS,
    );
    write(fixture.rootDir, "src/alternate.ts", "export const alternate = true;\n");
    git(fixture.rootDir, "add", ".");
    git(fixture.rootDir, "commit", "-m", "alternate head");

    const result = runBootstrap({
      ...fixture,
      approvedHead: fixture.candidateHead,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "ARTIFACT_BOOTSTRAP_CANDIDATE_NOT_CONTAINED",
    );
    expect(result.stderr).not.toContain(fixture.candidateHead);
  });

  it("rejects a trusted file changed after the approved candidate", () => {
    const fixture = createBootstrapRepository();
    checkoutSyntheticMerge(
      fixture.rootDir,
      fixture.baseSha,
      fixture.candidateHead,
    );
    write(
      fixture.rootDir,
      "config/artifact-hygiene-policy.json",
      `${JSON.stringify(defaultPolicy({ rootAllowlist: ["tampered"] }))}\n`,
    );
    git(fixture.rootDir, "add", "config/artifact-hygiene-policy.json");
    git(fixture.rootDir, "commit", "-m", "change trusted file after candidate");

    const result = runBootstrap({
      ...fixture,
      approvedHead: fixture.candidateHead,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "ARTIFACT_BOOTSTRAP_TRUSTED_SURFACE_MISMATCH",
    );
    expect(result.stderr).not.toContain(fixture.candidateHead);
  });

  it("rejects an unresolved approved candidate commit", () => {
    const fixture = createBootstrapRepository();
    const unresolvedCandidate = "e".repeat(40);

    const result = runBootstrap({
      ...fixture,
      approvedHead: unresolvedCandidate,
      candidateHead: unresolvedCandidate,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("ARTIFACT_BOOTSTRAP_CANDIDATE_INVALID");
    expect(result.stderr).not.toContain(unresolvedCandidate);
  });

  it("rejects a candidate with a missing trusted file", () => {
    const fixture = createBootstrapRepository({
      omittedTrustedPaths: ["scripts/check-artifact-hygiene.mjs"],
    });

    const result = runBootstrap({
      ...fixture,
      approvedHead: fixture.candidateHead,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "ARTIFACT_BOOTSTRAP_CANDIDATE_SURFACE_INVALID",
    );
  });

  it("rejects a candidate with a symbolic-link trusted file", () => {
    const fixture = createBootstrapRepository({
      invalidTrustedPath: "scripts/check-artifact-hygiene.mjs",
    });

    const result = runBootstrap({
      ...fixture,
      approvedHead: fixture.candidateHead,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "ARTIFACT_BOOTSTRAP_CANDIDATE_SURFACE_INVALID",
    );
  });

  it("continues to accept a direct approved candidate checkout", () => {
    const fixture = createBootstrapRepository();

    const result = runBootstrap({
      ...fixture,
      approvedHead: fixture.candidateHead,
    });

    expect(result.status).toBe(0);
  });

  it("passes the approved candidate and independently pins the workspace HEAD", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(workflow).toContain(
      '--candidate-head-sha "${ARTIFACT_HYGIENE_CANDIDATE_HEAD_SHA}"',
    );
    expect(workflow).toContain("workspace_head_sha=");
    expect(workflow).toContain("ARTIFACT_BOOTSTRAP_WORKSPACE_HEAD_MISMATCH");
  });

  it("runs base-materialized code so workspace policy tampering cannot bypass it", () => {
    const rootDir = createRepository();
    for (const relativePath of TRUSTED_ARTIFACT_PATHS) {
      write(rootDir, relativePath, readFileSync(relativePath));
    }
    git(rootDir, "add", ".");
    git(rootDir, "commit", "-m", "trusted checker baseline");
    git(rootDir, "update-ref", "refs/remotes/origin/main", "HEAD");
    const baseSha = git(rootDir, "rev-parse", "HEAD");

    write(
      rootDir,
      "config/artifact-hygiene-policy.json",
      `${JSON.stringify(
        defaultPolicy({ approvedProductionPaths: ["docs/final.png"] }),
      )}\n`,
    );
    write(rootDir, "docs/final.png", "not trusted\n");

    const externalRoot = mkdtempSync(path.join(tmpdir(), "trusted-runner-"));
    temporaryRoots.push(externalRoot);
    const externalRunner = path.join(externalRoot, "trusted-runner.mjs");
    writeFileSync(
      externalRunner,
      git(rootDir, "show", `${baseSha}:scripts/run-trusted-artifact-hygiene.mjs`),
    );
    const result = spawnSync(
      process.execPath,
      [externalRunner, "--base-sha", baseSha, "--workspace", rootDir],
      { cwd: rootDir, encoding: "utf8", windowsHide: true },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("TRUSTED_SURFACE_CHANGED");
  });

  it("exposes report and blocking check commands", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    expect(packageJson.scripts["report:artifact-hygiene"]).toBe(
      "node scripts/check-artifact-hygiene.mjs --mode report",
    );
    expect(packageJson.scripts["check:artifact-hygiene"]).toBe(
      "node scripts/check-artifact-hygiene.mjs --mode check",
    );

    const policy = JSON.parse(
      readFileSync("config/artifact-hygiene-policy.json", "utf8"),
    );
    expect(policy.legacyOnlyRoots).toEqual(
      expect.arrayContaining([".scratch", ".tmp", "artifacts", "output"]),
    );
    expect(TRUSTED_ARTIFACT_PATHS).toEqual(
      expect.arrayContaining([
        "scripts/run-trusted-artifact-hygiene.mjs",
        "scripts/lib/artifact-hygiene.mjs",
        "config/artifact-hygiene-policy.json",
      ]),
    );
  });
});
