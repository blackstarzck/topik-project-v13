"use client";

import { Button, Card, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import type { ComparisonMetrics } from "@/lib/writing/comparison-service";
import { MetricsTable } from "./MetricsTable";
import { SubmissionDiffPanel } from "./SubmissionDiffPanel";

const { Paragraph, Text, Title } = Typography;

type Props = {
  metrics: ComparisonMetrics;
  narrative: string | null;
  currentText: string;
  previousText: string | null;
  /** question_no of the current submission, used for the 다시 풀기 CTA. */
  retryHref?: string | null;
};

export function ComparisonReportView({
  metrics,
  narrative,
  currentText,
  previousText,
  retryHref,
}: Props) {
  const router = useRouter();
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <Title level={4} style={{ marginTop: 0 }}>비교 리포트</Title>
        <Paragraph>
          {narrative ?? "비교 분석 요약을 아직 생성하지 못했어요. 아래 지표로 변화를 확인해 주세요."}
        </Paragraph>
        <Text type="secondary" style={{ fontSize: 12 }}>
          요약은 AI가 두 답안을 비교해 자동으로 작성한 안내예요.
        </Text>
      </Card>
      <MetricsTable metrics={metrics} />
      <SubmissionDiffPanel
        currentText={currentText}
        previousText={previousText}
      />
      {/* description region 5 — 다음 CTA (대표 CTA 1개 + 후속 학습 경로). */}
      <Card>
        <Title level={5} style={{ marginTop: 0 }}>다음 학습 이어가기</Title>
        <Space wrap>
          <Button
            type="primary"
            onClick={() => router.push("/practice/weakness")}
          >
            약점 추천 보기
          </Button>
          <Button onClick={() => router.push("/practice/next")}>
            다음 문제
          </Button>
          {retryHref ? (
            <Button onClick={() => router.push(retryHref)}>다시 풀기</Button>
          ) : null}
        </Space>
      </Card>
    </Space>
  );
}
