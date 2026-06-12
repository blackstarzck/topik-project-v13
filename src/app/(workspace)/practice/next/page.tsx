import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { getNextProblemBundle } from "@/lib/practice/next";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { NextProblemView } from "@/components/practice/NextProblemView";
import { PageHeader } from "@/components/shared/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practice.next");
  return { title: t("metaTitle") };
}

export default async function PracticeNextPage() {
  const t = await getTranslations("practice.next");
  const user = await requireUser();
  const bundle = await getNextProblemBundle(user.id);
  return (
    <WorkspaceBody>
      <PageHeader title={t("pageTitle")} subtitle={t("subtitle")} />
      <NextProblemView bundle={bundle} />
    </WorkspaceBody>
  );
}
