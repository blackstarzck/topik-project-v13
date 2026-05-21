import type { Metadata } from "next";
import { ProblemListView } from "@/components/practice/ProblemListView";

export const metadata: Metadata = { title: "문제 목록 — TALKPIK" };

export default function PracticeProblemsPage() {
  return <ProblemListView />;
}
