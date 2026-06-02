"use client";

import Link from "next/link";
import { Badge, Button, List, Space, Tag, Tooltip, Typography } from "antd";
import type { ProblemRow as ProblemRowData } from "@/lib/practice/types";

const { Text } = Typography;

type Props = {
  row: ProblemRowData;
  /** Phase 7-D Task 5: parent supplies retry handler when user has prior attempt/submission. */
  onRetryClick?: (problemId: string) => void;
  /** Phase 7-D Task 12: 풀이 상태 — solved일 때 retry 버튼 표시. */
  solveState?: "none" | "attempted" | "submitted";
  /** C-02 — 풀이 이력: 시도 횟수(problem_attempts). */
  attemptCount?: number;
  /** C-02 — 풀이 이력: 마지막 시도 시각(ISO). */
  lastAttemptAt?: string | null;
};

function relativeDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function ProblemRow({
  row,
  onRetryClick,
  solveState = "none",
  attemptCount = 0,
  lastAttemptAt,
}: Props) {
  const disabled = row.publish_status !== "published";
  const hasPriorWork = solveState !== "none";
  const lastLabel = relativeDay(lastAttemptAt);

  return (
    <List.Item
      actions={[
        hasPriorWork && onRetryClick ? (
          <Button
            key="retry"
            onClick={() => onRetryClick(row.id)}
            disabled={disabled}
          >
            다시 풀기
          </Button>
        ) : (
          <Link
            key="start"
            href={
              row.question_no
                ? (`/writing/${row.question_no}` as never)
                : "#"
            }
          >
            <Button type="primary" disabled={disabled}>
              시작하기
            </Button>
          </Link>
        ),
      ]}
    >
      <List.Item.Meta
        title={
          <Space wrap>
            {row.question_no ? <Tag>{row.question_no}번</Tag> : null}
            <span>
              {row.title.length > 32
                ? `${row.title.slice(0, 32)}…`
                : row.title}
            </span>
            {solveState === "submitted" ? (
              <Tag color="green">완료</Tag>
            ) : solveState === "attempted" ? (
              <Tag color="orange">진행 중</Tag>
            ) : null}
          </Space>
        }
        description={
          <Space size="small" wrap>
            {row.difficulty != null ? (
              <Tag color="blue">난이도 {row.difficulty}</Tag>
            ) : null}
            <Badge
              status={disabled ? "default" : "success"}
              text={disabled ? "비공개" : "공개"}
            />
            {/* C-02 — 풀이 이력 (problem_attempts.attempt_count + 마지막 시도). */}
            {attemptCount > 0 ? (
              <Tooltip title={lastLabel ? `마지막 시도: ${lastLabel}` : undefined}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  시도 {attemptCount}회{lastLabel ? ` · ${lastLabel}` : ""}
                </Text>
              </Tooltip>
            ) : null}
          </Space>
        }
      />
    </List.Item>
  );
}
