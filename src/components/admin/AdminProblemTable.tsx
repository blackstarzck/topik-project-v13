"use client";

import {
  Alert,
  Button,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useAdminProblems } from "@/lib/admin/queries";
import {
  PUBLISH_STATUS_OPTIONS,
  type AdminProblemFilter,
  type AdminProblemRow,
} from "@/lib/admin/types";
import { AdminProblemPublishToggle } from "./AdminProblemPublishToggle";
import { AdminProblemDetailPanel } from "./AdminProblemDetailPanel";
import { AdminProblemKpiBand } from "./AdminProblemKpiBand";
import { AdminAuditLogDrawer } from "./AdminAuditLogDrawer";
import {
  DOMAIN_LABEL,
  PUBLISH_LABEL,
  REVIEW_LABEL,
  ellipsis,
  formatDate,
} from "./format";

type PublishStatus = AdminProblemRow["publish_status"];
type ReviewStatus = AdminProblemRow["review_status"];
type Domain = AdminProblemRow["domain"];
type ReviewFilter = ReviewStatus | "all";
type SortKey = "updated" | "difficulty";

const REVIEW_STATUS_OPTIONS: ReviewStatus[] = [
  "pending",
  "approved",
  "rejected",
];

type Props = {
  initialRows: AdminProblemRow[];
};

/**
 * H-01 — 문제 관리 콘솔.
 *
 * regions: KPI band (2) · filter+sort (2/3) · table (3) · right detail/edit
 * panel (4) · status bar (5) · audit-log surfacing.
 *
 * Filter+sort run simultaneously (description 제약 "필터와 정렬 동시 사용 가능").
 * Publish-status filter goes server-side via the existing hook; review-status
 * filter + sort are applied client-side over the loaded set (the admin list
 * loads the full visible catalog).
 */
export function AdminProblemTable({ initialRows }: Props) {
  const [filter, setFilter] = useState<AdminProblemFilter>({});
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [selected, setSelected] = useState<AdminProblemRow | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<string | null>(null);

  const query = useAdminProblems(filter);
  const baseRows = query.data ?? initialRows;

  const rows = useMemo(() => {
    let next = baseRows;
    if (reviewFilter !== "all") {
      next = next.filter((r) => r.review_status === reviewFilter);
    }
    const sorted = [...next].sort((a, b) => {
      if (sortKey === "difficulty") {
        return (a.difficulty ?? 99) - (b.difficulty ?? 99);
      }
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
    return sorted;
  }, [baseRows, reviewFilter, sortKey]);

  function openDetail(row: AdminProblemRow) {
    setSelected(row);
    setPanelOpen(true);
  }

  function openAudit(targetId: string | null) {
    setAuditTarget(targetId);
    setAuditOpen(true);
  }

  const columns: ColumnsType<AdminProblemRow> = [
    {
      title: "문제 번호",
      dataIndex: "question_no",
      key: "question_no",
      width: 96,
      render: (value: number | null) =>
        value == null ? <Tag>—</Tag> : <Tag>{value}번</Tag>,
    },
    {
      title: "유형",
      dataIndex: "domain",
      key: "domain",
      width: 84,
      render: (value: Domain) => <Tag>{DOMAIN_LABEL[value]}</Tag>,
    },
    {
      title: "제목",
      dataIndex: "title",
      key: "title",
      render: (value: string, record) => {
        const isConflict =
          record.publish_status !== "published" &&
          record.review_status === "pending";
        return (
          <Space size={4}>
            <Tooltip title={value}>
              <span>{ellipsis(value, 36)}</span>
            </Tooltip>
            {isConflict ? <Tag color="orange">검수 충돌</Tag> : null}
          </Space>
        );
      },
    },
    {
      title: "난이도",
      dataIndex: "difficulty",
      key: "difficulty",
      width: 88,
      render: (value: number | null) =>
        value == null ? "—" : <Tag>{value}★</Tag>,
    },
    {
      title: "공개 여부",
      dataIndex: "publish_status",
      key: "publish_status",
      width: 150,
      render: (_value, record) => <AdminProblemPublishToggle row={record} />,
    },
    {
      title: "검수",
      dataIndex: "review_status",
      key: "review_status",
      width: 104,
      render: (value: ReviewStatus) => {
        const color =
          value === "approved"
            ? "green"
            : value === "rejected"
              ? "red"
              : "gold";
        return <Tag color={color}>{REVIEW_LABEL[value]}</Tag>;
      },
    },
    {
      title: "수정일",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 110,
      render: (value: string) => (
        <span suppressHydrationWarning>{formatDate(value)}</span>
      ),
    },
    {
      title: "작업",
      key: "actions",
      width: 150,
      render: (_value, record) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openDetail(record)}>
            상세/편집
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => openAudit(record.id)}
          >
            이력
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <AdminProblemKpiBand
        rows={baseRows}
        loading={query.isFetching}
        error={Boolean(query.error)}
        onRetry={() => query.refetch()}
      />

      <Space wrap size="middle" style={{ width: "100%" }}>
        <Select<PublishStatus | "all">
          aria-label="공개 상태 필터"
          value={filter.status ?? "all"}
          style={{ width: 150 }}
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
        <Select<ReviewFilter>
          aria-label="검수 상태 필터"
          value={reviewFilter}
          style={{ width: 150 }}
          onChange={setReviewFilter}
          options={[
            { value: "all", label: "검수 상태 전체" },
            ...REVIEW_STATUS_OPTIONS.map((s) => ({
              value: s,
              label: REVIEW_LABEL[s],
            })),
          ]}
        />
        <Select<SortKey>
          aria-label="정렬"
          value={sortKey}
          style={{ width: 150 }}
          onChange={setSortKey}
          options={[
            { value: "updated", label: "최근 수정순" },
            { value: "difficulty", label: "난이도순" },
          ]}
        />
        <Button onClick={() => openAudit(null)}>최근 변경 이력</Button>
      </Space>

      {query.error ? (
        <Alert
          type="error"
          showIcon
          message="문제 목록을 불러오지 못했어요"
          description={
            query.error instanceof Error ? query.error.message : ""
          }
          action={
            <Button size="small" onClick={() => query.refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : null}

      <Table<AdminProblemRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={query.isFetching}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        scroll={{ x: 920 }}
        locale={{
          emptyText: "조건에 맞는 문제가 없어요. 필터를 변경해 보세요.",
        }}
      />

      <AdminProblemDetailPanel
        row={selected}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onDeleted={() => {
          setSelected(null);
          query.refetch();
        }}
      />

      <AdminAuditLogDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        targetId={auditTarget}
        title={auditTarget ? "문제 변경 이력" : "최근 관리자 변경 이력"}
      />
    </Space>
  );
}
