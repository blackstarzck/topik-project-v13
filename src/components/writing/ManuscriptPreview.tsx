"use client";

import { Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text, Title } = Typography;

type Props = {
  text: string;
  /** TOPIK 원고지 standard: 20 chars per line. */
  charsPerLine?: 20;
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

  return (
    <div aria-label={t("manuscriptTitle")}>
      <Title level={5}>{t("manuscriptTitle")}</Title>
      <Text type="secondary">{t("manuscriptPerLine", { charsPerLine })}</Text>
      <div className="mt-2 grid gap-0.5 font-mono">
        {lines.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="grid grid-cols-[repeat(20,1fr)] gap-0.5"
          >
            {Array.from({ length: charsPerLine }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="min-h-6 border border-[#d9d9d9] py-0.5 text-center"
              >
                {row[colIdx] ?? ""}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
