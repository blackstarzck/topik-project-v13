import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { getLibraryDashboard } from "@/lib/library/dashboard";
import { LibraryDashboard } from "@/components/library/LibraryDashboard";
import { PageHeader } from "@/components/shared/PageHeader";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library.page");
  return { title: t("metaTitle") };
}

export default async function LibraryPage() {
  const user = await requireUser();
  const t = await getTranslations("library.page");
  const dashboard = await getLibraryDashboard(user.id);

  return (
    <WorkspaceBody
      size="wide"
      className="app-cards-bordered flex min-h-0 flex-col"
    >
      <PageHeader
        title={t("heading")}
        subtitle={t("subtitle")}
        className="library-page-header"
      />
      <LibraryDashboard dashboard={dashboard} />
    </WorkspaceBody>
  );
}
