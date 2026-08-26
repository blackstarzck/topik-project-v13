"use client";

import { Statistic } from "antd";
import { AppCard } from "@/components/shared/AppCard";

type Props = {
  title: string;
  value: number | string;
  suffix?: string;
  hint?: string;
};

export function KpiCard({ title, value, suffix, hint }: Props) {
  return (
    <AppCard size="small" className="h-full">
      <Statistic title={title} value={value} suffix={suffix} />
      {hint ? (
        <div className="mt-2 text-xs text-text-secondary">{hint}</div>
      ) : null}
    </AppCard>
  );
}
