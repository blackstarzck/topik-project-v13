"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input, Space, Typography, notification } from "antd";
import { useRouter } from "next/navigation";
import {
  useSubmitWriting,
  useUpsertDraft,
} from "@/lib/writing/mutations";
import {
  isShortAnswer,
  type AutosaveStatus,
  type QuestionNo,
  type WritingDraftRow,
} from "@/lib/writing/types";
import {
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "@/lib/writing/constants";
import { AutosaveBadge } from "./AutosaveBadge";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";

const { Text } = Typography;

type Props = {
  userId: string;
  problemId: string;
  questionNo: QuestionNo;
  initialDraft: WritingDraftRow | null;
};

const DEBOUNCE_MS = 2000;

export function WritingEditor({
  userId,
  problemId,
  questionNo,
  initialDraft,
}: Props) {
  const [text, setText] = useState(initialDraft?.answer_text ?? "");
  const [status, setStatus] = useState<AutosaveStatus>(
    initialDraft?.autosave_status ?? "clean",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialDraft?.last_saved_at ?? null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warningTrigger, setWarningTrigger] = useState<WarningTrigger | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const upsert = useUpsertDraft();
  const submit = useSubmitWriting();
  const router = useRouter();

  const limit = getCharLimit(questionNo);
  const charCount = useMemo(() => text.length, [text]);
  const submittable = isCountSubmittable(charCount, questionNo);
  const inRecommended = isCountInRecommendedRange(charCount, questionNo);
  // Used by SubmissionConfirmModal "minimum to submit" line.
  const minChars = limit.hardMin;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function scheduleSave(next: string) {
    if (status !== "syncing") setStatus("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setStatus("syncing");
      const seq = ++saveSeqRef.current;
      upsert.mutate(
        {
          user_id: userId,
          problem_id: problemId,
          question_no: questionNo,
          answer_text: next,
          char_count: next.length,
          autosave_status: "clean",
          last_saved_at: new Date().toISOString(),
        },
        {
          onSuccess: (row) => {
            if (seq !== saveSeqRef.current) return; // stale response
            setStatus("clean");
            setLastSavedAt(row.last_saved_at ?? null);
          },
          onError: () => {
            if (seq !== saveSeqRef.current) return;
            setStatus("failed");
            setWarningTrigger("save_failure");
          },
        },
      );
    }, DEBOUNCE_MS);
  }

  function onChange(next: string) {
    setText(next);
    scheduleSave(next);
  }

  function onConfirmSubmit() {
    submit.mutate(
      {
        draft_id: initialDraft?.id ?? null,
        problem_id: problemId,
        question_no: questionNo,
        answer_text: text,
        char_count: charCount,
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          const next = isShortAnswer(result.questionNo)
            ? `/writing/feedback/short/${result.submissionId}`
            : `/writing/feedback/long/${result.submissionId}`;
          router.push(next);
        },
        onError: (e) => {
          notification.error({
            message: "제출 실패",
            description: e.message,
          });
        },
      },
    );
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space>
        <AutosaveBadge status={status} lastSavedAt={lastSavedAt} />
        <Text type={inRecommended ? "success" : "secondary"}>
          {charCount} / {limit.hardMax}자{" "}
          {limit.recommendedMin !== limit.hardMin ||
          limit.recommendedMax !== limit.hardMax
            ? `(권장 ${limit.recommendedMin}-${limit.recommendedMax}자)`
            : `(최소 ${limit.hardMin}자)`}
          {inRecommended ? " ✓" : ""}
        </Text>
      </Space>
      <Input.TextArea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        autoSize={{ minRows: isShortAnswer(questionNo) ? 3 : 12 }}
        maxLength={limit.hardMax}
        placeholder={
          isShortAnswer(questionNo)
            ? "답안을 짧고 명확하게 작성하세요."
            : "글의 구조를 갖춰 문장을 작성하세요."
        }
        disabled={submit.isPending}
      />
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={!submittable || submit.isPending}
        style={{ alignSelf: "flex-start" }}
      >
        제출하기
      </button>
      <SubmissionConfirmModal
        open={confirmOpen}
        charCount={charCount}
        minChars={minChars}
        loading={submit.isPending}
        onConfirm={onConfirmSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
      <AutosaveWarningModal
        trigger={warningTrigger}
        lastSavedAt={lastSavedAt}
        retrying={upsert.isPending}
        onKeep={() => setWarningTrigger(null)}
        onRetry={() => {
          setWarningTrigger(null);
          scheduleSave(text);
        }}
        onProceed={() => setWarningTrigger(null)}
      />
    </Space>
  );
}
