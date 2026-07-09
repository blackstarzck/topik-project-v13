"use client";

// DB-backed legal document renderer (X-13 terms, X-14 privacy). Renders the
// published legal_documents row projected from the admin operation_policies.
// The body may be admin-authored HTML or Markdown and already includes the
// document heading, so we render the sanitized body and show only a
// version/effective-date meta line above it. "use client" because AppCard/antd
// Typography crash in a server component (prod React #130), matching
// TermsContent.

import { Typography } from "antd";

import { AppCard } from "@/components/shared/AppCard";
import type { PublishedLegalDocument } from "@/lib/legal/documents";
import { renderLegalDocumentBodyHtml } from "@/lib/legal/html";

const { Text } = Typography;

function formatEffectiveDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

type LegalDocumentProps = {
  doc: PublishedLegalDocument;
  testIdPrefix?: "terms" | "privacy";
};

export function LegalDocument({
  doc,
  testIdPrefix = "terms",
}: LegalDocumentProps) {
  const effective = formatEffectiveDate(doc.effective_at);
  const bodyHtml = renderLegalDocumentBodyHtml(doc.body);
  const meta = [doc.version, effective].filter(Boolean).join(" · ");

  return (
    <AppCard
      className="legal-document-card"
      data-testid={`${testIdPrefix}-card`}
    >
      <div className="legal-document-card__content flex w-full flex-col gap-4">
        {meta ? (
          <Text type="secondary" data-testid={`${testIdPrefix}-version`}>
            {meta}
          </Text>
        ) : null}
        <div
          className="legal-document-body"
          data-testid={`${testIdPrefix}-document-body`}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    </AppCard>
  );
}

export function TermsDocument({ doc }: { doc: PublishedLegalDocument }) {
  return <LegalDocument doc={doc} testIdPrefix="terms" />;
}
