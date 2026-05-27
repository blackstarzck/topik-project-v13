"use client";

import Link from "next/link";
import { Badge, Button, List, Space, Tag } from "antd";
import type { ProblemRow as ProblemRowData } from "@/lib/practice/types";

type Props = {
  row: ProblemRowData;
  /** Phase 7-D Task 5: parent supplies retry handler when user has prior attempt/submission. */
  onRetryClick?: (problemId: string) => void;
  /** Phase 7-D Task 12: 풀이 상태 — solved일 때 retry 버튼 표시. */
  solveState?: "none" | "attempted" | "submitted";
};

export function ProblemRow({ row, onRetryClick, solveState = "none" }: Props) {
  const disabled = row.publish_status !== "published";
  const hasPriorWork = solveState !== "none";

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
          <Space>
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
          <Space size="small">
            {row.difficulty != null ? (
              <Tag color="blue">난이도 {row.difficulty}</Tag>
            ) : null}
            <Badge
              status={disabled ? "default" : "success"}
              text={disabled ? "비공개" : "공개"}
            />
          </Space>
        }
      />
    </List.Item>
  );
}
