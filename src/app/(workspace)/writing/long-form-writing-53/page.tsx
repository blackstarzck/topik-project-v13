import {
  generateWritingQuestionMetadata,
  renderWritingQuestionPage,
  type WritingQuestionSearchParams,
} from "../_components/WritingQuestionRoute";

export { generateWritingQuestionMetadata as generateMetadata };

export default function LongFormWriting53Page({
  searchParams,
}: {
  searchParams: WritingQuestionSearchParams;
}) {
  return renderWritingQuestionPage(53, searchParams);
}
