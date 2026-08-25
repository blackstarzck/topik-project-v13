"use client";

import { Typography } from "antd";
import { useTranslations } from "next-intl";
import styles from "./ManuscriptPreview.module.css";

const { Text, Title } = Typography;
const MIN_VISIBLE_LINES = 20;

export type ManuscriptSectionKey = "intro" | "body" | "conclusion";

type ManuscriptCell = {
  char: string;
  section?: ManuscriptSectionKey | null;
};

type Props = {
  text: string;
  /** TOPIK 원고지 standard: 20 chars per line. */
  charsPerLine?: 20;
  showHeader?: boolean;
  cellSections?: Array<ManuscriptSectionKey | null | undefined>;
  activeSection?: ManuscriptSectionKey | null;
  sectionLabels?: Partial<Record<ManuscriptSectionKey, string>>;
};

/**
 * Renders text as a TOPIK 원고지 (manuscript) grid — 20 chars per line by
 * default, with each cell visible. Read-only preview; editing happens in the
 * upstream sections.
 */
export function ManuscriptPreview({
  text,
  charsPerLine = 20,
  showHeader = true,
  cellSections,
  activeSection = null,
  sectionLabels,
}: Props) {
  const t = useTranslations("writing.editor");
  const lines: ManuscriptCell[][] = [];
  const chars = Array.from(text); // grapheme-safe enough for KO
  const cells = chars.map((char, index) => ({
    char,
    section: cellSections?.[index] ?? null,
  }));
  for (let i = 0; i < cells.length; i += charsPerLine) {
    lines.push(cells.slice(i, i + charsPerLine));
  }
  // Keep enough manuscript rows visible for the expanded preview surface.
  while (lines.length < MIN_VISIBLE_LINES) {
    lines.push([]);
  }

  return (
    <div
      aria-label={t("manuscriptTitle")}
      className={[
        "writing-manuscript-preview",
        styles.preview,
        !showHeader ? "writing-manuscript-preview--compact" : "",
        !showHeader ? styles.compact : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="manuscript-preview"
    >
      {showHeader ? (
        <>
          <Title
            level={5}
            className={[
              "writing-manuscript-preview__title",
              styles.title,
            ].join(" ")}
          >
            {t("manuscriptTitle")}
          </Title>
          <Text
            type="secondary"
            className={["writing-manuscript-preview__meta", styles.meta].join(
              " ",
            )}
          >
            {t("manuscriptPerLine", { charsPerLine })}
          </Text>
        </>
      ) : null}
      <div
        className="writing-manuscript-preview__grid"
        data-testid="manuscript-preview-grid"
      >
        {lines.map((row, rowIdx) => (
          <div key={rowIdx} className="writing-manuscript-preview__row">
            {Array.from({ length: charsPerLine }).map((_, colIdx) => {
              const cell = row[colIdx];
              const highlighted = Boolean(
                activeSection && cell?.section === activeSection,
              );
              const sectionClass = cell?.section
                ? `writing-manuscript-preview__cell--${cell.section}`
                : "";
              const sectionLabel = cell?.section
                ? (sectionLabels?.[cell.section] ?? cell.section)
                : null;

              return (
                <div
                  key={colIdx}
                  aria-label={
                    cell?.char && sectionLabel
                      ? `${sectionLabel} ${cell.char}`
                      : undefined
                  }
                  className={[
                    "writing-manuscript-preview__cell",
                    sectionClass,
                    highlighted
                      ? "writing-manuscript-preview__cell--highlighted"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-highlighted={highlighted ? "true" : "false"}
                  data-section={cell?.section ?? undefined}
                  data-testid="manuscript-preview-cell"
                >
                  {cell?.char ?? ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
