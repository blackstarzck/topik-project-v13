"use client";

import { Table, Typography } from "antd";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

const { Text, Title } = Typography;
const EMPTY_ANSWER = "-";
const SECTION_KEYS = ["intro", "body", "conclusion"] as const;
const SECTION_COLUMN_WIDTH = 112;
const ANSWER_COLUMN_WIDTH = `calc((100% - ${SECTION_COLUMN_WIDTH}px) / 2)`;
const TABLE_HEADING_TEXT_CLASS_NAME =
  "!text-[var(--ant-color-text-description)]";
const TABLE_HEADER_CLASS_NAME = `!font-medium ${TABLE_HEADING_TEXT_CLASS_NAME}`;

type Props = {
  currentText: string;
  previousText: string | null;
  currentAnswerJson?: unknown;
  previousAnswerJson?: unknown;
};

type SectionKey = (typeof SECTION_KEYS)[number];
type AnswerSections = Record<SectionKey, string>;
type SectionTrend = "up" | "down" | null;
type AnswerSectionRow = {
  key: SectionKey;
  section: string;
  current: string;
  previous: string;
  trend: SectionTrend;
};

export function SubmissionDiffPanel({
  currentText,
  previousText,
  currentAnswerJson,
  previousAnswerJson,
}: Props) {
  const t = useTranslations("reports.diff");
  const currentSections = getAnswerSections(currentAnswerJson, currentText);
  const previousSections =
    previousText === null
      ? null
      : getAnswerSections(previousAnswerJson, previousText);
  const rows = SECTION_KEYS.map((key) => ({
    key,
    section: t(sectionLabelKey(key)),
    current: currentSections[key],
    previous:
      previousSections?.[key] ??
      (key === "intro" ? t("noPreviousAnswer") : EMPTY_ANSWER),
    trend: getSectionTrend(currentSections[key], previousSections?.[key]),
  }));

  return (
    <section
      data-testid="comparison-submission-diff"
      className="comparison-diff-panel min-w-0"
    >
      <Title level={5} className="!mb-[40px] !mt-0">
        {t("title")}
      </Title>
      <Table<AnswerSectionRow>
        data-testid="comparison-submission-table"
        className="comparison-submission-table"
        columns={[
          {
            key: "section",
            dataIndex: "section",
            width: SECTION_COLUMN_WIDTH,
            render: (value: string) => (
              <Text className={`font-medium ${TABLE_HEADING_TEXT_CLASS_NAME}`}>
                {value}
              </Text>
            ),
          },
          {
            title: renderTableHeader(t("currentAnswer")),
            key: "current",
            dataIndex: "current",
            width: ANSWER_COLUMN_WIDTH,
            onHeaderCell: () => ({ className: TABLE_HEADER_CLASS_NAME }),
            render: (value: string, row: AnswerSectionRow) =>
              renderCurrentAnswerCell(value, row),
          },
          {
            title: renderTableHeader(t("previousAnswer")),
            key: "previous",
            dataIndex: "previous",
            width: ANSWER_COLUMN_WIDTH,
            onHeaderCell: () => ({ className: TABLE_HEADER_CLASS_NAME }),
            render: renderAnswerCell,
          },
        ]}
        dataSource={rows}
        pagination={false}
        rowKey="key"
        tableLayout="fixed"
      />
    </section>
  );
}

function renderTableHeader(label: string) {
  return (
    <span className={`font-medium ${TABLE_HEADING_TEXT_CLASS_NAME}`}>
      {label}
    </span>
  );
}

function renderCurrentAnswerCell(value: string, row: AnswerSectionRow) {
  return (
    <div className="flex items-start gap-2">
      <TrendIcon trend={row.trend} sectionKey={row.key} />
      {renderAnswerCell(value)}
    </div>
  );
}

function renderAnswerCell(value: string) {
  return (
    <span className="comparison-submission-answer-text block min-w-0 whitespace-pre-wrap break-words">
      {value}
    </span>
  );
}

function TrendIcon({
  trend,
  sectionKey,
}: {
  trend: SectionTrend;
  sectionKey: SectionKey;
}) {
  if (trend === "up") {
    return (
      <TrendingUp
        aria-hidden
        className="mt-0.5 shrink-0 text-primary"
        data-testid={`comparison-submission-trend-up-${sectionKey}`}
        size={16}
        strokeWidth={2}
      />
    );
  }
  if (trend === "down") {
    return (
      <TrendingDown
        aria-hidden
        className="mt-0.5 shrink-0 text-text-secondary"
        data-testid={`comparison-submission-trend-down-${sectionKey}`}
        size={16}
        strokeWidth={2}
      />
    );
  }
  return null;
}

function sectionLabelKey(key: SectionKey) {
  if (key === "intro") return "sectionIntro";
  if (key === "body") return "sectionBody";
  return "sectionConclusion";
}

function getAnswerSections(answerJson: unknown, fallbackText: string) {
  return (
    readSectionsFromJson(answerJson) ?? splitAnswerTextIntoSections(fallbackText)
  );
}

function readSectionsFromJson(value: unknown): AnswerSections | null {
  if (!isRecord(value)) return null;
  const sections = value.sections;
  if (!isRecord(sections)) return null;
  if (
    typeof sections.intro !== "string" ||
    typeof sections.body !== "string" ||
    typeof sections.conclusion !== "string"
  ) {
    return null;
  }

  return {
    intro: normalizeSectionText(sections.intro),
    body: normalizeSectionText(sections.body),
    conclusion: normalizeSectionText(sections.conclusion),
  };
}

function splitAnswerTextIntoSections(value: string): AnswerSections {
  const paragraphs = value
    .split(/\r?\n\s*\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const parts =
    paragraphs.length >= SECTION_KEYS.length
      ? paragraphs
      : value
          .split(/\r?\n/)
          .map((part) => part.trim())
          .filter(Boolean);

  return {
    intro: normalizeSectionText(parts[0] ?? ""),
    body: normalizeSectionText(parts[1] ?? ""),
    conclusion: normalizeSectionText(parts.slice(2).join("\n")),
  };
}

function normalizeSectionText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : EMPTY_ANSWER;
}

function getSectionTrend(
  current: string,
  previous: string | undefined,
): SectionTrend {
  if (previous === undefined) return null;
  const delta = visibleLength(current) - visibleLength(previous);
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return null;
}

function visibleLength(value: string) {
  return value === EMPTY_ANSWER ? 0 : Array.from(value.trim()).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
