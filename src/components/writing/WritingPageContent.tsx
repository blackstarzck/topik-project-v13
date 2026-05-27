import { Empty } from "antd";
import { QuestionPrompt } from "./QuestionPrompt";
import { HelpPanel } from "./HelpPanel";
import { WritingEditor } from "./WritingEditor";
import { LongFormEditor } from "./LongFormEditor";
import { isLongForm } from "@/lib/writing/types";
import type { QuestionNo, WritingDraftRow } from "@/lib/writing/types";
import type { WritingProblem } from "@/lib/writing/server";

type Props = {
  questionNo: QuestionNo;
  userId: string;
  problem: WritingProblem | null;
  draft: WritingDraftRow | null;
};

export function WritingPageContent({
  questionNo,
  userId,
  problem,
  draft,
}: Props) {
  if (!problem) {
    return (
      <Empty description={`${questionNo}번 문제가 아직 준비되지 않았습니다.`} />
    );
  }
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 280px" }}>
      <div style={{ display: "grid", gap: 16 }}>
        <QuestionPrompt
          questionNo={questionNo}
          title={problem.title}
          prompt={problem.prompt}
        />
        {isLongForm(questionNo) ? (
          <LongFormEditor
            userId={userId}
            problemId={problem.id}
            questionNo={questionNo as 53 | 54}
            initialDraft={draft}
            problemMaterials={problem.materials}
          />
        ) : (
          <WritingEditor
            userId={userId}
            problemId={problem.id}
            questionNo={questionNo}
            initialDraft={draft}
          />
        )}
      </div>
      <HelpPanel />
    </div>
  );
}
