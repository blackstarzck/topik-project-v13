"use client";

import { Button, Empty, Tag, Typography } from "antd";
import { ChevronRight, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { SentenceFeedbackRow } from "@/lib/writing/types";

const { Text, Title } = Typography;

const INITIAL_VISIBLE = 5;

type Props = {
  rows: SentenceFeedbackRow[];
  onReanalyze?: () => void;
};

export function SentenceFeedbackList({ rows, onReanalyze }: Props) {
  const t = useTranslations("feedback.sentence");
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    return (
      <section
        className="flex flex-col gap-4"
        data-testid="feedback-sentence-card"
      >
        <Title level={5} className="m-0">
          {t("cardTitle")}
        </Title>
        <Empty description={t("emptyDescription")} />
      </section>
    );
  }

  const visible = expanded ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rows.length - visible.length;

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="feedback-sentence-card"
    >
      <Title level={5} className="m-0">
        {t("cardTitle")}
      </Title>
      <div role="list" className="flex flex-col gap-4">
        {visible.map((row, index) => {
          const failed = !row.corrected_text && !row.comment;
          const itemClassName = ["py-4", index === 0 ? "pt-0" : ""]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={row.id} role="listitem" className={itemClassName}>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-primary">
                  <Circle aria-hidden size={10} strokeWidth={2.5} />
                </span>
                <Text strong className="text-primary">
                  {t("blankLabel")}
                </Text>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_minmax(260px,0.95fr)]">
                <section
                  className="min-w-0 rounded-md border border-solid border-red-100 bg-red-50/60 p-4"
                  data-testid="feedback-sentence-before"
                >
                  <Text strong className="block text-red-600">
                    {t("beforeTitle")}
                  </Text>
                  <Text className="mt-3 block whitespace-pre-line break-words">
                    {row.original_text?.trim() || t("beforeFallback")}
                  </Text>
                </section>

                <div className="hidden items-center justify-center text-text-tertiary lg:flex">
                  <ChevronRight aria-hidden size={22} strokeWidth={1.8} />
                </div>

                <section
                  className="min-w-0 rounded-md border border-solid border-emerald-100 bg-emerald-50/60 p-4"
                  data-testid="feedback-sentence-after"
                >
                  <Text strong className="block text-emerald-700">
                    {t("afterTitle")}
                  </Text>
                  <Text className="mt-3 block whitespace-pre-line break-words">
                    {row.corrected_text?.trim() || t("afterFallback")}
                  </Text>
                </section>

                <section
                  className="min-w-0 rounded-md border border-solid border-blue-100 bg-blue-50/50 p-4"
                  data-testid="feedback-sentence-reason"
                >
                  <Text strong className="block text-blue-700">
                    {t("reasonTitle")}
                  </Text>
                  {failed ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Tag>{t("failTag")}</Tag>
                      {onReanalyze ? (
                        <Button
                          size="small"
                          type="link"
                          className="p-0"
                          onClick={onReanalyze}
                        >
                          {t("reanalyze")}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <Text
                      type="secondary"
                      className="mt-3 block whitespace-pre-line break-words"
                    >
                      {row.comment?.trim() || t("reasonFallback")}
                    </Text>
                  )}
                </section>
              </div>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 ? (
        <div className="mt-2 text-center">
          <Button type="link" onClick={() => setExpanded(true)}>
            {t("showMore", { count: hiddenCount })}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
