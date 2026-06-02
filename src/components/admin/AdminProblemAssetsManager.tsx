"use client";

import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  List,
  Popconfirm,
  Segmented,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchProblemAssets,
  type AdminProblemAssetRow,
} from "./admin-rpc";
import {
  addProblemAssetAction,
  removeProblemAssetAction,
} from "@/app/(workspace)/admin/actions";

const { Text, Paragraph } = Typography;

/**
 * H-01 region 4 — 자료 관리 (문제 첨부 자료).
 *
 * Real data-layer wiring:
 *  - list:   problem_assets (RLS-bound select via browser client)
 *  - add:    admin_add_problem_asset RPC (storage_path + asset_type) — audited
 *  - remove: admin_remove_problem_asset RPC — audited
 *
 * STORAGE SEAM (external leg): the binary upload into the `problem-assets`
 * bucket is not wired here. The bucket + policies exist, but no upload widget is
 * built yet, so we add assets by their storage path and mark direct file upload
 * as 준비 중 — no fake success.
 */

function assetsKey(problemId: string) {
  return ["problem-assets", problemId] as const;
}

type Props = {
  problemId: string;
};

export function AdminProblemAssetsManager({ problemId }: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [path, setPath] = useState("");
  const [assetType, setAssetType] = useState<"image" | "audio">("image");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery<AdminProblemAssetRow[], Error>({
    queryKey: assetsKey(problemId),
    queryFn: () => fetchProblemAssets(createSupabaseBrowserClient(), problemId),
  });

  async function handleAdd() {
    const trimmed = path.trim();
    if (!trimmed) {
      setError("자료 경로(storage path)를 입력해 주세요.");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      await addProblemAssetAction({
        problemId,
        storagePath: trimmed,
        assetType,
      });
      setPath("");
      message.success("자료를 추가했어요.");
      await qc.invalidateQueries({ queryKey: assetsKey(problemId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "자료 추가에 실패했어요.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(assetId: string) {
    setRemovingId(assetId);
    setError(null);
    try {
      await removeProblemAssetAction(assetId);
      message.success("자료를 삭제했어요.");
      await qc.invalidateQueries({ queryKey: assetsKey(problemId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "자료 삭제에 실패했어요.");
    } finally {
      setRemovingId(null);
    }
  }

  const assets = query.data ?? [];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {error ? (
        <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />
      ) : null}

      {query.isLoading ? (
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <Spin size="small" />
        </div>
      ) : assets.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="첨부된 자료가 없어요."
        />
      ) : (
        <List<AdminProblemAssetRow>
          size="small"
          bordered
          dataSource={assets}
          renderItem={(asset) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="remove"
                  title="자료 삭제"
                  description="이 자료를 삭제할까요? 되돌릴 수 없어요."
                  okText="삭제"
                  cancelText="취소"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleRemove(asset.id)}
                >
                  <Button
                    size="small"
                    danger
                    loading={removingId === asset.id}
                  >
                    삭제
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Space>
                <Tag color={asset.asset_type === "audio" ? "purple" : "blue"}>
                  {asset.asset_type === "audio" ? "오디오" : "이미지"}
                </Tag>
                <Text style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {asset.storage_path}
                </Text>
              </Space>
            </List.Item>
          )}
        />
      )}

      <Space.Compact style={{ width: "100%" }}>
        <Segmented<"image" | "audio">
          value={assetType}
          onChange={(v) => setAssetType(v)}
          options={[
            { label: "이미지", value: "image" },
            { label: "오디오", value: "audio" },
          ]}
        />
        <Input
          placeholder="problem-assets 경로 (예: problems/abc/img1.png)"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onPressEnter={handleAdd}
        />
        <Button type="primary" loading={adding} onClick={handleAdd}>
          자료 추가
        </Button>
      </Space.Compact>

      <Tooltip title="파일 직접 업로드(스토리지 연동)는 준비 중입니다. 지금은 업로드된 파일의 경로를 입력해 연결합니다.">
        <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
          파일 직접 업로드 <Tag color="default">준비 중</Tag> · 현재는 스토리지
          경로로 연결합니다.
        </Paragraph>
      </Tooltip>
    </Space>
  );
}
