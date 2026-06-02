"use client";

import { useState } from "react";
import { Card, Empty, Image, Space, Typography } from "antd";

const { Text } = Typography;

export type ProblemAsset = {
  id: string;
  url: string;
  assetType: "image" | "audio";
  /** 대체 텍스트 폴백 + 디버깅용 경로. */
  storagePath: string;
};

type Props = {
  assets: ProblemAsset[];
  /** 캡션(40자 이하) — 없으면 표시 안 함. */
  captions?: Record<string, string>;
};

/**
 * D-01..D-04 §3 참고 이미지/자료 영역.
 * - 이미지: antd <Image> preview 로 확대 보기 지원, 비율 유지.
 * - 로드 실패: 대체 텍스트 + 빈 프레임(§3 예외).
 * - 자료 없음: 접힌 빈 상태(§3 예외)를 caller 가 조건부로 렌더(빈 배열이면 null).
 * - 오디오: <audio> controls (준비된 자료가 있을 때만).
 */
export function ReferenceMaterials({ assets, captions }: Props) {
  if (assets.length === 0) return null;

  return (
    <Card size="small" title="참고 자료">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {assets.map((asset) => (
          <AssetView
            key={asset.id}
            asset={asset}
            caption={captions?.[asset.id]}
          />
        ))}
      </Space>
    </Card>
  );
}

function altTextFor(asset: ProblemAsset, caption?: string): string {
  if (caption && caption.length > 0) return caption.slice(0, 40);
  return asset.assetType === "image" ? "문제 참고 이미지" : "문제 참고 음성";
}

function AssetView({
  asset,
  caption,
}: {
  asset: ProblemAsset;
  caption?: string;
}) {
  const [failed, setFailed] = useState(false);
  const alt = altTextFor(asset, caption);

  if (asset.assetType === "audio") {
    return (
      <div>
        <audio controls src={asset.url} aria-label={alt} style={{ width: "100%" }}>
          <track kind="captions" />
        </audio>
        {caption ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {caption.slice(0, 40)}
          </Text>
        ) : null}
      </div>
    );
  }

  if (failed) {
    // §3 예외 — 이미지 로드 실패 시 대체 텍스트 + 빈 프레임.
    return (
      <div
        style={{
          border: "1px dashed #d9d9d9",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`이미지를 불러오지 못했어요. (${alt})`}
        />
      </div>
    );
  }

  return (
    <div>
      <Image
        src={asset.url}
        alt={alt}
        style={{ maxWidth: "100%", height: "auto" }}
        onError={() => setFailed(true)}
        preview={{ mask: "확대 보기" }}
      />
      {caption ? (
        <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
          {caption.slice(0, 40)}
        </Text>
      ) : null}
    </div>
  );
}
