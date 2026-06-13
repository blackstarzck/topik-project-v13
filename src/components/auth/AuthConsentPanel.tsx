"use client";

import { Alert, Button, Checkbox, Divider, Flex, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Paragraph, Text, Title } = Typography;

export type AuthConsentPanelDocument = {
  id: string;
  title: string;
  version: string;
  summary: string | null;
  body: string;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  documents: AuthConsentPanelDocument[];
  next: string;
  showRequiredError: boolean;
};

export function AuthConsentPanel({
  action,
  documents,
  next,
  showRequiredError,
}: Props) {
  const t = useTranslations("auth.consent");

  return (
    <Flex vertical gap={24} className="w-full">
      <div>
        <Title level={2}>{t("heading")}</Title>
        <Paragraph type="secondary">{t("description")}</Paragraph>
      </div>

      {showRequiredError && (
        <Alert type="warning" showIcon title={t("requiredError")} />
      )}

      <Flex vertical gap={16} className="w-full">
        {documents.map((doc) => (
          <section
            key={doc.id}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <Flex vertical gap={8} className="w-full">
              <Text strong>{doc.title}</Text>
              <Text type="secondary">
                {t("versionLabel", { version: doc.version })}
              </Text>
              {doc.summary ? <Paragraph>{doc.summary}</Paragraph> : null}
              <Paragraph className="max-h-40 overflow-auto whitespace-pre-wrap">
                {doc.body}
              </Paragraph>
            </Flex>
          </section>
        ))}
      </Flex>

      <Divider className="!m-0" />

      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <Flex vertical gap={16} className="w-full">
          <Checkbox name="accept">{t("agreement")}</Checkbox>
          <Button type="primary" htmlType="submit" block>
            {t("submit")}
          </Button>
        </Flex>
      </form>
    </Flex>
  );
}
