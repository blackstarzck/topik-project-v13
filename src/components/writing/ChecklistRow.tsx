"use client";

import { Segmented, Space, Typography } from "antd";
import { useTranslations } from "next-intl";

import type { ChecklistItemStatus } from "@/lib/writing/types";

const { Text } = Typography;

type Props = {
  label: string;
  status: ChecklistItemStatus;
  onChange: (next: ChecklistItemStatus) => void;
};

export function ChecklistRow({ label, status, onChange }: Props) {
  const t = useTranslations("writing.checklist");
  const OPTIONS: { label: string; value: ChecklistItemStatus }[] = [
    { label: t("statusUnchecked"), value: "unchecked" },
    { label: t("statusWarning"), value: "warning" },
    { label: t("statusComplete"), value: "complete" },
  ];
  return (
    <Space
      className="writing-checklist-row"
      orientation="vertical"
      size={2}
    >
      <Text>{label}</Text>
      <Segmented
        block
        aria-label={label}
        value={status}
        onChange={(v) => onChange(v as ChecklistItemStatus)}
        options={OPTIONS}
      />
    </Space>
  );
}
