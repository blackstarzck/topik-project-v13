// NOTE: Server-only by convention. This module is consumed by the
// `/library/problems` RSC and keeps the page data contract out of client code.
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type {
  LibraryItemView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "./types";
import { listLibraryItems } from "./server";

type ClientFactory = () => Promise<SupabaseServerClient>;

export type LibraryProblemsPageData = {
  initialSubmissions: LibrarySubmissionView[];
  initialProblems: LibraryProblemView[];
};

export async function getLibraryProblemsPageData(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<LibraryProblemsPageData> {
  const supabase = await createClient();
  const sameClient = async () => supabase;
  const [submissions, problems] = await Promise.all([
    listLibraryItems(userId, "submissions", sameClient),
    listLibraryItems(userId, "problems", sameClient),
  ]);

  return {
    initialSubmissions: submissions.filter(isSubmission),
    initialProblems: problems.filter(isProblem),
  };
}

function isSubmission(item: LibraryItemView): item is LibrarySubmissionView {
  return item.kind === "submission";
}

function isProblem(item: LibraryItemView): item is LibraryProblemView {
  return item.kind === "problem";
}
