"use client";

import { Typography } from "antd";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

const { Text, Title } = Typography;

type Props = {
  text: string;
  /** TOPIK 원고지 standard: 20 chars per line. */
  charsPerLine?: number;
};

/**
 * Renders text as a TOPIK 원고지 (manuscript) grid — 20 chars per line by
 * default, with each cell visible. Read-only preview; editing happens in the
 * upstream sections.
 */
export function ManuscriptPreview({ text, charsPerLine = 20 }: Props) {
  const t = useTranslations("writing.editor");
  const lines: string[][] = [];
  const chars = Array.from(text); // grapheme-safe enough for KO
  for (let i = 0; i < chars.length; i += charsPerLine) {
    lines.push(chars.slice(i, i + charsPerLine));
  }
  // Always show at least 5 lines for visual structure.
  while (lines.length < 5) {
    lines.push([]);
  }
  const gridStyle = {
    "--writing-manuscript-columns": charsPerLine,
  } as CSSProperties;

  return (
    <div
      className="writing-manuscript"
      style={gridStyle}
      aria-label={t("manuscriptTitle")}
    >
      <Title level={5}>{t("manuscriptTitle")}</Title>
      <Text type="secondary">{t("manuscriptPerLine", { charsPerLine })}</Text>
      <div className="writing-manuscript__grid">
        {lines.map((row, rowIdx) => (
          <div className="writing-manuscript__row" key={rowIdx}>
            {Array.from({ length: charsPerLine }).map((_, colIdx) => (
              <div className="writing-manuscript__cell" key={colIdx}>
                {row[colIdx] ?? ""}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
