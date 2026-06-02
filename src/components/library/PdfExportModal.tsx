"use client";

import {
  Alert,
  App,
  Button,
  Checkbox,
  Divider,
  Form,
  Input,
  Modal,
  Radio,
  Result,
  Space,
  Typography,
} from "antd";
import { useMemo, useState } from "react";

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
  // Modal 셸은 항상 마운트 상태로 두되, 본문은 open될 때마다 새 key로 새로
  // 마운트한다 → effect+setState로 초기화하지 않고도 transient 상태가 깨끗하게
  // 리셋된다(React "reset state with a key" 권장 패턴). destroyOnClose가
  // 닫힐 때 본문을 언마운트하므로 다음 open 시 기본 state로 시작한다.
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="PDF로 내보내기"
      width={680}
      maskClosable={false}
      footer={null}
      destroyOnClose
    >
      {open ? (
        <PdfExportModalBody onClose={onClose} selection={selection} />
      ) : null}
    </Modal>
  );
}

function PdfExportModalBody({
  onClose,
  selection,
}: {
  onClose: () => void;
  selection: ExportSelectionItem[];
}) {
  const { message } = App.useApp();

  const [filename, setFilename] = useState("내서재-내보내기");
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
    if (trimmed.length === 0) return "파일명을 입력해 주세요.";
    if (trimmed.length > FILENAME_MAX)
      return `파일명은 ${FILENAME_MAX}자 이하여야 해요.`;
    return null;
  }, [filename]);

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
      message.success("PDF 출력 대화상자가 열렸습니다.");
    } catch (err) {
      setGen({
        phase: "error",
        message:
          err instanceof Error ? err.message : "PDF 생성에 실패했어요.",
      });
    }
  }

  return (
    <>
      {selectionLost ? (
        // Region 1 예외: 선택 항목이 사라짐.
        <Result
          status="warning"
          title="선택한 항목을 찾을 수 없어요"
          subTitle="선택이 해제되었거나 항목이 삭제되었습니다. 목록에서 다시 선택해 주세요."
          extra={
            <Button type="primary" onClick={onClose}>
              목록으로 돌아가기
            </Button>
          }
        />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {tooMany ? (
            <Alert
              type="warning"
              showIcon
              message={`한 번에 ${MAX_ITEMS}개까지 내보낼 수 있어요`}
              description={`현재 ${selection.length}개가 선택되어 있습니다. 선택을 줄여 주세요.`}
            />
          ) : null}

          {/* Region 2: PDF 옵션 */}
          <Form layout="vertical">
            <Form.Item
              label="파일명"
              required
              validateStatus={filenameError ? "error" : undefined}
              help={filenameError ?? `${filename.trim().length}/${FILENAME_MAX}자`}
              style={{ marginBottom: 12 }}
            >
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                maxLength={FILENAME_MAX}
                aria-label="파일명"
                addonAfter=".pdf"
              />
            </Form.Item>

            <Form.Item label="포함 항목" style={{ marginBottom: 12 }}>
              <Space direction="vertical">
                <Checkbox
                  checked={includeAnswers}
                  onChange={(e) => setIncludeAnswers(e.target.checked)}
                >
                  내 답안 포함
                </Checkbox>
                <Checkbox
                  checked={includeFeedback}
                  onChange={(e) => setIncludeFeedback(e.target.checked)}
                >
                  AI 피드백 포함
                </Checkbox>
              </Space>
            </Form.Item>

            <Form.Item label="정렬" style={{ marginBottom: 12 }}>
              <Radio.Group
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              >
                <Radio value="saved_desc">최근 저장순</Radio>
                <Radio value="saved_asc">오래된순</Radio>
                <Radio value="title">제목순</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="파일 형식" style={{ marginBottom: 12 }}>
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
                내보내는 파일에 개인 학습 정보가 포함될 수 있음을 확인했습니다.
              </Checkbox>
            </Form.Item>
          </Form>

          <Divider style={{ margin: "4px 0" }} />

          {/* Region 3: 미리보기 (1페이지 축약) */}
          <div>
            <Text strong>미리보기</Text>
            {preview === "failed" ? (
              <Alert
                style={{ marginTop: 8 }}
                type="warning"
                showIcon
                message="미리보기를 만들지 못했어요"
                description={
                  <Space direction="vertical">
                    <Text type="secondary">
                      {`내보낼 항목 ${previewItems.length}개 · 답안 ${
                        includeAnswers ? "포함" : "제외"
                      } · 피드백 ${includeFeedback ? "포함" : "제외"}`}
                    </Text>
                    <Button size="small" onClick={() => setPreview("ok")}>
                      미리보기 재생성
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
                aria-label="PDF 미리보기"
              >
                <Title level={5} style={{ marginTop: 0 }}>
                  {filename.trim() || "내서재-내보내기"}
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  TALKPIK 내 서재 · {previewItems.length}개 항목
                </Paragraph>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {previewItems.map((it) => (
                    <li key={it.itemId}>
                      <Text>{it.title}</Text>
                      {includeAnswers ? (
                        <Text type="secondary"> · 답안</Text>
                      ) : null}
                      {includeFeedback ? (
                        <Text type="secondary"> · 피드백</Text>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {selection.length > previewItems.length ? (
                  <Text type="secondary">
                    …외 {selection.length - previewItems.length}개 (긴 답안은
                    일부만 표시)
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
              message="PDF 생성에 실패했어요"
              description={
                <Space direction="vertical">
                  <Text type="secondary">{gen.message}</Text>
                  <Space>
                    <Button size="small" type="primary" onClick={handleExport}>
                      다시 시도
                    </Button>
                    <Button
                      size="small"
                      href="mailto:support@talkpik.example?subject=PDF 내보내기 오류"
                    >
                      문의하기
                    </Button>
                  </Space>
                </Space>
              }
            />
          ) : gen.phase === "done" ? (
            <Alert
              type="success"
              showIcon
              message="PDF 출력 준비 완료"
              description={
                <Space direction="vertical">
                  <Text type="secondary">
                    브라우저 인쇄 대화상자에서 &ldquo;PDF로 저장&rdquo;을 선택해
                    저장하세요.
                  </Text>
                  <Space>
                    <Button size="small" type="primary" onClick={handleExport}>
                      다시 인쇄
                    </Button>
                    <Button size="small" disabled>
                      저장된 파일 다운로드 (준비 중)
                    </Button>
                  </Space>
                </Space>
              }
            />
          ) : null}

          <Space style={{ justifyContent: "flex-end", width: "100%" }}>
            <Button onClick={onClose}>닫기</Button>
            <Button
              type="primary"
              loading={gen.phase === "generating"}
              disabled={!canExport}
              onClick={handleExport}
            >
              {gen.phase === "generating" ? "생성 중..." : "PDF 내보내기"}
            </Button>
          </Space>
        </Space>
      )}
    </>
  );
}
