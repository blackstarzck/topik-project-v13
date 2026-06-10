"use client";

import { Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

type Props = {
  step: number;
  reduceMotion?: boolean;
};

export function AnalysisCharacter({ step, reduceMotion }: Props) {
  const t = useTranslations("feedback.analysis");
  return (
    <div
      className={[
        "analysis-character",
        reduceMotion ? "analysis-character--static" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={t("characterAria")}
      role="img"
      data-step={step}
    >
      <div className="analysis-character__stage" aria-hidden>
        <div className="analysis-character__bot">
          <span className="analysis-character__eye" />
          <span className="analysis-character__eye" />
          <span className="analysis-character__mouth" />
        </div>
        <span className="analysis-character__spark analysis-character__spark--left" />
        <span className="analysis-character__spark analysis-character__spark--right" />
      </div>
      <Text type="secondary" className="analysis-character__caption">
        {t("characterCaption")}
      </Text>
    </div>
  );
}
