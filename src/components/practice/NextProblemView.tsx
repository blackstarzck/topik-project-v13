"use client";

import { Button, Empty, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { logStudyEvent } from "@/lib/events/study-events";
import { consumeRecommendationItem } from "@/lib/practice/consume";
import type { AlternativeProblem, NextProblemBundle } from "@/lib/practice/next";
import { writingProblemHref } from "@/lib/writing/routes";
import { SummaryCardRow } from "./SummaryCardRow";
import { AlternativeCardsGrid } from "./AlternativeCardsGrid";

const { Title, Paragraph, Text } = Typography;

/** tier → { badge key, color, description key } in the practice.next namespace. */
const TIER_META: Record<
  1 | 2 | 3,
  { badgeKey: string; color: string; descriptionKey: string }
> = {
  1: { badgeKey: "tier1Badge", color: "gold", descriptionKey: "tier1Desc" },
  2: { badgeKey: "tier2Badge", color: "blue", descriptionKey: "tier2Desc" },
  3: { badgeKey: "tier3Badge", color: "green", descriptionKey: "tier3Desc" },
};

/** maps difficulty (1..5) to a practice.common translation key. */
function difficultyKey(difficulty: number | null | undefined): string | null {
  if (difficulty == null) return null;
  if (difficulty <= 1) return "difficultyVeryEasy";
  if (difficulty === 2) return "difficultyEasy";
  if (difficulty === 3) return "difficultyNormal";
  if (difficulty === 4) return "difficultyHardish";
  return "difficultyHard";
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
  const t = useTranslations("practice.next");
  const tCommon = useTranslations("practice.common");
  const router = useRouter();
  const { primary, primaryTier, summary, alternatives } = bundle;

  // 51/52/53/54 → detailed label; other → "N번 문항" fallback (practice.common).
  function questionTypeLabel(
    questionNo: number | null | undefined,
  ): string | null {
    if (questionNo == null) return null;
    if (questionNo === 51 || questionNo === 52 || questionNo === 53 || questionNo === 54) {
      return tCommon(`questionType${questionNo}`);
    }
    return tCommon("questionItem", { no: questionNo });
  }

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
    router.push(
      writingProblemHref({
        questionNo: t.questionNo,
        problemId: t.problemId,
      }) as never,
    );
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
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        <SummaryCardRow
          recentSubmissions={summary.recentSubmissions}
          averageScore={summary.averageScore}
          weakestDimensions={summary.weakestDimensions}
          estimatedMinutes={primary?.estimatedMinutes ?? null}
          recommendedType={recommendedType}
        />
        <Empty description={t("emptyNoMore")}>
          <Button
            type="primary"
            onClick={() => router.push("/practice/problems" as never)}
          >
            {t("viewProblemList")}
          </Button>
        </Empty>
      </Space>
    );
  }

  const meta = primary ? TIER_META[primaryTier as 1 | 2 | 3] : null;
  const reason =
    primary?.reason ??
    (meta ? t(meta.descriptionKey as Parameters<typeof t>[0]) : null) ??
    null;
  const diffKey = difficultyKey(primary?.difficulty);
  const diffLabel = diffKey
    ? tCommon(diffKey as Parameters<typeof tCommon>[0])
    : null;
  const estMinutes = primary?.estimatedMinutes ?? null;
  const selectionLabel = selected
    ? `${questionTypeLabel(selected.questionNo) ?? t("selectedProblem")}${
        selected.source === "next_alternative" ? ` ${t("alternativeSuffix")}` : ""
      }`
    : null;

  return (
    <Space
      orientation="vertical"
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
              {t("heading")}
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {t("subtitle")}
            </Paragraph>
          </div>

          <AppCard
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
                  {t(meta.badgeKey as Parameters<typeof t>[0])}
                </Tag>
                <span>
                  {primary.questionNo != null
                    ? tCommon("questionItem", { no: primary.questionNo })
                    : tCommon("questionItemUnknown")}
                </span>
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
                {t("startProblem")}
              </Button>
            }
          >
            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
              {/* R-02 §2 제약 — 난이도/시간 배지 필수. */}
              <Space wrap data-testid="next-problem-badges">
                <Tag color="purple">
                  {t("difficultyBadge", {
                    value: diffLabel ?? t("noInfo"),
                  })}
                </Tag>
                <Tag color="cyan">
                  {t("estimatedTimeBadge", {
                    value:
                      estMinutes != null
                        ? tCommon("minutes", { minutes: estMinutes })
                        : t("noInfo"),
                  })}
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
          </AppCard>
        </>
      ) : (
        // primary 만료/없음 → 대안에 포커스했음을 안내.
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            {t("heading")}
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {t("primaryExpired")}
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
            ? t("selectionLabel", { selection: selectionLabel })
            : t("selectionPrompt")}
        </Text>
        <Button
          type="primary"
          size="large"
          disabled={!selected || starting}
          loading={starting}
          onClick={() => handleStart()}
          data-testid="next-start-cta"
        >
          {t("startLearning")}
        </Button>
      </div>
    </Space>
  );
}
