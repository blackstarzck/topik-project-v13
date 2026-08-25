import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { scanUiContract } from "../../scripts/lib/ui-contract.mjs";

const COMPONENT_PATHS = [
  "src/components/auth/AuthMascot.tsx",
  "src/components/feedback/FeedbackRecommendationCards.tsx",
  "src/components/feedback/FeedbackSummary.tsx",
  "src/components/feedback/SentenceFeedbackList.tsx",
];

describe("remaining component visual ownership", () => {
  it("keeps the targeted components free of arbitrary visual utilities", async () => {
    const sources = await Promise.all(
      COMPONENT_PATHS.map(async (path) => ({
        path,
        content: await readFile(path, "utf8"),
      })),
    );

    expect(
      scanUiContract(sources).violations.filter(
        (violation) => violation.ruleId === "tailwind.arbitrary-visual",
      ),
    ).toEqual([]);
  });

  it("maps mascot typography to L2 and preserves the 46px score through a local recipe", async () => {
    const [mascot, summary, scoreRecipe, { getResolvedBridgeVars }] =
      await Promise.all([
        readFile("src/components/auth/AuthMascot.tsx", "utf8"),
        readFile("src/components/feedback/FeedbackSummary.tsx", "utf8"),
        readFile(
          "src/components/feedback/FeedbackSummary.module.css",
          "utf8",
        ).catch(() => ""),
        import("../../src/theme/tailwind-bridge.ts"),
      ]);

    expect(mascot).toContain('56: "text-display-sm"');
    expect(mascot).toContain('className="!text-body"');
    expect(summary).toContain(
      'import styles from "./FeedbackSummary.module.css";',
    );
    expect(summary).toContain("className={styles.score}");
    expect(scoreRecipe).toMatch(
      /\.score\s+:global\(\.ant-statistic-content-value\)\s*\{[\s\S]*?font-size:\s*calc\(var\(--app-font-size-heading-lg\)\s*\*\s*23\s*\/\s*20\)\s*!important;[\s\S]*?font-weight:\s*700;[\s\S]*?line-height:\s*1;/u,
    );

    const defaultHeadingSize = Number.parseFloat(
      getResolvedBridgeVars("default", "light")["--app-font-size-heading-lg"],
    );
    expect((defaultHeadingSize * 23) / 20).toBe(46);
    expect(mascot).not.toMatch(/text-\[(?:56|13)px\]/u);
    expect(summary).not.toContain("text-[46px]");
    expect(scoreRecipe).not.toContain("46px");
  });

  it("uses the L2 secondary-text role for decorative feedback icons", async () => {
    const [recommendations, sentences] = await Promise.all([
      readFile(
        "src/components/feedback/FeedbackRecommendationCards.tsx",
        "utf8",
      ),
      readFile("src/components/feedback/SentenceFeedbackList.tsx", "utf8"),
    ]);

    expect(recommendations).toContain("text-text-secondary");
    expect(sentences).toContain("text-text-secondary");
    expect(`${recommendations}\n${sentences}`).not.toContain("var(--ant-");
  });
});
