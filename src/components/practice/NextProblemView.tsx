"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { Button, Empty, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { WorkspaceFixedActionBar } from "@/components/app/WorkspaceBody";
import { AppCard } from "@/components/shared/AppCard";
import { logStudyEvent } from "@/lib/events/study-events";
import { consumeRecommendationItem } from "@/lib/practice/consume";
import type {
  AlternativeProblem,
  NextProblemBundle,
} from "@/lib/practice/next";
import { writingProblemHref } from "@/lib/writing/routes";
import { AlternativeCardsGrid } from "./AlternativeCardsGrid";
import { difficultyKey } from "./difficulty";
import { SummaryCardRow } from "./SummaryCardRow";

const { Paragraph, Text } = Typography;
const PRIMARY_TITLE_LIMIT = 48;

const TIER_META: Record<
  1 | 2 | 3,
  { badgeKey: string; descriptionKey: string }
> = {
  1: { badgeKey: "tier1Badge", descriptionKey: "tier1Desc" },
  2: { badgeKey: "tier2Badge", descriptionKey: "tier2Desc" },
  3: { badgeKey: "tier3Badge", descriptionKey: "tier3Desc" },
};

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
        returnTo: "/practice/next",
      }) as never,
    );
  }

  if ((primaryTier === 4 || !primary) && !firstUnlockedAlt) {
    return (
      <div className="flex w-full flex-col gap-6">
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
      </div>
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

  return (
    <div className="flex w-full flex-col gap-6 pb-24">
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
          className={
            selected?.source === "next" ? "ring-2 ring-primary" : undefined
          }
          title={
            <div className="flex flex-wrap items-center gap-2">
              <Tag data-testid="next-problem-badge">
                {t(meta.badgeKey as Parameters<typeof t>[0])}
              </Tag>
              <span>
                {primary.questionNo != null
                  ? tCommon("questionItem", { no: primary.questionNo })
                  : tCommon("questionItemUnknown")}
              </span>
            </div>
          }
        >
          <div className="flex w-full flex-col gap-2">
            <div
              className="flex flex-wrap gap-2"
              data-testid="next-problem-badges"
            >
              <Tag>
                {t("difficultyBadge", {
                  value: diffLabel ?? t("noInfo"),
                })}
              </Tag>
              <Tag>
                {t("estimatedTimeBadge", {
                  value:
                    estMinutes != null
                      ? tCommon("minutes", { minutes: estMinutes })
                      : t("noInfo"),
                })}
              </Tag>
            </div>
            <Text strong>{truncateTitle(primary.title)}</Text>
            {reason ? (
              <Paragraph
                type="secondary"
                className="mb-0"
                ellipsis={{ rows: 2 }}
                data-testid="next-problem-reason"
              >
                {reason}
              </Paragraph>
            ) : null}
          </div>
        </AppCard>
      ) : (
        <AppCard data-testid="next-primary-fallback">
          <Paragraph type="secondary" className="mb-0">
            {t("primaryExpired")}
          </Paragraph>
        </AppCard>
      )}

      <AlternativeCardsGrid
        alternatives={alternatives}
        selectedId={selected?.problemId ?? null}
        onSelect={selectAlternative}
      />

      <WorkspaceFixedActionBar
        data-testid="next-selection-bar"
        size="workspace"
      >
        <Text className="min-w-0 flex-1 truncate">
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
          className="shrink-0"
        >
          {t("startLearning")}
        </Button>
      </WorkspaceFixedActionBar>
    </div>
  );
}
