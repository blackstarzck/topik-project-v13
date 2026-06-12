"use client";

import { Card, Statistic } from "antd";

type Props = {
  title: string;
  value: number | string;
  suffix?: string;
  hint?: string;
};

export function KpiCard({ title, value, suffix, hint }: Props) {
  return (
    <Card size="small" className="h-full">
      <Statistic title={title} value={value} suffix={suffix} />
      {hint ? (
        <div className="mt-2 text-xs text-text-secondary">{hint}</div>
      ) : null}
    </Card>
  );
}
