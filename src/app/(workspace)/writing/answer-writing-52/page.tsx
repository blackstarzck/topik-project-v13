import {
  generateWritingQuestionMetadata,
  renderWritingQuestionPage,
  type WritingQuestionSearchParams,
} from "../_components/WritingQuestionRoute";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";

export { generateWritingQuestionMetadata as generateMetadata };

export default async function AnswerWriting52Page({
  searchParams,
}: {
  searchParams: WritingQuestionSearchParams;
}) {
  return (
    <WorkspaceBody size="full">
      {await renderWritingQuestionPage(52, searchParams)}
    </WorkspaceBody>
  );
}
