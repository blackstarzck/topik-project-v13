"use client";

import { Typography } from "antd";
import styles from "./InteractiveBlankPrompt.module.css";
import { AppCard } from "@/components/shared/AppCard";
import { tokenizeQ51Prompt } from "@/lib/writing/q51-prompt";

const { Title } = Typography;

type InlineBlank = {
  key: string;
  label: string;
  filled?: boolean;
};

type Props = {
  title: string;
  textType?: string | null;
  questionNo: number;
  prompt: string;
  blanks: InlineBlank[];
  activeBlankIndex: number;
  onSelectBlank: (index: number) => void;
};

export function InteractiveBlankPrompt({
  title,
  textType,
  questionNo,
  prompt,
  blanks,
  activeBlankIndex,
  onSelectBlank,
}: Props) {
  const tokens = tokenizeQ51Prompt(prompt);
  const titlePrefix = textType?.trim();
  const displayTitle = titlePrefix ? `${titlePrefix} - ${title}` : title;

  return (
    <AppCard size="small">
      <Title level={5}>{displayTitle}</Title>
      <div
        className="writing-inline-prompt"
        aria-label={`${questionNo}번 문제 지문`}
      >
        {tokens.map((token, index) => {
          if (token.type === "text") {
            return <span key={`text-${index}`}>{token.value}</span>;
          }

          const blankIndex = blanks.findIndex(
            (blank) => blank.label === token.label,
          );
          const blank = blankIndex >= 0 ? blanks[blankIndex] : null;
          const isActive = blankIndex === activeBlankIndex;
          const isFilled = Boolean(blank?.filled);

          return (
            <button
              key={`blank-${token.label}-${index}`}
              type="button"
              className={[
                "writing-inline-blank",
                styles.blank,
                isActive ? "writing-inline-blank--active" : "",
                isActive ? styles.active : "",
                isFilled ? "writing-inline-blank--filled" : "",
                isFilled ? styles.filled : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={`빈칸 ${token.label}`}
              aria-pressed={isActive}
              onClick={() => {
                if (blankIndex >= 0) onSelectBlank(blankIndex);
              }}
            >
              <span className="writing-inline-blank__index">
                {blankIndex >= 0 ? blankIndex + 1 : "?"}
              </span>
              <span>{token.label}</span>
            </button>
          );
        })}
      </div>
    </AppCard>
  );
}
