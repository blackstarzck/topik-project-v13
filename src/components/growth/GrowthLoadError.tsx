"use client";

import { Button, Result } from "antd";
import { useRouter } from "next/navigation";

/**
 * X-02 area 3 예외 — 차트/지표 로드 실패 시 재시도 버튼을 제공한다.
 * 사용자를 막다른 길에 두지 않도록 정직한 안내 + 다시 시도 동선을 노출한다.
 */
export function GrowthLoadError() {
  const router = useRouter();
  return (
    <Result
      status="warning"
      title="성장 지표를 불러오지 못했어요."
      subTitle="잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침해 주세요."
      extra={
        <Button type="primary" onClick={() => router.refresh()}>
          다시 시도
        </Button>
      }
    />
  );
}
