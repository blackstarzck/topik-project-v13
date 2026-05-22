import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import {
  getNextProblem,
  type NextProblemSuggestion,
} from "@/lib/practice/next";
import { NextProblemView } from "@/components/practice/NextProblemView";

export const metadata: Metadata = { title: "다음 문제 — TALKPIK" };

function suggestionToTier(s: NextProblemSuggestion | null): 1 | 2 | 3 | 4 {
  if (!s) return 4;
  if (s.source === "recommendation") return 1;
  if (s.source === "same_question_no") return 2;
  return 3;
}

export default async function PracticeNextPage() {
  const user = await requireUser();
  const suggestion = await getNextProblem(user.id);
  const tier = suggestionToTier(suggestion);
  const problem = suggestion
    ? {
        id: suggestion.problemId,
        title: suggestion.title,
        question_no: suggestion.questionNo ?? 0,
      }
    : null;
  return (
    <main style={{ padding: 24 }}>
      <h1>다음 문제</h1>
      <NextProblemView problem={problem} tier={tier} />
    </main>
  );
}
