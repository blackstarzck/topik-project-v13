"use client";

import { Button, Card, Empty, Space, Tag, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { logStudyEvent } from "@/lib/events/study-events";
import { consumeRecommendationItem } from "@/lib/practice/consume";
import type { AlternativeProblem, NextProblemBundle } from "@/lib/practice/next";
import { SummaryCardRow } from "./SummaryCardRow";
import { AlternativeCardsGrid } from "./AlternativeCardsGrid";

const { Title, Paragraph, Text } = Typography;

type TierMeta = {
  badge: string;
  color: string;
  description: string;
};

const TIER_META: Record<1 | 2 | 3, TierMeta> = {
  1: {
    badge: "추천",
    color: "gold",
    description: "선생님이 추천한 문제예요.",
  },
  2: {
    badge: "이어서",
    color: "blue",
    description: "방금 푼 문항과 같은 유형으로 계속 풀어볼까요?",
  },
  3: {
    badge: "탐색",
    color: "green",
    description: "오늘 처음 만나는 문제예요.",
  },
};

const QUESTION_TYPE_LABELS: Record<number, string> = {
  51: "51번 단답",
  52: "52번 문장 완성",
  53: "53번 장문",
  54: "54번 에세이",
};

function questionTypeLabel(questionNo: number | null | undefined): string | null {
  if (questionNo == null) return null;
  return QUESTION_TYPE_LABELS[questionNo] ?? `${questionNo}번 문항`;
}

/** problems.difficulty (1..5 가정) → 한국어 라벨. null → null. */
function difficultyLabel(difficulty: number | null | undefined): string | null {
  if (difficulty == null) return null;
  if (difficulty <= 1) return "쉬움";
  if (difficulty === 2) return "조금 쉬움";
  if (difficulty === 3) return "보통";
  if (difficulty === 4) return "조금 어려움";
  return "어려움";
}

type Props = {
  bundle: NextProblemBundle;
};

/** 선택된 항목(대표 추천 또는 대안) 공통 표현. */
type SelectedTarget = {
  problemId: string;
  itemId?: string | null;
  questionNo: number | null;
  source: "next" | "next_alternative";
};

export function NextProblemView({ bundle }: Props) {
  const router = useRouter();
  const { primary, primaryTier, summary, alternatives } = bundle;

  // 대표 추천이 있으면 기본 선택은 대표. 없으면(만료/없음) 첫 unlocked 대안으로 포커스.
  const firstUnlockedAlt = alternatives.find((a) => !a.locked) ?? null;
  const defaultSelected: SelectedTarget | null = primary
    ? {
        problemId: primary.problemId,
        itemId: primary.itemId ?? null,
        questionNo: primary.questionNo,
        source: "next",
      }
    : firstUnlockedAlt
      ? {
          problemId: firstUnlockedAlt.id,
          itemId: firstUnlockedAlt.itemId ?? null,
          questionNo: firstUnlockedAlt.questionNo,
          source: "next_alternative",
        }
      : null;

  const [selected, setSelected] = useState<SelectedTarget | null>(
    defaultSelected,
  );
  const [starting, setStarting] = useState(false);
  // dup-click guard: ref flips synchronously before any await/navigation.
  const startedRef = useRef(false);

  const recommendedType = questionTypeLabel(primary?.questionNo);

  function selectAlternative(alt: AlternativeProblem) {
    if (alt.locked) return;
    setSelected({
      problemId: alt.id,
      itemId: alt.itemId ?? null,
      questionNo: alt.questionNo,
      source: "next_alternative",
    });
  }

  function handleStart(target?: SelectedTarget) {
    const t = target ?? selected;
    if (!t) return;
    if (startedRef.current) return; // 중복 실행 차단
    startedRef.current = true;
    setStarting(true);
    setSelected(t);
    void logStudyEvent({
      eventType: "recommendation_clicked",
      problemId: t.problemId,
      payload: { source: t.source },
    });
    // recommendation_items.status='consumed' (RLS owner-update, fire-and-forget).
    void consumeRecommendationItem(t.itemId ?? null);
    router.push(`/practice/problems/${t.problemId}` as never);
  }

  function primaryTarget(): SelectedTarget | null {
    if (!primary) return null;
    return {
      problemId: primary.problemId,
      itemId: primary.itemId ?? null,
      questionNo: primary.questionNo,
      source: "next",
    };
  }

  // tier 4 / no primary AND no unlocked alternative → 빈 상태.
  if ((primaryTier === 4 || !primary) && !firstUnlockedAlt) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <SummaryCardRow
          recentSubmissions={summary.recentSubmissions}
          averageScore={summary.averageScore}
          weakestDimensions={summary.weakestDimensions}
          estimatedMinutes={primary?.estimatedMinutes ?? null}
          recommendedType={recommendedType}
        />
        <Empty description="더 추천할 문제가 없습니다.">
          <Button
            type="primary"
            onClick={() => router.push("/practice/problems" as never)}
          >
            문제 목록 보기
          </Button>
        </Empty>
      </Space>
    );
  }

  const meta = primary ? TIER_META[primaryTier as 1 | 2 | 3] : null;
  const reason = primary?.reason ?? meta?.description ?? null;
  const diffLabel = difficultyLabel(primary?.difficulty);
  const estMinutes = primary?.estimatedMinutes ?? null;
  const selectionLabel = selected
    ? `${questionTypeLabel(selected.questionNo) ?? "선택한 문제"}${
        selected.source === "next_alternative" ? " (대안)" : ""
      }`
    : null;

  return (
    <Space
      direction="vertical"
      size="large"
      style={{ width: "100%", paddingBottom: 88 }}
    >
      <SummaryCardRow
        recentSubmissions={summary.recentSubmissions}
        averageScore={summary.averageScore}
        weakestDimensions={summary.weakestDimensions}
        estimatedMinutes={estMinutes}
        recommendedType={recommendedType}
      />

      {primary && meta ? (
        <>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              다음 문제
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              이어 풀기 좋은 문제를 추천해 드릴게요.
            </Paragraph>
          </div>

          <Card
            hoverable
            onClick={() => handleStart(primaryTarget() ?? undefined)}
            data-testid={`next-problem-${primary.problemId}`}
            style={
              selected?.source === "next"
                ? { borderColor: "#1677ff", borderWidth: 2 }
                : undefined
            }
            title={
              <Space wrap>
                <Tag color={meta.color} data-testid="next-problem-badge">
                  {meta.badge}
                </Tag>
                <span>{primary.questionNo ?? "—"}번 문항</span>
              </Space>
            }
            extra={
              <Button
                type="primary"
                disabled={starting}
                onClick={(event) => {
                  event.stopPropagation();
                  handleStart(primaryTarget() ?? undefined);
                }}
              >
                시작하기
              </Button>
            }
          >
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {/* R-02 §2 제약 — 난이도/시간 배지 필수. */}
              <Space wrap data-testid="next-problem-badges">
                <Tag color="purple">
                  난이도: {diffLabel ?? "정보 없음"}
                </Tag>
                <Tag color="cyan">
                  예상 시간: {estMinutes != null ? `${estMinutes}분` : "정보 없음"}
                </Tag>
              </Space>
              <Text strong>
                {primary.title.length > 48
                  ? `${primary.title.slice(0, 48)}…`
                  : primary.title}
              </Text>
              {/* R-02 §2 제약 — 이유 2줄 이하. */}
              {reason ? (
                <Paragraph
                  type="secondary"
                  style={{ margin: 0 }}
                  ellipsis={{ rows: 2 }}
                  data-testid="next-problem-reason"
                >
                  {reason}
                </Paragraph>
              ) : null}
            </Space>
          </Card>
        </>
      ) : (
        // primary 만료/없음 → 대안에 포커스했음을 안내.
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            다음 문제
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            대표 추천 문제가 만료되어 아래 대안 중에서 골라드렸어요.
          </Paragraph>
        </div>
      )}

      <AlternativeCardsGrid
        alternatives={alternatives}
        selectedId={selected?.problemId ?? null}
        onSelect={selectAlternative}
      />

      {/* R-02 §4 — 선택 문제 요약 / 학습 시작 CTA. 하단 고정. */}
      <div
        data-testid="next-selection-bar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "12px 24px",
          background: "#fff",
          borderTop: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          zIndex: 10,
        }}
      >
        <Text style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectionLabel
            ? `선택: ${selectionLabel}`
            : "시작할 문제를 선택하세요"}
        </Text>
        <Button
          type="primary"
          size="large"
          disabled={!selected || starting}
          loading={starting}
          onClick={() => handleStart()}
          data-testid="next-start-cta"
        >
          학습 시작
        </Button>
      </div>
    </Space>
  );
}
