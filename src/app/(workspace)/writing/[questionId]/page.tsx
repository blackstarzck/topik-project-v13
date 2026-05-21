import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WritingPageContent } from "@/components/writing/WritingPageContent";
import { requireUser } from "@/lib/auth/session";
import {
  getActiveDraft,
  getWritingProblem,
} from "@/lib/writing/server";
import { isQuestionNo } from "@/lib/writing/types";

export const metadata: Metadata = { title: "쓰기 — TALKPIK" };

export default async function WritingQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ problem?: string }>;
}) {
  const { questionId } = await params;
  const qn = Number(questionId);
  if (!isQuestionNo(qn)) notFound();
  const user = await requireUser();
  const { problem: problemId } = await searchParams;
  const problem = await getWritingProblem(qn, problemId);
  const draft = problem ? await getActiveDraft(user.id, problem.id) : null;
  return (
    <WritingPageContent
      questionNo={qn}
      userId={user.id}
      problem={problem}
      draft={draft}
    />
  );
}
