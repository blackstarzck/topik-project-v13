"use client";

import { Card, Statistic, Typography } from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";

const { Paragraph } = Typography;

type Props = {
  examDate: string | null;
};

export function UpcomingExamCard({ examDate }: Props) {
  const t = useTranslations("dashboard.upcomingExam");
  if (!examDate) return null;
  const exam = dayjs(examDate).startOf("day");
  const daysLeft = exam.diff(dayjs().startOf("day"), "day");
  if (daysLeft < 0) return null;
  return (
    <Card title={t("title")}>
      <Statistic
        value={exam.format("YYYY-MM-DD")}
        valueStyle={{ fontSize: 20 }}
      />
      <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
        {daysLeft === 0
          ? t("daysLeftToday")
          : t("daysLeft", { days: daysLeft })}
      </Paragraph>
    </Card>
  );
}
