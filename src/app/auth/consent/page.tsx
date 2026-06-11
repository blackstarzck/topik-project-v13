import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Alert, Button, Checkbox, Divider, Flex, Typography } from "antd";

import { acceptRequiredConsentsAction } from "@/app/auth/consent/actions";
import { sanitizeNext } from "@/lib/auth/error-mapping";
import { bootstrapProfile } from "@/lib/auth/profile";
import { requireUser } from "@/lib/auth/session";
import { getMissingRequiredConsentDocuments } from "@/lib/legal/consent";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

export const dynamic = "force-dynamic";

const { Paragraph, Text, Title } = Typography;

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const documentListStyle: CSSProperties = {
  border: "1px solid var(--ant-color-border-secondary)",
  borderRadius: 8,
  padding: 16,
  background: "var(--ant-color-fill-quaternary)",
};

const documentBodyStyle: CSSProperties = {
  maxHeight: 160,
  overflow: "auto",
  whiteSpace: "pre-wrap",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.consent");
  return { title: t("metaTitle") };
}

export default async function AuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = sanitizeNext(
    pickFirst(params.next),
    "/auth/post-auth?intent=login",
  );
  const showRequiredError = pickFirst(params.error) === "required";
  const user = await requireUser();
  const profile = await bootstrapProfile(user.id);
  const missingDocuments = await getMissingRequiredConsentDocuments(
    user.id,
    profile.ui_locale,
  );

  if (missingDocuments.length === 0) {
    redirect(next);
  }

  const t = await getTranslations("auth.consent");

  return (
    <PublicShell>
      <PageContainer size="narrow">
        <Flex vertical gap={24} style={{ width: "100%" }}>
          <div>
            <Title level={2}>{t("heading")}</Title>
            <Paragraph type="secondary">{t("description")}</Paragraph>
          </div>

          {showRequiredError && (
            <Alert type="warning" showIcon title={t("requiredError")} />
          )}

          <Flex vertical gap={16} style={{ width: "100%" }}>
            {missingDocuments.map((doc) => (
              <section key={doc.id} style={documentListStyle}>
                <Flex vertical gap={8} style={{ width: "100%" }}>
                  <Text strong>{doc.title}</Text>
                  <Text type="secondary">
                    {t("versionLabel", { version: doc.version })}
                  </Text>
                  {doc.summary ? <Paragraph>{doc.summary}</Paragraph> : null}
                  <Paragraph style={documentBodyStyle}>{doc.body}</Paragraph>
                </Flex>
              </section>
            ))}
          </Flex>

          <Divider style={{ margin: 0 }} />

          <form action={acceptRequiredConsentsAction}>
            <input type="hidden" name="next" value={next} />
            <Flex vertical gap={16} style={{ width: "100%" }}>
              <Checkbox name="accept">
                {t("agreement")}
              </Checkbox>
              <Button type="primary" htmlType="submit" block>
                {t("submit")}
              </Button>
            </Flex>
          </form>
        </Flex>
      </PageContainer>
    </PublicShell>
  );
}
