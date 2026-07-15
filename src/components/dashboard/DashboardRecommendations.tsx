"use client";

import { Button, Empty, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { AppCard } from "@/components/shared/AppCard";
import { writingProblemHref } from "@/lib/writing/routes";

const { Paragraph, Text } = Typography;

/**
 * B-01 area 3 — 추천/진행 카드.
 *
 * "이어 풀 문제"(primary, recommendation_items 기반)와 "추천 유형"(alternatives)
 * 카드를 실제 추천 데이터(getNextProblemBundle)에서 렌더한다.
 *
 * 제약 조건(description.md): 카드 제목 28자, 본문 2줄, 기본 3개/최대 5개.
 * 예외: 추천 없음/최근 기록 없음은 빈 상태 카드로 대체.
 */

export type DashboardPrimary = {
  problemId: string;
  title: string;
  questionNo: number | null;
  reason: string | null;
  primaryTier?: 1 | 2 | 3 | 4;
  /** recommendation | same_question_no | random — 출처 라벨용. */
  source: "recommendation" | "same_question_no" | "random";
};

export type DashboardAlternative = {
  problemId: string;
  title: string;
  questionNo: number | null;
  reason: string | null;
};

type Props = {
  primary: DashboardPrimary | null;
  alternatives: DashboardAlternative[];
};

// Tier 1 recommendation_items만 개인화 추천으로 표시하고,
// fallback 문제는 학습 시작 후보로 분리해 라벨링한다.
function isPersonalizedRecommendation(primary: DashboardPrimary): boolean {
  return (
    (primary.primaryTier ?? 1) === 1 && primary.source === "recommendation"
  );
}

function sourceLabelKey(primary: DashboardPrimary): string {
  if (isPersonalizedRecommendation(primary)) return "sourceRecommendation";
  if (primary.source === "same_question_no") return "sourceSameQuestionNo";
  return "sourcePublishedProblem";
}

function defaultReasonKey(primary: DashboardPrimary): string {
  if (isPersonalizedRecommendation(primary)) return "defaultReason";
  if (primary.source === "same_question_no") return "fallbackSameTypeReason";
  return "fallbackPublishedReason";
}

function truncate(title: string, max = 28): string {
  return title.length > max ? `${title.slice(0, max)}…` : title;
}

export function DashboardRecommendations({ primary, alternatives }: Props) {
  const t = useTranslations("dashboard.recommendations");
  // 기본 3개/최대 5개: primary 1 + alternatives 최대 4 → 총 5개 이하.
  const altList = alternatives.slice(0, 4);

  return (
    <Space orientation="vertical" size="middle" className="w-full">
      <AppCard title={t("continueCardTitle")}>
        {primary ? (
          <Space orientation="vertical" size="small" className="w-full">
            <Space size={8} wrap>
              <Tag
                color={
                  isPersonalizedRecommendation(primary) ? "geekblue" : "default"
                }
              >
                {t(sourceLabelKey(primary) as Parameters<typeof t>[0])}
              </Tag>
              {primary.questionNo != null ? (
                <Tag>
                  {t("questionNoTag", { questionNo: primary.questionNo })}
                </Tag>
              ) : null}
            </Space>
            <Text strong>{truncate(primary.title)}</Text>
            {primary.reason ? (
              <Paragraph
                type="secondary"
                ellipsis={{ rows: 2 }}
                className="!m-0"
              >
                {primary.reason}
              </Paragraph>
            ) : (
              <Paragraph type="secondary" className="!m-0">
                {t(defaultReasonKey(primary) as Parameters<typeof t>[0])}
              </Paragraph>
            )}
            <Link
              href={
                writingProblemHref({
                  questionNo: primary.questionNo,
                  problemId: primary.problemId,
                  returnTo: "/dashboard",
                }) as never
              }
            >
              <Button type="primary" block>
                {t("continueButton")}
              </Button>
            </Link>
          </Space>
        ) : (
          <Empty description={t("continueEmpty")}>
            <Link href="/practice/recommendations">
              <Button type="primary">{t("viewRecommendations")}</Button>
            </Link>
          </Empty>
        )}
      </AppCard>

      <AppCard title={t("typesCardTitle")}>
        {altList.length === 0 ? (
          <Empty description={t("typesEmpty")} />
        ) : (
          <Space orientation="vertical" size="small" className="w-full">
            {altList.map((alt) => (
              <div key={alt.problemId} className="app-card-compact">
                <Space className="w-full justify-between" wrap>
                  <Space orientation="vertical" size={2}>
                    <Tag color="blue">
                      {alt.questionNo != null
                        ? t("questionNoTag", { questionNo: alt.questionNo })
                        : t("recommendTag")}
                    </Tag>
                    <Text strong>{truncate(alt.title)}</Text>
                  </Space>
                  <Link
                    href={
                      writingProblemHref({
                        questionNo: alt.questionNo,
                        problemId: alt.problemId,
                        returnTo: "/dashboard",
                      }) as never
                    }
                  >
                    <Button>{t("solveButton")}</Button>
                  </Link>
                </Space>
              </div>
            ))}
          </Space>
        )}
      </AppCard>
    </Space>
  );
}
