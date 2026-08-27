import postcss from "postcss";

function findCssClassSelectors(
  source: string,
  matchesClassName: (className: string) => boolean,
) {
  const root = postcss.parse(source);
  const selectors: string[] = [];

  root.walkRules((rule) => {
    const classNames = Array.from(
      rule.selector.matchAll(/\.([A-Za-z_-][\w-]*)/gu),
      (match) => match[1],
    );

    if (classNames.some(matchesClassName)) {
      selectors.push(rule.selector);
    }
  });

  return selectors;
}

export function findCssClassFamilySelectors(
  source: string,
  baseClassNames: readonly string[],
) {
  return findCssClassSelectors(source, (className) =>
    baseClassNames.some(
      (baseClassName) =>
        className === baseClassName ||
        className.startsWith(`${baseClassName}__`) ||
        className.startsWith(`${baseClassName}--`),
    ),
  );
}

export function findCssClassPrefixSelectors(
  source: string,
  classNamePrefixes: readonly string[],
) {
  return findCssClassSelectors(source, (className) =>
    classNamePrefixes.some((prefix) => className.startsWith(prefix)),
  );
}
