"use client";

import { Button, Result } from "antd";
import { useTranslations } from "next-intl";

export default function LibraryError({ reset }: { reset: () => void }) {
  const t = useTranslations("library.dashboard.error");

  return (
    <Result
      data-testid="library-error"
      status="error"
      title={t("title")}
      subTitle={t("subTitle")}
      extra={
        <Button type="primary" onClick={reset}>
          {t("retry")}
        </Button>
      }
    />
  );
}
