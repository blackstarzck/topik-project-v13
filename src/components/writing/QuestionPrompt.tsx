"use client";

import { Card, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Title, Paragraph } = Typography;

type Props = {
  questionNo: number;
  title: string;
  prompt: string;
};

export function QuestionPrompt({ questionNo, title, prompt }: Props) {
  const t = useTranslations("writing.prompt");
  return (
    <Card size="small">
      <Title level={5}>{t("heading", { questionNo, title })}</Title>
      <Paragraph type="secondary" style={{ whiteSpace: "pre-line", margin: 0 }}>
        {prompt}
      </Paragraph>
    </Card>
  );
}
