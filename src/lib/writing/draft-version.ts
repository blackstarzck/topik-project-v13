import type { WritingDraftRow } from "./types";

export type CurrentWritingQuestionVersion = {
  questionId: string | null;
  importId: string | null;
  payloadHash: string | null;
};

function snapshotIdentity(snapshot: WritingDraftRow["question_snapshot"]) {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== "object") {
    return null;
  }

  return {
    questionId:
      typeof snapshot.question_id === "string" ? snapshot.question_id : null,
    importId:
      typeof snapshot.canonical_import_id === "string"
        ? snapshot.canonical_import_id
        : typeof snapshot.canonical_import_id === "number"
          ? String(snapshot.canonical_import_id)
          : null,
    payloadHash:
      typeof snapshot.payload_hash === "string" ? snapshot.payload_hash : null,
  };
}

export function isWritingDraftVersionStale(
  draft: WritingDraftRow | null,
  current: CurrentWritingQuestionVersion,
) {
  if (
    !draft ||
    !current.questionId ||
    !current.importId ||
    !current.payloadHash
  ) {
    return false;
  }

  const snapshot = snapshotIdentity(draft.question_snapshot);
  return (
    draft.canonical_question_id !== current.questionId ||
    draft.canonical_import_id?.toString() !== current.importId ||
    draft.canonical_payload_hash !== current.payloadHash ||
    snapshot?.questionId !== current.questionId ||
    snapshot.importId !== current.importId ||
    snapshot.payloadHash !== current.payloadHash
  );
}
