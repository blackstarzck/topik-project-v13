"use client";

import { Button, Result } from "antd";
import { useTranslations } from "next-intl";

type Props = {
  error?: Error;
  reset?: () => void;
};

export function AppError({ error, reset }: Props) {
  const t = useTranslations("shared.error");
  return (
    <Result
      status="error"
      title={t("title")}
      subTitle={error?.message ?? t("subTitle")}
      extra={
        reset ? (
          <Button type="primary" onClick={reset}>
            {t("retry")}
          </Button>
        ) : null
      }
    />
  );
}
