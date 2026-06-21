// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubmittedAnalysisPanel } from "../../../src/components/writing/SubmittedAnalysisPanel";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("@/lib/writing/queries", () => ({
  useFeedbackStatus: () => ({ data: "failed" }),
}));

afterEach(() => cleanup());

describe("SubmittedAnalysisPanel failed state", () => {
  it("removes the submitted answer card below the analysis failure card", async () => {
    renderWithIntl(
      <SubmittedAnalysisPanel
        state={{
          submissionId: "submission-failed",
          questionNo: 51,
          answerText: "failed answer text",
          charCount: 18,
          submittedAt: "2026-06-19T00:00:00.000Z",
          feedbackHref: "/writing/feedback/submission-failed",
        }}
      />,
    );

    expect(await screen.findByTestId("analysis-state-card")).toBeTruthy();
    expect(screen.queryByTestId("analysis-loading-background")).toBeNull();
  });

  it("centers the standalone failure card in the page", async () => {
    renderWithIntl(
      <SubmittedAnalysisPanel
        state={{
          submissionId: "submission-failed",
          questionNo: 51,
          answerText: "failed answer text",
          charCount: 18,
          submittedAt: "2026-06-19T00:00:00.000Z",
          feedbackHref: "/writing/feedback/submission-failed",
        }}
      />,
    );

    expect(
      (await screen.findByTestId("analysis-loading-page")).classList.contains(
        "submitted-analysis-page--failed",
      ),
    ).toBe(true);

    const css = readFileSync(
      resolve(process.cwd(), "src/styles/global.css"),
      "utf8",
    );
    const failedRule = css.match(
      /\.submitted-analysis-page\.submitted-analysis-page--failed\s*\{([^}]+)\}/,
    );

    expect(failedRule?.[1]).toContain("justify-content: center");
  });
});
