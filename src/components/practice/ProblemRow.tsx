"use client";

import Link from "next/link";
import { Badge, Button, List, Space, Tag } from "antd";
import type { ProblemRow as ProblemRowData } from "@/lib/practice/types";

type Props = {
  row: ProblemRowData;
};

export function ProblemRow({ row }: Props) {
  const disabled = row.publish_status !== "published";
  return (
    <List.Item
      actions={[
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
        </Link>,
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
