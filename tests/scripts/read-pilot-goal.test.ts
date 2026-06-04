import { describe, test, expect } from "vitest";
// The parser is a plain .mjs script with no type declarations (tsconfig
// allowJs:false), so TS cannot resolve a typed import. The runtime export is
// exercised by every assertion below (mirrors ai-workflow-check.test.ts).
// @ts-expect-error -- .mjs script has no .d.ts; runtime contract verified here
import { parsePilotGoal, readPilotGoalRoutes } from "../../scripts/read-pilot-goal.mjs";

// A fixture mirroring the PLAN.md §Goal block shape, incl. the inline comments
// that broke the first parser cut (validate-the-validator).
const FIXTURE = [
  "## Goal — machine-derivable",
  "",
  "```yaml",
  "goal:",
  "  in:",
  "    files:                       # key comment",
  '      - "src/app/login/**"',
  '      - "src/components/dashboard/**"   # item comment',
  '    routes: ["/login", "/dashboard"]    # trailing comment',
  "  out:",
  "    absolute:                    # key comment",
  '      - "src/components/admin/**"',
  "  done:",
  '    - "gate exit 0"',
  "```",
  "",
  "---",
].join("\n");

describe("read-pilot-goal — §Goal block parser", () => {
  test("routes: inline array, ignores the trailing comment", () => {
    expect(parsePilotGoal(FIXTURE)?.in.routes).toEqual(["/login", "/dashboard"]);
  });

  test("in.files: list survives key + item comments", () => {
    expect(parsePilotGoal(FIXTURE)?.in.files).toEqual([
      "src/app/login/**",
      "src/components/dashboard/**",
    ]);
  });

  test("out.absolute: frozen admin paths", () => {
    expect(parsePilotGoal(FIXTURE)?.out.absolute).toEqual([
      "src/components/admin/**",
    ]);
  });

  test("returns null when there is no §Goal block", () => {
    expect(parsePilotGoal("# nothing here")).toBeNull();
  });

  // The DOCUMENT is the goal source: the real PLAN.md must parse to the pilot
  // routes, otherwise M1's auto-sourcing silently falls back.
  test("readPilotGoalRoutes(repo) yields the pilot routes from PLAN.md", () => {
    const routes = readPilotGoalRoutes(process.cwd());
    expect(routes).toContain("/login");
    expect(routes).toContain("/dashboard");
  });
});
