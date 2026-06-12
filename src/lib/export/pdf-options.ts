// F-M1 서버 PDF 내보내기 — 클라이언트(모달)와 서버(route)가 공유하는 순수
// 옵션 계약. options JSON 허용 키는 브리프(docs/pdf-export-real-file-brief-
// 20260612.md) §2-5에서 확정: filename / includeAnswers / includeFeedback /
// layout / orientation (+ 서버가 source: 'server_render'를 덧붙인다).
import { z } from "zod";

export const PDF_EXPORT_MAX_ITEMS = 6;
export const PDF_FILENAME_MAX = 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const pdfExportOptionsSchema = z.object({
  filename: z.string().trim().min(1).max(PDF_FILENAME_MAX),
  includeAnswers: z.boolean(),
  includeFeedback: z.boolean(),
  // hifi §3 레이아웃 옵션: 두 페이지(문제별 페이지 구분) / 한 페이지(연속).
  layout: z.enum(["paged", "continuous"]),
  orientation: z.enum(["portrait", "landscape"]),
});

export type PdfExportOptions = z.infer<typeof pdfExportOptionsSchema>;

const uuid = z.string().regex(UUID_PATTERN, "must be a uuid");

export const pdfExportRequestSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("submission"),
    sourceId: uuid,
    options: pdfExportOptionsSchema,
  }),
  z.object({
    sourceType: z.literal("report"),
    sourceId: uuid,
    options: pdfExportOptionsSchema,
  }),
  z.object({
    sourceType: z.literal("library_selection"),
    // library_items.id 목록 — RLS가 본인 소유만 돌려주므로 서버에서 재검증된다.
    itemIds: z.array(uuid).min(1).max(PDF_EXPORT_MAX_ITEMS),
    options: pdfExportOptionsSchema,
  }),
]);

export type PdfExportRequest = z.infer<typeof pdfExportRequestSchema>;

export const PDF_EXPORT_DEFAULT_OPTIONS: Omit<PdfExportOptions, "filename"> = {
  includeAnswers: true,
  includeFeedback: true,
  layout: "paged",
  orientation: "portrait",
};

/**
 * hifi "예상 분량 N 페이지" 배지용 추정치. 실제 페이지 수는 답안 길이에 따라
 * 달라지므로 어디까지나 안내용 휴리스틱이다: 항목당 (답안 1p + 피드백 1p),
 * 연속 레이아웃은 페이지 구분이 없어 약 60%로 압축된다고 본다.
 */
export function estimatePdfPages(input: {
  itemCount: number;
  includeAnswers: boolean;
  includeFeedback: boolean;
  layout: PdfExportOptions["layout"];
}): number {
  const perItem =
    (input.includeAnswers ? 1 : 0) + (input.includeFeedback ? 1 : 0) || 1;
  const raw = Math.max(1, input.itemCount) * perItem;
  if (input.layout === "paged") return Math.max(1, raw);
  return Math.max(1, Math.ceil(raw * 0.6));
}

const FILENAME_FORBIDDEN = new Set([
  "<",
  ">",
  ":",
  '"',
  "/",
  "\\",
  "|",
  "?",
  "*",
]);

/**
 * 다운로드 파일명 정리 — 경로 구분자/예약문자/제어문자만 제거한다(한글 등
 * 비ASCII는 그대로 허용). 저장소 경로는 항상 exports/{user_id}/{export_id}.pdf
 * 라서 파일명은 다운로드 표시용으로만 쓰인다.
 */
export function sanitizePdfFilename(filename: string): string {
  let cleaned = "";
  for (const ch of filename.trim()) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20) continue; // 제어문자
    if (FILENAME_FORBIDDEN.has(ch)) continue;
    cleaned += ch;
  }
  cleaned = cleaned.slice(0, PDF_FILENAME_MAX);
  return cleaned.length > 0 ? cleaned : "talkpik-export";
}
