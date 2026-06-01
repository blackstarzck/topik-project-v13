"use client";

import { Card, Typography } from "antd";

const { Title, Paragraph } = Typography;

type Props = {
  questionNo: number;
  title: string;
  prompt: string;
};

export function QuestionPrompt({ questionNo, title, prompt }: Props) {
  return (
    <Card size="small">
      <Title level={5}>
        {questionNo}번 — {title}
      </Title>
      <Paragraph type="secondary" style={{ whiteSpace: "pre-line", margin: 0 }}>
        {prompt}
      </Paragraph>
    </Card>
  );
}
