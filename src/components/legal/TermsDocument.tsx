"use client";

// DB-backed legal document renderer (X-13 terms). Renders the published
// legal_documents row projected from the admin operation_policies. The body is
// admin-authored HTML (operation_policies.body_html) and already includes the
// document heading, so we render it as-is and show only a version/effective-date
// meta line above it. "use client" because AppCard/antd Typography crash in a
// server component (prod React #130), matching TermsContent.

import { Typography } from "antd";

import { AppCard } from "@/components/shared/AppCard";
import type { PublishedLegalDocument } from "@/lib/legal/documents";

const { Text } = Typography;

function formatEffectiveDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function TermsDocument({ doc }: { doc: PublishedLegalDocument }) {
  const effective = formatEffectiveDate(doc.effective_at);
  const meta = [doc.version, effective].filter(Boolean).join(" · ");

  return (
    <AppCard data-testid="terms-card">
      <div className="flex w-full flex-col gap-4">
        {meta ? (
          <Text type="secondary" data-testid="terms-version">
            {meta}
          </Text>
        ) : null}
        <div
          className="legal-document-body"
          data-testid="terms-document-body"
          dangerouslySetInnerHTML={{ __html: doc.body }}
        />
      </div>
      <style>{`
        .legal-document-body { line-height: 1.7; word-break: break-word; }
        .legal-document-body h2 { font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem; }
        .legal-document-body h3 { font-size: 1.15rem; font-weight: 700; margin: 1.75rem 0 .5rem; }
        .legal-document-body h4 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 .4rem; }
        .legal-document-body p { margin: 0 0 .75rem; }
        .legal-document-body ul, .legal-document-body ol { margin: 0 0 .75rem; padding-left: 1.5rem; }
        .legal-document-body ul { list-style: disc; }
        .legal-document-body ol { list-style: decimal; }
        .legal-document-body li { margin-bottom: .35rem; }
      `}</style>
    </AppCard>
  );
}
