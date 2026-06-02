"use client";

import {
  Alert,
  App,
  Button,
  Divider,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminProblemRow } from "@/lib/admin/types";
import { adminProblemsKey } from "@/lib/admin/queries";
import {
  deleteProblemAction,
  updateProblemAction,
} from "@/app/(workspace)/admin/actions";
import { AdminProblemAssetsManager } from "./AdminProblemAssetsManager";
import {
  REVIEW_LABEL,
  VISIBILITY_LABEL,
  clampStatus,
} from "./format";

const { Text, Paragraph } = Typography;

/**
 * H-01 region 4 — 우측 상세/설정 패널.
 *
 * description.md: "선택 문제의 지문, 정답, 해설, 태그, 공개 설정을 편집".
 * 제약: "수정 권한 필요, 저장 전 변경 항목 표시, 삭제는 확인 모달".
 * 예외: "저장 실패/동시 수정 충돌은 패널 상단에 안내".
 *
 * Edit -> admin_update_problem (allowlisted columns, audited diff).
 * Delete -> admin_delete_problem (confirm modal, audited).
 * Conflict guard: 비공개 + 검수 대기 충돌 행은 상단 경고 + 발행 전환 차단 안내.
 */

type EditableFields = {
  title: string;
  prompt: string;
  explanation: string;
  tags: string; // comma-separated in the form, parsed to string[]
  answer_key: string; // raw JSON text
  rubric: string; // raw JSON text
  visibility: AdminProblemRow["visibility"];
  review_status: AdminProblemRow["review_status"];
  difficulty: number | null;
};

function rowToFields(row: AdminProblemRow): EditableFields {
  return {
    title: row.title ?? "",
    prompt: row.prompt ?? "",
    explanation: row.explanation ?? "",
    tags: (row.tags ?? []).join(", "),
    answer_key: row.answer_key ? JSON.stringify(row.answer_key, null, 2) : "",
    rubric: row.rubric ? JSON.stringify(row.rubric, null, 2) : "",
    visibility: row.visibility,
    review_status: row.review_status,
    difficulty: row.difficulty,
  };
}

