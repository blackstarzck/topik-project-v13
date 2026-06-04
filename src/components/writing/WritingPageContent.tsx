import { Button, Col, Empty, Row, Space } from "antd";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { QuestionPrompt } from "./QuestionPrompt";
import { HelpPanel } from "./HelpPanel";
import { ReferenceMaterials, type ProblemAsset } from "./ReferenceMaterials";
import { WritingEditor } from "./WritingEditor";
import { LongFormEditor } from "./LongFormEditor";
import type { ProblemRubric } from "./ConditionsPanel";
import { writingQuestionHref } from "@/lib/writing/routes";
import { isLongForm } from "@/lib/writing/types";
import type { QuestionNo, WritingDraftRow } from "@/lib/writing/types";
import type { WritingProblem } from "@/lib/writing/server";

type Props = {
  questionNo: QuestionNo;
  userId: string;
  problem: WritingProblem | null;
  draft: WritingDraftRow | null;
  assets?: ProblemAsset[];
  rubric?: ProblemRubric;
};

export async function WritingPageContent({
  questionNo,
  userId,
  problem,
  draft,
  assets = [],
  rubric = null,
}: Props) {
  const t = await getTranslations("writing.page");
  if (!problem) {
    // D-01 §2 예외 — 지문 로드 실패/문제 없음: 재시도 + 문제 목록 복귀 동선.
    return (
      <Empty description={t("problemLoadFailed", { questionNo })}>
        <Space>
          <Link href={writingQuestionHref(questionNo) as never}>
            <Button type="primary">{t("retry")}</Button>
          </Link>
          <Link href={"/practice/problems" as never}>
            <Button>{t("toProblemList")}</Button>
          </Link>
        </Space>
      </Empty>
    );
  }
  return (
    // 반응형: 모바일(xs/sm)에서는 본문→도움말이 세로로 쌓이고, lg 이상에서만
    // 좌(본문)/우(도움말) 2단으로 배치한다.
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={17}>
        <div style={{ display: "grid", gap: 16 }}>
          <QuestionPrompt
            questionNo={questionNo}
            title={problem.title}
            prompt={problem.prompt}
          />
          {/* D §3 — 참고 이미지/자료 영역 (자료 없으면 null). */}
          <ReferenceMaterials assets={assets} />
          {isLongForm(questionNo) ? (
            <LongFormEditor
              userId={userId}
              problemId={problem.id}
              questionNo={questionNo as 53 | 54}
              initialDraft={draft}
              problemMaterials={problem.materials}
              rubric={rubric}
            />
          ) : (
            <WritingEditor
              userId={userId}
              problemId={problem.id}
              questionNo={questionNo}
              initialDraft={draft}
              rubric={rubric}
            />
          )}
        </div>
      </Col>
      <Col xs={24} lg={7}>
        <HelpPanel questionNo={questionNo} />
      </Col>
    </Row>
  );
}
