"use client";

import { Button, Empty, Tag, Typography } from "antd";
import { ListChecks } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";

const { Text, Title, Paragraph } = Typography;

/** dimension → practice.common label key. */
const DIMENSION_LABEL_KEYS: Record<string, string> = {
  grammar: "dimGrammar",
  vocab: "dimVocab",
  structure: "dimStructure",
  content: "dimContent",
  expression: "dimExpression",
  topic_fit: "dimTopicFit",
};

type WeakDimension = {
  dimension: string;
  averageScore: number;
  sampleCount?: number;
};

type Props = {
  /** weak 차원 array (오름차순 점수). 첫 번째가 가장 약한 차원. */
  weakDimensions: WeakDimension[];
  /** 마지막 분석 갱신 시각 (ISO). */
  updatedAt?: string | null;
  /**
   * Phase 7-D follow-up (X-07 §3 예외) — 분석 실패/데이터 없음을 명시적으로
   * 표시할지. true면 weakDimensions가 비어 있어도 "실패" 톤의 빈 상태 + 다시
   * 분석 CTA를 보여준다. 기본 false (데이터 부족 톤).
   */
  failed?: boolean;
};

/**
 * Phase 7-D Task 7 (P1-3) — X-07 핵심 진단 카드.
 * 가장 약한 차원 1개 강조 + 분석 갱신일.
 * 예외(§3): 추천 없음/분석 실패는 빈 상태와 다시 분석 CTA 표시.
 */
export function DiagnosticCard({ weakDimensions, updatedAt, failed }: Props) {
  const t = useTranslations("practice.weakness");
  const tCommon = useTranslations("practice.common");
  const router = useRouter();

  if (weakDimensions.length === 0) {
    return (
      <AppCard data-testid="diagnostic-empty">
        <Empty
          description={failed ? t("diagnosticFailed") : t("diagnosticNoData")}
        >
          <Button
            type="primary"
            icon={<ListChecks size={16} />}
            onClick={() => router.push("/practice/problems" as never)}
            data-testid="diagnostic-reanalyze"
          >
            {t("recommendationsEmptyCta")}
          </Button>
        </Empty>
      </AppCard>
    );
  }

  const primary = weakDimensions[0];
  const label = DIMENSION_LABEL_KEYS[primary.dimension]
    ? tCommon(
        DIMENSION_LABEL_KEYS[primary.dimension] as Parameters<
          typeof tCommon
        >[0],
      )
    : primary.dimension;

  return (
    <AppCard>
      <Title level={5}>{t("diagnosticTopTitle")}</Title>
      <Paragraph>
        <Tag className="!text-sm">{label}</Tag>
        <Text>
          {" "}
          {t("diagnosticAverage", {
            score: Math.round(primary.averageScore),
          })}
        </Text>
      </Paragraph>
      <Paragraph>
        <Text type="secondary">{t("diagnosticBody")}</Text>
      </Paragraph>
      {updatedAt ? (
        <Text type="secondary" className="!text-xs">
          {t("diagnosticUpdated", {
            // Pin tz + 24h so SSR (Node) and client (browser) ICU agree — Node
            // renders the ko-KR day-period as "PM" vs browser "오후" → React #418.
            date: new Date(updatedAt).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
              hour12: false,
            }),
          })}
        </Text>
      ) : null}
    </AppCard>
  );
}
