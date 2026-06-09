"use client";

import { useSyncExternalStore } from "react";
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

function formatSavedTime(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function subscribeHydrationStore() {
  return () => undefined;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function AutosaveBadge({ status, lastSavedAt }: Props) {
  const t = useTranslations("writing.autosave");
  const isClient = useSyncExternalStore(
    subscribeHydrationStore,
    getClientSnapshot,
    getServerSnapshot,
  );
  const tone = TONE[status];
  const label = t(LABEL_KEYS[status] as never);
  const stamp = isClient && lastSavedAt ? formatSavedTime(lastSavedAt) : null;

  return (
    <Tag color={tone}>
      {label}
      {stamp ? ` · ${stamp}` : ""}
    </Tag>
  );
}
