"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { Button, Empty, Space, Tag, Typography, theme } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import { logStudyEvent } from "@/lib/events/study-events";
import { consumeRecommendationItem } from "@/lib/practice/consume";
import type { AlternativeProblem, NextProblemBundle } from "@/lib/practice/next";
import { writingProblemHref } from "@/lib/writing/routes";
import { SPACING } from "@/theme/spacing";
import { AlternativeCardsGrid } from "./AlternativeCardsGrid";
import { SummaryCardRow } from "./SummaryCardRow";

const { Paragraph, Text } = Typography;
const PRIMARY_TITLE_LIMIT = 48;
const SELECTION_BAR_OFFSET = 88;

const TIER_META: Record<
  1 | 2 | 3,
  { badgeKey: string; color: string; descriptionKey: string }
> = {
  1: { badgeKey: "tier1Badge", color: "gold", descriptionKey: "tier1Desc" },
  2: { badgeKey: "tier2Badge", color: "blue", descriptionKey: "tier2Desc" },
  3: { badgeKey: "tier3Badge", color: "green", descriptionKey: "tier3Desc" },
};

function difficultyKey(difficulty: number | null | undefined): string | null {
  if (difficulty == null) return null;
  if (difficulty <= 1) return "difficultyVeryEasy";
  if (difficulty === 2) return "difficultyEasy";
  if (difficulty === 3) return "difficultyNormal";
  if (difficulty === 4) return "difficultyHardish";
  return "difficultyHard";
}

function truncateTitle(title: string) {
  return title.length > PRIMARY_TITLE_LIMIT
    ? `${title.slice(0, PRIMARY_TITLE_LIMIT)}...`
    : title;
}

function handleCardKeyDown(
  event: KeyboardEvent<HTMLElement>,
  callback: () => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  callback();
}

type Props = {
  bundle: NextProblemBundle;
};

type SelectedTarget = {
  problemId: string;
  itemId?: string | null;
  questionNo: number | null;
  source: "next" | "next_alternative";
};

export function NextProblemView({ bundle }: Props) {
  const t = useTranslations("practice.next");
  const tCommon = useTranslations("practice.common");
  const { token } = theme.useToken();
  const router = useRouter();
  const { primary, primaryTier, summary, alternatives } = bundle;

  function questionTypeLabel(
    questionNo: number | null | undefined,
  ): string | null {
    if (questionNo == null) return null;
    if (
      questionNo === 51 ||
      questionNo === 52 ||
      questionNo === 53 ||
      questionNo === 54
    ) {
      return tCommon(`questionType${questionNo}`);
    }
    return tCommon("questionItem", { no: questionNo });
  }

  const firstUnlockedAlt = alternatives.find((alt) => !alt.locked) ?? null;
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
  const startedRef = useRef(false);

  const recommendedType = questionTypeLabel(primary?.questionNo);

  function primaryTarget(): SelectedTarget | null {
    if (!primary) return null;
    return {
      problemId: primary.problemId,
      itemId: primary.itemId ?? null,
      questionNo: primary.questionNo,
      source: "next",
    };
  }

  function selectPrimary() {
    const target = primaryTarget();
    if (target) setSelected(target);
  }

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
    const selectedTarget = target ?? selected;
    if (!selectedTarget) return;
    if (startedRef.current) return;
    startedRef.current = true;
    setStarting(true);
    setSelected(selectedTarget);
    void logStudyEvent({
      eventType: "recommendation_clicked",
      problemId: selectedTarget.problemId,
      payload: { source: selectedTarget.source },
    });
    void consumeRecommendationItem(selectedTarget.itemId ?? null);
    router.push(
      writingProblemHref({
        questionNo: selectedTarget.questionNo,
        problemId: selectedTarget.problemId,
      }) as never,
    );
  }

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
        <Empty description={t("emptyNoMore")} data-testid="next-empty-state">
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
        selected.source === "next_alternative"
          ? ` ${t("alternativeSuffix")}`
          : ""
      }`
    : null;
  const selectedCardStyle = {
    borderColor: token.colorPrimary,
    borderWidth: token.lineWidth * 2,
  };

  return (
    <Space
      orientation="vertical"
      size="large"
      style={{ width: "100%", paddingBottom: SELECTION_BAR_OFFSET }}
    >
      <SummaryCardRow
        recentSubmissions={summary.recentSubmissions}
        averageScore={summary.averageScore}
        weakestDimensions={summary.weakestDimensions}
        estimatedMinutes={estMinutes}
        recommendedType={recommendedType}
      />

      {primary && meta ? (
        <AppCard
          hoverable
          role="button"
          tabIndex={0}
          onClick={selectPrimary}
          onKeyDown={(event) => handleCardKeyDown(event, selectPrimary)}
          data-testid="next-primary-card"
          data-problem-id={primary.problemId}
          style={selected?.source === "next" ? selectedCardStyle : undefined}
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
        >
          <Space orientation="vertical" size="small" style={{ width: "100%" }}>
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
            <Text strong>{truncateTitle(primary.title)}</Text>
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
      ) : (
        <AppCard data-testid="next-primary-fallback">
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {t("primaryExpired")}
          </Paragraph>
        </AppCard>
      )}

      <AlternativeCardsGrid
        alternatives={alternatives}
        selectedId={selected?.problemId ?? null}
        onSelect={selectAlternative}
      />

      <div
        data-testid="next-selection-bar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: `${SPACING.sm + SPACING.xs}px ${SPACING.lg}px`,
          background: token.colorBgContainer,
          borderTop: `${token.lineWidth}px ${token.lineType} ${token.colorBorderSecondary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACING.md,
          zIndex: 10,
        }}
      >
        <Text
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
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
