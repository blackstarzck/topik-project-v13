import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const skillNames = [
  "brainstorming",
  "dispatching-parallel-agents",
  "executing-plans",
  "finishing-a-development-branch",
  "frontend-design",
  "receiving-code-review",
  "requesting-code-review",
  "subagent-driven-development",
  "systematic-debugging",
  "test-driven-development",
  "using-git-worktrees",
  "using-superpowers",
  "verification-before-completion",
  "writing-plans",
  "writing-skills",
];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-skills-"));
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  await cp(path.join(process.cwd(), "scripts", "sync-agent-skills.mjs"), path.join(root, "scripts", "sync-agent-skills.mjs"));
  for (const name of skillNames) {
    const directory = path.join(root, ".codex", "skills", name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, "SKILL.md"),
      `---\nname: ${name}\ndescription: fixture\n---\n\n# ${name}\n`,
    );
    if (name === "frontend-design") {
      writeFileSync(path.join(directory, "UPSTREAM_SKILL.md"), "upstream\n");
      writeFileSync(path.join(directory, "SOURCE.md"), "source\n");
      writeFileSync(path.join(directory, "LICENSE.txt"), "license\n");
    }
  }
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, ["scripts/sync-agent-skills.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
}

function treeSnapshot(root) {
  const snapshot = [];

  function visit(target, relativePath) {
    const targetStat = lstatSync(target);
    const type = targetStat.isDirectory()
      ? "directory"
      : targetStat.isFile()
        ? "file"
        : targetStat.isSymbolicLink()
          ? "link"
          : "other";
    snapshot.push({
      path: relativePath || ".",
      type,
      mtimeMs: targetStat.mtimeMs,
      content: targetStat.isFile() ? readFileSync(target, "base64") : null,
    });
    if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) return;
    for (const entry of readdirSync(target).sort()) {
      visit(path.join(target, entry), path.posix.join(relativePath, entry));
    }
  }

  visit(root, "");
  return snapshot;
}

