"use client";

import { Card, Col, Empty, Row, Statistic, Typography } from "antd";

const { Text } = Typography;

type Props = {
  /** 현재 총점. null이면 점수 산출 실패. */
  currentScore: number | null;
  /** 개선 폭(현재-이전). null이면 이전 데이터 없음. */
  scoreDelta: number | null;
  /** 변화한 항목 수(상승/하락 합). */
  changedDimensions: number;
  /** 비교 데이터가 부족하면 단일 결과 요약으로 대체(description region 1 예외). */
  hasPrevious: boolean;
};

/**
 * R-01 비교 KPI (description region 1).
 * 제약: KPI 라벨 1줄, 비교 대상 2개 기본.
 * 예외: 비교 데이터 부족 시 단일 결과 요약으로 대체.
 */
export function ComparisonKpiBlock({
  currentScore,
  scoreDelta,
  changedDimensions,
  hasPrevious,
}: Props) {
  if (currentScore === null) {
    return (
      <Card>
        <Empty description="이번 답안의 점수를 산출하지 못해 KPI를 계산할 수 없어요." />
      </Card>
    );
  }

  const deltaColor =
    scoreDelta === null
      ? undefined
      : scoreDelta > 0
        ? "#3f8600"
        : scoreDelta < 0
          ? "#cf1322"
          : undefined;

  return (
    <Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Statistic title="현재 총점" value={currentScore} suffix="점" />
        </Col>
        <Col xs={24} md={8}>
          {hasPrevious && scoreDelta !== null ? (
            <Statistic
              title="개선 폭"
              value={Math.abs(scoreDelta)}
              precision={1}
              valueStyle={{ color: deltaColor }}
              prefix={
                <span aria-hidden>
                  {scoreDelta > 0 ? "▲" : scoreDelta < 0 ? "▼" : "—"}
                </span>
              }
              suffix="점"
            />
          ) : (
            <Statistic
              title="개선 폭"
              value="—"
              formatter={() => (
                <Text type="secondary" style={{ fontSize: 16 }}>
                  비교 대상 없음
                </Text>
              )}
            />
          )}
        </Col>
        <Col xs={24} md={8}>
          <Statistic
            title="변화한 항목"
            value={hasPrevious ? changedDimensions : 0}
            suffix={hasPrevious ? "개" : ""}
            formatter={
              hasPrevious
                ? undefined
                : () => (
                    <Text type="secondary" style={{ fontSize: 16 }}>
                      단일 결과
                    </Text>
                  )
            }
          />
        </Col>
      </Row>
    </Card>
  );
}
