"use client";

import { Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import type { NormalizedWritingProblem } from "@/lib/writing/problem-normalizer";
import { parseQ54PromptPresentation } from "@/lib/writing/q54-prompt-presentation";

const { Title, Paragraph } = Typography;

type Props = {
  problem: NormalizedWritingProblem;
};

export function QuestionPrompt({ problem }: Props) {
  const t = useTranslations("writing.prompt");
  const titlePrefix = problem.textType?.trim();
  const heading = titlePrefix
    ? `${titlePrefix} - ${problem.title}`
    : problem.title;
  const q54Presentation =
    problem.kind === "q54" ? parseQ54PromptPresentation(problem.prompt) : null;
  const promptText = q54Presentation?.passage ?? problem.prompt;

  return (
    <AppCard size="small">
      <Title level={5}>{heading}</Title>
      <Paragraph
        type="secondary"
        className="writing-question-prompt !m-0 whitespace-pre-line"
      >
        {promptText}
      </Paragraph>
      {q54Presentation && q54Presentation.questions.length === 3 ? (
        <ol className="writing-question-task-list mt-3 grid list-decimal gap-2 ps-8 text-base">
          {q54Presentation.questions.map((question, index) => (
            <li key={`${index}-${question}`}>{question}</li>
          ))}
        </ol>
      ) : null}
      {problem.kind === "q51" || problem.kind === "q52" ? (
        <Space orientation="vertical" size={4} className="w-full">
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
        <Space orientation="vertical" size={4} className="w-full">
          <Typography.Text strong>{t("writingTasksLabel")}</Typography.Text>
          <ul className="writing-guide-list writing-question-prompt">
            {problem.writingTasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
        </Space>
      ) : null}
    </AppCard>
  );
}
