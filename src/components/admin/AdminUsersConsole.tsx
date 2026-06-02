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
import { changeUserRoleAction } from "@/lib/admin/server-actions";
import { ROLE_OPTIONS } from "@/lib/admin/types";
import type { AppRole } from "@/lib/auth/roles";
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

/** One row's outcome after a bulk action settles. */
export type BulkOutcome = {
  id: string;
  name: string;
  ok: boolean;
  /** Failure reason (already trimmed to a friendly length); only set when !ok. */
  reason?: string;
};

export type BulkFailedRow = { id: string; name: string; reason: string };

/**
 * Pure partition of settled bulk outcomes into a success count + a failed-row
 * list (region 6 예외: "일괄 처리 실패/권한 충돌은 실패 행 목록으로 안내").
 * Kept side-effect free so it is unit-testable without rendering antd.
 */
export function summarizeBulkOutcomes(outcomes: BulkOutcome[]): {
  succeeded: number;
  failed: BulkFailedRow[];
} {
  const failed: BulkFailedRow[] = [];
  let succeeded = 0;
  for (const o of outcomes) {
    if (o.ok) {
      succeeded += 1;
    } else {
      failed.push({
        id: o.id,
        name: o.name,
        reason: o.reason && o.reason.trim().length > 0 ? o.reason : "알 수 없는 오류",
      });
    }
  }
  return { succeeded, failed };
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
  const [failedRows, setFailedRows] = useState<BulkFailedRow[]>([]);
  const [roleBulkOpen, setRoleBulkOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState<AppRole>("learner");

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

  // Deleted rows are gated from multi-select (region 4 예외: 차단/비활성 사용자는
  // 액션 제한). active + blocked rows stay selectable so bulk reactivation works.
  const selectableRow = (r: AdminUserDirectoryRow) => r.status !== "deleted";

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

  const rowName = (row: AdminUserDirectoryRow) =>
    row.display_name ?? maskEmail(row.email);

  /**
   * Run one async action per selected row, collecting per-row outcomes, then
   * partition them with the pure helper. The caller's `apply` is responsible
   * for the actual mutation (status via admin-rpc, role via server action).
   * Self-action refusals (admin_set_user_status rejects the caller's own row)
   * surface as a failed-row entry rather than being swallowed.
   */
  async function runBulk(
    rowsToApply: AdminUserDirectoryRow[],
    successVerb: string,
    apply: (row: AdminUserDirectoryRow) => Promise<void>,
  ) {
    if (rowsToApply.length === 0) return;
    setBulkBusy(true);
    setFailedRows([]);
    const outcomes: BulkOutcome[] = [];
    for (const row of rowsToApply) {
      try {
        await apply(row);
        outcomes.push({ id: row.user_id, name: rowName(row), ok: true });
      } catch (err) {
        outcomes.push({
          id: row.user_id,
          name: rowName(row),
          ok: false,
          reason: err instanceof Error ? err.message : undefined,
        });
      }
    }
    const { succeeded, failed } = summarizeBulkOutcomes(outcomes);
    setBulkBusy(false);
    setFailedRows(failed);
    setSelectedKeys([]);
    await refreshAll();
    if (failed.length === 0) {
      message.success(`${succeeded}명 ${successVerb} 완료`);
    } else if (succeeded === 0) {
      message.error(`모두 실패: ${failed.length}건. 아래 목록을 확인하세요.`);
    } else {
      message.warning(
        `${succeeded}명 ${successVerb}, ${failed.length}건 실패. 아래 목록을 확인하세요.`,
      );
    }
  }

  function confirmBulkDeactivate() {
    if (selectedRows.length === 0) return;
    const targets = selectedRows.filter((r) => r.status !== "blocked");
    if (targets.length === 0) {
      message.info("선택한 사용자는 이미 모두 차단 상태예요.");
      return;
    }
    const client = createSupabaseBrowserClient();
    Modal.confirm({
      title: "일괄 비활성화(차단)",
      content: `선택한 ${targets.length}명을 차단할까요? 삭제가 아닌 상태 변경이며 되돌릴 수 있어요. (본인 계정은 차단할 수 없어 실패 목록에 표시될 수 있어요.)`,
      okText: "차단",
      okButtonProps: { danger: true },
      cancelText: "취소",
      onOk: () =>
        runBulk(targets, "차단", (row) =>
          setUserStatus(client, row.user_id, "blocked"),
        ),
    });
  }

  function confirmBulkReactivate() {
    if (selectedRows.length === 0) return;
    const targets = selectedRows.filter((r) => r.status === "blocked");
    if (targets.length === 0) {
      message.info("선택한 사용자 중 차단 상태가 없어요.");
      return;
    }
    const client = createSupabaseBrowserClient();
    Modal.confirm({
      title: "일괄 재활성화",
      content: `선택한 ${targets.length}명의 차단을 해제할까요?`,
      okText: "재활성화",
      cancelText: "취소",
      onOk: () =>
        runBulk(targets, "재활성화", (row) =>
          setUserStatus(client, row.user_id, "active"),
        ),
    });
  }

  function confirmBulkRole() {
    if (selectedRows.length === 0) return;
    // Snapshot the rows + chosen role at confirm time.
    const targets = selectedRows.filter((r) => r.app_role !== bulkRole);
    setRoleBulkOpen(false);
    if (targets.length === 0) {
      message.info(
        `선택한 사용자는 이미 모두 "${ROLE_LABEL[bulkRole] ?? bulkRole}" 권한이에요.`,
      );
      return;
    }
    void runBulk(targets, "권한 변경", (row) =>
      changeUserRoleAction({ targetId: row.user_id, newRole: bulkRole }).then(
        () => undefined,
      ),
    );
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
      title: "기관 소속",
      dataIndex: "org_names",
      key: "org_names",
      width: 160,
      render: (value: string | null) =>
        value && value.trim().length > 0 ? (
          <Tooltip title={value}>
            <span>{ellipsis(value, 24)}</span>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
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
          placeholder="이름, 이메일, 기관명, 사용자 ID (2–60자)"
          allowClear
          status={searchError ? "error" : undefined}
          style={{ width: 340 }}
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
        <Text type="secondary">선택 {selectedRows.length}명</Text>
        <Button
          disabled={selectedRows.length === 0 || bulkBusy}
          loading={bulkBusy}
          onClick={() => {
            setBulkRole(
              (selectedRows[0]?.app_role as AppRole) ?? "learner",
            );
            setRoleBulkOpen(true);
          }}
        >
          권한 변경
        </Button>
        <Button
          danger
          disabled={selectedRows.length === 0}
          loading={bulkBusy}
          onClick={confirmBulkDeactivate}
        >
          선택 비활성화 (차단)
        </Button>
        <Button
          disabled={selectedRows.length === 0}
          loading={bulkBusy}
          onClick={confirmBulkReactivate}
        >
          선택 재활성화
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

      {/* region 6 — bulk role change (위험 액션 → 확인 모달 필수). */}
      <Modal
        title="선택 사용자 권한 일괄 변경"
        open={roleBulkOpen}
        onOk={confirmBulkRole}
        onCancel={() => {
          if (!bulkBusy) setRoleBulkOpen(false);
        }}
        okText="권한 변경"
        cancelText="취소"
        okButtonProps={{ danger: true, loading: bulkBusy }}
        cancelButtonProps={{ disabled: bulkBusy }}
        destroyOnHidden
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Text>
            선택한 <Text strong>{selectedRows.length}명</Text>의 권한을 아래
            역할로 변경할까요? 이미 같은 권한인 사용자는 건너뜁니다.
          </Text>
          <Select<AppRole>
            aria-label="일괄 적용 역할 선택"
            value={bulkRole}
            style={{ width: "100%" }}
            disabled={bulkBusy}
            onChange={setBulkRole}
            options={ROLE_OPTIONS.map((r) => ({
              value: r,
              label: ROLE_LABEL[r] ?? r,
            }))}
          />
          <Text type="secondary">
            본인 또는 보호된 계정 등 변경이 거부되면 실패 목록으로 안내됩니다.
          </Text>
        </Space>
      </Modal>
    </Space>
  );
}
