import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import postcss from "postcss";

type ParsedCssRule = {
  atRules: string[];
  declarations: string;
  depth: number;
  selector: string;
  selectors: string[];
};

export type GlobalCssOwner = {
  path: string;
  selector: string;
};

function normalizeCssSelector(selector: string) {
  return selector
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\s*([,>+~])\s*/gu, "$1")
    .replace(/\(\s+/gu, "(")
    .replace(/\s+\)/gu, ")");
}

function normalizeCssAtRule(atRule: string) {
  return normalizeCssSelector(atRule)
    .replace(/^(@[\w-]+)\s*\(/u, "$1(")
    .replace(/\s*:\s*/gu, ":");
}

function splitCssSelectors(selector: string) {
  const selectors: string[] = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    const previous = selector[index - 1];

    if (quote) {
      if (character === quote && previous !== "\\") quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") parentheses += 1;
    if (character === ")") parentheses = Math.max(0, parentheses - 1);
    if (character === "[") brackets += 1;
    if (character === "]") brackets = Math.max(0, brackets - 1);
    if (character === "," && parentheses === 0 && brackets === 0) {
      selectors.push(normalizeCssSelector(selector.slice(start, index)));
      start = index + 1;
    }
  }

  selectors.push(normalizeCssSelector(selector.slice(start)));
  return selectors.filter(Boolean);
}

function parseCssRules(source: string): ParsedCssRule[] {
  const rules: ParsedCssRule[] = [];

  postcss.parse(source).walkRules((rule) => {
    const atRules: string[] = [];
    let depth = 0;
    let parent = rule.parent;
    while (parent && parent.type !== "root") {
      depth += 1;
      if (parent.type === "atrule") {
        atRules.unshift(
          normalizeCssAtRule(
            `@${parent.name}${parent.params ? ` ${parent.params}` : ""}`,
          ),
        );
      }
      parent = parent.parent;
    }

    const selector = normalizeCssSelector(rule.selector);
    rules.push({
      atRules,
      declarations: (rule.nodes ?? [])
        .filter((node) => node.type === "decl")
        .map(
          (node) =>
            `${node.prop}: ${node.value}${node.important ? " !important" : ""};`,
        )
        .join(" "),
      depth,
      selector,
      selectors: splitCssSelectors(selector),
    });
  });

  return rules;
}

function canonicalDeclarations(source: string) {
  return source
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      return [
        declaration.slice(0, separator).trim().toLowerCase(),
        declaration
          .slice(separator + 1)
          .replace(/\s+/gu, " ")
          .trim()
          .replace(/\(\s+/gu, "(")
          .replace(/\s+\)/gu, ")")
          .replace(/\s*,\s*/gu, ", "),
      ] as const;
    })
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      `${leftName}:${leftValue}`.localeCompare(`${rightName}:${rightValue}`),
    );
}

export function hasExactCssRule(
  source: string,
  selector: string,
  expectedDeclarations: string,
  expectedAtRules: readonly string[] = [],
) {
  const normalizedSelector = normalizeCssSelector(selector);
  const normalizedAtRules = expectedAtRules.map(normalizeCssAtRule);
  const matches = parseCssRules(source).filter(
    (rule) =>
      rule.selectors.includes(normalizedSelector) &&
      JSON.stringify(rule.atRules) === JSON.stringify(normalizedAtRules),
  );

  return (
    matches.length === 1 &&
    matches[0].depth === normalizedAtRules.length &&
    matches[0].selectors.length === 1 &&
    matches[0].selector === normalizedSelector &&
    JSON.stringify(canonicalDeclarations(matches[0].declarations)) ===
      JSON.stringify(canonicalDeclarations(expectedDeclarations))
  );
}

function selectorContainsClass(
  selector: string,
  className: string,
  includeSuffix: boolean,
) {
  const decodedSelector = selector.replace(
    /\\(?:([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|([^\r\n\f0-9a-f]))/giu,
    (_match, hexadecimal: string | undefined, escaped: string | undefined) =>
      hexadecimal
        ? String.fromCodePoint(Number.parseInt(hexadecimal, 16))
        : (escaped ?? ""),
  );
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (
    new RegExp(
      `\\.${escapedClassName}${includeSuffix ? "[\\w-]*" : "(?![\\w-])"}`,
      "u",
    ).test(decodedSelector)
  ) {
    return true;
  }

  const classAttributePattern =
    /\[\s*class\s*(=|~=|\|=|\^=|\$=|\*=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))/giu;
  return Array.from(decodedSelector.matchAll(classAttributePattern)).some(
    (match) => {
      const operator = match[1];
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      const matchesClass = (candidate: string) =>
        includeSuffix
          ? candidate.startsWith(className)
          : candidate === className;

      if (operator === "=") {
        return value.split(/\s+/u).some(matchesClass);
      }
      if (operator === "~=") return matchesClass(value);
      if (operator === "|=") {
        return (
          matchesClass(value) ||
          className === value ||
          className.startsWith(`${value}-`)
        );
      }
      if (operator === "^=") {
        return (
          className.startsWith(value) ||
          (includeSuffix && value.startsWith(className))
        );
      }
      if (operator === "$=") {
        return (
          className.endsWith(value) ||
          (includeSuffix && value.startsWith(className))
        );
      }
      if (operator === "*=") {
        return (
          className.includes(value) ||
          (includeSuffix && value.includes(className))
        );
      }
      return false;
    },
  );
}

export function findClassOwners(
  source: string,
  classNames: readonly string[],
  { includeSuffix = false } = {},
) {
  return parseCssRules(source).flatMap((rule) =>
    rule.selectors.filter((selector) =>
      classNames.some((className) =>
        selectorContainsClass(selector, className, includeSuffix),
      ),
    ),
  );
}

function readNonModuleCssPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return readNonModuleCssPaths(path);
    return entry.isFile() &&
      entry.name.endsWith(".css") &&
      !entry.name.endsWith(".module.css")
      ? [path]
      : [];
  });
}

export function findGlobalCssOwners(
  classNames: readonly string[],
  sourceRoot = join(process.cwd(), "src"),
  options: { includeSuffix?: boolean } = {},
): GlobalCssOwner[] {
  return readNonModuleCssPaths(sourceRoot).flatMap((path) =>
    findClassOwners(readFileSync(path, "utf8"), classNames, options).map(
      (selector) => ({
        path: relative(process.cwd(), path).replaceAll("\\", "/"),
        selector,
      }),
    ),
  );
}

export function hasStableAndScopedClasses(
  element: Element | null | undefined,
  stableClassName: string,
  scopedClassName: string,
) {
  return Boolean(
    element?.classList.contains(stableClassName) &&
    element.classList.contains(scopedClassName),
  );
}
