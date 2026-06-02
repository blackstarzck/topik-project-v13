"use client";

import {
  Alert,
  App,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  createOrganization,
  fetchOrganizations,
  fetchOrgAssignments,
  type AdminAssignmentRow,
  type AdminOrganizationRow,
} from "./admin-rpc";
import { createAssignmentAction } from "@/app/(workspace)/admin/actions";
import { formatDate } from "./format";

const { Text, Paragraph } = Typography;

/**
 * X-08 region 3 — 과제 생성.
 *
 * Real wiring: reads `organizations` the admin can see + lists existing
 * `assignments`, and creates a new assignment row via createAssignmentAction
 * (assignments table).
 *
 * ORG BOOTSTRAP: a brand-new tenant has no org, and org RLS blocks inserting
 * the first one. The SECURITY DEFINER `create_organization` RPC (migration
 * 20260602120500) creates the org + the caller's owner membership atomically.
 * When the admin belongs to no org we show a minimal inline "기관 만들기" step so
 * an org can be bootstrapped; on failure the reason is shown inside the modal
 * (region 3 예외: "권한 없음/일괄 처리 실패는 카드 내부에 사유 표시"). No fake success.
 */

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AdminOrgAssignmentModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  const orgsQuery = useQuery<AdminOrganizationRow[], Error>({
    queryKey: ["admin-org-organizations"],
    queryFn: () => fetchOrganizations(createSupabaseBrowserClient()),
    enabled: open,
  });

  const assignmentsQuery = useQuery<AdminAssignmentRow[], Error>({
    queryKey: ["admin-org-assignments"],
    queryFn: () => fetchOrgAssignments(createSupabaseBrowserClient()),
    enabled: open,
  });

  const orgs = orgsQuery.data ?? [];
  const noOrg = !orgsQuery.isLoading && orgs.length === 0;

  async function handleCreateOrg() {
    if (!orgName.trim()) {
      setError("기관 이름을 입력해 주세요.");
      return;
    }
    setError(null);
    setCreatingOrg(true);
    try {
      const newOrgId = await createOrganization(
        createSupabaseBrowserClient(),
        orgName.trim(),
      );
      message.success("기관을 만들었어요.");
      setOrgName("");
      // Refetch organizations and preselect the newly created org so the admin
      // can immediately create an assignment for it.
      await qc.invalidateQueries({ queryKey: ["admin-org-organizations"] });
      if (newOrgId) setOrgId(newOrgId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "기관 생성에 실패했어요.",
      );
    } finally {
      setCreatingOrg(false);
    }
  }

  async function handleCreate() {
    if (!orgId) {
      setError("기관을 선택해 주세요.");
      return;
    }
    if (!title.trim()) {
      setError("과제 제목을 입력해 주세요.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createAssignmentAction({ orgId, title: title.trim(), dueAt });
      message.success("과제를 생성했어요.");
      setTitle("");
      setDueAt(null);
      await qc.invalidateQueries({ queryKey: ["admin-org-assignments"] });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "과제 생성에 실패했어요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="과제 생성"
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {error ? (
          <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />
        ) : null}

        {orgsQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: "1rem" }}>
            <Spin />
          </div>
        ) : noOrg ? (
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Alert
              type="info"
              showIcon
              message="소속된 기관이 없어요"
              description="과제를 만들려면 먼저 기관이 있어야 합니다. 아래에서 기관을 만들면 바로 과제를 만들 수 있어요."
            />
            <Form layout="vertical">
              <Form.Item label="기관 이름" required style={{ marginBottom: 12 }}>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="예: 한국어교육원 1반"
                  onPressEnter={() => void handleCreateOrg()}
                />
              </Form.Item>
              <Button
                type="primary"
                loading={creatingOrg}
                onClick={() => void handleCreateOrg()}
              >
                기관 만들기
              </Button>
            </Form>
          </Space>
        ) : (
          <Form layout="vertical">
            <Form.Item label="기관" required>
              <Select<string>
                placeholder="기관 선택"
                value={orgId ?? undefined}
                onChange={(v) => setOrgId(v)}
                options={orgs.map((o) => ({ value: o.id, label: o.name }))}
              />
            </Form.Item>
            <Form.Item label="과제 제목" required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 5월 4주차 쓰기 과제"
              />
            </Form.Item>
            <Form.Item label="마감 일시(선택)">
              <DatePicker
                showTime
                style={{ width: "100%" }}
                onChange={(d) => setDueAt(d ? d.toISOString() : null)}
              />
            </Form.Item>
            <Button type="primary" loading={submitting} onClick={handleCreate}>
              과제 생성
            </Button>
          </Form>
        )}

        <div>
          <Text strong>최근 과제</Text>
          {assignmentsQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: "1rem" }}>
              <Spin size="small" />
            </div>
          ) : (assignmentsQuery.data ?? []).length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="아직 생성된 과제가 없어요."
            />
          ) : (
            <List<AdminAssignmentRow>
              size="small"
              dataSource={assignmentsQuery.data ?? []}
              renderItem={(a) => (
                <List.Item>
                  <Space>
                    <Text>{a.title}</Text>
                    {a.due_at ? (
                      <Tag>
                        마감 <span suppressHydrationWarning>{formatDate(a.due_at)}</span>
                      </Tag>
                    ) : (
                      <Tag color="default">마감 없음</Tag>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          )}
        </div>

        <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
          과제는 assignments 테이블에 기록됩니다. 기관은 create_organization
          RPC로 안전하게 만들어집니다.
        </Paragraph>
      </Space>
    </Modal>
  );
}
