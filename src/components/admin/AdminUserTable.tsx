"use client";

import { Alert, Button, Empty, Input, Select, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useAdminUsers } from "@/lib/admin/queries";
import {
  ROLE_OPTIONS,
  type AdminUserFilter,
  type AdminUserRow,
} from "@/lib/admin/types";
import type { AppRole } from "@/lib/auth/roles";
import { AdminUserRoleMenu } from "./AdminUserRoleMenu";

const ROLE_LABEL: Record<AppRole, string> = {
  learner: "학습자",
  content_admin: "콘텐츠 관리자",
  org_admin: "기관 관리자",
  platform_admin: "플랫폼 관리자",
};

const STATUS_OPTIONS = ["active", "blocked", "deleted"] as const;
type UserStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_LABEL: Record<UserStatus, string> = {
  active: "활성",
  blocked: "차단",
  deleted: "삭제",
};

type Props = {
  initialRows: AdminUserRow[];
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR");
  } catch {
    return iso;
  }
}

export function AdminUserTable({ initialRows }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState<AdminUserFilter>({});
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [editingRow, setEditingRow] = useState<AdminUserRow | null>(null);

  // Debounce the search input → filter.search.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilter((prev) => {
        const nextSearch = searchInput.trim() || undefined;
        if ((prev.search ?? undefined) === nextSearch) return prev;
        return { ...prev, search: nextSearch };
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const query = useAdminUsers(filter);
  const baseRows = query.data ?? initialRows;

  // Status filter is applied client-side (the data hook only supports
  // search/role server-side; status is a small enum).
  const rows = useMemo(() => {
    if (statusFilter === "all") return baseRows;
    return baseRows.filter((r) => r.status === statusFilter);
  }, [baseRows, statusFilter]);

  const hasActiveFilter =
    searchInput.trim().length > 0 ||
    filter.search != null ||
    filter.role != null ||
    statusFilter !== "all";

  function resetFilters() {
    setSearchInput("");
    setFilter({});
    setStatusFilter("all");
  }

  const columns: ColumnsType<AdminUserRow> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (value: string) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
          {value.slice(0, 8)}…
        </span>
      ),
    },
    {
      title: "이름",
      dataIndex: "display_name",
      key: "display_name",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "닉네임",
      dataIndex: "nickname",
      key: "nickname",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "역할",
      dataIndex: "app_role",
      key: "app_role",
      render: (value: AppRole) => <Tag>{ROLE_LABEL[value]}</Tag>,
    },
    {
      title: "상태",
      dataIndex: "status",
      key: "status",
      render: (value: UserStatus) => {
        const color =
          value === "active"
            ? "green"
            : value === "blocked"
              ? "red"
              : "default";
        return <Tag color={color}>{STATUS_LABEL[value]}</Tag>;
      },
    },
    {
      title: "가입일",
      dataIndex: "created_at",
      key: "created_at",
      // suppressHydrationWarning: toLocaleDateString('ko-KR') can differ between
      // server and client (locale/timezone) → React #418. Suppress the mismatch.
      render: (value: string) => (
        <span suppressHydrationWarning>{formatDate(value)}</span>
      ),
    },
    {
      title: "작업",
      key: "actions",
      render: (_value, record) => (
        <Button size="small" onClick={() => setEditingRow(record)}>
          역할 변경
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space wrap size="middle">
        <Input.Search
          aria-label="사용자 검색"
          placeholder="이름 또는 닉네임"
          allowClear
          style={{ width: 240 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select<AppRole | "all">
          aria-label="역할 필터"
          value={filter.role ?? "all"}
          style={{ width: 180 }}
          onChange={(value) =>
            setFilter((prev) => ({
              ...prev,
              role: value === "all" ? undefined : value,
            }))
          }
          options={[
            { value: "all", label: "역할 전체" },
            ...ROLE_OPTIONS.map((r) => ({
              value: r,
              label: ROLE_LABEL[r],
            })),
          ]}
        />
        <Select<UserStatus | "all">
          aria-label="상태 필터"
          value={statusFilter}
          style={{ width: 140 }}
          onChange={(value) => setStatusFilter(value)}
          options={[
            { value: "all", label: "상태 전체" },
            ...STATUS_OPTIONS.map((s) => ({
              value: s,
              label: STATUS_LABEL[s],
            })),
          ]}
        />
      </Space>

      {query.error ? (
        <Alert
          type="error"
          message="사용자 목록을 불러오지 못했어요"
          description={
            query.error instanceof Error ? query.error.message : ""
          }
        />
      ) : null}

      <Table<AdminUserRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={query.isFetching}
        pagination={{ pageSize: 20 }}
        size="middle"
        locale={{
          emptyText: hasActiveFilter ? (
            <Empty
              description="검색 결과가 없어요."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button size="small" onClick={resetFilters}>
                필터 초기화
              </Button>
            </Empty>
          ) : (
            "표시할 사용자가 없어요."
          ),
        }}
      />

      {editingRow ? (
        <AdminUserRoleMenu
          row={editingRow}
          open={editingRow !== null}
          onClose={() => setEditingRow(null)}
        />
      ) : null}
    </Space>
  );
}
