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
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
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
              style={{ marginBottom: 12 }}
            >
              <Space.Compact style={{ width: "100%" }}>
                <Input
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
                  style={{ width: 56, textAlign: "center" }}
                />
              </Space.Compact>
            </Form.Item>

            <Form.Item label={t("includeLabel")} style={{ marginBottom: 12 }}>
              <Space orientation="vertical">
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
              </Space>
            </Form.Item>

            <Form.Item label={t("sortLabel")} style={{ marginBottom: 12 }}>
              <Radio.Group
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              >
                <Radio value="saved_desc">{t("sortRecent")}</Radio>
                <Radio value="saved_asc">{t("sortOldest")}</Radio>
                <Radio value="title">{t("sortTitle")}</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label={t("formatLabel")} style={{ marginBottom: 12 }}>
              <Radio.Group value={format}>
                <Radio value="pdf">PDF</Radio>
              </Radio.Group>
            </Form.Item>

            {/* 개인정보 확인 필수 */}
            <Form.Item style={{ marginBottom: 0 }}>
              <Checkbox
                checked={privacyConfirmed}
                onChange={(e) => setPrivacyConfirmed(e.target.checked)}
              >
                {t("privacyConfirm")}
              </Checkbox>
            </Form.Item>
          </Form>

          <Divider style={{ margin: "4px 0" }} />

          {/* Region 3: 미리보기 (1페이지 축약) */}
          <div>
            <Text strong>{t("previewLabel")}</Text>
            {preview === "failed" ? (
              <Alert
                style={{ marginTop: 8 }}
                type="warning"
                showIcon
                title={t("previewFailedTitle")}
                description={
                  <Space orientation="vertical">
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
                  </Space>
                }
              />
            ) : (
              <div
                style={{
                  border: "1px solid var(--ant-color-border)",
                  borderRadius: 8,
                  marginTop: 8,
                  padding: 16,
                  maxHeight: 220,
                  overflow: "hidden",
                }}
                aria-label={t("previewAriaLabel")}
              >
                <Title level={5} style={{ marginTop: 0 }}>
                  {filename.trim() || t("filenameDefault")}
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  {t("previewSubtitle", { count: previewItems.length })}
                </Paragraph>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {previewItems.map((it) => (
                    <li key={it.itemId}>
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
                <Space orientation="vertical">
                  <Text type="secondary">{gen.message}</Text>
                  <Space>
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
                  </Space>
                </Space>
              }
            />
          ) : gen.phase === "done" ? (
            <Alert
              type="success"
              showIcon
              title={t("doneTitle")}
              description={
                <Space orientation="vertical">
                  <Text type="secondary">{t("doneDescription")}</Text>
                  <Space>
                    <Button size="small" type="primary" onClick={handleExport}>
                      {t("reprint")}
                    </Button>
                    <Button size="small" disabled>
                      {t("downloadStored")}
                    </Button>
                  </Space>
                </Space>
              }
            />
          ) : null}

          <Space style={{ justifyContent: "flex-end", width: "100%" }}>
            <Button onClick={onClose}>{t("close")}</Button>
            <Button
              type="primary"
              loading={gen.phase === "generating"}
              disabled={!canExport}
              onClick={handleExport}
            >
              {gen.phase === "generating" ? t("generating") : t("export")}
            </Button>
          </Space>
        </Space>
      )}
    </>
  );
}
