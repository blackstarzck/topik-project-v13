"use client";

import { Button, Space, notification } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateComparisonReport } from "@/lib/writing/mutations";

type Props = {
  submissionId: string;
  retryHref: string;
  nextHref: string;
};

export function NextActionBar({ submissionId, retryHref, nextHref }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const compare = useCreateComparisonReport();

  function onCompare() {
    if (busy || compare.isPending) return;
    setBusy(true);
    compare.mutate(
      { current_id: submissionId },
      {
        onSuccess: ({ reportId }) => {
          router.push(`/writing/reports/${reportId}/compare`);
        },
        onError: (e) => {
          setBusy(false);
          notification.error({
            message: "비교 리포트 생성 실패",
            description: e.message,
          });
        },
      },
    );
  }

  return (
    <Space wrap>
      <Button type="primary" onClick={() => router.push(retryHref)}>
        다시 풀기
      </Button>
      <Button onClick={() => router.push(nextHref)}>다음 문제</Button>
      <Button onClick={onCompare} loading={compare.isPending || busy}>
        비교 리포트
      </Button>
    </Space>
  );
}
