"use client";

import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  List,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType, TableRowSelection } from "antd/es/table/interface";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  USER_SORT_OPTIONS,
  fetchAdminUserDirectory,
  setUserStatus,
  type AdminUserDirectoryRow,
  type UserSort,
} from "./admin-rpc";
import { AdminUserKpiBand } from "./AdminUserKpiBand";
import { AdminUserDetailPanel } from "./AdminUserDetailPanel";
import { AdminUserRoleModal } from "./AdminUserRoleModal";
import { AdminAuditLogDrawer } from "./AdminAuditLogDrawer";
import {
  ROLE_LABEL,
  USER_STATUS_LABEL,
  ellipsis,
  formatDate,
  formatDateTime,
  maskEmail,
} from "./format";

const { Text } = Typography;
const PAGE_SIZE = 20;
const SORT_LABEL: Record<UserSort, string> = {
  activity: "활동순",
  created: "가입순",
  name: "이름순",
};

/**
 * X-10 — 관리자 사용자 관리 콘솔.
 *
 * regions: KPI band (2) · search/sort (3) · table (4) · detail panel (5) ·
 * bulk/status actions (6) · audit log.
 *
 * Data: get_admin_users(search, sort, page, page_size) — server-side pagination
 * via the window total_count. KPI band uses get_admin_user_stats. Status changes
 * use admin_set_user_status; role changes reuse admin_change_user_role. Bulk
 * deactivate runs sequentially and reports a failed-row list (region 6 예외).
 */

const SEARCH_MIN = 2;
const SEARCH_MAX = 60;

function userDirectoryKey(params: {
  search: string;
  sort: UserSort;
  page: number;
}) {
  return ["admin-users", "directory", params] as const;
}

