"use client";

import dayjs from "dayjs";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";

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
    <AppCard title={t("title")}>
      <div className="grid gap-2">
        <strong className="text-xl font-semibold text-text">
          {exam.format("YYYY-MM-DD")}
        </strong>
        <p className="m-0 text-sm text-text-secondary">
          {daysLeft === 0
            ? t("daysLeftToday")
            : t("daysLeft", { days: daysLeft })}
        </p>
      </div>
    </AppCard>
  );
}
