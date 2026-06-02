"use client";

import {
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import type { AdminOrgPerUserRow } from "./admin-rpc";
import { formatDateTime, shortId } from "./format";
import { AdminOrgUserDetailPanel } from "./AdminOrgUserDetailPanel";

const { Title } = Typography;

/**
 * X-08 region 4 — 사용자/과제 테이블.
 *
 * description.md: "학습자별 제출 현황, 점수, 과제 상태, 최근 활동을 표로 표시."
 * 제약: "15개/페이지, 필터 동시 사용, 테이블 가로 스크롤 허용."
 * 예외: "결과 없음/로드 실패는 빈 상태와 재시도 CTA 제공."
 *
 * Data: per_user rows from get_admin_org_dashboard (learner_id / display_name /
 * submission_count / avg_score / last_activity). Search + activity filter run
 * simultaneously and client-side over the loaded rows.
 */

type ActivityFilter = "all" | "active" | "inactive";

type Props = {
  rows: AdminOrgPerUserRow[];
  onRetry: () => void;
};

export function AdminOrgPerUserTable({ rows, onRetry }: Props) {
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [selected, setSelected] = useState<AdminOrgPerUserRow | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim();
    return rows.filter((r) => {
      if (term && !(r.display_name ?? "").includes(term)) return false;
      if (activity === "active" && r.submission_count === 0) return false;
      if (activity === "inactive" && r.submission_count > 0) return false;
      return true;
    });
  }, [rows, search, activity]);

  const hasFilter = search.trim().length > 0 || activity !== "all";

  const columns: ColumnsType<AdminOrgPerUserRow> = [
    {
      title: "학습자",
      dataIndex: "display_name",
      key: "display_name",
      render: (value: string | null, record) => (
        <Space direction="vertical" size={0}>
          <span>{value ?? "이름 없음"}</span>
          <span
            style={{ fontFamily: "monospace", fontSize: 11, color: "#999" }}
          >
            {shortId(record.learner_id)}
          </span>
        </Space>
      ),
    },
    {
      title: "제출 수",
      dataIndex: "submission_count",
      key: "submission_count",
      width: 100,
      sorter: (a, b) => a.submission_count - b.submission_count,
      render: (value: number) => <Tag>{value}건</Tag>,
    },
    {
      title: "평균 점수",
      dataIndex: "avg_score",
      key: "avg_score",
      width: 110,
      sorter: (a, b) => (a.avg_score ?? -1) - (b.avg_score ?? -1),
      render: (value: number | null) =>
        value == null ? "—" : <Tag color="blue">{value}점</Tag>,
    },
    {
      title: "최근 활동",
      dataIndex: "last_activity",
      key: "last_activity",
      width: 190,
      render: (value: string | null) => (
        <span suppressHydrationWarning>{formatDateTime(value)}</span>
      ),
    },
    {
      title: "작업",
      key: "actions",
      width: 100,
      render: (_v, record) => (
        <Button
          size="small"
          type="link"
          onClick={() => {
            setSelected(record);
            setPanelOpen(true);
          }}
        >
          상세
        </Button>
      ),
    },
  ];

  return (
    <Card size="small">
      <Title level={5} style={{ marginTop: 0 }}>
        학습자별 현황
      </Title>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap size="middle">
          <Input.Search
            aria-label="학습자 검색"
            placeholder="이름으로 검색"
            allowClear
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select<ActivityFilter>
            aria-label="활동 필터"
            value={activity}
            style={{ width: 150 }}
            onChange={setActivity}
            options={[
              { value: "all", label: "전체" },
              { value: "active", label: "제출 있음" },
              { value: "inactive", label: "제출 없음" },
            ]}
          />
        </Space>

        <Table<AdminOrgPerUserRow>
          rowKey="learner_id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          size="small"
          scroll={{ x: 700 }}
          locale={{
            emptyText: hasFilter ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="조건에 맞는 학습자가 없어요."
              >
                <Button
                  size="small"
                  onClick={() => {
                    setSearch("");
                    setActivity("all");
                  }}
                >
                  필터 초기화
                </Button>
              </Empty>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="아직 학습자 데이터가 없어요."
              >
                <Button size="small" onClick={onRetry}>
                  다시 불러오기
                </Button>
              </Empty>
            ),
          }}
        />
      </Space>

      <AdminOrgUserDetailPanel
        row={selected}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />
    </Card>
  );
}
