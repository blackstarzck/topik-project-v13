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
import pdfDocumentStyles from "./pdf-document-styles.json";

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

export type PdfBlankContext = {
  label: string;
  role: string | null;
  functionLabel: string | null;
  answerType: string | null;
};

export type PdfChartContext = {
  title: string;
  unit: string | null;
  yearRange: Array<string | number>;
  series: Array<{
    label: string;
    values: number[];
  }>;
};

export type PdfMaterialCardContext =
  | {
      id: string;
      kind: "chart";
      title: string;
      subtitle: string | null;
      chart: PdfChartContext;
    }
  | {
      id: string;
      kind: "reference";
      title: string;
      subtitle: string | null;
      rows: Array<{ label: string; value: string }>;
    };

type PdfAvailableProblemContext = {
  title: string;
  prompt: string;
};

export type PdfProblemContext =
  | {
      kind: "unavailable";
      questionNo: number;
    }
  | (PdfAvailableProblemContext & {
      kind: "q51" | "q52";
      blankedPrompt: string;
      blanks: PdfBlankContext[];
    })
  | (PdfAvailableProblemContext & {
      kind: "q53";
      writingTasks: string[];
      materialCards: PdfMaterialCardContext[];
    })
  | (PdfAvailableProblemContext & {
      kind: "q54";
      topicTitle: string;
      topicDefinition: string | null;
      background: string | null;
      requiredQuestions: string[];
    });

