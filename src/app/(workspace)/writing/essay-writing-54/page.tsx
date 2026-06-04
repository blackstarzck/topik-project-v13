import {
  generateWritingQuestionMetadata,
  renderWritingQuestionPage,
  type WritingQuestionSearchParams,
} from "../_components/WritingQuestionRoute";

export { generateWritingQuestionMetadata as generateMetadata };

export default function EssayWriting54Page({
  searchParams,
}: {
  searchParams: WritingQuestionSearchParams;
}) {
  return renderWritingQuestionPage(54, searchParams);
}
