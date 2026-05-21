import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

const VALID = new Set(["51", "52", "53", "54"]);

const IA_CODES: Record<string, { code: string; title: string }> = {
  "51": { code: "D-01", title: "쓰기 51 단답" },
  "52": { code: "D-02", title: "쓰기 52 답변" },
  "53": { code: "D-03", title: "쓰기 53 장문" },
  "54": { code: "D-04", title: "쓰기 54 에세이" },
};

export const metadata: Metadata = { title: "쓰기 — TALKPIK" };

export default async function WritingQuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  if (!VALID.has(questionId)) notFound();
  const meta = IA_CODES[questionId];
  return (
    <PlaceholderPage
      iaCode={meta.code}
      title={meta.title}
      phaseHint="작성 에디터·자동저장·제출 흐름은 Phase 5에서 채워집니다."
    />
  );
}
