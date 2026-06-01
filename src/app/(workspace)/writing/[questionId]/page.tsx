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
  searchParams: Promise<{ problem?: string; fresh?: string }>;
}) {
  const { questionId } = await params;
  const qn = Number(questionId);
  if (!isQuestionNo(qn)) notFound();
  const user = await requireUser();
  const { problem: problemId, fresh } = await searchParams;
  const problem = await getWritingProblem(qn, problemId);
  // C-03 재풀이 모드 "새 답안으로 시작" (fresh=1): 저장된 draft를 불러오지 않고
  // 빈 에디터로 시작. fresh 미지정이면 기존 작성 내용을 이어서 로드한다.
  const startFresh = fresh === "1";
  const draft =
    problem && !startFresh ? await getActiveDraft(user.id, problem.id) : null;
  return (
    <WritingPageContent
      questionNo={qn}
      userId={user.id}
      problem={problem}
      draft={draft}
    />
  );
}
