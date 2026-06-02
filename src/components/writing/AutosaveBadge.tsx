"use client";

import { Tag } from "antd";
import { useTranslations } from "next-intl";
import type { AutosaveStatus } from "@/lib/writing/types";

type Props = { status: AutosaveStatus; lastSavedAt?: string | null };

const TONE: Record<AutosaveStatus, "default" | "processing" | "warning" | "success" | "error"> = {
  clean: "success",
  dirty: "warning",
  syncing: "processing",
  failed: "error",
  superseded: "default",
};

// AutosaveStatus → 카탈로그 라벨 키 매핑. next-intl 타입은 동적 문자열을
// 좁히지 못하므로 키 매핑을 명시해 둔다.
const LABEL_KEYS: Record<AutosaveStatus, string> = {
  clean: "statusClean",
  dirty: "statusDirty",
  syncing: "statusSyncing",
  failed: "statusFailed",
  superseded: "statusSuperseded",
};

export function AutosaveBadge({ status, lastSavedAt }: Props) {
  const t = useTranslations("writing.autosave");
  const tone = TONE[status];
  const label = t(LABEL_KEYS[status] as never);
  const stamp = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <Tag color={tone}>
      {label}
      {stamp ? ` · ${stamp}` : ""}
    </Tag>
  );
}
