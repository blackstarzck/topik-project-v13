"use client";

import {
  Alert,
  App,
  Button,
  Checkbox,
  Divider,
  Form,
  Input,
  Radio,
  Result,
  Space,
  Typography,
} from "antd";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { AppModal } from "@/components/shared/AppModal";
import { triggerPdfExport } from "@/lib/export/pdf-export";

const { Text, Title, Paragraph } = Typography;

const FILENAME_MAX = 60;
const MAX_ITEMS = 6;

export type ExportSelectionItem = {
  /** library_items.id */
  itemId: string;
  /** Short title shown in the preview list. */
  title: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** The user's current selection from the library list. */
  selection: ExportSelectionItem[];
};

type SortOrder = "saved_desc" | "saved_asc" | "title";
type FileFormat = "pdf";

type GenState =
  | { phase: "idle" }
  | { phase: "generating" }
  | { phase: "done"; exportId: string }
  | { phase: "error"; message: string };

type PreviewState = "ok" | "failed";

/**
 * F-M1 PDF 내보내기 모달 — reverses the earlier print-only supersede.
 *
 * Regions:
 *  1 배경 내 서재: Modal supplies the dim background + body scroll-lock. The
 *    selection-lost exception (선택 항목이 사라지면) renders an error Result
 *    instead of the option form.
 *  2 PDF 옵션: 포함 항목 / 정렬 / 답안·피드백 토글 / 형식 / 파일명(1-60자) /
 *    항목 <=6 / 개인정보 확인 필수.
 *  3 미리보기: 1-page condensed preview; on preview-fail show a text summary +
 *    재생성 CTA.
 *  4 내보내기 CTA: generating-disabled -> after success a single download CTA;
 *    on fail a retry + 문의 link.
 *
 * Real generate path = browser print via triggerPdfExport (source_type=
 * 'library_selection', source_id=null) which writes the export_files ledger
 * row. Stored-file download (generated-exports bucket) is honestly 준비 중.
 */
