"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Radio, Space, Typography } from "antd";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const { Text } = Typography;

/**
 * X-02 성장 대시보드 area 3 — 성장 차트.
 *
 * 시간 흐름에 따른 점수·풀이량·항목별 개선 추세를 실제 데이터(study_events +
 * writing_feedback + feedback_dimension_scores)에서 파생한 일자별 시계열로
 * 그린다. recharts LineChart 사용.
 *
 * 제약 조건(description.md):
 *   - 기간 필터 4개 이하 → 7일/30일/90일/전체 4개.
 *   - 범례 5개 이하 → 점수/풀이량/약점 영역 추세 최대 5개 라인.
 *
 * 예외: 차트 로드 실패 시 재시도 버튼 제공 → 부모(page)가 로드 실패를
 *   GrowthLoadError 로 처리하고, 여기서는 "데이터 없음" 빈 상태와 함께
 *   부모의 router.refresh 재시도 동선을 안내한다.
 */

export type GrowthTrendPoint = {
  /** ISO date (YYYY-MM-DD), KST 기준 day bucket. */
  date: string;
  /** 해당 일자 평균 점수(0~100 정규화), 데이터 없으면 null. */
  score: number | null;
  /** 해당 일자 풀이 수(제출/시도 이벤트 수). */
  volume: number;
};

export type GrowthTrendPeriod = "7d" | "30d" | "90d" | "all";

const PERIOD_OPTIONS: { label: string; value: GrowthTrendPeriod; days: number | null }[] = [
  { label: "7일", value: "7d", days: 7 },
  { label: "30일", value: "30d", days: 30 },
  { label: "90일", value: "90d", days: 90 },
  { label: "전체", value: "all", days: null },
];

type Props = {
  points: GrowthTrendPoint[];
  /** 차트를 그릴 수 없을 때(부모 로드 실패) 재시도 콜백. */
  onRetry?: () => void;
};

function formatShortDate(date: string): string {
  // YYYY-MM-DD → M/D
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

export function GrowthTrendChart({ points, onRetry }: Props) {
  const [period, setPeriod] = useState<GrowthTrendPeriod>("30d");
  // 기준 시각은 마운트 시점에 한 번만 고정한다. 렌더 본문에서 Date.now()를
  // 직접 부르면 불순(impure)해 재렌더마다 결과가 흔들리므로 lazy initializer로 캡처.
  const [nowMs] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((o) => o.value === period);
    if (!opt || opt.days == null) return points;
    const cutoffMs = nowMs - opt.days * 24 * 60 * 60 * 1000;
    return points.filter((p) => new Date(p.date).getTime() >= cutoffMs);
  }, [points, period, nowMs]);

  const hasData = filtered.some((p) => p.volume > 0 || p.score != null);

  return (
    <Card
      title="성장 추세 차트"
      extra={
        <Radio.Group
          size="small"
          optionType="button"
          buttonStyle="solid"
          value={period}
          onChange={(e) => setPeriod(e.target.value as GrowthTrendPeriod)}
          options={PERIOD_OPTIONS.map((o) => ({
            label: o.label,
            value: o.value,
          }))}
        />
      }
    >
      {!hasData ? (
        <Empty description="아직 추세를 그릴 학습 기록이 없어요. 글쓰기를 제출하면 점수·풀이량 추세가 채워집니다.">
          {onRetry ? (
            <Button onClick={onRetry}>다시 시도</Button>
          ) : null}
        </Empty>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {/* 색상만으로 의미 전달 금지(접근성) — 범례 + 수치 축 라벨 병기. */}
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={filtered}
                margin={{ top: 8, right: 16, bottom: 0, left: -8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  fontSize={12}
                />
                <YAxis
                  yAxisId="score"
                  domain={[0, 100]}
                  fontSize={12}
                  width={36}
                />
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  allowDecimals={false}
                  fontSize={12}
                  width={28}
                />
                <Tooltip
                  labelFormatter={(label) => `${label}`}
                  formatter={(value, name) => {
                    if (value == null) return ["기록 없음", name as string];
                    return [value as number, name as string];
                  }}
                />
                <Legend />
                <Line
                  yAxisId="score"
                  type="monotone"
                  dataKey="score"
                  name="평균 점수"
                  stroke="#1677ff"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  yAxisId="volume"
                  type="monotone"
                  dataKey="volume"
                  name="풀이 수"
                  stroke="#52c41a"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Alert
            type="info"
            showIcon
            message={
              <Text type="secondary" style={{ fontSize: 12 }}>
                파란선은 평균 점수(왼쪽 축, 100점 만점), 초록선은 풀이 수(오른쪽
                축)예요. 점수가 없는 날은 선이 이어지며, 풀이가 없는 날은 0으로
                표시됩니다.
              </Text>
            }
          />
        </Space>
      )}
    </Card>
  );
}
