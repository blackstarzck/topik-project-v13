"use client";

import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";

import {
  ESSAY_CHECKLIST_KEYS,
  type ChecklistItemStatus,
  type EssayChecklistKey,
} from "@/lib/writing/types";
import { ChecklistRow } from "./ChecklistRow";

type Props = {
  status: Record<EssayChecklistKey, ChecklistItemStatus>;
  onChange: (key: EssayChecklistKey, next: ChecklistItemStatus) => void;
};

// EssayChecklistKey → 카탈로그 라벨 키 매핑. next-intl 타입은 동적 문자열을
// 좁히지 못하므로 키 매핑을 명시해 둔다.
const LABEL_KEYS: Record<EssayChecklistKey, string> = {
  intro: "labelIntro",
  body: "labelBody",
  conclusion: "labelConclusion",
  evidence: "labelEvidence",
  connectors: "labelConnectors",
  topic_fit: "labelTopicFit",
};

export function EssayChecklist({ status, onChange }: Props) {
  const t = useTranslations("writing.checklist");
  return (
    <AppCard title={t("cardTitle")}>
      {ESSAY_CHECKLIST_KEYS.map((key) => (
        <ChecklistRow
          key={key}
          label={t(LABEL_KEYS[key] as never)}
          status={status[key] ?? "unchecked"}
          onChange={(next) => onChange(key, next)}
        />
      ))}
    </AppCard>
  );
}
