import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { LibraryProblemsBackLink } from "@/components/library/LibraryProblemsBackLink";
import { LibraryProblemsWorkspace } from "@/components/library/LibraryProblemsWorkspace";
import { requireUser } from "@/lib/auth/session";
import { getLibraryProblemsPageData } from "@/lib/library/problems-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library.problemsPage");
  return { title: t("metaTitle") };
}

export default async function LibraryProblemsPage() {
  const user = await requireUser();
  const t = await getTranslations("library.problemsPage");
  const data = await getLibraryProblemsPageData(user.id);

  return (
    <WorkspaceBody
      size="wide"
      className="app-cards-bordered flex min-h-0 flex-col"
    >
      <header
        className="mb-16 flex items-center gap-3"
        data-testid="library-problems-page-header"
      >
        <LibraryProblemsBackLink
          label={t("backToLibrary")}
          testId="library-problems-back-link"
        />
        <div className="min-w-0" data-testid="library-problems-heading-copy">
          <h1 className="m-0 text-2xl font-semibold leading-[1.35] text-foreground">
            {t("heading")}
          </h1>
          <p className="mt-1 mb-0 text-sm leading-[1.5715] text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </header>
      <LibraryProblemsWorkspace
        initialSubmissions={data.initialSubmissions}
        initialProblems={data.initialProblems}
        initialDrafts={data.initialDrafts}
      />
    </WorkspaceBody>
  );
}
