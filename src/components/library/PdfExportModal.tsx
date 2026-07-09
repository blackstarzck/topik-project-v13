"use client";

import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Result,
  Segmented,
  Space,
  Tag,
  Typography,
} from "antd";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import { AppModal } from "@/components/shared/AppModal";
import {
  exportPdfWithPrintFallback,
  getPdfExportErrorMessage,
} from "@/lib/export/pdf-export-client";
import { PDF_EXPORT_ERROR_CODES } from "@/lib/export/pdf-export-errors";
import {
  PDF_EXPORT_MAX_ITEMS,
  PDF_FILENAME_MAX,
  estimatePdfPages,
  type PdfExportOptions,
} from "@/lib/export/pdf-options";
import { useSingleFlightAction } from "@/lib/request-control/useSingleFlightAction";

const { Text, Title, Paragraph } = Typography;

export type ExportSelectionItem = {
  /** library_items.id */
  itemId: string;
  /** Short title shown in the selection list + preview. */
  title: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** The user's current selection from the library list. */
  selection: ExportSelectionItem[];
};

type GenState =
  | { phase: "idle" }
  | { phase: "generating" }
  | { phase: "done"; mode: "file" | "print" }
  | { phase: "error"; message: string };

/**
 * F-M1 PDF 출력 설정 모달 — hifi.png 2단 레이아웃 정렬(2026-06-12 owner 지시).
 *
 * 좌측: 1. 선택한 문제(모달 안에서 개별 해제) / 2. 포함할 항목(내 답안·AI
 * 피드백) / 3. 레이아웃 옵션(두 페이지·한 페이지 + 페이지 방향) / 파일명.
 * 우측: 미리보기(예상 분량 배지 + 종이 모사 카드) + 안내.
 * 하단: 개인정보 확인(필수) → 취소 / PDF 생성.
 *
 * hifi 대비 의도적 차이 2가지(정직성·description.md 의무):
 *  - 파일명 입력과 개인정보 확인은 hifi에 없지만 description.md 제약
 *    ("파일명 1-60자, 개인정보 확인 필수")이 우선이라 유지한다.
 *  - hifi의 "생성 후 알림으로 안내드려요" 카피는 알림 발송이 스텁(§11-S)이라
 *    "생성이 끝나면 바로 다운로드돼요"로 바꿨다 — 거짓 약속 금지.
 *
 * 생성 경로 = 서버 실파일(POST /api/export/pdf → generated-exports 다운로드),
 * 실패 시 브라우저 인쇄 폴백(브리프 §3-B).
 */
export function PdfExportModal({ open, onClose, selection }: Props) {
  const t = useTranslations("library.pdf");
  // Modal 셸은 항상 마운트 상태로 두되, 본문은 open될 때마다 destroyOnHidden
  // 으로 새로 마운트 → transient 상태가 깨끗하게 리셋된다.
  return (
    <AppModal
      open={open}
      onCancel={onClose}
      title={t("modalTitle")}
      width={920}
      mask={{ closable: false }}
      footer={null}
      destroyOnHidden
    >
      {open ? (
        <PdfExportModalBody onClose={onClose} selection={selection} />
      ) : null}
    </AppModal>
  );
}

function SectionHeading({
  children,
  extra,
}: {
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Text strong>{children}</Text>
      {extra}
    </div>
  );
}

