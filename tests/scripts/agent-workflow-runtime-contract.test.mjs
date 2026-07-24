import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

describe("agent workflow runtime contract", () => {
  it("makes AGENTS.md the common Codex and Claude workflow owner", () => {
    const agents = readProjectFile("AGENTS.md");
    const claude = readProjectFile(".claude/CLAUDE.md");
    const gitignore = readProjectFile(".gitignore");

    expect(agents).toContain("Codex와 Claude를 포함한 모든 AI 에이전트");
    expect(claude).toContain("@../AGENTS.md");
    expect(gitignore).toContain("!.claude/CLAUDE.md");
    expect(() => readProjectFile("CLAUDE.md")).toThrow();
    expect(agents).toContain("먼저 `task:prepare`로 요청을 분류한다");
    expect(agents).toContain(
      "작은 순차 코드 작업은 task branch 하나와 `.worktrees/shared-dev` 공용 slot을 재사용한다",
    );
  });

  it("requires safe worktree env preparation before runtime verification", () => {
    const agents = readProjectFile("AGENTS.md");
    const helper = readProjectFile("scripts/prepare-worktree-env.mjs");

    expect(agents).toContain("pnpm prepare:worktree-env --profile app");
    expect(agents).toContain("--profile e2e");
    expect(agents).toContain("기존 파일은 덮어쓰거나 합치지 않으며 값과 secret을 출력하지 않는다");
    expect(helper).toContain('const profiles = new Set(["app", "e2e"])');
    expect(helper).toContain('openSync(file, "wx+", 0o600)');
  });

  it("requires Playwright CLI and direct Playwright MCP evidence for UI changes", () => {
    const agents = readProjectFile("AGENTS.md");

    expect(agents).toContain("Playwright CLI와 Playwright MCP 직접 브라우저 확인");
    expect(agents).toContain("desktop/mobile");
    expect(agents).toContain("현재 worktree runtime임을 증명하지 못하면 해당 UI 검증은 미완료");
  });

  it("requires every completion report to state remaining work", () => {
    const agents = readProjectFile("AGENTS.md");

    expect(agents).toContain("모든 작업 완료 보고에는 남은 작업을 반드시 명시한다");
    expect(agents).toContain("남은 작업 없음");
  });

  it("wires prebuild to the project structure checker and removes retired gates", () => {
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const scripts = packageJson.scripts;
    // Build removed command labels from fragments: these are negative contract
    // assertions, not active references that can execute or recreate old owners.
    const retiredRegistry = ["sot", "registry"].join("-");
    const retiredProposalGate = ["admin-boundary", "proposal"].join("-");
    const retiredNotificationGate = ["notification-retirement", "gate"].join("-");

    expect(scripts.prebuild).toContain("scripts/check-project-structure.mjs");
    expect(scripts).not.toHaveProperty(`check:${retiredRegistry}`);
    expect(scripts).not.toHaveProperty(`report:${retiredRegistry}`);
    expect(scripts).not.toHaveProperty(`generate:${["sot", "index"].join("-")}`);
    expect(scripts).not.toHaveProperty(`check:${retiredProposalGate}`);
    expect(scripts).not.toHaveProperty(`check:${retiredNotificationGate}`);
    expect(scripts["harness:admin-boundary"]).not.toContain(retiredProposalGate);
    expect(scripts["harness:admin-boundary"]).not.toContain(retiredNotificationGate);
  });
});
