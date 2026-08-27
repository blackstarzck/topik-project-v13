import {
  generateWritingQuestionMetadata,
  renderWritingQuestionPage,
  type WritingQuestionSearchParams,
} from "../_components/WritingQuestionRoute";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";

export { generateWritingQuestionMetadata as generateMetadata };

export default async function LongFormWriting53Page({
  searchParams,
}: {
  searchParams: WritingQuestionSearchParams;
}) {
  return (
    <WorkspaceBody size="full">
      {await renderWritingQuestionPage(53, searchParams)}
    </WorkspaceBody>
  );
}
