import { Skeleton } from "antd";
import { getTranslations } from "next-intl/server";

import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { PageHeader } from "@/components/shared/PageHeader";
import { AppCard } from "@/components/shared/AppCard";

export default async function LibraryLoading() {
  const t = await getTranslations("library.page");

  return (
    <WorkspaceBody
      size="wide"
      className="app-cards-bordered flex min-h-0 flex-col"
    >
      <PageHeader title={t("heading")} subtitle={t("subtitle")} />
      <div className="flex flex-col gap-4" data-testid="library-loading">
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <AppCard key={index} size="small">
              <Skeleton active paragraph={{ rows: 2 }} title={false} />
            </AppCard>
          ))}
        </div>
        <AppCard>
          <Skeleton active paragraph={{ rows: 8 }} />
        </AppCard>
      </div>
    </WorkspaceBody>
  );
}
