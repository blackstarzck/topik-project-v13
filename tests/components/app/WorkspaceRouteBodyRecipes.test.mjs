import { describe, expect, it } from "vitest";

import { collectUiSources } from "../../../scripts/check-ui-contract.mjs";
import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

const ROUTES = [
  "src/app/(workspace)/subscription/page.tsx",
  "src/app/(workspace)/writing/answer-writing-52/page.tsx",
  "src/app/(workspace)/writing/essay-writing-54/page.tsx",
  "src/app/(workspace)/writing/feedback/long/[id]/page.tsx",
  "src/app/(workspace)/writing/feedback/short/[id]/page.tsx",
  "src/app/(workspace)/writing/long-form-writing-53/page.tsx",
  "src/app/(workspace)/writing/reports/[id]/compare/page.tsx",
  "src/app/(workspace)/writing/short-answer-writing-51/page.tsx",
];

const EXPECTED_SIZES = new Map(
  ROUTES.map((route) => [
    route,
    route.includes("subscription") ? "workspace" : "full",
  ]),
);
const WRITING_EXAM_SHELL_PATH = "src/components/writing/WritingExamShell.tsx";

describe("workspace route body recipes", () => {
  it("gives every remaining workspace route a canonical body recipe", async () => {
    const sources = await collectUiSources(process.cwd());
    const result = scanUiContract(sources);
    const missingRoutes = result.violations
      .filter(
        (violation) =>
          violation.ruleId === "workspace.missing-body-recipe" &&
          ROUTES.includes(violation.path),
      )
      .map((violation) => violation.path);

    expect(missingRoutes).toEqual([]);
  });

  it("keeps full-screen study routes full-width without nesting page mains", async () => {
    const sources = await collectUiSources(process.cwd());
    const sourceByPath = new Map(
      sources.map((source) => [source.path, source.content]),
    );

    for (const [route, size] of EXPECTED_SIZES) {
      const content = sourceByPath.get(route);
      expect(content, route).toContain(`<WorkspaceBody size="${size}">`);
      expect(content, route).not.toContain("PageContainer");
      expect(content, route).not.toMatch(/<main\b/u);
    }

    const examShell = sourceByPath.get(WRITING_EXAM_SHELL_PATH);
    expect(examShell, WRITING_EXAM_SHELL_PATH).not.toMatch(/<main\b/u);
    expect(examShell, WRITING_EXAM_SHELL_PATH).toContain(
      '<div className={["writing-exam-main", styles.main].join(" ")}>',
    );
  });
});
