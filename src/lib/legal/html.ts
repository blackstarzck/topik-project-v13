const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const VOID_TAGS = new Set(["br", "col", "hr"]);
const DROP_WITH_CONTENT_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "canvas",
  "audio",
  "video",
  "noscript",
];

const TAG_PATTERN = /<\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)([^<>]*)>/g;
const HTML_TAG_PATTERN = /<\/?\s*[a-zA-Z][a-zA-Z0-9:-]*(?:\s[^<>]*)?>/;
const MARKDOWN_BLOCK_PATTERN = /(^|\n)\s*(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s+)/;
const MARKDOWN_INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|\[[^\]\n]+\]\([^)]+\)|`[^`\n]+`)/;
const ATTRIBUTE_PATTERN =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const SAFE_PROTOCOLS = new Set(["http", "https", "mailto", "tel"]);

// Matches a single HTML tag with the tag name directly after `<`/`</`. This is a
// strict subset of TAG_PATTERN, so anything stashed with it is still re-processed
// by sanitizeLegalDocumentHtml — the final sanitize step remains the only gate.
const INLINE_HTML_TAG_PATTERN = /<\/?[a-zA-Z][^<>]*>/g;
// In the Markdown path <br> is a block separator, so collapse it to a newline
// before line splitting instead of leaking a literal &lt;br&gt; to the reader.
const STRUCTURAL_BR_PATTERN = /<br\b[^<>]*>/gi;
// Block wrapper tags (<div>/<p>/<section>) that admin bodies sometimes wrap a
// single line in. Their attributes are dropped by the sanitizer anyway, so we
// peel them and treat the wrapper as a block boundary.
const WRAPPER_TAG_PREFIX_PATTERN = /^(?:<\/?(?:div|p|section)\b[^<>]*>\s*)+/i;
const WRAPPER_TAG_SUFFIX_PATTERN = /(?:\s*<\/?(?:div|p|section)\b[^<>]*>)+$/i;
// A line that opens with a block-level HTML element must pass through as-is
// rather than being wrapped in <p>.
const RAW_BLOCK_TAG_LINE_PATTERN =
  /^<\/?(?:h[1-6]|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|caption|colgroup|col|blockquote|pre|hr)\b/i;
// Markdown heading marker used only to re-route HTML-looking bodies that still
// carry Markdown headings into the Markdown path.
const MARKDOWN_HEADING_PATTERN = /(^|\n)\s*#{1,6}\s+/;
const LEGAL_DOC_TOKEN_PATTERN = /@@LEGAL_DOC_TOKEN_\d+@@/g;

function entityToCharacter(value: string, radix: 10 | 16): string {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return "";
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return "";
  }
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Escape bare markup characters while leaving already-valid HTML entities
// (e.g. admin-authored &nbsp; / &gt; / &#160;) intact — re-escaping their "&"
// to "&amp;" would surface the literal "&nbsp;" text to readers. Entities in a
// text node decode to characters only (never re-parsed as markup), so this is
// XSS-safe: the final sanitize pass has already removed any real tags.
const NAMED_OR_NUMERIC_ENTITY =
  /&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g;

function escapeText(value: string): string {
  return value
    .replace(NAMED_OR_NUMERIC_ENTITY, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
      entityToCharacter(hex, 16),
    )
    .replace(/&#(\d+);?/g, (_, decimal: string) =>
      entityToCharacter(decimal, 10),
    )
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function sanitizeHref(value: string | null): string | null {
  if (!value) return null;

  const decoded = decodeHtmlEntities(value).trim();
  if (!decoded || decoded.startsWith("//")) return null;

  const normalized = decoded.replace(/[\u0000-\u001F\u007F\s]+/g, "");
  const protocolSeparator = normalized.indexOf(":");

  if (protocolSeparator >= 0) {
    const protocol = normalized.slice(0, protocolSeparator).toLowerCase();
    if (!SAFE_PROTOCOLS.has(protocol)) return null;
  }

  return decoded;
}

function sanitizePositiveInteger(value: string | null): string | null {
  if (!value || !/^[1-9]\d{0,2}$/.test(value.trim())) return null;
  return value.trim();
}

function sanitizeAttributes(tagName: string, source: string): string {
  const attributes = new Map<string, string | null>();
  let match: RegExpExecArray | null;

  ATTRIBUTE_PATTERN.lastIndex = 0;
  while ((match = ATTRIBUTE_PATTERN.exec(source)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? null;
    attributes.set(name, value);
  }

  const sanitized: string[] = [];

  if (tagName === "a") {
    const href = sanitizeHref(attributes.get("href") ?? null);
    if (href) sanitized.push(`href="${escapeAttribute(href)}"`);
  }

  if (tagName === "td" || tagName === "th") {
    const colspan = sanitizePositiveInteger(attributes.get("colspan") ?? null);
    const rowspan = sanitizePositiveInteger(attributes.get("rowspan") ?? null);

    if (colspan) sanitized.push(`colspan="${colspan}"`);
    if (rowspan) sanitized.push(`rowspan="${rowspan}"`);

    if (tagName === "th") {
      const scope = attributes.get("scope")?.trim().toLowerCase();
      if (scope && ["col", "row", "colgroup", "rowgroup"].includes(scope)) {
        sanitized.push(`scope="${scope}"`);
      }
    }
  }

  return sanitized.length ? ` ${sanitized.join(" ")}` : "";
}

function removeDroppedBlocks(html: string): string {
  return DROP_WITH_CONTENT_TAGS.reduce((current, tagName) => {
    const pattern = new RegExp(
      `<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`,
      "gi",
    );
    return current.replace(pattern, "");
  }, html);
}

export function sanitizeLegalDocumentHtml(
  value: string | null | undefined,
): string {
  if (!value) return "";

  const withoutComments = removeDroppedBlocks(value).replace(
    /<!--[\s\S]*?-->/g,
    "",
  );

  return withoutComments.replace(
    TAG_PATTERN,
    (tag, rawTagName: string, rawAttributes: string) => {
      const tagName = rawTagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tagName)) return "";

      const isClosing = /^<\s*\//.test(tag);
      if (isClosing) {
        return VOID_TAGS.has(tagName) ? "" : `</${tagName}>`;
      }

      const attributes = sanitizeAttributes(tagName, rawAttributes);
      return `<${tagName}${attributes}>`;
    },
  );
}

function normalizeDocumentSource(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
  const lines = normalized.split("\n");
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;

  if (minIndent === 0) return normalized.trim();
  return lines
    .map((line) => (line.trim() ? line.slice(minIndent) : ""))
    .join("\n")
    .trim();
}

function hasMarkdownSyntax(value: string): boolean {
  return (
    MARKDOWN_BLOCK_PATTERN.test(value) || MARKDOWN_INLINE_PATTERN.test(value)
  );
}

function renderInlineMarkdown(value: string): string {
  const tokens: string[] = [];
  const stash = (html: string): string => {
    const token = `@@LEGAL_DOC_TOKEN_${tokens.length}@@`;
    tokens.push(html);
    return token;
  };

  // Drop any pre-existing token markers so admin bodies cannot spoof the stash.
  let output = value.replace(LEGAL_DOC_TOKEN_PATTERN, "");

  output = output.replace(/`([^`\n]+)`/g, (_, code: string) =>
    stash(`<code>${escapeText(code)}</code>`),
  );
  // Preserve inline HTML tags (e.g. <strong>, <a>) authored inside otherwise
  // Markdown bodies by stashing them before escapeText runs. Placed after the
  // code-span stash so backtick-quoted "`<div>`" still renders literally.
  output = output.replace(INLINE_HTML_TAG_PATTERN, (tag: string) => stash(tag));
  output = output.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)\)/g,
    (_, label: string, href: string) =>
      stash(
        `<a href="${escapeAttribute(href.trim())}">${escapeText(
          label.trim(),
        )}</a>`,
      ),
  );
  output = output.replace(/\*\*([^*\n]+)\*\*/g, (_, text: string) =>
    stash(`<strong>${escapeText(text)}</strong>`),
  );
  output = output.replace(/__([^_\n]+)__/g, (_, text: string) =>
    stash(`<strong>${escapeText(text)}</strong>`),
  );
  output = output.replace(/\*([^*\n]+)\*/g, (_, text: string) =>
    stash(`<em>${escapeText(text)}</em>`),
  );

  output = escapeText(output);

  // Restore descending so a token nested inside a later token (e.g. a code span
  // inside a link label) is expanded after its container.
  return tokens.reduceRight(
    (current, html, index) =>
      current.replaceAll(`@@LEGAL_DOC_TOKEN_${index}@@`, html),
    output,
  );
}

