"use client";

import { App, Button, Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { exportPdfWithPrintFallback } from "@/lib/export/pdf-export-client";
import { PDF_EXPORT_DEFAULT_OPTIONS } from "@/lib/export/pdf-options";
import { useSaveLibraryItem } from "@/lib/library/mutations";
import { useCreateComparisonReport } from "@/lib/writing/mutations";

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
   * (description region 4 wording differs per surface). 미지정 시
   * feedback.actions.retryDefault로 해석한다. 호출부에서 t()로 해석한 문구를
   * 넘기면 그대로 사용(번역 키 캐스트 회피).
   */
  retryLabel?: string;
  /** 보관함 저장 권한 잠금 (보기 전용 공유 등). */
  saveLocked?: boolean;
  /** 이미 보관함에 저장돼 있으면 버튼을 저장됨으로 표시. */
  alreadySaved?: boolean;
};

const RLS_DENIED = new Set(["42501", "PGRST301", "PGRST116"]);

/**
 * E-01/E-02 다음 행동 CTA (description region 4).
 * 제약: 주요 CTA 1개(다시 풀기/작성), 보조 CTA 3개 이하, 중복 클릭 차단.
 * 모바일은 탭/스택 전환 — 액션들이 줄바꿈되며 각 버튼 block로 쌓인다.
 * 저장 관련 보조 액션은 하나의 메뉴에 묶어 CTA 수를 유지한다.
 * 예외: 저장 실패/권한 잠금, PDF 실패는 토스트와 메뉴 항목 상태로 안내한다.
 */
export function NextActionBar({
  submissionId,
  userId,
  retryHref,
  nextHref,
  withPdf = true,
  retryLabel,
  saveLocked = false,
  alreadySaved = false,
}: Props) {
  const t = useTranslations("feedback.actions");
  const router = useRouter();
  const { notification } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saved, setSaved] = useState(alreadySaved);
  const save = useSaveLibraryItem();
  const compare = useCreateComparisonReport();
  const resolvedRetryLabel = retryLabel ?? t("retryDefault");

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
            title: t("compareFailedTitle"),
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
      // 서버 실파일 생성 → 실패 시 브라우저 인쇄 폴백 (F-M1 브리프 §3-B).
      const outcome = await exportPdfWithPrintFallback({
        sourceType: "submission",
        sourceId: submissionId,
        options: {
          filename: t("pdfDefaultFilename"),
          ...PDF_EXPORT_DEFAULT_OPTIONS,
        },
      });
      if (outcome.mode === "file") {
        notification.success({ title: t("pdfDownloaded") });
      } else {
        notification.info({ title: t("pdfSuccess") });
      }
    } catch {
      notification.error({
        title: t("pdfFailedTitle"),
        description: t("pdfFailedDescription"),
      });
    } finally {
      setPdfBusy(false);
    }
  }

  function onSaveLibrary() {
    if (saveLocked || saved || save.isPending) return;
    save.mutate(
      { item_type: "submission", submission_id: submissionId, user_id: userId },
      {
        onSuccess: () => {
          setSaved(true);
          notification.success({ title: t("save.saveSuccess") });
        },
        onError: (e: unknown) => {
          const err = e as { code?: string; message?: string };
          if (err.code && RLS_DENIED.has(err.code)) {
            notification.error({
              title: t("save.deniedTitle"),
              description: t("save.deniedDescription"),
            });
            return;
          }
          notification.error({
            title: t("save.failedTitle"),
            description: err.message ?? t("save.failedDescription"),
          });
        },
      },
    );
  }

  const saveMenuItems: MenuProps["items"] = [
    {
      key: "library",
      label: saveLocked
        ? t("save.lockedButton")
        : saved
          ? t("save.saved")
          : t("save.save"),
      disabled: saveLocked || saved || save.isPending,
    },
    ...(withPdf
      ? [
          {
            key: "pdf",
            label: t("savePdf"),
            disabled: pdfBusy,
          },
        ]
      : []),
  ];

  function onSaveMenuClick({ key }: { key: string }) {
    if (key === "library") onSaveLibrary();
    if (key === "pdf") void onPdf();
  }

  return (
    <div data-testid="feedback-actions">
      <div className="flex w-full flex-wrap gap-2">
        <Button
          type="primary"
          onClick={() => router.push(retryHref)}
          data-testid="feedback-action-retry"
        >
          {resolvedRetryLabel}
        </Button>
        <Button
          onClick={() => router.push(nextHref)}
          data-testid="feedback-action-next"
        >
          {t("nextProblem")}
        </Button>
        <Tooltip title={saveLocked ? t("save.lockedTooltip") : undefined}>
          <Dropdown
            menu={{ items: saveMenuItems, onClick: onSaveMenuClick }}
            trigger={["click"]}
            disabled={!withPdf && (saveLocked || saved)}
          >
            <Button
              loading={save.isPending || pdfBusy}
              data-testid="feedback-action-save"
            >
              {t("saveGroup")}
              <ChevronDown aria-hidden size={14} />
            </Button>
          </Dropdown>
        </Tooltip>
        <Button
          onClick={onCompare}
          loading={compare.isPending || busy}
          data-testid="feedback-action-compare"
        >
          {t("compareReport")}
        </Button>
      </div>
    </div>
  );
}
