"use client";

import { Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import type { NormalizedWritingProblem } from "@/lib/writing/problem-normalizer";

const { Title, Paragraph } = Typography;

type Props = {
  problem: NormalizedWritingProblem;
};

function firstPromptBlock(prompt: string) {
  return prompt.split(/\n\s*\n/)[0] ?? prompt;
}

export function QuestionPrompt({ problem }: Props) {
  const t = useTranslations("writing.prompt");
  const prompt =
    problem.kind === "q54" ? firstPromptBlock(problem.prompt) : problem.prompt;
  return (
    <AppCard size="small">
      <Title level={5}>
        {t("heading", {
          questionNo: problem.questionNo,
          title: problem.title,
        })}
      </Title>
      <Paragraph className="writing-prompt-copy" type="secondary">
        {prompt}
      </Paragraph>
      {problem.kind === "q51" || problem.kind === "q52" ? (
        <Space className="writing-prompt-stack" orientation="vertical" size={4}>
          <Typography.Text strong>{t("blanksLabel")}</Typography.Text>
          <Space wrap>
            {problem.blanks.map((blank) => (
              <Tag key={blank.key} color={blank.key === "ㄱ" ? "blue" : "cyan"}>
                {blank.label}
                {blank.role ? ` · ${blank.role}` : ""}
              </Tag>
            ))}
          </Space>
        </Space>
      ) : null}
      {problem.kind === "q53" && problem.writingTasks.length > 0 ? (
        <Space className="writing-prompt-stack" orientation="vertical" size={4}>
          <Typography.Text strong>{t("writingTasksLabel")}</Typography.Text>
          <ol className="writing-prompt-list">
            {problem.writingTasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ol>
        </Space>
      ) : null}
      {problem.kind === "q54" ? (
        <Space className="writing-prompt-stack" orientation="vertical" size={8}>
          {problem.topicDefinition ? (
            <Paragraph className="writing-prompt-paragraph">
              <Typography.Text strong>{t("definitionLabel")}</Typography.Text>{" "}
              {problem.topicDefinition}
            </Paragraph>
          ) : null}
          {problem.background ? (
            <Paragraph className="writing-prompt-paragraph">
              <Typography.Text strong>{t("backgroundLabel")}</Typography.Text>{" "}
              {problem.background}
            </Paragraph>
          ) : null}
          {problem.requiredQuestions.length > 0 ? (
            <div>
              <Typography.Text strong>
                {t("requiredQuestionsLabel")}
              </Typography.Text>
              <ol className="writing-prompt-list writing-prompt-list--offset">
                {problem.requiredQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </Space>
      ) : null}
    </AppCard>
  );
}
