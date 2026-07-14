// F-M1 서버 PDF 템플릿 — 간단 1안 (owner 확정 2026-06-12, 브리프 §3-D):
// 표지 없음, [제목 → 점수 → 답안 → 피드백] 순서, 상단 DOTORE TOPIK 로고 텍스트만.
// 본문 언어는 한국어 고정(§3-E) — NanumGothic(OFL)만 임베딩한다.
//
// 서버 전용 모듈이다(Node 런타임 route handler에서만 import). 클라이언트
// 번들에 폰트 등록/fs 접근이 들어가면 안 된다.
import path from "node:path";
import type { ReactNode } from "react";

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { PdfExportOptions } from "./pdf-options";

export type PdfFeedbackDimension = {
  dimension: string;
  score: number | null;
  scoreMax: number | null;
  summary: string | null;
};

export type PdfSentenceFeedback = {
  sentenceIndex: number;
  originalText: string | null;
  correctedText: string | null;
  comment: string | null;
};

export type PdfSubmissionItem = {
  kind: "submission";
  problemId: string;
  questionNo: number;
  problemTitle: string | null;
  submittedAt: string;
  answerText: string;
  charCount: number;
  feedback: {
    scoreTotal: number | null;
    scoreMax: number | null;
    overallSummary: string | null;
    dimensions: PdfFeedbackDimension[];
    sentences: PdfSentenceFeedback[];
  } | null;
};

export type PdfReportItem = {
  kind: "report";
  problemId: string;
  generatedAt: string;
  narrative: string | null;
};

export type PdfExportItem = PdfSubmissionItem | PdfReportItem;

export type PdfDocumentProps = {
  title: string;
  generatedAtLabel: string;
  items: PdfExportItem[];
  options: PdfExportOptions;
};

const FONT_FAMILY = "NanumGothic";

// 점수 차원 한국어 라벨 — 화면(E-01)과 동일한 표기.
const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합도",
  language: "언어",
};

let fontsRegistered = false;

/** NanumGothic Regular/Bold(TTF, OFL — public/fonts/pdf/OFL.txt)를 임베딩한다. */
export function registerPdfFonts(): void {
  if (fontsRegistered) return;
  const fontDir = path.join(process.cwd(), "public", "fonts", "pdf");
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: path.join(fontDir, "NanumGothic-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "NanumGothic-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // 한국어는 단어 사이 공백이 드물어 기본 줄바꿈(공백 기준)으로는 긴 문장이
  // 페이지를 넘친다 — 글자 단위로 줄바꿈을 허용한다(CJK 표준 처리).
  Font.registerHyphenationCallback((word) =>
    word.length > 1 ? Array.from(word) : [word],
  );
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    lineHeight: 1.55,
    color: "#1f1f1f",
    paddingTop: 44,
    paddingBottom: 52,
    paddingHorizontal: 48,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  brand: { fontSize: 11, fontWeight: 700, letterSpacing: 1 },
  brandMeta: { fontSize: 8, color: "#8c8c8c" },
  docTitle: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  docSubtitle: { fontSize: 9, color: "#8c8c8c", marginBottom: 14 },
  itemBlock: { marginBottom: 18 },
  itemTitle: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  itemMeta: { fontSize: 8, color: "#8c8c8c", marginBottom: 8 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginTop: 8,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#ededed",
  },
  scoreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  scoreTotal: { fontSize: 13, fontWeight: 700 },
  scoreChip: {
    fontSize: 8,
    color: "#454545",
    backgroundColor: "#f5f5f5",
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  bodyText: { fontSize: 9.5 },
  answerBox: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#ededed",
    borderRadius: 4,
    padding: 10,
  },
  sentenceRow: { marginBottom: 6 },
  sentenceOriginal: { fontSize: 9, color: "#8c8c8c" },
  sentenceCorrected: { fontSize: 9.5, fontWeight: 700 },
  sentenceComment: { fontSize: 8.5, color: "#454545" },
  emptyNote: { fontSize: 9, color: "#8c8c8c" },
  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#8c8c8c",
  },
});

