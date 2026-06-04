import {
  generateWritingQuestionMetadata,
  renderWritingQuestionPage,
  type WritingQuestionSearchParams,
} from "../_components/WritingQuestionRoute";

export { generateWritingQuestionMetadata as generateMetadata };

export default function AnswerWriting52Page({
  searchParams,
}: {
  searchParams: WritingQuestionSearchParams;
}) {
  return renderWritingQuestionPage(52, searchParams);
}
