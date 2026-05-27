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
    <Card size="small" style={{ height: "100%" }}>
      <Statistic title={title} value={value} suffix={suffix} />
      {hint ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>{hint}</div>
      ) : null}
    </Card>
  );
}
