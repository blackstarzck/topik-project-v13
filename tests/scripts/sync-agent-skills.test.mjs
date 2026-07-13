import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { cp, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const skillNames = [
  "brainstorming",
  "dispatching-parallel-agents",
  "executing-plans",
  "finishing-a-development-branch",
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
  });

  it("does not write in check mode or delete unrelated local Claude skills", async () => {
    const root = await fixture();
    const external = path.join(root, ".claude", "skills", "local-only", "SKILL.md");
    mkdirSync(path.dirname(external), { recursive: true });
    writeFileSync(external, "local\n");

    expect(run(root, "--check").status).toBe(1);
    expect(existsSync(path.join(root, ".claude", "skills", "brainstorming", "SKILL.md"))).toBe(false);
    expect(readFileSync(external, "utf8")).toBe("local\n");
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
});