export function AdminUsersConsole() {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<UserSort>("activity");
  const [page, setPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const [detailRow, setDetailRow] = useState<AdminUserDirectoryRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [roleRow, setRoleRow] = useState<AdminUserDirectoryRow | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const [searchError, setSearchError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [failedRows, setFailedRows] = useState<
    { id: string; name: string; reason: string }[]
  >([]);

  // Debounce search → server filter, with 2–60 char validation (region 3).
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed.length === 0) {
        setSearchError(null);
        setSearch("");
        setPage(1);
        return;
      }
      if (trimmed.length < SEARCH_MIN || trimmed.length > SEARCH_MAX) {
        setSearchError(`검색어는 ${SEARCH_MIN}–${SEARCH_MAX}자로 입력해 주세요.`);
        return;
      }
      setSearchError(null);
      setSearch(trimmed);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const query = useQuery<AdminUserDirectoryRow[], Error>({
    queryKey: userDirectoryKey({ search, sort, page }),
    queryFn: () =>
      fetchAdminUserDirectory(createSupabaseBrowserClient(), {
        search: search || null,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  // total_count is a bigint window function; supabase-js may hand it back as a
  // string. Coerce so pagination math + the result count render correctly.
  const total = Number(rows[0]?.total_count ?? 0);
  const hasSearch = search.length > 0;

  // blocked/deleted rows are gated from multi-select (region 4 예외).
  const selectableRow = (r: AdminUserDirectoryRow) => r.status === "active";

  const rowSelection: TableRowSelection<AdminUserDirectoryRow> = {
    selectedRowKeys: selectedKeys,
    onChange: (keys) => setSelectedKeys(keys as string[]),
    getCheckboxProps: (record) => ({
      disabled: !selectableRow(record),
      name: record.user_id,
    }),
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedKeys.includes(r.user_id)),
    [rows, selectedKeys],
  );

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setSort("activity");
    setPage(1);
    setSearchError(null);
  }

  function openDetail(row: AdminUserDirectoryRow) {
    setDetailRow(row);
    setDetailOpen(true);
  }

  function openRole(row: AdminUserDirectoryRow) {
    setRoleRow(row);
    setRoleOpen(true);
  }

  async function refreshAll() {
    await qc.invalidateQueries({ queryKey: ["admin-users"] });
    await qc.invalidateQueries({ queryKey: ["admin-user-stats"] });
    await query.refetch();
  }

  function confirmBulkDeactivate() {
    if (selectedRows.length === 0) return;
    Modal.confirm({
      title: "일괄 비활성화(차단)",
      content: `선택한 ${selectedRows.length}명을 차단할까요? 삭제가 아닌 상태 변경이며 되돌릴 수 있어요.`,
      okText: "차단",
      okButtonProps: { danger: true },
      cancelText: "취소",
      onOk: async () => {
        setBulkBusy(true);
        setFailedRows([]);
        const failures: { id: string; name: string; reason: string }[] = [];
        const client = createSupabaseBrowserClient();
        for (const row of selectedRows) {
          try {
            await setUserStatus(client, row.user_id, "blocked");
          } catch (err) {
            failures.push({
              id: row.user_id,
              name: row.display_name ?? maskEmail(row.email),
              reason: err instanceof Error ? err.message : "알 수 없는 오류",
            });
          }
        }
        setBulkBusy(false);
        setFailedRows(failures);
        setSelectedKeys([]);
        await refreshAll();
        if (failures.length === 0) {
          message.success(`${selectedRows.length}명을 차단했어요.`);
        } else {
          message.warning(
            `일부 실패: ${failures.length}건. 아래 목록을 확인하세요.`,
          );
        }
      },
    });
  }

  const columns: ColumnsType<AdminUserDirectoryRow> = [
    {
      title: "사용자명",
      dataIndex: "display_name",
      key: "display_name",
      render: (value: string | null, record) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(record)}>
          {value ?? "이름 없음"}
        </Button>
      ),
    },
    {
      title: "이메일",
      dataIndex: "email",
      key: "email",
      render: (value: string | null) => (
        <Tooltip title="개인정보 보호를 위해 일부 마스킹됩니다.">
          <span>{ellipsis(maskEmail(value), 30)}</span>
        </Tooltip>
      ),
    },
    {
      title: "상태",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (value: string) => {
        const color =
          value === "active" ? "green" : value === "blocked" ? "red" : "default";
        return <Tag color={color}>{USER_STATUS_LABEL[value] ?? value}</Tag>;
      },
    },
    {
      title: "권한",
      dataIndex: "app_role",
      key: "app_role",
      width: 130,
      render: (value: string) => <Tag>{ROLE_LABEL[value] ?? value}</Tag>,
    },
    {
      title: "최근 활동",
      dataIndex: "last_activity",
      key: "last_activity",
      width: 170,
      render: (value: string | null) => (
        <span suppressHydrationWarning>{formatDateTime(value)}</span>
      ),
    },
    {
      title: "로그인",
      dataIndex: "last_sign_in_at",
      key: "last_sign_in_at",
      width: 110,
      render: (value: string | null) => (
        <span suppressHydrationWarning>{formatDate(value)}</span>
      ),
    },
    {
      title: "제출 수",
      dataIndex: "submission_count",
      key: "submission_count",
      width: 90,
      render: (value: number) => <Tag>{value}건</Tag>,
    },
    {
      title: "작업",
      key: "actions",
      width: 100,
      render: (_v, record) => (
        <Button size="small" type="link" onClick={() => openDetail(record)}>
          상세
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <AdminUserKpiBand />

      <Space wrap size="middle" style={{ width: "100%" }}>
        <Input.Search
          aria-label="사용자 검색"
          placeholder="이름 또는 이메일 (2–60자)"
          allowClear
          status={searchError ? "error" : undefined}
          style={{ width: 280 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select<UserSort>
          aria-label="정렬"
          value={sort}
          style={{ width: 140 }}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
          options={USER_SORT_OPTIONS.map((s) => ({
            value: s,
            label: SORT_LABEL[s],
          }))}
        />
        <Button onClick={() => setAuditOpen(true)}>변경 이력</Button>
        <Text type="secondary">결과 {total.toLocaleString()}명</Text>
      </Space>

      {searchError ? (
        <Alert type="warning" showIcon message={searchError} />
      ) : null}

      {query.error ? (
        <Alert
          type="error"
          showIcon
          message="사용자 목록을 불러오지 못했어요"
          description={query.error.message}
          action={
            <Button size="small" onClick={() => query.refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : null}

      {/* region 6 — bulk/status actions. */}
      <Space wrap>
        <Button
          danger
          disabled={selectedRows.length === 0}
          loading={bulkBusy}
          onClick={confirmBulkDeactivate}
        >
          선택 비활성화 ({selectedRows.length})
        </Button>
        <Tooltip title="알림 발송(이메일/푸시)은 발송 인프라 연동 예정입니다.">
          <Button disabled>
            알림 발송 <Tag color="default">연동 예정</Tag>
          </Button>
        </Tooltip>
        <Tooltip title="사용자 목록 내보내기(CSV)는 내보내기 파이프라인 연동 예정입니다.">
          <Button disabled>
            내보내기 <Tag color="default">연동 예정</Tag>
          </Button>
        </Tooltip>
      </Space>

      {failedRows.length > 0 ? (
        <Alert
          type="error"
          showIcon
          message={`일괄 처리 실패 ${failedRows.length}건`}
          closable
          onClose={() => setFailedRows([])}
          description={
            <List
              size="small"
              dataSource={failedRows}
              renderItem={(f) => (
                <List.Item>
                  <Text>
                    {f.name}: {f.reason}
                  </Text>
                </List.Item>
              )}
            />
          }
        />
      ) : null}

      <Table<AdminUserDirectoryRow>
        rowKey="user_id"
        rowSelection={rowSelection}
        columns={columns}
        dataSource={rows}
        loading={query.isFetching}
        size="middle"
        scroll={{ x: 1000 }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: hasSearch ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="검색 결과가 없어요."
            >
              <Button size="small" onClick={resetFilters}>
                필터 초기화 · 전체 목록
              </Button>
            </Empty>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="표시할 사용자가 없어요."
            >
              <Button size="small" onClick={() => query.refetch()}>
                다시 시도
              </Button>
            </Empty>
          ),
        }}
      />

      <AdminUserDetailPanel
        row={detailRow}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onChangeRole={(r) => {
          setDetailOpen(false);
          openRole(r);
        }}
        onChanged={refreshAll}
      />

      <AdminUserRoleModal
        row={roleRow}
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        onChanged={refreshAll}
      />

      <AdminAuditLogDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        title="관리자 변경 이력"
      />
    </Space>
  );
}
