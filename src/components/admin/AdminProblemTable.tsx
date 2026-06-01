"use client";

import { Alert, Select, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useAdminProblems } from "@/lib/admin/queries";
import {
  PUBLISH_STATUS_OPTIONS,
  type AdminProblemFilter,
  type AdminProblemRow,
} from "@/lib/admin/types";
import { AdminProblemPublishToggle } from "./AdminProblemPublishToggle";

type PublishStatus = AdminProblemRow["publish_status"];
type ReviewStatus = AdminProblemRow["review_status"];
type Domain = AdminProblemRow["domain"];

const PUBLISH_LABEL: Record<PublishStatus, string> = {
  draft: "초안",
  published: "공개",
  archived: "보관",
};

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: "검토 대기",
  approved: "승인",
  rejected: "반려",
};

const DOMAIN_LABEL: Record<Domain, string> = {
  reading: "읽기",
  listening: "듣기",
  writing: "쓰기",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR");
  } catch {
    return iso;
  }
}

type Props = {
  initialRows: AdminProblemRow[];
};

export function AdminProblemTable({ initialRows }: Props) {
  const [filter, setFilter] = useState<AdminProblemFilter>({});
  const query = useAdminProblems(filter);
  const rows = query.data ?? initialRows;

  const columns: ColumnsType<AdminProblemRow> = [
    {
      title: "제목",
      dataIndex: "title",
      key: "title",
      render: (value: string) =>
        value.length > 36 ? `${value.slice(0, 36)}…` : value,
    },
    {
      title: "도메인",
      dataIndex: "domain",
      key: "domain",
      width: 100,
      render: (value: Domain) => <Tag>{DOMAIN_LABEL[value]}</Tag>,
    },
    {
      title: "문항 번호",
      dataIndex: "question_no",
      key: "question_no",
      width: 100,
      render: (value: number | null) =>
        value == null ? "—" : <Tag>{value}번</Tag>,
    },
    {
      title: "발행 상태",
      dataIndex: "publish_status",
      key: "publish_status",
      width: 160,
      render: (_value, record) => <AdminProblemPublishToggle row={record} />,
    },
    {
      title: "검토 상태",
      dataIndex: "review_status",
      key: "review_status",
      width: 120,
      render: (value: ReviewStatus) => {
        const color =
          value === "approved"
            ? "green"
            : value === "rejected"
              ? "red"
              : "default";
        return <Tag color={color}>{REVIEW_LABEL[value]}</Tag>;
      },
    },
    {
      title: "수정일",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 120,
      // suppressHydrationWarning: toLocaleDateString('ko-KR') can differ between
      // server and client (locale/timezone) → React #418. Suppress the mismatch.
      render: (value: string) => (
        <span suppressHydrationWarning>{formatDate(value)}</span>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space wrap size="middle">
        <Select<PublishStatus | "all">
          aria-label="공개 상태 필터"
          value={filter.status ?? "all"}
          style={{ width: 160 }}
          onChange={(value) =>
            setFilter((prev) => ({
              ...prev,
              status: value === "all" ? undefined : value,
            }))
          }
          options={[
            { value: "all", label: "공개 상태 전체" },
            ...PUBLISH_STATUS_OPTIONS.map((s) => ({
              value: s,
              label: PUBLISH_LABEL[s],
            })),
          ]}
        />
      </Space>

      {query.error ? (
        <Alert
          type="error"
          message="문제 목록을 불러오지 못했어요"
          description={
            query.error instanceof Error ? query.error.message : ""
          }
        />
      ) : null}

      <Table<AdminProblemRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={query.isFetching}
        pagination={{ pageSize: 20 }}
        size="middle"
        locale={{
          emptyText: "조건에 맞는 문제가 없어요. 필터를 변경해 보세요.",
        }}
      />
    </Space>
  );
}
