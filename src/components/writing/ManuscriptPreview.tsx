"use client";

import { Typography } from "antd";

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
    <div aria-label="원고지 미리보기">
      <Title level={5}>원고지 미리보기</Title>
      <Text type="secondary">한 줄 {charsPerLine}자 기준</Text>
      <div
        style={{
          marginTop: 8,
          display: "grid",
          gap: 2,
          fontFamily: "monospace",
        }}
      >
        {lines.map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${charsPerLine}, 1fr)`,
              gap: 2,
            }}
          >
            {Array.from({ length: charsPerLine }).map((_, colIdx) => (
              <div
                key={colIdx}
                style={{
                  border: "1px solid #d9d9d9",
                  textAlign: "center",
                  padding: "2px 0",
                  minHeight: 24,
                }}
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
