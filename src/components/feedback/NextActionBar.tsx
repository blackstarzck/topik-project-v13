"use client";

import { App, Button } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  trackApiRequestResult,
  trackButtonClick,
} from "@/lib/analytics/google-analytics";
import {
  exportPdfWithPrintFallback,
  getPdfExportErrorMessage,
  PdfExportApiError,
} from "@/lib/export/pdf-export-client";
import { PDF_EXPORT_ERROR_CODES } from "@/lib/export/pdf-export-errors";
import { PDF_EXPORT_DEFAULT_OPTIONS } from "@/lib/export/pdf-options";
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
  /** 제출했던 문제가 더 이상 새 풀이를 허용하지 않는 경우 재풀이 CTA를 막는다. */
  retryDisabled?: boolean;
  retryDisabledReason?: string;
};

type FeedbackActionGroupProps = Props & {
  className?: string;
  variant?: "footer" | "header";
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/**
 * E-01/E-02 다음 행동 CTA (description region 4).
 * 제약: 주요 CTA 1개(다시 풀기/작성), 보조 CTA 3개 이하, 중복 클릭 차단.
 * 모바일은 탭/스택 전환 — 액션들이 줄바꿈되며 각 버튼 block로 쌓인다.
 * PDF 저장은 드롭다운 없이 직접 실행한다.
 * 예외: PDF 실패는 토스트로 안내한다.
 */
export function FeedbackActionGroup({
  submissionId,
  retryHref,
  nextHref,
  withPdf = true,
  retryLabel,
  retryDisabled = false,
  retryDisabledReason,
  className,
  variant = "footer",
}: FeedbackActionGroupProps) {
  const t = useTranslations("feedback.actions");
  const router = useRouter();
  const { notification } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const compare = useCreateComparisonReport();
  const resolvedRetryLabel = retryLabel ?? t("retryDefault");

  function onCompare() {
    if (busy || compare.isPending) return; // 중복 클릭 차단
    trackButtonClick({
      buttonId: "feedback_compare_report",
      surface: "feedback_report",
    });
    setBusy(true);
    const startedAt = performance.now();
    compare.mutate(
      { current_id: submissionId },
      {
        onSuccess: ({ reportId }) => {
          trackApiRequestResult({
            apiName: "create_comparison_report",
            status: "success",
            durationMs: performance.now() - startedAt,
          });
          router.push(`/writing/reports/${reportId}/compare`);
        },
        onError: (e) => {
          trackApiRequestResult({
            apiName: "create_comparison_report",
            status: "error",
            durationMs: performance.now() - startedAt,
          });
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
    trackButtonClick({
      buttonId: "feedback_export_pdf",
      surface: "feedback_report",
    });
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
    } catch (err) {
      if (
        err instanceof PdfExportApiError &&
        err.code === PDF_EXPORT_ERROR_CODES.quotaExceeded
      ) {
        notification.warning({
          title: t("pdfQuotaExceededTitle"),
          description: getPdfExportErrorMessage(err, t("pdfQuotaExceededDescription"), {
            [PDF_EXPORT_ERROR_CODES.quotaExceeded]: t(
              "pdfQuotaExceededDescription",
            ),
          }),
        });
        return;
      }
      notification.error({
        title: t("pdfFailedTitle"),
        description: t("pdfFailedDescription"),
      });
    } finally {
      setPdfBusy(false);
    }
  }

  const isHeader = variant === "header";

  return (
    <div
      data-testid="feedback-actions"
      className={classNames(
        isHeader ? "flex w-full justify-start lg:w-auto lg:justify-end" : null,
        className,
      )}
    >
      <div
        className={classNames(
          "flex w-full flex-wrap items-center gap-2",
          isHeader ? "lg:justify-end" : null,
        )}
      >
        <Button
          type="primary"
          onClick={() => {
            if (retryDisabled) return;
            trackButtonClick({
              buttonId: "feedback_retry",
              surface: "feedback_report",
            });
            router.push(retryHref);
          }}
          disabled={retryDisabled}
          title={retryDisabled ? retryDisabledReason : undefined}
          data-testid="feedback-action-retry"
        >
          {resolvedRetryLabel}
        </Button>
        <div
          className={classNames(
            "flex flex-wrap items-center gap-2",
            isHeader
              ? "feedback-action-divider w-full pt-2 md:ml-1 md:w-auto md:pl-3 md:pt-0"
              : null,
          )}
        >
          <Button
            onClick={() => {
              trackButtonClick({
                buttonId: "feedback_next_problem",
                surface: "feedback_report",
              });
              router.push(nextHref);
            }}
            data-testid="feedback-action-next"
          >
            {t("nextProblem")}
          </Button>
          {withPdf ? (
            <Button
              onClick={() => void onPdf()}
              loading={pdfBusy}
              disabled={pdfBusy}
              data-testid="feedback-action-pdf"
            >
              {t("savePdf")}
            </Button>
          ) : null}
          <Button
            onClick={onCompare}
            loading={compare.isPending || busy}
            data-testid="feedback-action-compare"
          >
            {t("compareReport")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NextActionBar(props: Props) {
  return <FeedbackActionGroup {...props} />;
}
