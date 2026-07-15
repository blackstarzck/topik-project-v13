// NOTE: server-only by convention. This helper is consumed by route handlers
// and RSC/server code only; do not import it from client components.
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { getCanonicalWritingProblems } from "../writing/canonical-source";
import { QUESTION_NOS, type QuestionNo } from "./types";

type ClientFactory = () => Promise<SupabaseServerClient>;

export type WritingAvailability = {
  availableTypes: QuestionNo[];
  lockedTypes: QuestionNo[];
  hasAny: boolean;
};

function toWritingAvailability(
  availableQuestionNos: Iterable<QuestionNo>,
): WritingAvailability {
  const availableSet = new Set(availableQuestionNos);
  const availableTypes = QUESTION_NOS.filter((qn) => availableSet.has(qn));
  const lockedTypes = QUESTION_NOS.filter((qn) => !availableSet.has(qn));
  return {
    availableTypes,
    lockedTypes,
    hasAny: availableTypes.length > 0,
  };
}

export async function getWritingAvailability(
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<WritingAvailability> {
  const supabase = await createClient();
  const canonicalProblems = await getCanonicalWritingProblems({ supabase });
  return toWritingAvailability(
    canonicalProblems.map((problem) => problem.questionNo),
  );
}