function parseJsonField(label: string, raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} JSON 형식이 올바르지 않아요.`);
  }
}

/**
 * Build the patch (only changed fields) + a human-readable diff list for the
 * "저장 전 변경 항목 표시" requirement.
 */
function buildPatch(
  row: AdminProblemRow,
  fields: EditableFields,
): { patch: Record<string, unknown>; changed: string[] } {
  const patch: Record<string, unknown> = {};
  const changed: string[] = [];

  if (fields.title !== (row.title ?? "")) {
    patch.title = fields.title;
    changed.push("제목");
  }
  if (fields.prompt !== (row.prompt ?? "")) {
    patch.prompt = fields.prompt;
    changed.push("지문");
  }
  if (fields.explanation !== (row.explanation ?? "")) {
    patch.explanation = fields.explanation;
    changed.push("해설");
  }
  const nextTags = fields.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const prevTags = row.tags ?? [];
  if (JSON.stringify(nextTags) !== JSON.stringify(prevTags)) {
    patch.tags = nextTags;
    changed.push("태그");
  }
  const nextAnswer = parseJsonField("정답", fields.answer_key);
  if (JSON.stringify(nextAnswer) !== JSON.stringify(row.answer_key ?? null)) {
    patch.answer_key = nextAnswer;
    changed.push("정답");
  }
  const nextRubric = parseJsonField("채점 기준", fields.rubric);
  if (JSON.stringify(nextRubric) !== JSON.stringify(row.rubric ?? null)) {
    patch.rubric = nextRubric;
    changed.push("채점 기준");
  }
  if (fields.visibility !== row.visibility) {
    patch.visibility = fields.visibility;
    changed.push("공개 설정");
  }
  if (fields.review_status !== row.review_status) {
    patch.review_status = fields.review_status;
    changed.push("검수 상태");
  }
  if ((fields.difficulty ?? null) !== (row.difficulty ?? null)) {
    patch.difficulty =
      fields.difficulty == null ? "" : String(fields.difficulty);
    changed.push("난이도");
  }
  return { patch, changed };
}

type Props = {
  row: AdminProblemRow | null;
  open: boolean;
  onClose: () => void;
  /** Notify the parent so it can refetch + clear selection after a delete. */
  onDeleted?: (id: string) => void;
};

function DetailPanelInner({ row, open, onClose, onDeleted }: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [fields, setFields] = useState<EditableFields>(() =>
    row ? rowToFields(row) : ({} as EditableFields),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  // Conflict guard (description region 3/4 예외): 비공개(미발행) + 검수 대기 충돌.
  const isConflict =
    row != null &&
    row.publish_status !== "published" &&
    row.review_status === "pending";

  const { changed } = useMemo(() => {
    if (!row) return { changed: [] as string[] };
    try {
      const { changed: c } = buildPatch(row, fields);
      return { changed: c };
    } catch {
      // JSON parse error is surfaced on save; for the diff preview, treat as
      // "no computed change" so the banner doesn't crash mid-typing.
      return { changed: [] as string[] };
    }
  }, [row, fields]);

  if (!row) return null;

  async function handleSave() {
    if (!row) return;
    setTopError(null);
    let computed: { patch: Record<string, unknown>; changed: string[] };
    try {
      computed = buildPatch(row, fields);
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "입력값을 확인해 주세요.");
      return;
    }
    if (computed.changed.length === 0) {
      message.info("변경된 항목이 없어요.");
      return;
    }
    setSaving(true);
    try {
      await updateProblemAction(row.id, computed.patch);
      message.success(clampStatus(`저장 완료 · ${computed.changed.join(", ")}`));
      await qc.invalidateQueries({ queryKey: adminProblemsKey() });
      onClose();
    } catch (err) {
      // 저장 실패/동시 수정 충돌 → 패널 상단 안내.
      setTopError(
        err instanceof Error
          ? clampStatus(`저장 실패: ${err.message}`)
          : "저장에 실패했어요. 다시 시도해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!row) return;
    Modal.confirm({
      title: "문제 삭제",
      content: (
        <Space direction="vertical">
          <Text>이 문제를 삭제할까요? 되돌릴 수 없어요.</Text>
          <Text strong>{row.title}</Text>
        </Space>
      ),
      okText: "삭제",
      okButtonProps: { danger: true },
      cancelText: "취소",
      onOk: async () => {
        setDeleting(true);
        try {
          await deleteProblemAction(row.id);
          message.success("문제를 삭제했어요.");
          await qc.invalidateQueries({ queryKey: adminProblemsKey() });
          onDeleted?.(row.id);
          onClose();
        } catch (err) {
          setTopError(
            err instanceof Error
              ? clampStatus(`삭제 실패: ${err.message}`)
              : "삭제에 실패했어요.",
          );
          throw err; // keep the modal open on failure
        } finally {
          setDeleting(false);
        }
      },
    });
  }

  return (
    <Drawer
      title="문제 상세/편집"
      placement="right"
      width={620}
      open={open}
      onClose={() => {
        if (!saving && !deleting) onClose();
      }}
      extra={
        <Space>
          <Button danger loading={deleting} onClick={confirmDelete}>
            삭제
          </Button>
          <Button
            type="primary"
            loading={saving}
            disabled={changed.length === 0}
            onClick={handleSave}
          >
            저장
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {topError ? (
          <Alert type="error" showIcon message={topError} closable onClose={() => setTopError(null)} />
        ) : null}

        {isConflict ? (
          <Alert
            type="warning"
            showIcon
            message="검수 충돌 상태"
            description="비공개 상태에서 검수가 대기 중입니다. 검수 승인 후 공개로 전환하세요."
          />
        ) : null}

        {changed.length > 0 ? (
          <Alert
            type="info"
            showIcon
            message="저장 전 변경 항목"
            description={
              <Space wrap>
                {changed.map((c) => (
                  <Tag key={c} color="blue">
                    {c}
                  </Tag>
                ))}
              </Space>
            }
          />
        ) : null}

        <Form layout="vertical" size="middle">
          <Form.Item label="제목">
            <Input
              value={fields.title}
              onChange={(e) =>
                setFields((f) => ({ ...f, title: e.target.value }))
              }
            />
          </Form.Item>
          <Form.Item label="지문(prompt)">
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 8 }}
              value={fields.prompt}
              onChange={(e) =>
                setFields((f) => ({ ...f, prompt: e.target.value }))
              }
            />
          </Form.Item>
          <Form.Item label="해설(explanation)">
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              value={fields.explanation}
              onChange={(e) =>
                setFields((f) => ({ ...f, explanation: e.target.value }))
              }
            />
          </Form.Item>
          <Form.Item
            label="정답(answer_key · JSON)"
            help="JSON 형식으로 입력하세요. 비우면 정답 없음으로 저장됩니다."
          >
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              style={{ fontFamily: "monospace" }}
              value={fields.answer_key}
              onChange={(e) =>
                setFields((f) => ({ ...f, answer_key: e.target.value }))
              }
            />
          </Form.Item>
          <Form.Item label="채점 기준(rubric · JSON)">
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              style={{ fontFamily: "monospace" }}
              value={fields.rubric}
              onChange={(e) =>
                setFields((f) => ({ ...f, rubric: e.target.value }))
              }
            />
          </Form.Item>
          <Form.Item label="태그(쉼표로 구분)">
            <Input
              value={fields.tags}
              onChange={(e) =>
                setFields((f) => ({ ...f, tags: e.target.value }))
              }
            />
          </Form.Item>
          <Space size="middle" wrap style={{ width: "100%" }}>
            <Form.Item label="공개 설정" style={{ minWidth: 160 }}>
              <Select<AdminProblemRow["visibility"]>
                value={fields.visibility}
                style={{ width: 160 }}
                onChange={(v) => setFields((f) => ({ ...f, visibility: v }))}
                options={(
                  ["private", "public", "org"] as AdminProblemRow["visibility"][]
                ).map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
              />
            </Form.Item>
            <Form.Item label="검수 상태" style={{ minWidth: 160 }}>
              <Select<AdminProblemRow["review_status"]>
                value={fields.review_status}
                style={{ width: 160 }}
                onChange={(v) =>
                  setFields((f) => ({ ...f, review_status: v }))
                }
                options={(
                  [
                    "pending",
                    "approved",
                    "rejected",
                  ] as AdminProblemRow["review_status"][]
                ).map((v) => ({ value: v, label: REVIEW_LABEL[v] }))}
              />
            </Form.Item>
            <Form.Item label="난이도" style={{ minWidth: 140 }}>
              <Select<number | null>
                value={fields.difficulty}
                style={{ width: 140 }}
                allowClear
                placeholder="미설정"
                onChange={(v) =>
                  setFields((f) => ({ ...f, difficulty: v ?? null }))
                }
                options={[1, 2, 3, 4, 5].map((n) => ({
                  value: n,
                  label: `${n}★`,
                }))}
              />
            </Form.Item>
          </Space>
        </Form>

        <Divider style={{ margin: "8px 0" }}>자료 관리</Divider>
        <AdminProblemAssetsManager problemId={row.id} />

        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          모든 편집/삭제/자료 변경은 관리자 변경 이력(audit log)에 기록됩니다.
        </Paragraph>
      </Space>
    </Drawer>
  );
}

/**
 * Re-mount the inner panel whenever a different row is targeted so all local
 * form state resets cleanly (React-19 "key to reset" pattern; no setState in
 * effect).
 */
export function AdminProblemDetailPanel(props: Props) {
  const key = `${props.row?.id ?? "none"}:${props.open ? "open" : "closed"}`;
  return <DetailPanelInner key={key} {...props} />;
}
