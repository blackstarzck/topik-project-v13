"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Space, Tabs, Typography, notification } from "antd";
import { useRouter } from "next/navigation";

import {
  useSubmitWriting,
  useUpsertDraft,
} from "@/lib/writing/mutations";
import {
  combine53Sections,
  emptyChecklist,
  isLongFormDraftJson,
  type ChecklistItemStatus,
  type EssayChecklistKey,
  type LongFormDraftJson,
  type WritingDraftRow,
  type AutosaveStatus,
} from "@/lib/writing/types";
import {
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "@/lib/writing/constants";
import type { WritingProblemMaterials } from "@/lib/writing/server";
import { AutosaveBadge } from "./AutosaveBadge";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";
import { SectionEditor } from "./SectionEditor";
import { ManuscriptPreview } from "./ManuscriptPreview";
import { EssayChecklist } from "./EssayChecklist";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";

const { Text, Title } = Typography;

type Props = {
  userId: string;
  problemId: string;
  questionNo: 53 | 54;
  initialDraft: WritingDraftRow | null;
  problemMaterials: WritingProblemMaterials;
};

const DEBOUNCE_MS = 2000;

type Question53State = {
  intro: string;
  body: string;
  conclusion: string;
};

type Question54State = {
  text: string;
  checklist: Record<EssayChecklistKey, ChecklistItemStatus>;
};

function readInitial53(draft: WritingDraftRow | null): Question53State {
  if (
    draft?.answer_json &&
    isLongFormDraftJson(draft.answer_json) &&
    draft.answer_json._v === "53.v1"
  ) {
    return { ...draft.answer_json.sections };
  }
  return { intro: "", body: "", conclusion: "" };
}

function readInitial54(draft: WritingDraftRow | null): Question54State {
  if (
    draft?.answer_json &&
    isLongFormDraftJson(draft.answer_json) &&
    draft.answer_json._v === "54.v1"
  ) {
    return {
      text: draft.answer_json.text,
      checklist: draft.answer_json.checklist,
    };
  }
  return { text: draft?.answer_text ?? "", checklist: emptyChecklist() };
}

function MaterialsPanel({
  materials,
}: {
  materials: WritingProblemMaterials;
}) {
  if (!materials) return null;
  if ("text" in materials) {
    return (
      <Card title="문제 자료">
        <Text>{materials.text}</Text>
      </Card>
    );
  }
  if ("chart" in materials) {
    return (
      <Card title={`문제 자료 (${materials.chart.type})`}>
        <Text type="secondary">
          [차트] 데이터 {materials.chart.data.length}건 — 실 차트 렌더링은
          Tier 2 OOS-2 Realtime/차트 라이브러리 통합 후
        </Text>
      </Card>
    );
  }
  return null;
}

export function LongFormEditor({
  userId,
  problemId,
  questionNo,
  initialDraft,
  problemMaterials,
}: Props) {
  const [state53, setState53] = useState<Question53State>(() =>
    readInitial53(initialDraft),
  );
  const [state54, setState54] = useState<Question54State>(() =>
    readInitial54(initialDraft),
  );
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

  // Combined text for char count + submit payload.
  const combinedText = useMemo(
    () =>
      questionNo === 53
        ? combine53Sections(state53)
        : state54.text,
    [questionNo, state53, state54.text],
  );
  const charCount = combinedText.length;
  const submittable = isCountSubmittable(charCount, questionNo);
  const inRecommended = isCountInRecommendedRange(charCount, questionNo);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // D-M3 / description.md §1 예외 — 저장되지 않은 변경(또는 저장 실패)이 있는 상태에서
  // 새로 고침/탭 닫기 시 브라우저 이탈 경고로 손실을 방지. 장문(53/54)은 손실 위험이
  // 가장 크므로 단답 에디터와 동일하게 가드한다.
  useEffect(() => {
    const hasUnsaved = status === "dirty" || status === "failed";
    if (!hasUnsaved) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  function buildAnswerJson(): LongFormDraftJson {
    if (questionNo === 53) {
      return { _v: "53.v1", sections: state53 };
    }
    return {
      _v: "54.v1",
      text: state54.text,
      checklist: state54.checklist,
    };
  }

  // scheduleSave accepts the latest draft snapshot to avoid stale closure
  // capture (Codex Round 1 P1-1). React setState is async; calling
  // scheduleSave() right after setStateXX(...) would otherwise read pre-update
  // combinedText / buildAnswerJson() and persist obsolete data.
  function scheduleSave(nextJson: LongFormDraftJson, nextText: string) {
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
          answer_text: nextText,
          answer_json: JSON.parse(JSON.stringify(nextJson)),
          char_count: nextText.length,
          autosave_status: "clean",
          last_saved_at: new Date().toISOString(),
        },
        {
          onSuccess: (row) => {
            if (seq !== saveSeqRef.current) return;
            setStatus("clean");
            setLastSavedAt(row.last_saved_at ?? null);
          },
          onError: () => {
            if (seq !== saveSeqRef.current) return;
            setStatus("failed");
            // D-M3 / description.md §1 예외 — 토스트 대신 복구 가능한 경고 모달
            // (마지막 저장 시각 + 다시 시도 + 답안 복사 안내)을 띄운다.
            setWarningTrigger("save_failure");
          },
        },
      );
    }, DEBOUNCE_MS);
  }

  function onSection53Change(key: keyof Question53State, next: string) {
    const nextState: Question53State = { ...state53, [key]: next };
    setState53(nextState);
    const nextJson: LongFormDraftJson = {
      _v: "53.v1",
      sections: nextState,
    };
    scheduleSave(nextJson, combine53Sections(nextState));
  }

  function onText54Change(next: string) {
    const nextState: Question54State = { ...state54, text: next };
    setState54(nextState);
    const nextJson: LongFormDraftJson = {
      _v: "54.v1",
      text: nextState.text,
      checklist: nextState.checklist,
    };
    scheduleSave(nextJson, nextState.text);
  }

  function onChecklist54Change(
    key: EssayChecklistKey,
    next: ChecklistItemStatus,
  ) {
    const nextChecklist = { ...state54.checklist, [key]: next };
    const nextState: Question54State = {
      ...state54,
      checklist: nextChecklist,
    };
    setState54(nextState);
    const nextJson: LongFormDraftJson = {
      _v: "54.v1",
      text: nextState.text,
      checklist: nextState.checklist,
    };
    scheduleSave(nextJson, nextState.text);
  }

  // D-M3 retry — 현재 작성 상태 스냅샷으로 자동 저장을 다시 시도.
  function retrySaveNow() {
    setWarningTrigger(null);
    scheduleSave(buildAnswerJson(), combinedText);
  }

  function onConfirmSubmit() {
    submit.mutate(
      {
        draft_id: initialDraft?.id ?? null,
        problem_id: problemId,
        question_no: questionNo,
        answer_text: combinedText,
        // Persist long-form sections / checklist alongside flattened answer_text
        // (Codex Round 1 P1-3). submitWritingAction (server-actions.ts) accepts
        // answer_json; without it 53 sections / 54 checklist are not saved to
        // writing_submissions.
        answer_json: JSON.parse(JSON.stringify(buildAnswerJson())),
        char_count: charCount,
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          router.push(`/writing/feedback/long/${result.submissionId}`);
        },
        onError: (e) => {
          // description.md §4 예외 — 제출 실패 시 확인 모달을 유지(닫지 않음)하여
          // '제출' 버튼으로 바로 다시 시도할 수 있게 한다.
          notification.error({
            message: "제출 실패",
            description: `${e.message} — 확인 창의 '제출'을 눌러 다시 시도하거나, 작성한 답안을 복사해 두세요.`,
          });
        },
      },
    );
  }

  const charCountUI = (
    <Text type={inRecommended ? "success" : "secondary"}>
      {charCount} / {limit.hardMax}자 (권장 {limit.recommendedMin}-
      {limit.recommendedMax}자){inRecommended ? " ✓" : ""}
    </Text>
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space>
        <AutosaveBadge status={status} lastSavedAt={lastSavedAt} />
        {charCountUI}
      </Space>

      <MaterialsPanel materials={problemMaterials} />

      {questionNo === 53 ? (
        <>
          <Tabs
            items={[
              {
                key: "intro",
                label: "도입",
                children: (
                  <SectionEditor
                    label="도입 — 주제 소개"
                    value={state53.intro}
                    onChange={(v) => onSection53Change("intro", v)}
                    placeholder="주제를 한두 문장으로 소개하세요."
                  />
                ),
              },
              {
                key: "body",
                label: "전개",
                children: (
                  <SectionEditor
                    label="전개 — 자료 분석"
                    value={state53.body}
                    onChange={(v) => onSection53Change("body", v)}
                    placeholder="자료를 근거로 변화/대비를 설명하세요."
                    minRows={6}
                  />
                ),
              },
              {
                key: "conclusion",
                label: "마무리",
                children: (
                  <SectionEditor
                    label="마무리 — 정리"
                    value={state53.conclusion}
                    onChange={(v) => onSection53Change("conclusion", v)}
                    placeholder="정리와 자기 의견을 짧게 마무리하세요."
                  />
                ),
              },
            ]}
          />
          <ManuscriptPreview text={combinedText} />
        </>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
            // 반응형: 좁은 화면에서는 본문/체크리스트가 1열로 쌓이고, 넓을 때만
            // 2열(본문 + 320px 체크리스트). 고정 폭의 360px 가로 넘침 해소.
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <Card>
            <Title level={5}>본문 작성</Title>
            <Input.TextArea
              aria-label="에세이 본문"
              value={state54.text}
              onChange={(e) => onText54Change(e.target.value)}
              autoSize={{ minRows: 12 }}
              maxLength={limit.hardMax}
              placeholder="600~700자 분량의 에세이를 작성하세요."
              disabled={submit.isPending}
            />
          </Card>
          <EssayChecklist
            status={state54.checklist}
            onChange={onChecklist54Change}
          />
        </div>
      )}

      <Button
        type="primary"
        onClick={() => setConfirmOpen(true)}
        disabled={!submittable || submit.isPending}
        style={{ alignSelf: "flex-start" }}
      >
        제출하기
      </Button>
      <SubmissionConfirmModal
        open={confirmOpen}
        charCount={charCount}
        minChars={limit.hardMin}
        questionNo={questionNo}
        lastSavedAt={lastSavedAt}
        loading={submit.isPending}
        onConfirm={onConfirmSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
      <AutosaveWarningModal
        trigger={warningTrigger}
        lastSavedAt={lastSavedAt}
        retrying={upsert.isPending}
        onKeep={() => setWarningTrigger(null)}
        onRetry={retrySaveNow}
        onProceed={() => setWarningTrigger(null)}
      />
    </Space>
  );
}
