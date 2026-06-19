export type Q51PromptToken =
  | { type: "text"; value: string }
  | { type: "blank"; label: string };

const BLANK_MARKER_RE = /\(\s*([ㄱ-ㅎ])\s*\)/g;

export function tokenizeQ51Prompt(prompt: string): Q51PromptToken[] {
  const tokens: Q51PromptToken[] = [];
  let cursor = 0;

  for (const match of prompt.matchAll(BLANK_MARKER_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      tokens.push({ type: "text", value: prompt.slice(cursor, index) });
    }
    tokens.push({ type: "blank", label: match[1] ?? "" });
    cursor = index + match[0].length;
  }

  if (cursor < prompt.length) {
    tokens.push({ type: "text", value: prompt.slice(cursor) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value: prompt }];
}
