"use client";

import type {
  LibraryProblemView,
  LibrarySubmissionView,
} from "@/lib/library/types";

import { LibraryProblemsList } from "./LibraryProblemsList";

type Props = {
  initialSubmissions: LibrarySubmissionView[];
  initialProblems: LibraryProblemView[];
};

export function LibraryProblemsWorkspace({
  initialSubmissions,
  initialProblems,
}: Props) {
  return (
    <div
      data-testid="library-problems-workspace"
      className="flex min-h-0 flex-1"
    >
      <div
        data-testid="library-problems-list-column"
        className="flex min-h-0 w-full"
      >
        <LibraryProblemsList
          initialSubmissions={initialSubmissions}
          initialProblems={initialProblems}
        />
      </div>
    </div>
  );
}