describe("Claude skill proxy sync", () => {
  it("generates deterministic entrypoints that load canonical skills completely", async () => {
    const root = await fixture();
    expect(run(root).status).toBe(0);

    const proxy = readFileSync(
      path.join(root, ".claude", "skills", "brainstorming", "SKILL.md"),
      "utf8",
    );
    expect(proxy).toContain("GENERATED CANONICAL SKILL PROXY");
    expect(proxy).toContain("../../../.codex/skills/brainstorming/SKILL.md");
    expect(proxy).toContain("read the canonical SKILL.md completely");
    expect(run(root, "--check").status).toBe(0);

    const canonicalDirectories = readdirSync(path.join(root, ".codex", "skills"), {
      withFileTypes: true,
    }).map((entry) => entry.name);
    const proxyDirectories = readdirSync(path.join(root, ".claude", "skills"), {
      withFileTypes: true,
    }).map((entry) => entry.name);
    expect(canonicalDirectories.sort()).toEqual([...skillNames].sort());
    expect(proxyDirectories.sort()).toEqual([...skillNames].sort());

    for (const name of skillNames) {
      const proxyDirectory = path.join(root, ".claude", "skills", name);
      expect(readdirSync(proxyDirectory)).toEqual(["SKILL.md"]);
      const proxyStat = lstatSync(path.join(proxyDirectory, "SKILL.md"));
      expect(proxyStat.isFile()).toBe(true);
      expect(proxyStat.isSymbolicLink()).toBe(false);
    }
  });

  it("fails on an unknown Claude skill without deleting it", async () => {
    const root = await fixture();
    const external = path.join(root, ".claude", "skills", "local-only", "SKILL.md");
    mkdirSync(path.dirname(external), { recursive: true });
    writeFileSync(external, "local\n");

    expect(run(root, "--check").status).toBe(1);
    expect(existsSync(path.join(root, ".claude", "skills", "brainstorming", "SKILL.md"))).toBe(false);
    expect(readFileSync(external, "utf8")).toBe("local\n");
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown Claude skill");
    expect(readFileSync(external, "utf8")).toBe("local\n");
  });

  it("fails on an unknown canonical skill without deleting it", async () => {
    const root = await fixture();
    const unknown = path.join(root, ".codex", "skills", "gstack", "SKILL.md");
    mkdirSync(path.dirname(unknown), { recursive: true });
    writeFileSync(unknown, "gstack\n");

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown canonical skill");
    expect(readFileSync(unknown, "utf8")).toBe("gstack\n");
    expect(existsSync(path.join(root, ".claude", "skills"))).toBe(false);
  });

  it("reports a stale known proxy in check mode without rewriting or deleting entries", async () => {
    const root = await fixture();
    expect(run(root).status).toBe(0);

    const staleProxy = path.join(root, ".claude", "skills", "brainstorming", "SKILL.md");
    const untouchedProxy = path.join(
      root,
      ".claude",
      "skills",
      "frontend-design",
      "SKILL.md",
    );
    const staleContent = "stale proxy content\n";
    const untouchedContent = readFileSync(untouchedProxy, "utf8");
    const directoryNames = readdirSync(path.join(root, ".claude", "skills")).sort();
    writeFileSync(staleProxy, staleContent);
    const before = treeSnapshot(path.join(root, ".claude", "skills"));

    const result = run(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Out of sync: .claude/skills/brainstorming/SKILL.md");
    expect(readFileSync(staleProxy, "utf8")).toBe(staleContent);
    expect(readFileSync(untouchedProxy, "utf8")).toBe(untouchedContent);
    expect(readdirSync(path.join(root, ".claude", "skills")).sort()).toEqual(directoryNames);
    expect(treeSnapshot(path.join(root, ".claude", "skills"))).toEqual(before);
  });

  it("atomically replaces a stale regular proxy without leaving temporary entries", async () => {
    const root = await fixture();
    expect(run(root).status).toBe(0);
    const proxyDirectory = path.join(root, ".claude", "skills", "brainstorming");
    const staleProxy = path.join(proxyDirectory, "SKILL.md");
    writeFileSync(staleProxy, "stale proxy content\n");
    const staleInode = lstatSync(staleProxy, { bigint: true }).ino;

    const result = run(root);

    expect(result.status).toBe(0);
    expect(readFileSync(staleProxy, "utf8")).toContain("GENERATED CANONICAL SKILL PROXY");
    expect(lstatSync(staleProxy, { bigint: true }).ino).not.toBe(staleInode);
    expect(readdirSync(proxyDirectory)).toEqual(["SKILL.md"]);
  });

  it("requires exactly four regular files in frontend-design", async () => {
    const rootWithExtra = await fixture();
    const extra = path.join(rootWithExtra, ".codex", "skills", "frontend-design", "notes.md");
    writeFileSync(extra, "unexpected\n");
    const extraResult = run(rootWithExtra);
    expect(extraResult.status).toBe(1);
    expect(extraResult.stderr).toContain("Unexpected frontend-design entry");
    expect(readFileSync(extra, "utf8")).toBe("unexpected\n");

    const rootWithMissing = await fixture();
    const missing = path.join(
      rootWithMissing,
      ".codex",
      "skills",
      "frontend-design",
      "LICENSE.txt",
    );
    rmSync(missing);
    const missingResult = run(rootWithMissing);
    expect(missingResult.status).toBe(1);
    expect(missingResult.stderr).toContain("Missing frontend-design entry");
  });

  it("rejects every expected frontend-design file when replaced by an ordinary directory", async () => {
    for (const fileName of ["SOURCE.md", "UPSTREAM_SKILL.md", "LICENSE.txt", "SKILL.md"]) {
      const root = await fixture();
      const expectedFile = path.join(
        root,
        ".codex",
        "skills",
        "frontend-design",
        fileName,
      );
      rmSync(expectedFile);
      mkdirSync(expectedFile);

      const result = run(root);

      expect(result.status, fileName).toBe(1);
      expect(result.stderr, fileName).toContain("Frontend-design entry must be a regular file");
      expect(existsSync(path.join(root, ".claude", "skills")), fileName).toBe(false);
      expect(lstatSync(expectedFile).isDirectory(), fileName).toBe(true);
    }
  });

  it("rejects a frontend-design file replaced by an external junction", async () => {
    const root = await fixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "frontend-design-outside-"));
    const source = path.join(root, ".codex", "skills", "frontend-design", "SOURCE.md");
    rmSync(source);
    symlinkSync(outside, source, process.platform === "win32" ? "junction" : "dir");

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsafe canonical skill entry");
    expect(existsSync(path.join(root, ".claude", "skills"))).toBe(false);
  });

  it("recursively rejects a nested canonical support junction", async () => {
    const root = await fixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "canonical-support-outside-"));
    const references = path.join(root, ".codex", "skills", "brainstorming", "references");
    mkdirSync(references);
    const external = path.join(references, "external");
    symlinkSync(outside, external, process.platform === "win32" ? "junction" : "dir");

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsafe canonical skill entry");
    expect(existsSync(path.join(root, ".claude", "skills"))).toBe(false);
  });

  it("fails when a Claude proxy directory contains anything except a regular SKILL.md", async () => {
    const root = await fixture();
    expect(run(root).status).toBe(0);
    const extra = path.join(root, ".claude", "skills", "frontend-design", "notes.md");
    writeFileSync(extra, "unexpected\n");

    const result = run(root, "--check");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unexpected Claude proxy entry");
    expect(readFileSync(extra, "utf8")).toBe("unexpected\n");
  });

  it("refuses a Claude skill directory that escapes through a junction", async () => {
    const root = await fixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "agent-skills-outside-"));
    const outsideSkill = path.join(outside, "SKILL.md");
    writeFileSync(outsideSkill, "outside\n");
    mkdirSync(path.join(root, ".claude", "skills"), { recursive: true });
    symlinkSync(
      outside,
      path.join(root, ".claude", "skills", "brainstorming"),
      process.platform === "win32" ? "junction" : "dir",
    );

    expect(run(root).status).toBe(1);
    expect(readFileSync(outsideSkill, "utf8")).toBe("outside\n");
  });

  it("refuses a canonical skill directory that is a symlink or junction", async () => {
    const root = await fixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "canonical-skill-outside-"));
    writeFileSync(
      path.join(outside, "SKILL.md"),
      "---\nname: frontend-design\ndescription: fixture\n---\n",
    );
    const target = path.join(root, ".codex", "skills", "frontend-design");
    await rm(target, { recursive: true });
    symlinkSync(outside, target, process.platform === "win32" ? "junction" : "dir");

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsafe canonical skill directory");
  });

  it("lists the fixed 14 Superpowers skills plus frontend-design", async () => {
    const root = await fixture();
    const result = run(root, "--list");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Superpowers");
    expect(result.stdout).toContain("# Project local");
    const listedNames = result.stdout
      .split(/\r?\n/u)
      .filter((line) => line && !line.startsWith("#"));
    expect(listedNames.sort()).toEqual([...skillNames].sort());
    expect(result.stdout).not.toContain("gstack");
  });
});
