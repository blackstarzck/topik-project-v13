import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";

import {
  buildPdfDocument,
  registerPdfFonts,
  type PdfSubmissionItem,
} from "../../../src/lib/export/pdf-document";

// 실제 렌더 스모크 — 폰트 임베딩이 깨지면(파일 누락/포맷 미지원) 여기서
// 터진다. 런타임(라우트)에서 처음 발견하지 않도록 단위에서 잡는다.

const SUBMISSION: PdfSubmissionItem = {
  kind: "submission",
  problemId: "problem-1",
  questionNo: 51,
  problemContext: {
    kind: "q51",
    title: "기숙사 방 변경 문의",
    prompt: "기숙사 방을 변경하고 싶습니다. (ㄱ) 확인해 주십시오.",
    blankedPrompt: "기숙사 방을 변경하고 싶습니다. (ㄱ) 확인해 주십시오.",
    blanks: [
      {
        label: "ㄱ",
        role: "문장 연결",
        functionLabel: "요청 이유 설명",
        answerType: "한 문장",
      },
    ],
  },
  submittedAt: "2026-06-12",
  answerText:
    "한국어 답안 본문입니다. 줄바꿈과 긴 문장이 페이지 안에서 잘 흘러야 합니다. ".repeat(
      8,
    ),
  charCount: 320,
  feedback: {
    scoreTotal: 82,
    scoreMax: 100,
    overallSummary:
      "전반적으로 안정적인 답안입니다. 표현을 다듬으면 더 좋아요.",
    dimensions: [
      {
        dimension: "grammar",
        score: 76,
        scoreMax: 100,
        summary: "문법 — 양호",
      },
      { dimension: "vocab", score: 78, scoreMax: 100, summary: "어휘 — 양호" },
    ],
    sentences: [
      {
        sentenceIndex: 0,
        originalText: "저는 기숙사에 살고 있는다.",
        correctedText: "저는 기숙사에 살고 있다.",
        comment: "현재진행 표현을 정리했어요.",
      },
    ],
  },
};

const OPTIONS = {
  filename: "내서재-내보내기",
  includeAnswers: true,
  includeFeedback: true,
  layout: "paged",
  orientation: "portrait",
} as const;

const Q53_SUBMISSION: PdfSubmissionItem = {
  ...SUBMISSION,
  problemId: "problem-53",
  questionNo: 53,
  problemContext: {
    kind: "q53",
    title: "온라인 학습 이용률",
    prompt: "자료를 분석하여 이용률의 변화를 설명하십시오.",
    writingTasks: [
      "연도별 변화를 설명하십시오.",
      "집단별 차이를 비교하십시오.",
    ],
    materialCards: [
      {
        id: "chart-a",
        kind: "chart",
        title: "연도별 이용률",
        subtitle: "단위: %",
        chart: {
          title: "연도별 이용률",
          unit: "%",
          yearRange: [2024, 2025],
          series: [
            { label: "전체", values: [40, 55] },
            { label: "20대", values: [48, 63] },
          ],
        },
      },
    ],
  },
};

const Q54_SUBMISSION: PdfSubmissionItem = {
  ...SUBMISSION,
  problemId: "problem-54",
  questionNo: 54,
  problemContext: {
    kind: "q54",
    title: "원격 근무의 장단점",
    prompt: "원격 근무에 대한 자신의 생각을 쓰십시오.",
    topicTitle: "원격 근무",
    topicDefinition: "사무실 밖에서 정보통신 기술을 이용해 일하는 방식",
    background: "원격 근무를 도입하는 조직이 늘고 있습니다.",
    requiredQuestions: [
      "원격 근무의 장점은 무엇입니까?",
      "문제점은 무엇입니까?",
      "바람직한 운영 방법은 무엇입니까?",
    ],
  },
};

describe("buildPdfDocument", () => {
  it("renders a Korean submission PDF (magic bytes + embedded font size)", async () => {
    registerPdfFonts();
    const buffer = await renderToBuffer(
      buildPdfDocument({
        title: "내서재-내보내기",
        generatedAtLabel: "2026-06-12",
        items: [
          SUBMISSION,
          {
            ...SUBMISSION,
            problemId: "problem-52",
            questionNo: 52,
            problemContext: {
              kind: "q52",
              title: "기숙사 방 변경 문의",
              prompt: "기숙사 방을 변경하고 싶습니다. (ㄱ) 확인해 주십시오.",
              blankedPrompt:
                "기숙사 방을 변경하고 싶습니다. (ㄱ) 확인해 주십시오.",
              blanks: [
                {
                  label: "ㄱ",
                  role: "문장 연결",
                  functionLabel: "요청 이유 설명",
                  answerType: "한 문장",
                },
              ],
            },
          },
          Q53_SUBMISSION,
          Q54_SUBMISSION,
          {
            ...SUBMISSION,
            problemId: "problem-missing",
            questionNo: 51,
            problemContext: { kind: "unavailable", questionNo: 51 },
          },
        ],
        options: OPTIONS,
      }),
    );

    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // NanumGothic 서브셋이 실제로 임베딩되면 수십 KB 이상이 된다 —
    // 폰트 없이 빈 글리프로 떨어지는 회귀를 크기로 감지한다.
    expect(buffer.length).toBeGreaterThan(20_000);
  }, 60_000);

  it("renders the continuous/landscape variant without throwing", async () => {
    registerPdfFonts();
    const buffer = await renderToBuffer(
      buildPdfDocument({
        title: "연속 레이아웃",
        generatedAtLabel: "2026-06-12",
        items: [SUBMISSION],
        options: { ...OPTIONS, layout: "continuous", orientation: "landscape" },
      }),
    );
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 60_000);
});
