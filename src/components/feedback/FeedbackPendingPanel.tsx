"use client";

import { Alert, Card, Space, Spin } from "antd";
import { useFeedbackStatus } from "@/lib/writing/queries";

type Props = { submissionId: string };

export function FeedbackPendingPanel({ submissionId }: Props) {
  const q = useFeedbackStatus(submissionId);
  return (
    <Card>
      <Space direction="vertical" align="center" style={{ width: "100%" }}>
        <Spin size="large" />
        <Alert
          type="info"
          message="AI 분석 중"
          description={
            q.data === "analyzing"
              ? "조금만 더 기다려 주세요. 분석이 진행 중입니다."
              : "분석을 시작했습니다. 자동으로 새로고침됩니다."
          }
          showIcon
        />
      </Space>
    </Card>
  );
}
