import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProblemListView } from "@/components/practice/ProblemListView";
import { requireUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practice.problems");
  return { title: t("metaTitle") };
}

export default async function PracticeProblemsPage() {
  const user = await requireUser();
  return <ProblemListView userId={user.id} />;
}
