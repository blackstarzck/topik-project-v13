import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RecommendationsView } from "@/components/practice/RecommendationsView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practice.recommendations");
  return { title: t("metaTitle") };
}

export default function PracticeRecommendationsPage() {
  return <RecommendationsView />;
}
