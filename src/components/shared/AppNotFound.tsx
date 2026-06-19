"use client";

import Link from "next/link";
import { Button, Result } from "antd";
import { useTranslations } from "next-intl";

export function AppNotFound() {
  const t = useTranslations("shared.notFound");
  return (
    <div
      data-testid="app-not-found"
      className="flex min-h-dvh items-center justify-center p-6"
    >
      <Result
        status="404"
        title={t("title")}
        subTitle={t("subTitle")}
        extra={
          <Link href="/dashboard">
            <Button type="primary">{t("backToDashboard")}</Button>
          </Link>
        }
      />
    </div>
  );
}