export function PdfExportModal({ open, onClose, selection }: Props) {
  const t = useTranslations("library.pdf");
  // Modal 셸은 항상 마운트 상태로 두되, 본문은 open될 때마다 새 key로 새로
  // 마운트한다 → effect+setState로 초기화하지 않고도 transient 상태가 깨끗하게
  // 리셋된다(React "reset state with a key" 권장 패턴). destroyOnClose가
  // 닫힐 때 본문을 언마운트하므로 다음 open 시 기본 state로 시작한다.
  return (
    <AppModal
      open={open}
      onCancel={onClose}
      title={t("modalTitle")}
      width={680}
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
  const [sortOrder, setSortOrder] = useState<SortOrder>("saved_desc");
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeFeedback, setIncludeFeedback] = useState(true);
  const [format] = useState<FileFormat>("pdf");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [gen, setGen] = useState<GenState>({ phase: "idle" });
  const [preview, setPreview] = useState<PreviewState>("ok");

  const selectionLost = selection.length === 0;
  const tooMany = selection.length > MAX_ITEMS;

  const filenameError = useMemo(() => {
    const trimmed = filename.trim();
    if (trimmed.length === 0) return t("filenameEmptyError");
    if (trimmed.length > FILENAME_MAX)
      return t("filenameTooLongError", { max: FILENAME_MAX });
    return null;
  }, [filename, t]);

  const previewItems = useMemo(() => {
    const items = [...selection].slice(0, MAX_ITEMS);
    if (sortOrder === "title") {
      items.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    } else if (sortOrder === "saved_asc") {
      items.reverse();
    }
    return items;
  }, [selection, sortOrder]);

  const canExport =
    !selectionLost &&
    !tooMany &&
    filenameError === null &&
    privacyConfirmed &&
    gen.phase !== "generating";

  async function handleExport() {
    setGen({ phase: "generating" });
    try {
      const result = await triggerPdfExport({
        sourceType: "library_selection",
        sourceId: null,
      });
      setGen({ phase: "done", exportId: result.exportId });
      message.success(t("printDialogOpened"));
    } catch (err) {
      setGen({
        phase: "error",
        message:
          err instanceof Error ? err.message : t("generateFailed"),
      });
    }
  }

  return (
    <>
      {selectionLost ? (
        // Region 1 예외: 선택 항목이 사라짐.
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
      ) : (
        <div
          data-testid="pdf-export-modal"
          className="flex max-h-96 w-full flex-col gap-4 overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0"
        >
          {tooMany ? (
            <Alert
              type="warning"
              showIcon
              title={t("tooManyTitle", { max: MAX_ITEMS })}
              description={t("tooManyDescription", { count: selection.length })}
            />
          ) : null}

          {/* Region 2: PDF 옵션 */}
          <Form layout="vertical">
            <Form.Item
              className="mb-3"
              label={t("filenameLabel")}
              required
              validateStatus={filenameError ? "error" : undefined}
              help={
                filenameError ??
                t("filenameCount", {
                  count: filename.trim().length,
                  max: FILENAME_MAX,
                })
              }
            >
              <Space.Compact className="w-full">
                <Input
                  data-testid="pdf-export-filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  maxLength={FILENAME_MAX}
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

            <Form.Item className="mb-3" label={t("includeLabel")}>
              <div className="flex flex-col gap-2">
                <Checkbox
                  checked={includeAnswers}
                  onChange={(e) => setIncludeAnswers(e.target.checked)}
                >
                  {t("includeAnswers")}
                </Checkbox>
                <Checkbox
                  checked={includeFeedback}
                  onChange={(e) => setIncludeFeedback(e.target.checked)}
                >
                  {t("includeFeedback")}
                </Checkbox>
              </div>
            </Form.Item>

            <Form.Item className="mb-3" label={t("sortLabel")}>
              <Radio.Group
                className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              >
                <Radio value="saved_desc">{t("sortRecent")}</Radio>
                <Radio value="saved_asc">{t("sortOldest")}</Radio>
                <Radio value="title">{t("sortTitle")}</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item className="mb-3" label={t("formatLabel")}>
              <Radio.Group
                className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
                value={format}
              >
                <Radio value="pdf">PDF</Radio>
              </Radio.Group>
            </Form.Item>

            {/* 개인정보 확인 필수 */}
            <Form.Item className="mb-0">
              <Checkbox
                data-testid="pdf-export-privacy-confirm"
                checked={privacyConfirmed}
                onChange={(e) => setPrivacyConfirmed(e.target.checked)}
              >
                {t("privacyConfirm")}
              </Checkbox>
            </Form.Item>
          </Form>

          <Divider className="my-1" />

          {/* Region 3: 미리보기 (1페이지 축약) */}
          <div>
            <Text strong>{t("previewLabel")}</Text>
            {preview === "failed" ? (
              <Alert
                className="mt-2"
                type="warning"
                showIcon
                title={t("previewFailedTitle")}
                description={
                  <div className="flex flex-col gap-2">
                    <Text type="secondary">
                      {t("previewSummary", {
                        count: previewItems.length,
                        answers: includeAnswers
                          ? t("included")
                          : t("excluded"),
                        feedback: includeFeedback
                          ? t("included")
                          : t("excluded"),
                      })}
                    </Text>
                    <Button size="small" onClick={() => setPreview("ok")}>
                      {t("regeneratePreview")}
                    </Button>
                  </div>
                }
              />
            ) : (
              <div
                data-testid="pdf-export-preview"
                className="mt-2 max-h-56 overflow-hidden rounded-2xl border border-border p-4"
                aria-label={t("previewAriaLabel")}
              >
                <Title level={5} className="mt-0">
                  {filename.trim() || t("filenameDefault")}
                </Title>
                <Paragraph type="secondary" className="mb-2">
                  {t("previewSubtitle", { count: previewItems.length })}
                </Paragraph>
                <ol className="m-0 list-decimal pl-5">
                  {previewItems.map((it) => (
                    <li key={it.itemId} data-testid="pdf-export-preview-item">
                      <Text>{it.title}</Text>
                      {includeAnswers ? (
                        <Text type="secondary">{t("previewAnswerTag")}</Text>
                      ) : null}
                      {includeFeedback ? (
                        <Text type="secondary">{t("previewFeedbackTag")}</Text>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {selection.length > previewItems.length ? (
                  <Text type="secondary">
                    {t("previewMore", {
                      count: selection.length - previewItems.length,
                    })}
                  </Text>
                ) : null}
              </div>
            )}
          </div>

          {/* Region 4: 내보내기 CTA */}
          {gen.phase === "error" ? (
            <Alert
              type="error"
              showIcon
              title={t("errorTitle")}
              description={
                <div className="flex flex-col gap-2">
                  <Text type="secondary">{gen.message}</Text>
                  <div className="flex flex-wrap gap-2">
                    <Button size="small" type="primary" onClick={handleExport}>
                      {t("retry")}
                    </Button>
                    <Button
                      size="small"
                      href={`mailto:support@talkpik.example?subject=${encodeURIComponent(
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
              type="success"
              showIcon
              title={t("doneTitle")}
              description={
                <div className="flex flex-col gap-2">
                  <Text type="secondary">{t("doneDescription")}</Text>
                  <div className="flex flex-wrap gap-2">
                    <Button size="small" type="primary" onClick={handleExport}>
                      {t("reprint")}
                    </Button>
                    <Button size="small" disabled>
                      {t("downloadStored")}
                    </Button>
                  </div>
                </div>
              }
            />
          ) : null}

          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button data-testid="pdf-export-close" onClick={onClose}>
              {t("close")}
            </Button>
            <Button
              data-testid="pdf-export-submit"
              type="primary"
              loading={gen.phase === "generating"}
              disabled={!canExport}
              onClick={handleExport}
            >
              {gen.phase === "generating" ? t("generating") : t("export")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
