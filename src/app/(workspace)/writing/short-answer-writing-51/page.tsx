import {
  generateWritingQuestionMetadata,
  renderWritingQuestionPage,
  type WritingQuestionSearchParams,
} from "../_components/WritingQuestionRoute";

export { generateWritingQuestionMetadata as generateMetadata };

export default function ShortAnswerWriting51Page({
  searchParams,
}: {
  searchParams: WritingQuestionSearchParams;
}) {
  return renderWritingQuestionPage(51, searchParams);
}
