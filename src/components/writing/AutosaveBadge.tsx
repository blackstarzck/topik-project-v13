"use client";

import { Tag } from "antd";
import type { AutosaveStatus } from "@/lib/writing/types";

type Props = { status: AutosaveStatus; lastSavedAt?: string | null };

const TONE: Record<AutosaveStatus, "default" | "processing" | "warning" | "success" | "error"> = {
  clean: "success",
  dirty: "warning",
  syncing: "processing",
  failed: "error",
  superseded: "default",
};

const LABEL: Record<AutosaveStatus, string> = {
  clean: "저장됨",
  dirty: "저장 대기",
  syncing: "저장 중",
  failed: "저장 실패",
  superseded: "제출됨",
};

export function AutosaveBadge({ status, lastSavedAt }: Props) {
  const tone = TONE[status];
  const label = LABEL[status];
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
