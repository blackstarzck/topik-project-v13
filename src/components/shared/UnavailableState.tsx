"use client";

import { Button, Result } from "antd";
import { useTranslations } from "next-intl";

import { AppCard } from "./AppCard";

export type UnavailableVariant =
  | "general"
  | "required-information"
  | "resource";

export type UnavailableAction = {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
};

type Props = {
  actions?: readonly UnavailableAction[];
  title?: "error" | "unavailable";
  variant: UnavailableVariant;
};

const MESSAGE_KEYS: Record<
  UnavailableVariant,
  "general" | "requiredInformation" | "resource"
> = {
  general: "general",
  "required-information": "requiredInformation",
  resource: "resource",
};

/**
 * Stable client-facing boundary for unavailable data or services.
 *
 * The API deliberately accepts no Error or free-form diagnostic text, so
 * provider, database, token, and stack details cannot accidentally reach UI.
 */
export function UnavailableState({
  actions = [],
  title = "unavailable",
  variant,
}: Props) {
  const t = useTranslations("shared.unavailable");
  const errorT = useTranslations("shared.error");

  return (
    <AppCard
      data-testid="unavailable-state"
      className="mx-auto w-full max-w-2xl"
    >
      <Result
        status="warning"
        title={
          <h1 className="m-0 text-inherit">
            {title === "error" ? errorT("title") : t("title")}
          </h1>
        }
        subTitle={t(MESSAGE_KEYS[variant])}
        extra={actions.map((action) => (
          <Button
            key={action.key}
            href={action.href}
            onClick={action.onClick}
            type={action.primary ? "primary" : "default"}
          >
            {action.label}
          </Button>
        ))}
      />
    </AppCard>
  );
}
