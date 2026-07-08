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
  problemTitle: "기숙사 방 변경 문의",
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

describe("buildPdfDocument", () => {
  it("renders a Korean submission PDF (magic bytes + embedded font size)", async () => {
    registerPdfFonts();
    const buffer = await renderToBuffer(
      buildPdfDocument({
        title: "내서재-내보내기",
        generatedAtLabel: "2026-06-12",
        items: [SUBMISSION, { ...SUBMISSION, questionNo: 52 }],
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
