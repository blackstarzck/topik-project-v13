"use client";

import { App, Button, Tooltip } from "antd";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  isDuplicateLibrarySaveError,
  useSaveLibraryItem,
} from "@/lib/library/mutations";

type Props = {
  submissionId: string;
  /** 저장 row의 owner. 서버에서 내려온 현재 사용자 id (RLS user_id = auth.uid()). */
  userId: string;
  /** 이미 저장돼 있으면 버튼을 저장됨 상태로 비활성화한다. */
  initiallySaved?: boolean;
  /**
   * 권한 없음(읽기 전용 공유 등)일 때 저장 자체를 잠근다. description region 4
   * 예외: 권한 잠금은 해당 CTA 옆에 상태 표시.
   */
  permissionLocked?: boolean;
};

/** Postgres/PostgREST RLS 거부 코드. */
const RLS_DENIED = new Set(["42501", "PGRST301", "PGRST116"]);

/**
 * E-01/E-02 다음 행동 CTA — 보관함 저장 (description region 4).
 * 예외: 저장 실패/권한 잠금은 해당 CTA 옆에 상태 표시.
 *
 * 중복 클릭 차단(busy/저장됨), 권한 거부와 일반 실패를 구분해 안내한다.
 */
export function SaveToLibraryButton({
  submissionId,
  userId,
  initiallySaved = false,
  permissionLocked = false,
}: Props) {
  const t = useTranslations("feedback.actions.save");
  const { notification } = App.useApp();
  const save = useSaveLibraryItem();
  const [saved, setSaved] = useState(initiallySaved);

  if (permissionLocked) {
    return (
      <Tooltip title={t("lockedTooltip")}>
        <Button disabled>{t("lockedButton")}</Button>
      </Tooltip>
    );
  }

  function onSave() {
    if (saved || save.isPending) return; // 중복 클릭 차단
    save.mutate(
      { item_type: "submission", submission_id: submissionId, user_id: userId },
      {
        onSuccess: () => {
          setSaved(true);
          notification.success({ title: t("saveSuccess") });
        },
        onError: (e: unknown) => {
          if (isDuplicateLibrarySaveError(e)) {
            setSaved(true);
            notification.info({ title: t("saved") });
            return;
          }
          const err = e as { code?: string };
          if (err.code && RLS_DENIED.has(err.code)) {
            notification.error({
              title: t("deniedTitle"),
              description: t("deniedDescription"),
            });
            return;
          }
          notification.error({
            title: t("failedTitle"),
            description: t("failedDescription"),
          });
        },
      },
    );
  }

  return (
    <Button onClick={onSave} loading={save.isPending} disabled={saved}>
      {saved ? t("saved") : t("save")}
    </Button>
  );
}
