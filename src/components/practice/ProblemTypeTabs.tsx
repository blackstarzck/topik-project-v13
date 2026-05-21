"use client";

import { Tabs } from "antd";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";

type Props = {
  active: QuestionNo | null;
  onChange: (value: QuestionNo | null) => void;
};

export function ProblemTypeTabs({ active, onChange }: Props) {
  return (
    <Tabs
      activeKey={active != null ? String(active) : "all"}
      onChange={(key) => {
        if (key === "all") onChange(null);
        else onChange(Number(key) as QuestionNo);
      }}
      items={[
        { key: "all", label: "전체" },
        ...QUESTION_NOS.map((n) => ({
          key: String(n),
          label: `${n}번`,
        })),
      ]}
    />
  );
}