function markdownToHtml(value: string): string {
  const source = normalizeDocumentSource(value);
  const withoutUnsafeBlocks = removeDroppedBlocks(source)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(STRUCTURAL_BR_PATTERN, "\n");
  const lines = withoutUnsafeBlocks.split("\n");
  const blocks: string[] = [];
  const paragraphLines: string[] = [];
  let listType: "ol" | "ul" | null = null;

  const closeList = () => {
    if (!listType) return;
    blocks.push(`</${listType}>`);
    listType = null;
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push(
      `<p>${paragraphLines.map(renderInlineMarkdown).join("<br>")}</p>`,
    );
    paragraphLines.length = 0;
  };

  const ensureList = (nextListType: "ol" | "ul") => {
    if (listType === nextListType) return;
    closeList();
    blocks.push(`<${nextListType}>`);
    listType = nextListType;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    // Peel <div>/<p>/<section> wrappers so a line like "<div>## 제1조</div>"
    // is classified by its inner Markdown instead of leaking the wrapper tag.
    const unwrapped = trimmed
      .replace(WRAPPER_TAG_PREFIX_PATTERN, "")
      .replace(WRAPPER_TAG_SUFFIX_PATTERN, "")
      .trim();
    if (!unwrapped) {
      // Wrapper-only line (e.g. a lone <div> or </div>) is just a block break.
      flushParagraph();
      closeList();
      continue;
    }

    // Lines that open with a block-level HTML element pass through untouched
    // (still sanitized later) rather than being wrapped in <p>.
    if (RAW_BLOCK_TAG_LINE_PATTERN.test(unwrapped)) {
      flushParagraph();
      closeList();
      blocks.push(renderInlineMarkdown(unwrapped));
      continue;
    }

    const heading = unwrapped.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unorderedItem = unwrapped.match(/^[-*+]\s+(.+)$/);
    if (unorderedItem) {
      flushParagraph();
      ensureList("ul");
      blocks.push(`<li>${renderInlineMarkdown(unorderedItem[1])}</li>`);
      continue;
    }

    const orderedItem = unwrapped.match(/^\d+[.)]\s+(.+)$/);
    if (orderedItem) {
      flushParagraph();
      ensureList("ol");
      blocks.push(`<li>${renderInlineMarkdown(orderedItem[1])}</li>`);
      continue;
    }

    const quote = unwrapped.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      closeList();
      blocks.push(
        `<blockquote><p>${renderInlineMarkdown(quote[1])}</p></blockquote>`,
      );
      continue;
    }

    closeList();
    paragraphLines.push(unwrapped);
  }

  flushParagraph();
  closeList();

  return blocks.join("\n");
}

export function renderLegalDocumentBodyHtml(
  value: string | null | undefined,
): string {
  if (!value) return "";

  const normalized = normalizeDocumentSource(value);
  if (!normalized) return "";

  if (HTML_TAG_PATTERN.test(normalized) && !hasMarkdownSyntax(normalized)) {
    // A body can look like HTML yet still carry Markdown headings inside its
    // tags (e.g. "<div>## 제1조</div>"). Strip tags and, only if a heading
    // marker survives, fall through to the Markdown path so "##" is converted.
    const probe = removeDroppedBlocks(normalized).replace(TAG_PATTERN, "\n");
    if (!MARKDOWN_HEADING_PATTERN.test(probe)) {
      return sanitizeLegalDocumentHtml(normalized);
    }
  }

  return sanitizeLegalDocumentHtml(markdownToHtml(normalized));
}
