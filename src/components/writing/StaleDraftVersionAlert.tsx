"use client";

import { useState } from "react";
import { Alert, Button } from "antd";
import { useTranslations } from "next-intl";
import { replaceStaleWritingDraftAction } from "@/lib/writing/server-actions";

type Props = {
  draftId: string;
  questionId: string;
  importId: string;
  payloadHash: string;
};

export function StaleDraftVersionAlert({
  draftId,
  questionId,
  importId,
  payloadHash,
}: Props) {
  const t = useTranslations("writing.editor");
  const [isReplacing, setIsReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function replaceDraft() {
    setIsReplacing(true);
    setError(null);
    try {
      await replaceStaleWritingDraftAction({
        draftId,
        questionId,
        importId,
        payloadHash,
      });
    } catch {
      setError(t("staleDraftReplaceFailed"));
      setIsReplacing(false);
      return;
    }

    window.location.reload();
  }

  return (
    <Alert
      type="warning"
      showIcon
      title={t("staleDraftTitle")}
      description={error ?? t("staleDraftDescription")}
      action={
        <Button
          type="primary"
          loading={isReplacing}
          onClick={() => void replaceDraft()}
        >
          {t("staleDraftReplaceAction")}
        </Button>
      }
    />
  );
}
