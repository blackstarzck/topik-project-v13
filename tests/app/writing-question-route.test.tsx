// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const requireUserMock = vi.hoisted(() => vi.fn());
const getWritingProblemMock = vi.hoisted(() => vi.fn());
const getActiveDraftMock = vi.hoisted(() => vi.fn());
const getRetrySubmissionSeedMock = vi.hoisted(() => vi.fn());
const writingPageContentMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getTranslations: () => async (key: string) => key,
}));

vi.mock("@/components/writing/WritingPageContent", () => ({
  WritingPageContent: (props: unknown) => {
    writingPageContentMock(props);
    return <div data-testid="writing-page-content" />;
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

vi.mock("@/lib/writing/server", () => ({
  getWritingProblem: (...args: unknown[]) => getWritingProblemMock(...args),
  getActiveDraft: (...args: unknown[]) => getActiveDraftMock(...args),
  getRetrySubmissionSeed: (...args: unknown[]) =>
    getRetrySubmissionSeedMock(...args),
  isProblemIdLikeUuid: (value: unknown) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    ),
}));

import { renderWritingQuestionPage } from "../../src/app/(workspace)/writing/_components/WritingQuestionRoute";

describe("renderWritingQuestionPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("passes the authenticated user id into default writing problem selection", async () => {
    requireUserMock.mockResolvedValue({ id: "user-1" });
    getWritingProblemMock.mockResolvedValue(null);

    const element = await renderWritingQuestionPage(51, Promise.resolve({}));
    render(element);

    expect(getWritingProblemMock).toHaveBeenCalledWith(
      51,
      undefined,
      undefined,
      {
        userId: "user-1",
      },
    );
    expect(getActiveDraftMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("writing-page-content")).toBeTruthy();
  });
});