function PdfExportModalBody({
  onClose,
  selection,
}: {
  onClose: () => void;
  selection: ExportSelectionItem[];
}) {
  const t = useTranslations("library.pdf");
  const { message } = App.useApp();

  const [filename, setFilename] = useState(t("filenameDefault"));
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeFeedback, setIncludeFeedback] = useState(true);
  const [layout, setLayout] = useState<PdfExportOptions["layout"]>("paged");
  const [orientation, setOrientation] =
    useState<PdfExportOptions["orientation"]>("portrait");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [gen, setGen] = useState<GenState>({ phase: "idle" });

  const selectionLost = selection.length === 0;
  const tooMany = selection.length > PDF_EXPORT_MAX_ITEMS;

  const enabledItems = useMemo(
    () => selection.filter((item) => !excludedIds.has(item.itemId)),
    [selection, excludedIds],
  );

  function toggleItem(itemId: string, enabled: boolean) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const filenameError = useMemo(() => {
    const trimmed = filename.trim();
    if (trimmed.length === 0) return t("filenameEmptyError");
    if (trimmed.length > PDF_FILENAME_MAX)
      return t("filenameTooLongError", { max: PDF_FILENAME_MAX });
    return null;
  }, [filename, t]);

  const estimatedPages = useMemo(
    () =>
      estimatePdfPages({
        itemCount: enabledItems.length,
        includeAnswers,
        includeFeedback,
        layout,
      }),
    [enabledItems.length, includeAnswers, includeFeedback, layout],
  );

  async function runExport() {
    setGen({ phase: "generating" });
    try {
      const outcome = await exportPdfWithPrintFallback({
        sourceType: "library_selection",
        itemIds: enabledItems.map((item) => item.itemId),
        options: {
          filename: filename.trim(),
          includeAnswers,
          includeFeedback,
          layout,
          orientation,
        },
      });
      setGen({ phase: "done", mode: outcome.mode });
      if (outcome.mode === "file") {
        message.success(t("downloadStarted"));
      } else {
        message.warning(t("fallbackPrint"));
      }
    } catch (err) {
      setGen({
        phase: "error",
        message: getPdfExportErrorMessage(err, t("generateFailed"), {
          [PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable]: t(
            "failedAnalysisExportUnavailable",
          ),
          [PDF_EXPORT_ERROR_CODES.quotaExceeded]: t("quotaExceeded"),
        }),
      });
    }
  }
  const exportAction = useSingleFlightAction(runExport);
  const isGenerating = gen.phase === "generating" || exportAction.pending;
  const canExport =
    !selectionLost &&
    !tooMany &&
    enabledItems.length > 0 &&
    filenameError === null &&
    privacyConfirmed &&
    !isGenerating;

  function handleExport() {
    void exportAction.run();
  }

  if (selectionLost) {
    // Region 1 예외: 선택 항목이 사라짐.
    return (
      <Result
        status="warning"
        title={t("selectionLostTitle")}
        subTitle={t("selectionLostSubtitle")}
        extra={
          <Button type="primary" onClick={onClose}>
            {t("backToList")}
          </Button>
        }
      />
    );
  }

  const layoutChoices: {
    value: PdfExportOptions["layout"];
    title: string;
    description: string;
  }[] = [
    {
      value: "paged",
      title: t("layoutPagedTitle"),
      description: t("layoutPagedDesc"),
    },
    {
      value: "continuous",
      title: t("layoutContinuousTitle"),
      description: t("layoutContinuousDesc"),
    },
  ];

  return (
    <div
      data-testid="pdf-export-modal"
      className="flex max-h-[70vh] w-full flex-col gap-4 overflow-y-auto pr-1 sm:pr-0"
    >
      {tooMany ? (
        <Alert
          type="warning"
          showIcon
          title={t("tooManyTitle", { max: PDF_EXPORT_MAX_ITEMS })}
          description={t("tooManyDescription", { count: selection.length })}
        />
      ) : null}

      <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ───────── 좌측: 옵션 컬럼 ───────── */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* 1. 선택한 문제 */}
          <section className="flex flex-col gap-2">
            <SectionHeading
              extra={
                <Tag data-testid="pdf-export-enabled-count">
                  {t("selectedCountBadge", { count: enabledItems.length })}
                </Tag>
              }
            >
              {t("selectedSection")}
            </SectionHeading>
            <div className="flex flex-col gap-1 rounded-2xl border border-border p-2">
              {selection.map((item) => (
                <label
                  key={item.itemId}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--app-color-bg-layout)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      checked={!excludedIds.has(item.itemId)}
                      onChange={(e) =>
                        toggleItem(item.itemId, e.target.checked)
                      }
                    />
                    <Text ellipsis className="min-w-0">
                      {item.title}
                    </Text>
                  </span>
                  <Tag className="m-0 shrink-0">{t("solvedTag")}</Tag>
                </label>
              ))}
            </div>
            {enabledItems.length === 0 ? (
              <Text type="danger">{t("noneSelectedHint")}</Text>
            ) : null}
          </section>

          {/* 2. 포함할 항목 */}
          <section className="flex flex-col gap-2">
            <SectionHeading>{t("includeSection")}</SectionHeading>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-border p-3">
                <Checkbox
                  checked={includeAnswers}
                  onChange={(e) => setIncludeAnswers(e.target.checked)}
                />
                <span className="flex min-w-0 flex-col">
                  <Text strong>{t("includeAnswersTitle")}</Text>
                  <Text type="secondary" className="text-xs">
                    {t("includeAnswersDesc")}
                  </Text>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-border p-3">
                <Checkbox
                  checked={includeFeedback}
                  onChange={(e) => setIncludeFeedback(e.target.checked)}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2">
                    <Text strong>{t("includeFeedbackTitle")}</Text>
                    <Tag className="m-0">{t("recommendedTag")}</Tag>
                  </span>
                  <Text type="secondary" className="text-xs">
                    {t("includeFeedbackDesc")}
                  </Text>
                </span>
              </label>
            </div>
          </section>

          {/* 3. 레이아웃 옵션 */}
          <section className="flex flex-col gap-2">
            <SectionHeading>{t("layoutSection")}</SectionHeading>
            <div
              role="radiogroup"
              aria-label={t("layoutSection")}
              className="grid gap-2 sm:grid-cols-2"
            >
              {layoutChoices.map((choice) => {
                const selected = layout === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`pdf-export-layout-${choice.value}`}
                    onClick={() => setLayout(choice.value)}
                    className="flex cursor-pointer flex-col items-start gap-0.5 rounded-2xl border bg-transparent p-3 text-left"
                    style={{
                      borderColor: selected
                        ? "var(--app-color-primary)"
                        : "var(--app-color-border)",
                      borderWidth: 1,
                    }}
                  >
                    <Text strong>{choice.title}</Text>
                    <Text type="secondary" className="text-xs">
                      {choice.description}
                    </Text>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <Text type="secondary">{t("orientationLabel")}</Text>
              <Segmented
                value={orientation}
                onChange={(value) =>
                  setOrientation(value as PdfExportOptions["orientation"])
                }
                options={[
                  { label: t("orientationPortrait"), value: "portrait" },
                  { label: t("orientationLandscape"), value: "landscape" },
                ]}
              />
            </div>
          </section>

          {/* 파일명 — description.md 제약(1-60자) 유지 */}
          <Form layout="vertical" className="mb-0">
            <Form.Item
              className="mb-0"
              label={t("filenameLabel")}
              required
              validateStatus={filenameError ? "error" : undefined}
              help={
                filenameError ??
                t("filenameCount", {
                  count: filename.trim().length,
                  max: PDF_FILENAME_MAX,
                })
              }
            >
              <Space.Compact className="w-full">
                <Input
                  data-testid="pdf-export-filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  maxLength={PDF_FILENAME_MAX}
                  aria-label={t("filenameAriaLabel")}
                />
                <Input
                  disabled
                  aria-hidden
                  tabIndex={-1}
                  value=".pdf"
                  className="w-14 text-center"
                />
              </Space.Compact>
            </Form.Item>
          </Form>
        </div>

        {/* ───────── 우측: 미리보기 컬럼 ───────── */}
        <div className="flex min-w-0 flex-col gap-3">
          <SectionHeading
            extra={
              <Tag className="m-0" data-testid="pdf-export-page-estimate">
                {t("previewBadge", { count: estimatedPages })}
              </Tag>
            }
          >
            {t("previewLabel")}
          </SectionHeading>

          {/* 종이 모사 미리보기 (hifi region 3) — 1페이지 축약 */}
          <div className="rounded-2xl border border-border bg-[var(--app-color-bg-layout)] p-3">
            <div
              data-testid="pdf-export-preview"
              aria-label={t("previewAriaLabel")}
              className="flex flex-col gap-2 rounded-md border border-border bg-[var(--app-color-bg-container)] px-4 py-5 shadow-sm"
            >
              <Text type="secondary" className="text-center !text-[10px]">
                {t("previewBrand")}
              </Text>
              <Title level={5} className="!my-0 text-center">
                {t("previewPaperTitle")}
              </Title>
              <Text type="secondary" className="text-center !text-xs">
                {(filename.trim() || t("filenameDefault")) + ".pdf"}
              </Text>
              {/* 원고지 모사 장식 — 시각적 축약일 뿐 실제 내용 아님 */}
              <div
                aria-hidden
                className="h-10 rounded-sm border border-border opacity-60"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, transparent, transparent 11px, var(--app-color-border) 11px, var(--app-color-border) 12px), repeating-linear-gradient(0deg, transparent, transparent 11px, var(--app-color-border) 11px, var(--app-color-border) 12px)",
                }}
              />
              <ol className="m-0 flex list-decimal flex-col gap-0.5 pl-5">
                {enabledItems.map((item) => (
                  <li key={item.itemId} data-testid="pdf-export-preview-item">
                    <Text className="!text-xs">{item.title}</Text>
                    {includeAnswers ? (
                      <Text type="secondary" className="!text-xs">
                        {t("previewAnswerTag")}
                      </Text>
                    ) : null}
                    {includeFeedback ? (
                      <Text type="secondary" className="!text-xs">
                        {t("previewFeedbackTag")}
                      </Text>
                    ) : null}
                  </li>
                ))}
              </ol>
              <Text type="secondary" className="text-center !text-[10px]">
                1 / {estimatedPages}
              </Text>
            </div>
          </div>

          <Paragraph
            type="secondary"
            className="!mb-0 rounded-2xl bg-[var(--app-color-bg-layout)] p-3 !text-xs"
          >
            {t("previewNote")}
          </Paragraph>
        </div>
      </div>

      {/* 상태 알림 (region 4 예외) */}
      {gen.phase === "error" ? (
        <Alert
          type="error"
          showIcon
          title={t("errorTitle")}
          description={
            <div className="flex flex-col gap-2">
              <Text type="secondary">{gen.message}</Text>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="small"
                  type="primary"
                  loading={isGenerating}
                  disabled={isGenerating}
                  onClick={handleExport}
                >
                  {t("retry")}
                </Button>
                <Button
                  size="small"
                  href={`mailto:support@dotoretopik.example?subject=${encodeURIComponent(
                    t("contactSubject"),
                  )}`}
                >
                  {t("contact")}
                </Button>
              </div>
            </div>
          }
        />
      ) : gen.phase === "done" ? (
        <Alert
          type={gen.mode === "file" ? "success" : "info"}
          showIcon
          title={gen.mode === "file" ? t("doneFileTitle") : t("doneTitle")}
          description={
            <div className="flex flex-col gap-2">
              <Text type="secondary">
                {gen.mode === "file"
                  ? t("doneFileDescription")
                  : t("doneDescription")}
              </Text>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="small"
                  loading={isGenerating}
                  disabled={isGenerating}
                  onClick={handleExport}
                >
                  {t("exportAgain")}
                </Button>
              </div>
            </div>
          }
        />
      ) : null}

      {/* 개인정보 확인 필수 (description.md) */}
      <Checkbox
        data-testid="pdf-export-privacy-confirm"
        checked={privacyConfirmed}
        onChange={(e) => setPrivacyConfirmed(e.target.checked)}
      >
        {t("privacyConfirm")}
      </Checkbox>

      <div className="flex w-full flex-col items-end gap-1">
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button data-testid="pdf-export-close" onClick={onClose}>
            {t("close")}
          </Button>
          <Button
            data-testid="pdf-export-submit"
            type="primary"
            loading={isGenerating}
            disabled={!canExport}
            onClick={handleExport}
          >
            {isGenerating ? t("generating") : t("export")}
          </Button>
        </div>
        {/* hifi의 "생성 후 알림으로 안내드려요"는 알림 발송 스텁이라 다운로드
            안내로 대체(정직성). */}
        <Text type="secondary" className="!text-xs">
          {t("downloadNote")}
        </Text>
      </div>
    </div>
  );
}
