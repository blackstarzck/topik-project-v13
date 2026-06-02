import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { getNextProblemBundle } from "@/lib/practice/next";
import { NextProblemView } from "@/components/practice/NextProblemView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practice.next");
  return { title: t("metaTitle") };
}

export default async function PracticeNextPage() {
  const t = await getTranslations("practice.next");
  const user = await requireUser();
  const bundle = await getNextProblemBundle(user.id);
  return (
    <main style={{ padding: 24 }}>
      <h1>{t("pageTitle")}</h1>
      <NextProblemView bundle={bundle} />
    </main>
  );
}
