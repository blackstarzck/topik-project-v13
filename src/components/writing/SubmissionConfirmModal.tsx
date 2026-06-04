"use client";

import { useState } from "react";
import { Alert, Checkbox, Descriptions, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppModal } from "@/components/shared/AppModal";

const { Paragraph, Text } = Typography;

type Props = {
  open: boolean;
  charCount: number;
  minChars: number;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** D-M1 제출 요약 — 문제 유형 표시 (예: 51). */
  questionNo?: number;
  /** D-M1 제출 요약 — 마지막 자동 저장 시각(ISO). */
  lastSavedAt?: string | null;
  /**
   * D-M1 §4 예외 — 제출 실패 원인. 값이 있으면 모달을 유지(닫지 않음)하고
   * 모달 안에서 오류 + 재시도(제출 버튼)를 노출한다.
   */
  submitError?: string | null;
};

export function SubmissionConfirmModal({
  open,
  charCount,
  minChars,
  loading = false,
  onConfirm,
  onCancel,
  questionNo,
  lastSavedAt,
  submitError,
}: Props) {
  const t = useTranslations("writing.submit");
  const tCommon = useTranslations("common");
  const enough = charCount >= minChars;
  // §3 — 동의 체크. destroyOnClose 로 닫힐 때 언마운트되어 다시 열면 false 로 초기화.
  const [agreed, setAgreed] = useState(false);

  const savedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("ko-KR")
    : t("noSaveRecord");

  return (
    <AppModal
      title={t("title")}
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={submitError ? t("okRetry") : t("ok")}
      cancelText={tCommon("cancel")}
      okButtonProps={{ disabled: !enough || !agreed || loading, loading }}
      // §4 — 제출 처리 중에는 배경 클릭/ESC 로 닫히지 않게(중복/오작동 방지).
      maskClosable={!loading}
      keyboard={!loading}
      destroyOnHidden
    >
      {/* §2 제출 요약 — 문제 유형 / 답안 길이 / 저장 시각 (3항목). */}
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
        {questionNo ? (
          <Descriptions.Item label={t("questionTypeLabel")}>
            {t("questionNoValue", { questionNo })}
          </Descriptions.Item>
        ) : null}
        <Descriptions.Item label={t("answerLengthLabel")}>
          <Text strong type={enough ? "success" : "danger"}>
            {t("charCountValue", { charCount })}
          </Text>{" "}
          {t("minCharsHint", { minChars })}
        </Descriptions.Item>
        <Descriptions.Item label={t("lastSavedLabel")}>{savedLabel}</Descriptions.Item>
      </Descriptions>

      <Paragraph>{t("submitNotice")}</Paragraph>

      {!enough ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("notEnoughChars", { minChars })}
        />
      ) : null}

      {/* §4 예외 — 제출 실패 시 모달 유지 + 원인 + 재시도 안내. */}
      {submitError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("submitFailedTitle")}
          description={t("submitFailedDescription", { submitError })}
        />
      ) : null}

      {/* §3 — 동의 체크. 체크 전에는 제출 비활성. */}
      <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)}>
        {t("agreeNoEdit")}
      </Checkbox>
    </AppModal>
  );
}
