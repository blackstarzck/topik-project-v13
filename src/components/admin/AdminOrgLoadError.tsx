"use client";

import { Button, Result } from "antd";
import { useRouter } from "next/navigation";

/**
 * X-08 region 2 예외 — 기관 대시보드 데이터 로드 실패 시 하드 에러 바운더리 대신
 * 정직한 안내 + 다시 시도 동선을 노출한다 (description "데이터 없음/로드 실패 → 재시도").
 */
export function AdminOrgLoadError() {
  const router = useRouter();
  return (
    <Result
      status="warning"
      title="기관 대시보드를 불러오지 못했어요."
      subTitle="잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침해 주세요."
      extra={
        <Button type="primary" onClick={() => router.refresh()}>
          다시 시도
        </Button>
      }
    />
  );
}
