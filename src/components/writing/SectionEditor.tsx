"use client";

import { Input, Typography } from "antd";

const { Text } = Typography;

type Props = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
};

export function SectionEditor({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  minRows = 4,
}: Props) {
  return (
    <div>
      <Text strong>{label}</Text>
      <Input.TextArea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoSize={{ minRows }}
        style={{ marginTop: 8 }}
      />
    </div>
  );
}
