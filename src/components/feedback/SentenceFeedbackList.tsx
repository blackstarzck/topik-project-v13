"use client";

import { Button, Empty, Tag, Typography } from "antd";
import { ChevronRight, Circle } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  groupSentenceFeedbackRows,
  type SentenceFeedbackGroup,
} from "@/lib/writing/sentence-feedback-grouping";
import type { SentenceFeedbackRow } from "@/lib/writing/types";

const { Text, Title } = Typography;

const INITIAL_VISIBLE = 5;

type Props = {
  rows: SentenceFeedbackRow[];
  onReanalyze?: () => void;
  questionNo: number;
  answerText: string | null;
  answerJson: unknown;
};

type SentenceTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function SentenceFeedbackList({
  rows,
  onReanalyze,
  questionNo,
  answerText,
  answerJson,
}: Props) {
  const t = useTranslations("feedback.sentence") as SentenceTranslator;
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(
    () =>
      groupSentenceFeedbackRows({ rows, questionNo, answerText, answerJson }),
    [rows, questionNo, answerText, answerJson],
  );

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

  // 더보기(초기 5개)는 그룹이 아니라 첨삭 카드 수 기준으로 자른다.
  const totalCards = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const limit = expanded ? totalCards : INITIAL_VISIBLE;
  const { list: visibleGroups, taken: visibleCards } = groups.reduce<{
    taken: number;
    list: SentenceFeedbackGroup[];
  }>(
    (acc, group) => {
      if (acc.taken >= limit) return acc;
      const take = group.rows.slice(0, limit - acc.taken);
      return {
        taken: acc.taken + take.length,
        list: [...acc.list, { ...group, rows: take }],
      };
    },
    { taken: 0, list: [] },
  );
  const hiddenCount = totalCards - visibleCards;

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="feedback-sentence-card"
    >
      <Title level={5} className="m-0">
        {t("cardTitle")}
      </Title>
      <div className="flex flex-col gap-6">
        {visibleGroups.map((group) => (
          <section
            key={group.key}
            data-testid="feedback-sentence-group"
            className="flex flex-col"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-primary">
                <Circle aria-hidden size={10} strokeWidth={2.5} />
              </span>
              <Text
                strong
                className="text-primary"
                data-testid="feedback-sentence-group-label"
              >
                {groupLabel(group, t)}
              </Text>
            </div>
            <div role="list" className="flex flex-col gap-4">
              {group.rows.map((row) => (
                <SentenceCorrectionCard
                  key={row.id}
                  row={row}
                  groupKind={group.kind}
                  onReanalyze={onReanalyze}
                  t={t}
                />
              ))}
            </div>
          </section>
        ))}
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

function groupLabel(
  group: SentenceFeedbackGroup,
  t: SentenceTranslator,
): string {
  switch (group.kind) {
    case "blank":
      return group.blankLabel ?? t("generalLabel");
    case "intro":
      return t("longIntroLabel");
    case "body":
      return t("longBodyLabel");
    case "conclusion":
      return t("longConclusionLabel");
    default:
      return t("generalLabel");
  }
}

function SentenceCorrectionCard({
  row,
  groupKind,
  onReanalyze,
  t,
}: {
  row: SentenceFeedbackRow;
  groupKind: SentenceFeedbackGroup["kind"];
  onReanalyze?: () => void;
  t: SentenceTranslator;
}) {
  const failed = !row.corrected_text && !row.comment;
  // 전체 그룹의 빈 원문 = 특정 문장에 연결되지 않은 문서 수준 조언.
  // "입력된 답안이 없습니다" 같은 오해를 부르는 폴백 대신 전용 문구를 쓴다.
  const documentLevel = groupKind === "general" && !row.original_text?.trim();

  return (
    <div role="listitem">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_minmax(260px,0.95fr)]">
        <section
          className="min-w-0 rounded-md border border-solid border-red-100 bg-red-50/60 p-4"
          data-testid="feedback-sentence-before"
        >
          <Text strong className="block text-red-600">
            {t("beforeTitle")}
          </Text>
          <Text className="mt-3 block whitespace-pre-line break-words">
            {row.original_text?.trim() ||
              t(documentLevel ? "generalBeforeFallback" : "beforeFallback")}
          </Text>
        </section>

        <div className="hidden items-center justify-center text-text-secondary opacity-70 lg:flex">
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
            {row.corrected_text?.trim() ||
              t(documentLevel ? "generalAfterFallback" : "afterFallback")}
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
}
