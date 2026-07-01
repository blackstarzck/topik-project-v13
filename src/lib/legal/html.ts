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

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
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

  let output = value;

  output = output.replace(/`([^`\n]+)`/g, (_, code: string) =>
    stash(`<code>${escapeText(code)}</code>`),
  );
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

  return tokens.reduce(
    (current, html, index) =>
      current.replaceAll(`@@LEGAL_DOC_TOKEN_${index}@@`, html),
    output,
  );
}

function markdownToHtml(value: string): string {
  const source = normalizeDocumentSource(value);
  const withoutUnsafeBlocks = removeDroppedBlocks(source).replace(
    /<!--[\s\S]*?-->/g,
    "",
  );
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

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unorderedItem = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unorderedItem) {
      flushParagraph();
      ensureList("ul");
      blocks.push(`<li>${renderInlineMarkdown(unorderedItem[1])}</li>`);
      continue;
    }

    const orderedItem = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (orderedItem) {
      flushParagraph();
      ensureList("ol");
      blocks.push(`<li>${renderInlineMarkdown(orderedItem[1])}</li>`);
      continue;
    }

    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      closeList();
      blocks.push(
        `<blockquote><p>${renderInlineMarkdown(quote[1])}</p></blockquote>`,
      );
      continue;
    }

    closeList();
    paragraphLines.push(trimmed);
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
    return sanitizeLegalDocumentHtml(normalized);
  }

  return sanitizeLegalDocumentHtml(markdownToHtml(normalized));
}
