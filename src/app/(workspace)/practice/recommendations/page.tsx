import type { Metadata } from "next";
import { RecommendationsView } from "@/components/practice/RecommendationsView";

export const metadata: Metadata = { title: "추천 문제 — TALKPIK" };

export default function PracticeRecommendationsPage() {
  return <RecommendationsView />;
}
