"use client";

// DB-backed legal document renderer (X-13 terms). Renders the published
// legal_documents row projected from the admin operation_policies. The body is
// admin-authored HTML (operation_policies.body_html) and already includes the
// document heading, so we render the sanitized body and show only a
// version/effective-date meta line above it. "use client" because AppCard/antd
// Typography crash in a server component (prod React #130), matching
// TermsContent.

import { Typography } from "antd";

import { AppCard } from "@/components/shared/AppCard";
import type { PublishedLegalDocument } from "@/lib/legal/documents";
import { sanitizeLegalDocumentHtml } from "@/lib/legal/html";

const { Text } = Typography;

function formatEffectiveDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function TermsDocument({ doc }: { doc: PublishedLegalDocument }) {
  const effective = formatEffectiveDate(doc.effective_at);
  const bodyHtml = sanitizeLegalDocumentHtml(doc.body);
  const meta = [doc.version, effective].filter(Boolean).join(" · ");

  return (
    <AppCard className="legal-document-card" data-testid="terms-card">
      <div className="legal-document-card__content flex w-full flex-col gap-4">
        {meta ? (
          <Text type="secondary" data-testid="terms-version">
            {meta}
          </Text>
        ) : null}
        <div
          className="legal-document-body"
          data-testid="terms-document-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    </AppCard>
  );
}
