"use client";

import { Card } from "antd";

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

const LABELS: Record<EssayChecklistKey, string> = {
  intro: "서론 — 주제 소개 + 자기 입장",
  body: "본론 — 근거 + 사례",
  conclusion: "결론 — 본인 입장 재정리",
  evidence: "근거 — 통계 / 사례 / 경험",
  connectors: "연결어 — 그러나 / 따라서 / 또한 등",
  topic_fit: "주제 일치 — 출제 의도와 부합",
};

export function EssayChecklist({ status, onChange }: Props) {
  return (
    <Card title="작성 체크리스트">
      {ESSAY_CHECKLIST_KEYS.map((key) => (
        <ChecklistRow
          key={key}
          label={LABELS[key]}
          status={status[key] ?? "unchecked"}
          onChange={(next) => onChange(key, next)}
        />
      ))}
    </Card>
  );
}
