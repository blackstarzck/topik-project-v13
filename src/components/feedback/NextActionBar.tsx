"use client";

import { Button, Space, notification } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { triggerPdfExport } from "@/lib/export/pdf-export";
import { useCreateComparisonReport } from "@/lib/writing/mutations";
import { SaveToLibraryButton } from "./SaveToLibraryButton";

type Props = {
  submissionId: string;
  /** 보관함 저장 row owner (서버에서 내려온 현재 사용자 id). */
  userId: string;
  retryHref: string;
  nextHref: string;
  /**
   * PDF 저장 노출 여부. E-01/E-02 모두 functional-spec 주요 기능에 "PDF 내보내기"가
   * 있으므로 기본 노출. 실패/권한 잠금은 토스트와 대체 저장 안내(description region 4 예외).
   */
  withPdf?: boolean;
  /**
   * 주요 CTA 라벨. E-01 단답 = "다시 풀기", E-02 장문 = "다시 작성"
   * (description region 4 wording differs per surface).
   */
  retryLabel?: string;
  /** 보관함 저장 권한 잠금 (보기 전용 공유 등). */
  saveLocked?: boolean;
  /** 이미 보관함에 저장돼 있으면 버튼을 저장됨으로 표시. */
  alreadySaved?: boolean;
};

/**
 * E-01/E-02 다음 행동 CTA (description region 4).
 * 제약: 주요 CTA 1개(다시 풀기/작성), 보조 CTA 3개 이하, 중복 클릭 차단.
 * 모바일은 탭/스택 전환 — Space가 wrap되며 각 버튼 block로 쌓인다.
 * 예외: 저장 실패/권한 잠금은 해당 CTA 옆 상태 표시(SaveToLibraryButton),
 *       PDF 실패는 토스트와 대체 저장 안내.
 */
export function NextActionBar({
  submissionId,
  userId,
  retryHref,
  nextHref,
  withPdf = true,
  retryLabel = "다시 풀기",
  saveLocked = false,
  alreadySaved = false,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const compare = useCreateComparisonReport();

  function onCompare() {
    if (busy || compare.isPending) return; // 중복 클릭 차단
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
    if (pdfBusy) return; // 중복 클릭 차단
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
    <Space wrap size={[8, 8]} style={{ width: "100%" }}>
      <Button type="primary" onClick={() => router.push(retryHref)}>
        {retryLabel}
      </Button>
      <Button onClick={() => router.push(nextHref)}>다음 문제</Button>
      <SaveToLibraryButton
        submissionId={submissionId}
        userId={userId}
        permissionLocked={saveLocked}
        initiallySaved={alreadySaved}
      />
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
