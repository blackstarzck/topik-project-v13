// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  LibraryDraftView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "../../../src/lib/library/types";
import { LibraryProblemsWorkspace } from "../../../src/components/library/LibraryProblemsWorkspace";

vi.mock("../../../src/components/library/LibraryProblemsList", () => ({
  LibraryProblemsList: () => (
    <div data-testid="library-problems-list">mixed list</div>
  ),
}));

vi.mock("../../../src/components/library/LibraryStatsPanel", () => ({
  LibraryStatsPanel: () => (
    <aside data-testid="library-stats-panel">stats panel</aside>
  ),
}));

const submission: LibrarySubmissionView = {
  kind: "submission",
  id: "sub-1",
  problem_id: "problem-53",
  problem_title: "문화 소비 다양화 영향",
  question_no: 53,
  submitted_at: "2026-06-29T09:30:00.000Z",
  char_count: 252,
  item_id: "library-sub-1",
  saved_at: "2026-06-29T10:00:00.000Z",
  tags: [],
};

const problem: LibraryProblemView = {
  kind: "problem",
  id: "problem-52",
  title: "휴대전화 진동 문장 완성",
  question_no: 52,
  item_id: "library-problem-1",
  saved_at: "2026-06-30T10:00:00.000Z",
  tags: [],
  availabilityStatus: "available",
  availabilityReason: null,
  canRetry: true,
};

const draft: LibraryDraftView = {
  kind: "draft",
  id: "draft-51",
  problem_id: "problem-51",
  problem_title: "No. 51 - Draft answer problem",
  question_no: 51,
  answer_text: "draft body",
  char_count: 10,
  autosave_status: "clean",
  item_id: "draft:draft-51",
  saved_at: "2026-07-01T10:00:00.000Z",
  last_saved_at: "2026-07-01T10:00:00.000Z",
};

afterEach(cleanup);

describe("LibraryProblemsWorkspace", () => {
  it("renders only the mixed learning list without the library stats panel", () => {
    render(
      <LibraryProblemsWorkspace
        initialSubmissions={[submission]}
        initialProblems={[problem]}
        initialDrafts={[draft]}
      />,
    );

    expect(screen.getByTestId("library-problems-workspace")).toBeTruthy();
    expect(screen.getByTestId("library-problems-list")).toBeTruthy();
    expect(screen.getByTestId("library-problems-list-column")).toBeTruthy();
    expect(screen.queryByTestId("library-problems-stats-column")).toBeNull();
    expect(screen.queryByTestId("library-stats-panel")).toBeNull();
  });
});
