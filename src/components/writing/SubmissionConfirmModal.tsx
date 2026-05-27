"use client";

import { Modal, Typography } from "antd";

const { Paragraph, Text } = Typography;

type Props = {
  open: boolean;
  charCount: number;
  minChars: number;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SubmissionConfirmModal({
  open,
  charCount,
  minChars,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const enough = charCount >= minChars;
  return (
    <Modal
      title="답안을 제출하시겠어요?"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText="제출"
      cancelText="취소"
      okButtonProps={{ disabled: !enough || loading, loading }}
      destroyOnClose
    >
      <Paragraph>
        제출 후에는 답안을 수정할 수 없습니다. 자동으로 분석이 시작됩니다.
      </Paragraph>
      <Paragraph>
        현재 글자 수:{" "}
        <Text strong type={enough ? "success" : "danger"}>
          {charCount} / 최소 {minChars}
        </Text>
      </Paragraph>
    </Modal>
  );
}
