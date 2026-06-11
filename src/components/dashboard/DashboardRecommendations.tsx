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

// 출처(source) → 카탈로그 키 매핑. 모듈 스코프라 t()를 호출할 수 없으므로
// 안정적인 키만 보관하고, 컴포넌트에서 t(SOURCE_LABEL_KEY[source])로 해석한다.
const SOURCE_LABEL_KEY: Record<DashboardPrimary["source"], string> = {
  recommendation: "sourceRecommendation",
  same_question_no: "sourceSameQuestionNo",
  random: "sourceRandom",
};

function truncate(title: string, max = 28): string {
  return title.length > max ? `${title.slice(0, max)}…` : title;
}

export function DashboardRecommendations({ primary, alternatives }: Props) {
  const t = useTranslations("dashboard.recommendations");
  // 기본 3개/최대 5개: primary 1 + alternatives 최대 4 → 총 5개 이하.
  const altList = alternatives.slice(0, 4);

  return (
    <Space
      className="dashboard-card-stack"
      orientation="vertical"
      size="middle"
    >
      <AppCard title={t("continueCardTitle")}>
        {primary ? (
          <Space
            className="dashboard-card-stack"
            orientation="vertical"
            size="small"
          >
            <Space size={8} wrap>
              <Tag color="geekblue">
                {t(SOURCE_LABEL_KEY[primary.source] as Parameters<typeof t>[0])}
              </Tag>
              {primary.questionNo != null ? (
                <Tag>{t("questionNoTag", { questionNo: primary.questionNo })}</Tag>
              ) : null}
            </Space>
            <Text strong>{truncate(primary.title)}</Text>
            {primary.reason ? (
              <Paragraph
                className="dashboard-paragraph-flush"
                type="secondary"
                ellipsis={{ rows: 2 }}
              >
                {primary.reason}
              </Paragraph>
            ) : (
              <Paragraph
                className="dashboard-paragraph-flush"
                type="secondary"
              >
                {t("defaultReason")}
              </Paragraph>
            )}
            <Link
              href={
                writingProblemHref({
                  questionNo: primary.questionNo,
                  problemId: primary.problemId,
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
          <Space
            className="dashboard-card-stack"
            orientation="vertical"
            size="small"
          >
            {altList.map((alt) => (
              <div key={alt.problemId} className="app-card-compact">
                <Space
                  className="dashboard-recommendation-row"
                  wrap
                >
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
