#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const TRUSTED_ARTIFACT_PATHS = Object.freeze([
  "scripts/run-trusted-artifact-hygiene.mjs",
  "scripts/check-artifact-hygiene.mjs",
  "scripts/lib/artifact-hygiene.mjs",
  "scripts/lib/artifact-manifest-v2.mjs",
  "config/artifact-hygiene-policy.json",
]);

function git(rootDir, args) {
  return spawnSync("git", args, {
    cwd: rootDir,
    encoding: "buffer",
    windowsHide: true,
  });
}

function option(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function printResult(result) {
  for (const violation of result.violations) {
    process.stderr.write(`${violation.code}\t${violation.path}\n`);
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes("--print-materialize-paths")) {
    process.stdout.write(`${JSON.stringify(TRUSTED_ARTIFACT_PATHS)}\n`);
    return 0;
  }
  const workspace = path.resolve(option(args, "--workspace") ?? process.cwd());
  const baseSha = option(args, "--base-sha");
  if (!/^[0-9a-f]{40}$/iu.test(baseSha ?? "")) {
    process.stderr.write("TRUSTED_BASE_INVALID\t<invalid>\n");
    return 2;
  }
  const commit = git(workspace, ["cat-file", "-e", `${baseSha}^{commit}`]);
  if (commit.status !== 0) {
    process.stderr.write("TRUSTED_BASE_INVALID\t<unresolved>\n");
    return 2;
  }

  const availability = TRUSTED_ARTIFACT_PATHS.map((relativePath) => ({
    relativePath,
    exists:
      git(workspace, ["cat-file", "-e", `${baseSha}:${relativePath}`]).status ===
      0,
  }));
  const presentCount = availability.filter(({ exists }) => exists).length;
  const bootstrap = args.includes("--allow-bootstrap");
  if (presentCount === 0) {
    const originMain = git(workspace, ["rev-parse", "--verify", "origin/main^{commit}"]);
    const isPinnedOriginMain =
      originMain.status === 0 &&
      originMain.stdout.toString("utf8").trim().toLowerCase() ===
        baseSha.toLowerCase();
    if (!bootstrap || !isPinnedOriginMain) {
      process.stderr.write("TRUSTED_BASE_BOOTSTRAP_REQUIRED\t<trusted-files>\n");
      return 2;
    }
    const approvedHead = process.env.ARTIFACT_HYGIENE_BOOTSTRAP_APPROVED_HEAD_SHA;
    const workspaceHeadResult = git(workspace, ["rev-parse", "--verify", "HEAD^{commit}"]);
    const workspaceHead = workspaceHeadResult.stdout
      .toString("utf8")
      .trim()
      .toLowerCase();
    if (
      workspaceHeadResult.status !== 0 ||
      !/^[0-9a-f]{40}$/iu.test(approvedHead ?? "") ||
      approvedHead.toLowerCase() !== workspaceHead
    ) {
      process.stderr.write(
        "ARTIFACT_BOOTSTRAP_EXTERNAL_APPROVAL_REQUIRED\t<approved-head>\n",
      );
      return 2;
    }
    const { evaluateArtifactHygiene } = await import(
      "./lib/artifact-hygiene.mjs"
    );
    const result = evaluateArtifactHygiene({ rootDir: workspace, baseRef: baseSha });
    printResult(result);
    return result.ok ? 0 : 1;
  }
  if (presentCount !== TRUSTED_ARTIFACT_PATHS.length) {
    process.stderr.write("TRUSTED_BASE_INCOMPLETE\t<trusted-files>\n");
    return 2;
  }
  for (const { relativePath } of availability) {
    const unchanged = git(workspace, [
      "diff",
      "--quiet",
      baseSha,
      "--",
      relativePath,
    ]);
    if (unchanged.status !== 0) {
      process.stderr.write(`TRUSTED_SURFACE_CHANGED\t${relativePath}\n`);
      return 2;
    }
  }

  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "trusted-artifact-"));
  try {
    for (const { relativePath } of availability) {
      const content = git(workspace, ["show", `${baseSha}:${relativePath}`]);
      if (content.status !== 0) {
        process.stderr.write("TRUSTED_BASE_READ_FAILED\t<trusted-files>\n");
        return 2;
      }
      const target = path.join(temporaryRoot, ...relativePath.split("/"));
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content.stdout);
    }
    const trustedPolicy = JSON.parse(
      readFileSync(
        path.join(temporaryRoot, "config", "artifact-hygiene-policy.json"),
        "utf8",
      ),
    );
    const trustedLibrary = await import(
      pathToFileURL(
        path.join(temporaryRoot, "scripts", "lib", "artifact-hygiene.mjs"),
      ).href
    );
    const result = trustedLibrary.evaluateArtifactHygiene({
      rootDir: workspace,
      baseRef: baseSha,
      trustedPolicy,
    });
    printResult(result);
    return result.ok ? 0 : 1;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
) {
  process.exitCode = await main();
}
