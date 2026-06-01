import { Col, Empty, Row } from "antd";
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
    // 반응형: 모바일(xs/sm)에서는 본문→도움말이 세로로 쌓이고, lg 이상에서만
    // 좌(본문)/우(도움말) 2단으로 배치한다. 고정 폭 grid의 360px 가로 넘침 해소.
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={17}>
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
      </Col>
      <Col xs={24} lg={7}>
        <HelpPanel />
      </Col>
    </Row>
  );
}
