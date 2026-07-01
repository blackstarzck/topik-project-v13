import { Skeleton } from "antd";
import { getTranslations } from "next-intl/server";

import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { LibraryProblemsBackLink } from "@/components/library/LibraryProblemsBackLink";
import { AppCard } from "@/components/shared/AppCard";

export default async function LibraryProblemsLoading() {
  const t = await getTranslations("library.problemsPage");

  return (
    <WorkspaceBody
      size="wide"
      className="app-cards-bordered flex min-h-0 flex-col"
    >
      <header className="mb-16 flex items-center gap-3">
        <LibraryProblemsBackLink label={t("backToLibrary")} />
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-semibold leading-[1.35] text-foreground">
            {t("heading")}
          </h1>
          <p className="mt-1 mb-0 text-sm leading-[1.5715] text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </header>
      <div
        className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"
        data-testid="library-problems-loading"
      >
        <AppCard>
          <Skeleton active paragraph={{ rows: 10 }} />
        </AppCard>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <AppCard key={index} size="small">
              <Skeleton active paragraph={{ rows: 2 }} title={false} />
            </AppCard>
          ))}
        </div>
      </div>
    </WorkspaceBody>
  );
}