export type PdfSubmissionItem = {
  kind: "submission";
  problemId: string;
  questionNo: number;
  problemContext: PdfProblemContext;
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

type PdfStyleValue =
  | ReturnType<typeof StyleSheet.create>[string]
  | Array<ReturnType<typeof StyleSheet.create>[string]>;

const styles = StyleSheet.create(
  pdfDocumentStyles as Parameters<typeof StyleSheet.create>[0],
);
/*
 * react-pdf의 style은 브라우저 DOM inline style이 아니다. JSX attribute를
 * 직접 쓰지 않고 이 adapter를 통과시켜 두 렌더러의 style 계약을 분리한다.
 */
function pdfStyle(style: PdfStyleValue) {
  return { style };
}

function ProblemContextBlock({ context }: { context: PdfProblemContext }) {
  if (context.kind === "unavailable") {
    return (
      <View>
        <Text {...pdfStyle(styles.sectionTitle)}>문제</Text>
        <View {...pdfStyle(styles.problemCard)}>
          <Text {...pdfStyle(styles.emptyNote)}>
            제출 당시 문제 정보를 확인할 수 없습니다.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text {...pdfStyle(styles.sectionTitle)}>실제 제출 문제</Text>
      <View {...pdfStyle(styles.problemCard)}>
        <Text {...pdfStyle(styles.bodyText)}>{context.prompt}</Text>
      </View>

      {context.kind === "q51" || context.kind === "q52" ? (
        <View>
          {context.blanks.map((blank, index) => {
            const fields = [
              blank.role ? `역할: ${blank.role}` : null,
              blank.functionLabel
                ? `문맥상 기능: ${blank.functionLabel}`
                : null,
              blank.answerType ? `요구 답안 형태: ${blank.answerType}` : null,
            ].filter((field): field is string => Boolean(field));
            return fields.length > 0 ? (
              <View
                key={`${blank.label}-${index}`}
                {...pdfStyle(styles.contextCard)}
              >
                <Text {...pdfStyle(styles.contextTitle)}>
                  빈칸 {blank.label || index + 1}
                </Text>
                {fields.map((field) => (
                  <Text key={field} {...pdfStyle(styles.contextMeta)}>
                    {field}
                  </Text>
                ))}
              </View>
            ) : null;
          })}
        </View>
      ) : null}

      {context.kind === "q53" ? (
        <View>
          {context.writingTasks.length > 0 ? (
            <View {...pdfStyle(styles.contextCard)}>
              <Text {...pdfStyle(styles.contextTitle)}>작성 과제</Text>
              {context.writingTasks.map((task, index) => (
                <Text key={`${task}-${index}`} {...pdfStyle(styles.listItem)}>
                  {index + 1}. {task}
                </Text>
              ))}
            </View>
          ) : null}
          {context.materialCards.map((card) => (
            <View key={card.id} {...pdfStyle(styles.contextCard)}>
              <Text {...pdfStyle(styles.contextTitle)}>{card.title}</Text>
              {card.subtitle ? (
                <Text {...pdfStyle(styles.contextMeta)}>{card.subtitle}</Text>
              ) : null}
              {card.kind === "reference" ? (
                card.rows.map((row, index) => (
                  <Text
                    key={`${row.label}-${index}`}
                    {...pdfStyle(styles.contextMeta)}
                  >
                    {row.label}: {row.value}
                  </Text>
                ))
              ) : (
                <View {...pdfStyle(styles.table)}>
                  <View {...pdfStyle([styles.tableRow, styles.tableHeader])}>
                    <Text {...pdfStyle(styles.tableCell)}>범례</Text>
                    {(card.chart.yearRange.length > 0
                      ? card.chart.yearRange
                      : (card.chart.series[0]?.values.map(
                          (_, index) => index + 1,
                        ) ?? [])
                    ).map((label, index, labels) => (
                      <Text
                        key={`${label}-${index}`}
                        {...pdfStyle([
                          styles.tableCell,
                          index === labels.length - 1
                            ? styles.tableCellLast
                            : {},
                        ])}
                      >
                        {String(label)}
                      </Text>
                    ))}
                  </View>
                  {card.chart.series.map((series) => (
                    <View key={series.label} {...pdfStyle(styles.tableRow)}>
                      <Text {...pdfStyle(styles.tableCell)}>
                        {series.label}
                      </Text>
                      {series.values.map((value, index) => (
                        <Text
                          key={`${series.label}-${index}`}
                          {...pdfStyle([
                            styles.tableCell,
                            index === series.values.length - 1
                              ? styles.tableCellLast
                              : {},
                          ])}
                        >
                          {value}
                          {card.chart.unit ?? ""}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {context.kind === "q54" ? (
        <View {...pdfStyle(styles.contextCard)}>
          <Text {...pdfStyle(styles.contextTitle)}>{context.topicTitle}</Text>
          {context.topicDefinition ? (
            <Text {...pdfStyle(styles.contextMeta)}>
              {context.topicDefinition}
            </Text>
          ) : null}
          {context.background ? (
            <Text {...pdfStyle(styles.contextMeta)}>
              배경: {context.background}
            </Text>
          ) : null}
          {context.requiredQuestions.map((question, index) => (
            <Text key={`${question}-${index}`} {...pdfStyle(styles.listItem)}>
              {index + 1}. {question}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SubmissionBlock({
  item,
  options,
}: {
  item: PdfSubmissionItem;
  options: PdfExportOptions;
}) {
  const fb = item.feedback;
  return (
    <View {...pdfStyle(styles.itemBlock)}>
      <Text {...pdfStyle(styles.itemTitle)}>
        {item.questionNo}번 ·{" "}
        {item.problemContext.kind === "unavailable"
          ? "쓰기 문제"
          : item.problemContext.title}
      </Text>
      <Text {...pdfStyle(styles.itemMeta)}>
        제출일 {item.submittedAt} · {item.charCount}자
      </Text>

      <ProblemContextBlock context={item.problemContext} />

      {options.includeAnswers ? (
        <View>
          <Text {...pdfStyle(styles.sectionTitle)}>내 답안</Text>
          <View {...pdfStyle(styles.answerBox)}>
            <Text {...pdfStyle(styles.bodyText)}>
              {item.answerText.trim().length > 0
                ? item.answerText
                : "(작성된 답안이 없습니다)"}
            </Text>
          </View>
        </View>
      ) : null}

      {options.includeFeedback ? (
        <View {...pdfStyle(styles.feedbackSection)}>
          <Text {...pdfStyle(styles.sectionTitle)}>점수와 종합 피드백</Text>
          {fb ? (
            <View>
              <View {...pdfStyle(styles.scoreRow)}>
                <Text {...pdfStyle(styles.scoreTotal)}>
                  {fb.scoreTotal ?? "-"} / {fb.scoreMax ?? 100}
                </Text>
              </View>
              {fb.overallSummary ? (
                <Text {...pdfStyle(styles.bodyText)}>{fb.overallSummary}</Text>
              ) : null}
              {fb.dimensions.length > 0 ? (
                <Text {...pdfStyle(styles.sectionTitle)}>영역별 피드백</Text>
              ) : null}
              {fb.dimensions.map((d) => (
                <View
                  key={`s-${d.dimension}`}
                  {...pdfStyle(styles.sentenceRow)}
                >
                  <Text {...pdfStyle(styles.scoreChip)}>
                    {DIMENSION_LABELS[d.dimension] ?? d.dimension}{" "}
                    {d.score ?? "-"}/{d.scoreMax ?? 100}
                  </Text>
                  {d.summary ? (
                    <Text {...pdfStyle(styles.bodyText)}>{d.summary}</Text>
                  ) : null}
                </View>
              ))}
              {fb.sentences.length > 0 ? (
                <View {...pdfStyle(styles.sentenceList)}>
                  <Text {...pdfStyle(styles.sectionTitle)}>문장별 첨삭</Text>
                  {fb.sentences.map((s) => (
                    <View
                      key={s.sentenceIndex}
                      {...pdfStyle(styles.sentenceRow)}
                    >
                      {s.originalText ? (
                        <Text {...pdfStyle(styles.sentenceOriginal)}>
                          {s.sentenceIndex + 1}. {s.originalText}
                        </Text>
                      ) : null}
                      {s.correctedText ? (
                        <Text {...pdfStyle(styles.sentenceCorrected)}>
                          → {s.correctedText}
                        </Text>
                      ) : null}
                      {s.comment ? (
                        <Text {...pdfStyle(styles.sentenceComment)}>
                          {s.comment}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <Text {...pdfStyle(styles.emptyNote)}>
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
    <View {...pdfStyle(styles.itemBlock)}>
      <Text {...pdfStyle(styles.itemTitle)}>비교 리포트</Text>
      <Text {...pdfStyle(styles.itemMeta)}>생성일 {item.generatedAt}</Text>
      <Text {...pdfStyle(styles.sectionTitle)}>리포트 내용</Text>
      <Text {...pdfStyle(styles.bodyText)}>
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
      <View {...pdfStyle(styles.brandRow)} fixed>
        <Text {...pdfStyle(styles.brand)}>DOTORE TOPIK</Text>
        <Text {...pdfStyle(styles.brandMeta)}>답안 및 피드백 리포트</Text>
      </View>
      <Text {...pdfStyle(styles.docTitle)}>{title}</Text>
      <Text {...pdfStyle(styles.docSubtitle)}>생성일 {generatedAtLabel}</Text>
      {children}
      <View {...pdfStyle(styles.footer)} fixed>
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
            {...pdfStyle(styles.page)}
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
      <Page size="A4" orientation={orientation} {...pdfStyle(styles.page)}>
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
