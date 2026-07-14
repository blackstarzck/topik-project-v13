import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const skillRoot = path.join(repoRoot, ".codex", "skills", "frontend-design");
const commit = "9d2f1ae187231d8199c64b5b762e1bdf2244733d";
const rawRoot = `https://raw.githubusercontent.com/anthropics/skills/${commit}/skills/frontend-design`;

function read(relativePath) {
  return readFileSync(path.join(skillRoot, relativePath), "utf8");
}

function sha256(relativePath) {
  return createHash("sha256")
    .update(readFileSync(path.join(skillRoot, relativePath)))
    .digest("hex");
}

describe("project-local frontend-design skill", () => {
  test("preserves the pinned official skill and license byte-for-byte", () => {
    expect(sha256("UPSTREAM_SKILL.md")).toBe(
      "1608ea77fbb6fc30d13a97d12cfa8ebf31358d40f0dd97beed24829d6b3f45dd",
    );
    expect(sha256("LICENSE.txt")).toBe(
      "0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594",
    );
  });

  test("records the immutable source URLs, commit, and exact hashes", () => {
    const source = read("SOURCE.md");
    expect(source).toContain(commit);
    expect(source).toContain(`${rawRoot}/SKILL.md`);
    expect(source).toContain(`${rawRoot}/LICENSE.txt`);
    expect(source).toContain(
      `https://github.com/anthropics/skills/tree/${commit}/skills/frontend-design`,
    );
    expect(source).toContain(
      "1608ea77fbb6fc30d13a97d12cfa8ebf31358d40f0dd97beed24829d6b3f45dd",
    );
    expect(source).toContain(
      "0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594",
    );
  });

  test("uses a TALKPIK wrapper with narrow triggers and explicit precedence", () => {
    const wrapper = read("SKILL.md");
    expect(wrapper).toMatch(
      /^---\r?\nname: frontend-design\r?\ndescription: Use when[^\r\n]+\r?\n---/u,
    );
    expect(wrapper).toContain("UPSTREAM_SKILL.md");
    expect(wrapper).toMatch(/UI component/u);
    expect(wrapper).toMatch(/page visual/u);
    expect(wrapper).toMatch(/AGENTS\.md/u);
    expect(wrapper).toMatch(/Superpowers/u);
    expect(wrapper).toMatch(/docs\/prd\.md/u);
    expect(wrapper).toMatch(/DESIGN\.md/u);
    expect(wrapper).toMatch(/Ant Design|AntD/u);
    expect(wrapper).toMatch(/theme/u);
    expect(wrapper).toMatch(/not.*documentation/u);
    expect(wrapper).toMatch(/server/u);
    expect(wrapper).toMatch(/data-only/u);
    expect(wrapper).toMatch(/inline style/u);
    expect(wrapper).toMatch(/dependenc/u);
    expect(wrapper).toMatch(/product behavior/u);
    expect(wrapper).toMatch(/token/u);
  });

  test("moves Superpowers planning output into ignored task workspaces", () => {
    const brainstorming = readFileSync(
      path.join(repoRoot, ".codex", "skills", "brainstorming", "SKILL.md"),
      "utf8",
    );
    const writingPlans = readFileSync(
      path.join(repoRoot, ".codex", "skills", "writing-plans", "SKILL.md"),
      "utf8",
    );
    expect(brainstorming).toContain(".codex/work/<slug>/specs/");
    expect(writingPlans).toContain(".codex/work/<slug>/plans/");
    // This test proves the retired owner is absent. Build the historical label
    // from non-path fragments so the active-reference checker does not mistake
    // this negative assertion for code that recreates the retired directory.
    const retiredWorkflowDocsRoot =
      ["doc", "s"].join("") + "/" + ["super", "powers"].join("");
    expect(brainstorming).not.toContain(`${retiredWorkflowDocsRoot}/specs`);
    expect(writingPlans).not.toContain(`${retiredWorkflowDocsRoot}/plans`);
  });

  test("tracks frontend-design while leaving task workspaces ignored", () => {
    const gitignore = readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain("!.codex/skills/frontend-design/");
    expect(gitignore).toContain("!.codex/skills/frontend-design/**");
    expect(gitignore).not.toContain(".codex/skills/gstack");
    expect(gitignore).toContain(".codex/*");
    expect(gitignore).not.toContain("!.codex/work");
  });

  test("enforces the intended paths through real git ignore semantics", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "frontend-design-ignore-"));
    try {
      writeFileSync(
        path.join(root, ".gitignore"),
        readFileSync(path.join(repoRoot, ".gitignore"), "utf8"),
      );
      const workFile = path.join(root, ".codex", "work", "task", "specs", "plan.md");
      mkdirSync(path.dirname(workFile), { recursive: true });
      writeFileSync(workFile, "ignored\n");
      for (const fileName of ["SKILL.md", "UPSTREAM_SKILL.md", "SOURCE.md", "LICENSE.txt"]) {
        const target = path.join(root, ".codex", "skills", "frontend-design", fileName);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, `${fileName}\n`);
      }
      expect(spawnSync("git", ["init", "--quiet"], { cwd: root }).status).toBe(0);

      const checkIgnore = (relativePath) =>
        spawnSync("git", ["check-ignore", "--no-index", "--quiet", "--", relativePath], {
          cwd: root,
        }).status;

      expect(checkIgnore(".codex/work/task/specs/plan.md")).toBe(0);
      for (const fileName of ["SKILL.md", "UPSTREAM_SKILL.md", "SOURCE.md", "LICENSE.txt"]) {
        expect(checkIgnore(`.codex/skills/frontend-design/${fileName}`)).toBe(1);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
