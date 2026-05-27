"use client";

import { Segmented, Space, Typography } from "antd";

import type { ChecklistItemStatus } from "@/lib/writing/types";

const { Text } = Typography;

type Props = {
  label: string;
  status: ChecklistItemStatus;
  onChange: (next: ChecklistItemStatus) => void;
};

const OPTIONS: { label: string; value: ChecklistItemStatus }[] = [
  { label: "⚪ 아직", value: "unchecked" },
  { label: "🟡 부분", value: "warning" },
  { label: "🟢 완료", value: "complete" },
];

export function ChecklistRow({ label, status, onChange }: Props) {
  return (
    <Space
      direction="vertical"
      size={2}
      style={{ width: "100%", marginBottom: 12 }}
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
