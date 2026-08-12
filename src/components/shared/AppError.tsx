"use client";

import { useTranslations } from "next-intl";

import { UnavailableState } from "./UnavailableState";

type Props = {
  error?: Error;
  reset?: () => void;
};

export function AppError({ error, reset }: Props) {
  const t = useTranslations("shared.error");
  void error;
  return (
    <div
      data-testid="app-error"
      className="flex min-h-dvh items-center justify-center p-6"
    >
      <UnavailableState
        title="error"
        variant="general"
        actions={
          reset
            ? [
                {
                  key: "retry",
                  label: t("retry"),
                  onClick: reset,
                  primary: true,
                },
              ]
            : []
        }
      />
    </div>
  );
}