function SubmissionBlock({
  item,
  options,
}: {
  item: PdfSubmissionItem;
  options: PdfExportOptions;
}) {
  const fb = item.feedback;
  return (
    <View style={styles.itemBlock}>
      <Text style={styles.itemTitle}>
        {item.questionNo}번 · {item.problemTitle ?? "쓰기 문제"}
      </Text>
      <Text style={styles.itemMeta}>
        제출일 {item.submittedAt} · {item.charCount}자
      </Text>

      {options.includeFeedback && fb ? (
        <View>
          <Text style={styles.sectionTitle}>점수</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreTotal}>
              {fb.scoreTotal ?? "-"} / {fb.scoreMax ?? 100}
            </Text>
            {fb.dimensions.map((d) => (
              <Text key={d.dimension} style={styles.scoreChip}>
                {DIMENSION_LABELS[d.dimension] ?? d.dimension} {d.score ?? "-"}/
                {d.scoreMax ?? 100}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {options.includeAnswers ? (
        <View>
          <Text style={styles.sectionTitle}>내 답안</Text>
          <View style={styles.answerBox}>
            <Text style={styles.bodyText}>
              {item.answerText.trim().length > 0
                ? item.answerText
                : "(작성된 답안이 없습니다)"}
            </Text>
          </View>
        </View>
      ) : null}

      {options.includeFeedback ? (
        <View>
          <Text style={styles.sectionTitle}>AI 피드백</Text>
          {fb ? (
            <View>
              {fb.overallSummary ? (
                <Text style={styles.bodyText}>{fb.overallSummary}</Text>
              ) : null}
              {fb.dimensions
                .filter((d) => d.summary)
                .map((d) => (
                  <Text key={`s-${d.dimension}`} style={styles.bodyText}>
                    · {DIMENSION_LABELS[d.dimension] ?? d.dimension}:{" "}
                    {d.summary}
                  </Text>
                ))}
              {fb.sentences.length > 0 ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.sectionTitle}>문장별 첨삭</Text>
                  {fb.sentences.map((s) => (
                    <View key={s.sentenceIndex} style={styles.sentenceRow}>
                      {s.originalText ? (
                        <Text style={styles.sentenceOriginal}>
                          {s.sentenceIndex + 1}. {s.originalText}
                        </Text>
                      ) : null}
                      {s.correctedText ? (
                        <Text style={styles.sentenceCorrected}>
                          → {s.correctedText}
                        </Text>
                      ) : null}
                      {s.comment ? (
                        <Text style={styles.sentenceComment}>{s.comment}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.emptyNote}>
              아직 생성된 AI 피드백이 없습니다.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function ReportBlock({ item }: { item: PdfReportItem }) {
  return (
    <View style={styles.itemBlock}>
      <Text style={styles.itemTitle}>비교 리포트</Text>
      <Text style={styles.itemMeta}>생성일 {item.generatedAt}</Text>
      <Text style={styles.sectionTitle}>리포트 내용</Text>
      <Text style={styles.bodyText}>
        {item.narrative ?? "(리포트 내용이 없습니다)"}
      </Text>
    </View>
  );
}

function PageChrome({
  title,
  generatedAtLabel,
  children,
}: {
  title: string;
  generatedAtLabel: string;
  children: ReactNode;
}) {
  return (
    <>
      <View style={styles.brandRow} fixed>
        <Text style={styles.brand}>DOTORE TOPIK</Text>
        <Text style={styles.brandMeta}>답안 및 피드백 리포트</Text>
      </View>
      <Text style={styles.docTitle}>{title}</Text>
      <Text style={styles.docSubtitle}>생성일 {generatedAtLabel}</Text>
      {children}
      <View style={styles.footer} fixed>
        <Text>DOTORE TOPIK · 학습용 리포트</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </>
  );
}

/**
 * 간단 1안 PDF 문서. layout='paged'면 항목마다 새 Page, 'continuous'면 한
 * Page 흐름(react-pdf가 넘치면 자동 분할). 호출 전 registerPdfFonts() 필수.
 */
export function buildPdfDocument({
  title,
  generatedAtLabel,
  items,
  options,
}: PdfDocumentProps) {
  const orientation = options.orientation;
  if (options.layout === "paged") {
    return (
      <Document title={title} language="ko">
        {items.map((item, index) => (
          <Page
            key={index}
            size="A4"
            orientation={orientation}
            style={styles.page}
          >
            <PageChrome title={title} generatedAtLabel={generatedAtLabel}>
              {item.kind === "submission" ? (
                <SubmissionBlock item={item} options={options} />
              ) : (
                <ReportBlock item={item} />
              )}
            </PageChrome>
          </Page>
        ))}
      </Document>
    );
  }
  return (
    <Document title={title} language="ko">
      <Page size="A4" orientation={orientation} style={styles.page}>
        <PageChrome title={title} generatedAtLabel={generatedAtLabel}>
          {items.map((item, index) =>
            item.kind === "submission" ? (
              <SubmissionBlock key={index} item={item} options={options} />
            ) : (
              <ReportBlock key={index} item={item} />
            ),
          )}
        </PageChrome>
      </Page>
    </Document>
  );
}
