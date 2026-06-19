import { Button, Empty, Space } from "antd";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { EssayWriting54Workspace } from "./EssayWriting54Workspace";
import { LongFormWriting53Workspace } from "./LongFormWriting53Workspace";
import { ShortAnswerWriting51Workspace } from "./ShortAnswerWriting51Workspace";
import { ShortAnswerWriting52Workspace } from "./ShortAnswerWriting52Workspace";
import { writingQuestionHref } from "@/lib/writing/routes";
import type { QuestionNo, WritingDraftRow } from "@/lib/writing/types";
import type { WritingProblem } from "@/lib/writing/server";

type Props = {
  questionNo: QuestionNo;
  userId: string;
  problem: WritingProblem | null;
  draft: WritingDraftRow | null;
  canRetryProblemLoad?: boolean;
};

export async function WritingPageContent({
  questionNo,
  userId,
  problem,
  draft,
  canRetryProblemLoad = true,
}: Props) {
  const t = await getTranslations("writing.page");
  if (!problem) {
    // D-01 §2 예외 — 지문 로드 실패/문제 없음: 재시도 + 문제 목록 복귀 동선.
    const problemLoadFailed = t("problemLoadFailed", { questionNo });
    return (
      <Empty
        className="writing-empty-state"
        description={
          <h1 className="writing-empty-state__title">{problemLoadFailed}</h1>
        }
      >
        <Space>
          {canRetryProblemLoad ? (
            <Link href={writingQuestionHref(questionNo) as never}>
              <Button type="primary">{t("retry")}</Button>
            </Link>
          ) : null}
          <Link href={"/practice/problems" as never}>
            <Button type={canRetryProblemLoad ? "default" : "primary"}>
              {t("toProblemList")}
            </Button>
          </Link>
        </Space>
      </Empty>
    );
  }
  if (problem.kind === "q51") {
    return (
      <ShortAnswerWriting51Workspace
        userId={userId}
        problem={problem}
        draft={draft}
      />
    );
  }
  if (problem.kind === "q52") {
    return (
      <ShortAnswerWriting52Workspace
        userId={userId}
        problem={problem}
        draft={draft}
      />
    );
  }
  if (problem.kind === "q53") {
    return (
      <LongFormWriting53Workspace
        userId={userId}
        problem={problem}
        draft={draft}
      />
    );
  }
  if (problem.kind === "q54") {
    return (
      <EssayWriting54Workspace
        userId={userId}
        problem={problem}
        draft={draft}
      />
    );
  }
  return null;
}
