"use client";

// DB-backed legal document renderer (X-13 terms, X-14 privacy). Renders the
// published legal_documents row projected from the admin operation_policies.
// The body may be admin-authored HTML or Markdown. When it does not include a
// level-one heading, the published title supplies the accessible page heading.
// "use client" because AppCard/antd Typography crash in a server component
// (prod React #130), matching TermsContent.

import { Typography } from "antd";

import { AppCard } from "@/components/shared/AppCard";
import type { PublishedLegalDocument } from "@/lib/legal/documents";
import { renderLegalDocumentBodyHtml } from "@/lib/legal/html";

const { Text, Title } = Typography;

const INVISIBLE_HEADING_CHARACTERS =
  /[\s\u00a0\u00ad\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]/gu;
const INVISIBLE_HEADING_CHARACTER =
  /[\s\u00a0\u00ad\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]/u;
const INVISIBLE_HEADING_ENTITIES =
  /&(?:nbsp|ensp|emsp|thinsp|hairsp|numsp|puncsp|mediumspace|negativemediumspace|negativethickspace|negativethinspace|negativeverythinspace|zerowidthspace|zwnj|zwj|lrm|rlm|shy|newline|tab);?/gi;

function removeInvisibleHeadingContent(content: string) {
  return content
    .replace(/<[^>]*>/g, "")
    .replace(INVISIBLE_HEADING_ENTITIES, "")
    .replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (entity, hex, decimal) => {
      const codePoint = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
      try {
        const character = String.fromCodePoint(codePoint);
        return INVISIBLE_HEADING_CHARACTER.test(character) ? "" : entity;
      } catch {
        return entity;
      }
    })
    .replace(INVISIBLE_HEADING_CHARACTERS, "");
}

function normalizeLevelOneHeadings(bodyHtml: string): {
  bodyHtml: string;
  hasVisibleHeading: boolean;
} {
  let hasVisibleHeading = false;
  const normalized = bodyHtml.replace(
    /<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi,
    (heading, content: string) => {
      const visibleText = removeInvisibleHeadingContent(content);
      if (visibleText.length === 0) return "";
      hasVisibleHeading = true;
      return heading;
    },
  );
  return { bodyHtml: normalized, hasVisibleHeading };
}

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
  const renderedBodyHtml = renderLegalDocumentBodyHtml(doc.body);
  const { bodyHtml, hasVisibleHeading } =
    normalizeLevelOneHeadings(renderedBodyHtml);
  const shouldRenderTitle = !hasVisibleHeading;
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
        {shouldRenderTitle ? <Title level={1}>{doc.title}</Title> : null}
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
