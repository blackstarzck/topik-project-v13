"use client";

import { Button, Result } from "antd";
import { useTranslations } from "next-intl";

import { APP_ROUTES } from "@/lib/routes";

export default function LibraryProblemsError({ reset }: { reset: () => void }) {
  const t = useTranslations("library.dashboard.error");
  const pageT = useTranslations("library.problemsPage");

  return (
    <Result
      data-testid="library-problems-error"
      status="error"
      title={t("title")}
      subTitle={t("subTitle")}
      extra={[
        <Button key="retry" type="primary" onClick={reset}>
          {t("retry")}
        </Button>,
        <Button key="back" href={APP_ROUTES.library}>
          {pageT("backToLibrary")}
        </Button>,
      ]}
    />
  );
}
