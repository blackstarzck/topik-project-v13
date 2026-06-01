"use client";

import { Button, Space, notification } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { triggerPdfExport } from "@/lib/export/pdf-export";
import { useCreateComparisonReport } from "@/lib/writing/mutations";

type Props = {
  submissionId: string;
  retryHref: string;
  nextHref: string;
  /**
   * When true, show the "PDF 저장" action (E-02 장문 피드백 region 4). Uses the
   * existing browser-print export helper; failures surface as a toast with a
   * 대체 저장 안내 (description region 4 예외).
   */
  withPdf?: boolean;
  /**
   * Primary CTA label. E-01 단답 = "다시 풀기", E-02 장문 = "다시 작성"
   * (description region 4 wording differs per surface).
   */
  retryLabel?: string;
};

export function NextActionBar({
  submissionId,
  retryHref,
  nextHref,
  withPdf = false,
  retryLabel = "다시 풀기",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
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

  async function onPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await triggerPdfExport({ sourceType: "submission", sourceId: submissionId });
      notification.success({ message: "PDF 출력 대화상자가 열렸습니다." });
    } catch {
      notification.error({
        message: "PDF 저장에 실패했어요",
        description: "내 보관함에서 다시 저장해 보세요.",
      });
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <Space wrap>
      <Button type="primary" onClick={() => router.push(retryHref)}>
        {retryLabel}
      </Button>
      <Button onClick={() => router.push(nextHref)}>다음 문제</Button>
      {withPdf ? (
        <Button onClick={onPdf} loading={pdfBusy}>
          PDF 저장
        </Button>
      ) : null}
      <Button onClick={onCompare} loading={compare.isPending || busy}>
        비교 리포트
      </Button>
    </Space>
  );
}
