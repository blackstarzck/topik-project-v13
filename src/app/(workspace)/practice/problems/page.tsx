import type { Metadata } from "next";
import { ProblemListView } from "@/components/practice/ProblemListView";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "문제 목록 — TALKPIK" };

export default async function PracticeProblemsPage() {
  const user = await requireUser();
  return <ProblemListView userId={user.id} />;
}
