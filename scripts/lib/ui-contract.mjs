import { createHash } from "node:crypto";
import path from "node:path";

import postcss from "postcss";
import ts from "typescript";

export const UI_CONTRACT_SCHEMA_VERSION = 1;
export const UI_CONTRACT_BASELINE_SCHEMA_VERSION = 2;
export const UI_CONTRACT_SCANNER_VERSION = 5;
const TEST_SCANNER_DIGEST = "0".repeat(64);

const SCRIPT_KINDS = new Map([
  [".ts", [ts.ScriptKind.TS, "TS"]],
  [".tsx", [ts.ScriptKind.TSX, "TSX"]],
  [".js", [ts.ScriptKind.JS, "JS"]],
  [".jsx", [ts.ScriptKind.JSX, "JSX"]],
]);

export class UiContractError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "UiContractError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function isWindowsAbsolute(value) {
  return /^[A-Za-z]:[\\/]/u.test(value);
}

function assertContainedRelative(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    isWindowsAbsolute(normalized)
  ) {
    throw new UiContractError("UI_SOURCE_OUTSIDE_ROOT");
  }
  return normalized.replace(/^\.\//u, "");
}

export function normalizeRepoPath(filePath, rootPath) {
  if (typeof filePath !== "string" || filePath.length === 0 || filePath.includes("\0")) {
    throw new UiContractError("UI_SOURCE_PATH_INVALID");
  }

  if (rootPath === undefined) {
    return assertContainedRelative(filePath);
  }
  if (typeof rootPath !== "string" || rootPath.length === 0 || rootPath.includes("\0")) {
    throw new UiContractError("UI_SOURCE_ROOT_INVALID");
  }

  if (isWindowsAbsolute(rootPath) || isWindowsAbsolute(filePath)) {
    const root = path.win32.resolve(rootPath);
    const target = path.win32.resolve(root, filePath);
    const relative = path.win32.relative(root, target);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.win32.sep}`) ||
      path.win32.isAbsolute(relative)
    ) {
      throw new UiContractError("UI_SOURCE_OUTSIDE_ROOT");
    }
    return assertContainedRelative(relative);
  }

  const root = path.posix.resolve(rootPath.replaceAll("\\", "/"));
  const target = path.posix.resolve(root, filePath.replaceAll("\\", "/"));
  const relative = path.posix.relative(root, target);
  return assertContainedRelative(relative);
}

function normalizeSemanticKey(value) {
  return String(value).replace(/[\u0000-\u0020]+/gu, " ").trim();
}

function sanitizeLexeme(value) {
  return normalizeSemanticKey(value).slice(0, 160);
}

export function createViolation({ ruleId, path: sourcePath, line, semanticKey, lexeme }) {
  const normalizedPath = normalizeRepoPath(sourcePath);
  const normalizedKey = normalizeSemanticKey(semanticKey);
  const fingerprint = createHash("sha256")
    .update(
      `${UI_CONTRACT_SCANNER_VERSION}\0${ruleId}\0${normalizedPath}\0${normalizedKey}`,
      "utf8",
    )
    .digest("hex");

  return Object.freeze({
    ruleId,
    path: normalizedPath,
    line: Number.isInteger(line) && line > 0 ? line : 1,
    fingerprint,
    lexeme: sanitizeLexeme(lexeme),
  });
}

export function parseUiSource(source) {
  const extension = path.extname(source.path).toLowerCase();
  if (extension === ".css") {
    try {
      return {
        kind: "css",
        scriptKind: null,
        ast: postcss.parse(source.content, { from: source.path }),
      };
    } catch {
      throw new UiContractError("UI_CONTRACT_PARSE_ERROR", {
        path: normalizeRepoPath(source.path),
      });
    }
  }

  const scriptKind = SCRIPT_KINDS.get(extension);
  if (!scriptKind) {
    throw new UiContractError("UI_SOURCE_EXTENSION_UNSUPPORTED", {
      path: normalizeRepoPath(source.path),
    });
  }

  const ast = ts.createSourceFile(
    source.path,
    source.content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind[0],
  );
  if (ast.parseDiagnostics.length > 0) {
    throw new UiContractError("UI_CONTRACT_PARSE_ERROR", {
      path: normalizeRepoPath(source.path),
    });
  }
  return { kind: "typescript", scriptKind: scriptKind[1], ast };
}

function lineOf(ast, node) {
  return ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
}

function canonicalTypeScriptNode(node, ast) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.JSX,
    node.getText(ast),
  );
  const tokens = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    tokens.push(`${token}:${scanner.getTokenValue()}`);
  }
  return tokens.join("|");
}

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isNonReferenceIdentifier(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (
    (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent)) &&
    parent.name === node
  ) {
    return true;
  }
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  return false;
}

function directLexicalBindingInfo(scope, identifier) {
  if (ts.isFunctionLike(scope)) {
    for (const parameter of scope.parameters) {
      if (ts.isIdentifier(parameter.name) && parameter.name.text === identifier) {
        return { node: parameter.initializer ?? parameter, immutable: false };
      }
    }
  }
  const statements =
    ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope)
      ? scope.statements
      : [];
  const loopInitializer =
    ts.isForStatement(scope) || ts.isForInStatement(scope) || ts.isForOfStatement(scope)
      ? scope.initializer
      : null;
  if (loopInitializer && ts.isVariableDeclarationList(loopInitializer)) {
    for (const declaration of loopInitializer.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === identifier) {
        return {
          node: declaration.initializer ?? declaration,
          immutable: Boolean(loopInitializer.flags & ts.NodeFlags.Const),
        };
      }
    }
  }
  for (const statement of statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === identifier) {
          return {
            node: declaration.initializer ?? declaration,
            immutable: Boolean(statement.declarationList.flags & ts.NodeFlags.Const),
          };
        }
  if (
    ts.isObjectBindingPattern(declaration.name) ||
    ts.isArrayBindingPattern(declaration.name)
  ) {
    const binding = declaration.name.elements.find(
      (element) =>
        ts.isBindingElement(element) &&
        ts.isIdentifier(element.name) &&
        element.name.text === identifier,
    );
          if (binding) {
            return {
              node: binding,
              immutable: Boolean(statement.declarationList.flags & ts.NodeFlags.Const),
            };
          }
        }
      }
    }
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name?.text === identifier
    ) {
      return { node: statement, immutable: false };
    }
  }
  return null;
}

function nearestLexicalBindingInfo(identifierNode) {
  for (let scope = identifierNode.parent; scope; scope = scope.parent) {
    if (
      ts.isSourceFile(scope) ||
      ts.isBlock(scope) ||
      ts.isModuleBlock(scope) ||
      ts.isFunctionLike(scope) ||
      ts.isForStatement(scope) ||
      ts.isForInStatement(scope) ||
      ts.isForOfStatement(scope)
    ) {
      const binding = directLexicalBindingInfo(scope, identifierNode.text);
      if (binding) return binding;
    }
  }
  return null;
}

function resolveStyleBinding(
  identifierNode,
  entry,
  sourceEntries,
  { immutableOnly = false } = {},
) {
  const ast = entry.parsed.ast;
  const localBinding = nearestLexicalBindingInfo(identifierNode);
  if (localBinding) {
    if (immutableOnly && !localBinding.immutable) return null;
    return {
      entry,
      node: localBinding.node,
      key: `${entry.path}#${identifierNode.text}@${localBinding.node.pos}`,
    };
  }

  const binding = importBindings(ast).get(identifierNode.text);
  if (!binding) return null;
  const targetPath = resolveLocalModule(entry.path, binding.moduleName, sourceEntries);
  const targetEntry = targetPath ? sourceEntries.get(targetPath) : null;
  if (!targetEntry) return null;
  if (binding.importedName === "*") {
    return {
      entry: targetEntry,
      namespaceEntry: targetEntry,
      node: null,
      key: `${targetEntry.path}#namespace`,
    };
  }
  if (!immutableOnly) {
    const targetNode = findLocalSymbol(targetEntry.parsed.ast, binding.importedName);
    return targetNode
      ? {
          entry: targetEntry,
          node: targetNode,
          key: `${targetEntry.path}#${binding.importedName}`,
        }
      : null;
  }
  return resolveExportedStyleBinding(targetEntry, binding.importedName, sourceEntries);
}

function resolveExportedStyleBinding(
  entry,
  symbolName,
  sourceEntries,
  state = { depth: 0, resolving: new Set() },
) {
  if (state.depth > MAX_STATIC_BINDING_DEPTH) return null;
  const key = `${entry.path}#export:${symbolName}`;
  if (state.resolving.has(key)) return null;
  const resolving = new Set(state.resolving);
  resolving.add(key);

  const localNode = findImmutableLocalSymbol(entry.parsed.ast, symbolName);
  if (localNode) return { entry, node: localNode, key };

  if (symbolName === "default") {
    const assignment = entry.parsed.ast.statements.find(
      (statement) => ts.isExportAssignment(statement) && !statement.isExportEquals,
    );
    if (assignment && ts.isExportAssignment(assignment) && ts.isIdentifier(assignment.expression)) {
      const forwarded = resolveStyleBinding(
        assignment.expression,
        entry,
        sourceEntries,
        { immutableOnly: true },
      );
      if (forwarded) return forwarded;
    }
  }

  for (const statement of entry.parsed.ast.statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue;
    const moduleName = ts.isStringLiteralLike(statement.moduleSpecifier)
      ? statement.moduleSpecifier.text
      : null;
    if (
      statement.exportClause &&
      ts.isNamespaceExport(statement.exportClause) &&
      statement.exportClause.name.text === symbolName &&
      moduleName
    ) {
      const targetPath = resolveLocalModule(entry.path, moduleName, sourceEntries);
      const targetEntry = targetPath ? sourceEntries.get(targetPath) : null;
      return targetEntry
        ? {
            entry: targetEntry,
            namespaceEntry: targetEntry,
            node: null,
            key: `${targetEntry.path}#namespace`,
          }
        : null;
    }
    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        if (element.isTypeOnly || element.name.text !== symbolName) continue;
        const importedName = element.propertyName?.text ?? element.name.text;
        if (!moduleName) {
          const node = findImmutableLocalSymbol(entry.parsed.ast, importedName);
          return node ? { entry, node, key } : null;
        }
        const targetPath = resolveLocalModule(entry.path, moduleName, sourceEntries);
        const targetEntry = targetPath ? sourceEntries.get(targetPath) : null;
        return targetEntry
          ? resolveExportedStyleBinding(targetEntry, importedName, sourceEntries, {
              depth: state.depth + 1,
              resolving,
            })
          : null;
      }
    } else if (!statement.exportClause && moduleName) {
      const targetPath = resolveLocalModule(entry.path, moduleName, sourceEntries);
      const targetEntry = targetPath ? sourceEntries.get(targetPath) : null;
      const resolved = targetEntry
        ? resolveExportedStyleBinding(targetEntry, symbolName, sourceEntries, {
            depth: state.depth + 1,
            resolving,
          })
        : null;
      if (resolved) return resolved;
    }
  }
  return null;
}

function resolveNamespaceStyleMember(expression, propertyName, entry, sourceEntries) {
  if (!ts.isIdentifier(expression)) return null;
  const binding = importBindings(entry.parsed.ast).get(expression.text);
  if (binding?.importedName !== "*") return null;
  const targetPath = resolveLocalModule(entry.path, binding.moduleName, sourceEntries);
  const targetEntry = targetPath ? sourceEntries.get(targetPath) : null;
  return targetEntry
    ? resolveExportedStyleBinding(targetEntry, propertyName, sourceEntries)
    : null;
}

function canonicalTypeScriptNodeWithBindings(
  node,
  entry,
  sourceEntries,
  resolving = new Set(),
) {
  const ast = entry.parsed.ast;
  const bindings = [];
  const visit = (current) => {
    if (ts.isIdentifier(current) && !isNonReferenceIdentifier(current)) {
      const resolved = resolveStyleBinding(current, entry, sourceEntries);
      if (!resolved) {
        ts.forEachChild(current, visit);
        return;
      }
      if (resolving.has(resolved.key)) {
        bindings.push(`${current.text}@${resolved.entry.path}=cycle`);
        return;
      }
      const nextResolving = new Set(resolving);
      nextResolving.add(resolved.key);
      bindings.push(
        `${current.text}@${resolved.entry.path}=${canonicalTypeScriptNodeWithBindings(
          resolved.node,
          resolved.entry,
          sourceEntries,
          nextResolving,
        )}`,
      );
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  const ownSyntax = canonicalTypeScriptNode(node, ast);
  return bindings.length === 0
    ? ownSyntax
    : `${ownSyntax}|bindings:${bindings.sort(compareCodePoints).join(";")}`;
}

function scanStaticInlineStyles(entry, sourceEntries) {
  const { source, parsed } = entry;
  const ast = parsed.ast;
  const violations = [];
  const visit = (node) => {
    if (ts.isJsxAttribute(node)) {
      const attributeName = node.name.getText(ast);
      if (attributeName === "style" || attributeName === "styles") {
        const initializer = node.initializer;
        violations.push(
          createViolation({
            ruleId: "react.static-inline-style",
            path: source.path,
            line: lineOf(ast, node),
            semanticKey: `${attributeName}:${
              initializer
                ? canonicalTypeScriptNodeWithBindings(initializer, entry, sourceEntries)
                : "true"
            }`,
            lexeme: attributeName,
          }),
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return violations;
}

const CLASS_HELPERS = new Set(["classNames", "clsx", "cn", "cva", "twMerge"]);
const ARBITRARY_VISUAL_CLASS =
  /(?:[a-z0-9-]+:)*!?(?:bg|text|border|rounded|shadow|font|max-w)-\[[^\]\s]+\]/giu;
const RAW_COLOR_VALUE =
  /#(?:[a-f0-9]{3,8})\b|(?:rgb|hsl)a?\(|(?:hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|device-cmyk)\(/iu;
const NON_APP_COLOR_VARIABLE = /\bvar\(\s*--(?!app-)[a-z0-9_-]+/iu;
const CSS_NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
  blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
  crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
  darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
  dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
  gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
  magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
  mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
  mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
  steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
  yellowgreen`
    .split(/\s+/u)
    .filter(Boolean),
);
const SEMANTIC_COLOR_KEYWORDS = new Set([
  "context-fill",
  "context-stroke",
  "currentcolor",
  "inherit",
  "initial",
  "none",
  "revert",
  "revert-layer",
  "transparent",
  "unset",
]);
const COLOR_PROPERTIES =
  /^(?:color|background(?:color|image)?|border(?:top|right|bottom|left)?(?:color)?|outlinecolor|textdecorationcolor|columnrulecolor|caretcolor|accentcolor|fill|stroke|stopcolor|floodcolor|lightingcolor)$/iu;
const RADIUS_SHADOW_FONT_PROPERTIES = /(?:radius|shadow|fontfamily)$/iu;
const PROTECTED_ANTD_COMPONENTS = new Set(["Card", "Modal", "Drawer"]);
const PROTECTED_ANTD_SUBPATHS = new Map([
  ["card", "Card"],
  ["modal", "Modal"],
  ["drawer", "Drawer"],
]);
const ANTD_WRAPPER_PATHS = new Set([
  "src/components/shared/AppCard.tsx",
  "src/components/shared/AppModal.tsx",
  "src/components/shared/AppDrawer.tsx",
]);
export const UI_CONTRACT_RULE_IDS = Object.freeze([
  "react.static-inline-style",
  "visual.raw-color",
  "visual.raw-radius-shadow-font",
  "tailwind.arbitrary-visual",
  "global-css.selector-freeze",
  "global-css.declaration-freeze",
  "antd.broad-state-override",
  "antd.shared-wrapper-bypass",
  "workspace.extra-main",
  "workspace.missing-body-recipe",
]);
const UI_CONTRACT_RULE_ID_SET = new Set(UI_CONTRACT_RULE_IDS);
export const UI_CONTRACT_STRUCTURAL_RULE_IDS = Object.freeze([
  "global-css.selector-freeze",
  "global-css.declaration-freeze",
]);
const UI_CONTRACT_STRUCTURAL_RULE_ID_SET = new Set(UI_CONTRACT_STRUCTURAL_RULE_IDS);

export function partitionUiContractViolations(violations) {
  const structuralViolations = [];
  const actionableViolations = [];
  for (const violation of violations) {
    if (UI_CONTRACT_STRUCTURAL_RULE_ID_SET.has(violation.ruleId)) {
      structuralViolations.push(violation);
    } else {
      actionableViolations.push(violation);
    }
  }
  return Object.freeze({
    structuralViolations: Object.freeze(structuralViolations),
    actionableViolations: Object.freeze(actionableViolations),
  });
}

function collectConstInitializers(ast) {
  const initializers = new Map();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      initializers.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return initializers;
}

function collectStaticStrings(node, ast, initializers, state, onString) {
  if (!node || state.nodes.has(node)) return;
  state.nodes.add(node);

  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    onString(node.text, node);
    return;
  }
  if (ts.isTemplateExpression(node)) {
    onString(node.head.text, node.head);
    for (const span of node.templateSpans) {
      collectStaticStrings(span.expression, ast, initializers, state, onString);
      onString(span.literal.text, span.literal);
    }
    return;
  }
  if (ts.isIdentifier(node) && initializers.has(node.text) && !state.identifiers.has(node.text)) {
    state.identifiers.add(node.text);
    collectStaticStrings(initializers.get(node.text), ast, initializers, state, onString);
    state.identifiers.delete(node.text);
    return;
  }
  ts.forEachChild(node, (child) =>
    collectStaticStrings(child, ast, initializers, state, onString),
  );
}

function scanArbitraryTailwind(source, ast) {
  const violations = [];
  const initializers = collectConstInitializers(ast);
  const processedStringPositions = new Set();

  const inspectExpression = (expression) => {
    collectStaticStrings(
      expression,
      ast,
      initializers,
      { nodes: new Set(), identifiers: new Set() },
      (value, stringNode) => {
        if (processedStringPositions.has(stringNode.pos)) return;
        processedStringPositions.add(stringNode.pos);
        for (const match of value.matchAll(ARBITRARY_VISUAL_CLASS)) {
          const token = match[0];
          violations.push(
            createViolation({
              ruleId: "tailwind.arbitrary-visual",
              path: source.path,
              line: lineOf(ast, stringNode),
              semanticKey: token,
              lexeme: token,
            }),
          );
        }
      },
    );
  };

  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "className") {
      if (node.initializer && ts.isJsxExpression(node.initializer)) {
        inspectExpression(node.initializer.expression);
      } else if (node.initializer && ts.isStringLiteral(node.initializer)) {
        inspectExpression(node.initializer);
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      CLASS_HELPERS.has(node.expression.text)
    ) {
      for (const argument of node.arguments) inspectExpression(argument);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return violations;
}

function staticPrimitiveText(node) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    return `${node.operator === ts.SyntaxKind.MinusToken ? "-" : ""}${node.operand.text}`;
  }
  return null;
}

const MAX_STATIC_BINDING_DEPTH = 16;

function unwrapStaticExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isJsxExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function nextStaticBindingState(state, bindingKey) {
  if (state.depth >= MAX_STATIC_BINDING_DEPTH || state.resolving.has(bindingKey)) {
    return null;
  }
  const resolving = new Set(state.resolving);
  resolving.add(bindingKey);
  return { depth: state.depth + 1, resolving };
}

function staticPropertyAccessName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (!ts.isElementAccessExpression(node)) return null;
  const argument = unwrapStaticExpression(node.argumentExpression);
  return argument && (ts.isStringLiteralLike(argument) || ts.isNumericLiteral(argument))
    ? argument.text
    : null;
}

function staticObjectProperty(target, propertyName, sourceEntries, state) {
  if (target.namespaceEntry) {
    return resolveExportedStyleBinding(target.namespaceEntry, propertyName, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
  }
  for (const property of [...target.node.properties].reverse()) {
    if (
      (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
      boundPropertyNameText(
        property.name,
        target.entry,
        sourceEntries,
        state,
      ) === propertyName
    ) {
      return {
        entry: target.entry,
        node: ts.isPropertyAssignment(property) ? property.initializer : property.name,
      };
    }
    if (ts.isSpreadAssignment(property)) {
      const spreadTarget = boundStaticObjectLiteral(
        property.expression,
        target.entry,
        sourceEntries,
        { depth: state.depth + 1, resolving: state.resolving },
      );
      const resolved = spreadTarget
        ? staticObjectProperty(spreadTarget, propertyName, sourceEntries, {
            depth: state.depth + 1,
            resolving: state.resolving,
          })
        : null;
      if (resolved) return resolved;
    }
  }
  return null;
}

function boundStaticObjectLiteral(node, entry, sourceEntries, state) {
  const current = unwrapStaticExpression(node);
  if (!current || state.depth > MAX_STATIC_BINDING_DEPTH) return null;
  if (ts.isObjectLiteralExpression(current)) return { entry, node: current };
  if (
    ts.isCallExpression(current) &&
    current.arguments.length === 1 &&
    ts.isPropertyAccessExpression(current.expression) &&
    ts.isIdentifier(current.expression.expression) &&
    current.expression.expression.text === "Object" &&
    current.expression.name.text === "freeze" &&
    !nearestLexicalBindingInfo(current.expression.expression)
  ) {
    return boundStaticObjectLiteral(current.arguments[0], entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
  }

  if (ts.isIdentifier(current)) {
    const resolved = resolveStyleBinding(current, entry, sourceEntries, {
      immutableOnly: true,
    });
    if (!resolved) return null;
    const nextState = nextStaticBindingState(state, resolved.key);
    if (resolved.namespaceEntry) {
      return nextState
        ? { entry: resolved.namespaceEntry, namespaceEntry: resolved.namespaceEntry }
        : null;
    }
    return nextState
      ? boundStaticObjectLiteral(resolved.node, resolved.entry, sourceEntries, nextState)
      : null;
  }

  if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    const propertyName = staticPropertyAccessName(current);
    if (propertyName === null) return null;
    const namespaceMember = resolveNamespaceStyleMember(
      current.expression,
      propertyName,
      entry,
      sourceEntries,
    );
    if (namespaceMember) {
      const nextState = nextStaticBindingState(state, namespaceMember.key);
      return nextState
        ? boundStaticObjectLiteral(
            namespaceMember.node,
            namespaceMember.entry,
            sourceEntries,
            nextState,
          )
        : null;
    }
    const target = boundStaticObjectLiteral(current.expression, entry, sourceEntries, state);
    if (!target) return null;
    const property = staticObjectProperty(target, propertyName, sourceEntries, state);
    return property
      ? boundStaticObjectLiteral(property.node, property.entry, sourceEntries, {
          depth: state.depth + 1,
          resolving: state.resolving,
        })
      : null;
  }

  return null;
}

function boundStaticArrayLiteral(node, entry, sourceEntries, state) {
  const current = unwrapStaticExpression(node);
  if (!current || state.depth > MAX_STATIC_BINDING_DEPTH) return null;
  if (ts.isArrayLiteralExpression(current)) return { entry, node: current };
  if (
    ts.isCallExpression(current) &&
    current.arguments.length === 1 &&
    ts.isPropertyAccessExpression(current.expression) &&
    ts.isIdentifier(current.expression.expression) &&
    current.expression.expression.text === "Object" &&
    current.expression.name.text === "freeze" &&
    !nearestLexicalBindingInfo(current.expression.expression)
  ) {
    return boundStaticArrayLiteral(current.arguments[0], entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
  }
  if (ts.isIdentifier(current)) {
    const resolved = resolveStyleBinding(current, entry, sourceEntries, {
      immutableOnly: true,
    });
    if (!resolved?.node) return null;
    const nextState = nextStaticBindingState(state, resolved.key);
    return nextState
      ? boundStaticArrayLiteral(resolved.node, resolved.entry, sourceEntries, nextState)
      : null;
  }
  return null;
}

function boundStaticBoolean(node, entry, sourceEntries, state) {
  const current = unwrapStaticExpression(node);
  if (!current || state.depth > MAX_STATIC_BINDING_DEPTH) return null;
  if (current.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (current.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isPrefixUnaryExpression(current) &&
    current.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const operand = boundStaticBoolean(current.operand, entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
    return operand === null ? null : !operand;
  }
  if (ts.isIdentifier(current)) {
    const resolved = resolveStyleBinding(current, entry, sourceEntries, {
      immutableOnly: true,
    });
    if (!resolved?.node) return null;
    const nextState = nextStaticBindingState(state, resolved.key);
    return nextState
      ? boundStaticBoolean(resolved.node, resolved.entry, sourceEntries, nextState)
      : null;
  }
  return null;
}

function mergeStaticPrimitiveCandidates(left, right) {
  if (left && right) {
    return {
      text: left.text === right.text ? left.text : `${left.text} | ${right.text}`,
      trustedTheme: left.trustedTheme && right.trustedTheme,
    };
  }
  return left ?? right;
}

function boundStaticPrimitiveText(
  node,
  entry,
  sourceEntries,
  state = { depth: 0, resolving: new Set() },
) {
  const current = unwrapStaticExpression(node);
  if (!current || state.depth > MAX_STATIC_BINDING_DEPTH) return null;

  const direct = staticPrimitiveText(current);
  if (direct !== null) {
    return { text: direct, trustedTheme: entry.path.startsWith("src/theme/") };
  }

  if (
    ts.isBinaryExpression(current) &&
    current.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = boundStaticPrimitiveText(current.left, entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
    const right = boundStaticPrimitiveText(current.right, entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
    return left && right
      ? {
          text: `${left.text}${right.text}`,
          trustedTheme: left.trustedTheme && right.trustedTheme,
        }
      : null;
  }

  if (
    ts.isBinaryExpression(current) &&
    [
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.AmpersandAmpersandToken,
    ].includes(current.operatorToken.kind)
  ) {
    const left = boundStaticPrimitiveText(current.left, entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
    const right = boundStaticPrimitiveText(current.right, entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
    return mergeStaticPrimitiveCandidates(left, right);
  }

  if (ts.isTemplateExpression(current)) {
    let text = current.head.text;
    let trustedTheme = entry.path.startsWith("src/theme/");
    for (const span of current.templateSpans) {
      const value = boundStaticPrimitiveText(span.expression, entry, sourceEntries, {
        depth: state.depth + 1,
        resolving: state.resolving,
      });
      if (!value) return null;
      text += `${value.text}${span.literal.text}`;
      trustedTheme = trustedTheme && value.trustedTheme;
    }
    return { text, trustedTheme };
  }

  if (ts.isConditionalExpression(current)) {
    const condition = boundStaticBoolean(current.condition, entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
    if (condition !== null) {
      return boundStaticPrimitiveText(
        condition ? current.whenTrue : current.whenFalse,
        entry,
        sourceEntries,
        { depth: state.depth + 1, resolving: state.resolving },
      );
    }
    const whenTrue = boundStaticPrimitiveText(current.whenTrue, entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
    const whenFalse = boundStaticPrimitiveText(current.whenFalse, entry, sourceEntries, {
      depth: state.depth + 1,
      resolving: state.resolving,
    });
    return mergeStaticPrimitiveCandidates(whenTrue, whenFalse);
  }

  if (ts.isBindingElement(current) && ts.isObjectBindingPattern(current.parent)) {
    const declaration = current.parent.parent;
    if (!ts.isVariableDeclaration(declaration) || !declaration.initializer) return null;
    const propertyNode = current.propertyName ?? current.name;
    const propertyName = boundPropertyNameText(
      propertyNode,
      entry,
      sourceEntries,
      state,
    );
    const target = boundStaticObjectLiteral(declaration.initializer, entry, sourceEntries, state);
    if (!target) {
      return current.initializer
        ? boundStaticPrimitiveText(current.initializer, entry, sourceEntries, {
            depth: state.depth + 1,
            resolving: state.resolving,
          })
        : null;
    }
    const property = staticObjectProperty(target, propertyName, sourceEntries, state);
    if (property) {
      const value = boundStaticPrimitiveText(property.node, property.entry, sourceEntries, {
        depth: state.depth + 1,
        resolving: state.resolving,
      });
      if (value) return value;
    }
    return current.initializer
      ? boundStaticPrimitiveText(current.initializer, entry, sourceEntries, {
          depth: state.depth + 1,
          resolving: state.resolving,
        })
      : null;
  }

  if (ts.isBindingElement(current) && ts.isArrayBindingPattern(current.parent)) {
    const declaration = current.parent.parent;
    if (!ts.isVariableDeclaration(declaration) || !declaration.initializer) return null;
    const index = current.parent.elements.indexOf(current);
    if (index < 0) return null;
    const target = boundStaticArrayLiteral(
      declaration.initializer,
      entry,
      sourceEntries,
      state,
    );
    if (!target) {
      return current.initializer
        ? boundStaticPrimitiveText(current.initializer, entry, sourceEntries, {
            depth: state.depth + 1,
            resolving: state.resolving,
          })
        : null;
    }
    const element = target?.node.elements[index];
    if (element && !ts.isOmittedExpression(element) && !ts.isSpreadElement(element)) {
      const value = boundStaticPrimitiveText(element, target.entry, sourceEntries, {
        depth: state.depth + 1,
        resolving: state.resolving,
      });
      if (value) return value;
    }
    return current.initializer
      ? boundStaticPrimitiveText(current.initializer, entry, sourceEntries, {
          depth: state.depth + 1,
          resolving: state.resolving,
        })
      : null;
  }

  if (ts.isIdentifier(current)) {
    const resolved = resolveStyleBinding(current, entry, sourceEntries, {
      immutableOnly: true,
    });
    if (!resolved) return null;
    const nextState = nextStaticBindingState(state, resolved.key);
    return nextState
      ? boundStaticPrimitiveText(resolved.node, resolved.entry, sourceEntries, nextState)
      : null;
  }

  if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    const propertyName = staticPropertyAccessName(current);
    if (propertyName === null) return null;
    if (ts.isElementAccessExpression(current) && /^\d+$/u.test(propertyName)) {
      const target = boundStaticArrayLiteral(
        current.expression,
        entry,
        sourceEntries,
        state,
      );
      const element = target?.node.elements[Number(propertyName)];
      if (element && !ts.isOmittedExpression(element) && !ts.isSpreadElement(element)) {
        return boundStaticPrimitiveText(element, target.entry, sourceEntries, {
          depth: state.depth + 1,
          resolving: state.resolving,
        });
      }
    }
    const namespaceMember = resolveNamespaceStyleMember(
      current.expression,
      propertyName,
      entry,
      sourceEntries,
    );
    if (namespaceMember) {
      const nextState = nextStaticBindingState(state, namespaceMember.key);
      return nextState
        ? boundStaticPrimitiveText(
            namespaceMember.node,
            namespaceMember.entry,
            sourceEntries,
            nextState,
          )
        : null;
    }
    const target = boundStaticObjectLiteral(current.expression, entry, sourceEntries, state);
    if (!target) return null;
    const property = staticObjectProperty(target, propertyName, sourceEntries, state);
    return property
      ? boundStaticPrimitiveText(property.node, property.entry, sourceEntries, {
          depth: state.depth + 1,
          resolving: state.resolving,
        })
      : null;
  }

  return null;
}

function propertyNameText(name, ast) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    const expression = unwrapStaticExpression(name.expression);
    if (
      expression &&
      (ts.isStringLiteralLike(expression) || ts.isNumericLiteral(expression))
    ) {
      return expression.text;
    }
  }
  return name.getText(ast);
}

function boundPropertyNameText(name, entry, sourceEntries, state) {
  if (!ts.isComputedPropertyName(name)) {
    return propertyNameText(name, entry.parsed.ast);
  }
  const value = boundStaticPrimitiveText(name.expression, entry, sourceEntries, {
    depth: state.depth + 1,
    resolving: state.resolving,
  });
  return value?.text ?? propertyNameText(name, entry.parsed.ast);
}

function scanRawTypeScriptVisualValues(entry, sourceEntries) {
  const { source, parsed } = entry;
  const ast = parsed.ast;
  const normalizedPath = normalizeRepoPath(source.path);
  if (normalizedPath.startsWith("src/theme/")) return [];

  const violations = [];
  const difficultySource = normalizedPath === "src/components/practice/DifficultyMeter.tsx";
  const addRawColorViolation = (propertyName, value, node) => {
    if (
      difficultySource ||
      value === null ||
      value.trustedTheme ||
      !COLOR_PROPERTIES.test(propertyName) ||
      !RAW_COLOR_VALUE.test(value.text)
    ) {
      return;
    }
    violations.push(
      createViolation({
        ruleId: "visual.raw-color",
        path: source.path,
        line: lineOf(ast, node),
        semanticKey: `${propertyName.toLowerCase()}:${value.text.toLowerCase()}`,
        lexeme: `${propertyName}:${value.text}`,
      }),
    );
  };

  const inspectJsxShorthandSpread = (
    expression,
    spreadNode,
    visitedObjects = new Set(),
    depth = 0,
  ) => {
    if (depth > MAX_STATIC_BINDING_DEPTH) return;
    const target = boundStaticObjectLiteral(expression, entry, sourceEntries, {
      depth: 0,
      resolving: new Set(),
    });
    if (!target) return;
    const objectKey = `${target.entry.path}@${target.node.pos}`;
    if (visitedObjects.has(objectKey)) return;
    const nextVisitedObjects = new Set(visitedObjects);
    nextVisitedObjects.add(objectKey);
    for (const property of target.node.properties) {
      if (ts.isShorthandPropertyAssignment(property)) {
        const propertyName = property.name.text.replaceAll("-", "");
        addRawColorViolation(
          propertyName,
          boundStaticPrimitiveText(property.name, target.entry, sourceEntries),
          spreadNode,
        );
      } else if (ts.isSpreadAssignment(property)) {
        inspectJsxShorthandSpread(
          property.expression,
          spreadNode,
          nextVisitedObjects,
          depth + 1,
        );
      }
    }
  };

  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const propertyName = propertyNameText(node.name, ast).replaceAll("-", "");
      const value = boundStaticPrimitiveText(node.initializer, entry, sourceEntries);
      addRawColorViolation(propertyName, value, node);
      if (
        value !== null &&
        !value.trustedTheme &&
        RADIUS_SHADOW_FONT_PROPERTIES.test(propertyName) &&
        !value.text.includes("var(--app-")
      ) {
        violations.push(
          createViolation({
            ruleId: "visual.raw-radius-shadow-font",
            path: source.path,
            line: lineOf(ast, node),
            semanticKey: `${propertyName.toLowerCase()}:${value.text}`,
            lexeme: propertyName,
          }),
        );
      }
    }
    if (ts.isJsxAttribute(node)) {
      const propertyName = node.name.getText(ast).replaceAll("-", "");
      const value = boundStaticPrimitiveText(node.initializer, entry, sourceEntries);
      addRawColorViolation(propertyName, value, node);
    }
    if (ts.isJsxSpreadAttribute(node)) {
      inspectJsxShorthandSpread(node.expression, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return violations;
}

function scanAntdWrapperBypass(source, ast) {
  const normalizedPath = normalizeRepoPath(source.path);
  if (ANTD_WRAPPER_PATHS.has(normalizedPath)) return [];

  const violations = [];
  const namespaceImports = new Set();
  const antdModuleName = (node) =>
    ts.isStringLiteralLike(node) &&
    (node.text === "antd" || node.text.startsWith("antd/"))
      ? node.text
      : null;
  const protectedSubpathComponent = (moduleName) => {
    const segments = moduleName.split("/");
    const componentSegment = segments[0] === "antd" && ["es", "lib"].includes(segments[1])
      ? segments[2]
      : null;
    return componentSegment
      ? (PROTECTED_ANTD_SUBPATHS.get(componentSegment.toLowerCase()) ?? null)
      : null;
  };
  const addViolation = (componentName, node, kind) => {
    violations.push(
      createViolation({
        ruleId: "antd.shared-wrapper-bypass",
        path: source.path,
        line: lineOf(ast, node),
        semanticKey: `${kind}:${componentName}`,
        lexeme: componentName,
      }),
    );
  };

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      antdModuleName(node.arguments[0])
    ) {
      throw new UiContractError("UI_CONTRACT_UNSUPPORTED_DYNAMIC_ANTD_IMPORT", {
        path: normalizedPath,
      });
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      antdModuleName(node.arguments[0])
    ) {
      throw new UiContractError("UI_CONTRACT_UNSUPPORTED_ANTD_ACCESS", {
        path: normalizedPath,
      });
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      antdModuleName(node.moduleReference.expression)
    ) {
      throw new UiContractError("UI_CONTRACT_UNSUPPORTED_ANTD_ACCESS", {
        path: normalizedPath,
      });
    }

    if (
      ts.isImportDeclaration(node) &&
      antdModuleName(node.moduleSpecifier) &&
      node.importClause &&
      !node.importClause.isTypeOnly
    ) {
      const moduleName = node.moduleSpecifier.text;
      const subpathComponent = protectedSubpathComponent(moduleName);
      const bindings = node.importClause.namedBindings;
      const hasRuntimeBinding =
        Boolean(node.importClause.name) ||
        Boolean(bindings && ts.isNamespaceImport(bindings)) ||
        Boolean(
          bindings &&
            ts.isNamedImports(bindings) &&
            bindings.elements.some((element) => !element.isTypeOnly),
        );
      if (subpathComponent && hasRuntimeBinding) {
        addViolation(subpathComponent, node.importClause, "subpath-import");
      }
      if (!subpathComponent && bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (element.isTypeOnly) continue;
          const importedName = element.propertyName?.text ?? element.name.text;
          if (PROTECTED_ANTD_COMPONENTS.has(importedName)) {
            addViolation(importedName, element, "import");
          }
        }
      } else if (!subpathComponent && bindings && ts.isNamespaceImport(bindings)) {
        namespaceImports.add(bindings.name.text);
      }
      if (!subpathComponent && node.importClause.name) {
        throw new UiContractError("UI_CONTRACT_UNSUPPORTED_ANTD_ACCESS", {
          path: normalizedPath,
        });
      }
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      antdModuleName(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      const moduleName = node.moduleSpecifier.text;
      if (!node.exportClause) {
        throw new UiContractError("UI_CONTRACT_UNSUPPORTED_ANTD_ACCESS", {
          path: normalizedPath,
        });
      }
      const subpathComponent = protectedSubpathComponent(moduleName);
      const hasRuntimeNamedExport =
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.some((element) => !element.isTypeOnly);
      if (
        subpathComponent &&
        (!ts.isNamedExports(node.exportClause) || hasRuntimeNamedExport)
      ) {
        addViolation(subpathComponent, node, "subpath-export");
      } else if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          if (element.isTypeOnly) continue;
          const exportedName = element.propertyName?.text ?? element.name.text;
          if (PROTECTED_ANTD_COMPONENTS.has(exportedName)) {
            addViolation(exportedName, element, "export");
          }
        }
      } else {
        throw new UiContractError("UI_CONTRACT_UNSUPPORTED_ANTD_ACCESS", {
          path: normalizedPath,
        });
      }
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      namespaceImports.has(node.expression.text) &&
      PROTECTED_ANTD_COMPONENTS.has(node.name.text)
    ) {
      addViolation(node.name.text, node, "namespace");
    }

    ts.forEachChild(node, visit);
  };
  visit(ast);
  return violations;
}

function jsxTagIdentifier(tagName) {
  if (ts.isIdentifier(tagName)) return tagName.text;
  if (ts.isPropertyAccessExpression(tagName)) return tagName.name.text;
  return null;
}

function scanExtraWorkspaceMain(source, ast) {
  const normalizedPath = normalizeRepoPath(source.path);
  if (!normalizedPath.startsWith("src/app/(workspace)/")) return [];
  const violations = [];
  const visit = (node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      jsxTagIdentifier(node.tagName) === "main"
    ) {
      violations.push(
        createViolation({
          ruleId: "workspace.extra-main",
          path: source.path,
          line: lineOf(ast, node),
          semanticKey: "main-landmark",
          lexeme: "main",
        }),
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return violations;
}

function importBindings(ast) {
  const bindings = new Map();
  for (const statement of ast.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      !statement.importClause
    ) {
      continue;
    }
    const moduleName = statement.moduleSpecifier.text;
    if (statement.importClause.name) {
      bindings.set(statement.importClause.name.text, { moduleName, importedName: "default" });
    }
    const namedBindings = statement.importClause.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        bindings.set(element.name.text, {
          moduleName,
          importedName: element.propertyName?.text ?? element.name.text,
        });
      }
    } else if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      bindings.set(namedBindings.name.text, { moduleName, importedName: "*" });
    }
  }
  return bindings;
}

function hasDefaultModifier(node) {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
}

function findLocalSymbol(ast, symbolName) {
  if (symbolName === "default") {
    for (const statement of ast.statements) {
      if (ts.isFunctionDeclaration(statement) && hasDefaultModifier(statement)) return statement;
      if (ts.isClassDeclaration(statement) && hasDefaultModifier(statement)) return statement;
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        if (ts.isIdentifier(statement.expression)) {
          return findLocalSymbol(ast, statement.expression.text);
        }
        return statement.expression;
      }
    }
    return null;
  }

  for (const statement of ast.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === symbolName) return statement;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === symbolName) {
          return declaration.initializer ?? declaration;
        }
      }
    }
  }
  return null;
}

function findImmutableLocalSymbol(ast, symbolName) {
  if (symbolName === "default") {
    for (const statement of ast.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        return ts.isIdentifier(statement.expression)
          ? findImmutableLocalSymbol(ast, statement.expression.text)
          : statement.expression;
      }
    }
    return null;
  }
  for (const statement of ast.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const)
    ) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === symbolName &&
        declaration.initializer
      ) {
        return declaration.initializer;
      }
    }
  }
  return null;
}

function returnExpressions(symbolNode) {
  if (!symbolNode) return [];
  if (ts.isArrowFunction(symbolNode) && !ts.isBlock(symbolNode.body)) return [symbolNode.body];
  if (
    ts.isJsxElement(symbolNode) ||
    ts.isJsxSelfClosingElement(symbolNode) ||
    ts.isCallExpression(symbolNode)
  ) {
    return [symbolNode];
  }

  const rootBody = symbolNode.body ?? symbolNode;
  const expressions = [];
  const visit = (node) => {
    if (node !== rootBody && (ts.isFunctionLike(node) || ts.isClassLike(node))) return;
    if (ts.isReturnStatement(node) && node.expression) {
      expressions.push(node.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(rootBody);
  return expressions;
}

function resolveLocalModule(fromPath, moduleName, sourceEntries) {
  let basePath;
  if (moduleName.startsWith("@/")) {
    basePath = `src/${moduleName.slice(2)}`;
  } else if (moduleName.startsWith(".")) {
    basePath = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), moduleName));
  } else {
    return null;
  }
  const extension = path.posix.extname(basePath);
  const candidates = extension
    ? [basePath]
    : [
        `${basePath}.tsx`,
        `${basePath}.ts`,
        `${basePath}.jsx`,
        `${basePath}.js`,
        `${basePath}/index.tsx`,
        `${basePath}/index.ts`,
        `${basePath}/index.jsx`,
        `${basePath}/index.js`,
      ];
  return (
    candidates.find(
      (candidate) => sourceEntries.get(candidate)?.parsed.kind === "typescript",
    ) ?? null
  );
}

function isCanonicalWorkspaceBodyImport(binding) {
  return (
    binding?.moduleName === "@/components/app/WorkspaceBody" &&
    binding.importedName === "WorkspaceBody"
  );
}

function symbolReachesWorkspaceBody(entry, symbolName, sourceEntries, depth, visited) {
  if (depth > 8) return false;
  const visitKey = `${entry.path}#${symbolName}`;
  if (visited.has(visitKey)) return false;
  visited.add(visitKey);

  const symbolNode = findLocalSymbol(entry.parsed.ast, symbolName);
  if (!symbolNode) return false;
  const bindings = importBindings(entry.parsed.ast);
  const expressions = returnExpressions(symbolNode);

  const expressionReaches = (expression) => {
    let found = false;
    const inspect = (node) => {
      if (found) return;
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tagName = jsxTagIdentifier(node.tagName);
        if (tagName) {
          const binding = bindings.get(tagName);
          if (tagName === "WorkspaceBody" && isCanonicalWorkspaceBodyImport(binding)) {
            found = true;
            return;
          }
          if (binding) {
            const targetPath = resolveLocalModule(entry.path, binding.moduleName, sourceEntries);
            const target = targetPath ? sourceEntries.get(targetPath) : null;
            if (
              target &&
              symbolReachesWorkspaceBody(
                target,
                binding.importedName,
                sourceEntries,
                depth + 1,
                visited,
              )
            ) {
              found = true;
              return;
            }
          }
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const binding = bindings.get(node.expression.text);
        if (binding) {
          const targetPath = resolveLocalModule(entry.path, binding.moduleName, sourceEntries);
          const target = targetPath ? sourceEntries.get(targetPath) : null;
          if (
            target &&
            symbolReachesWorkspaceBody(
              target,
              binding.importedName,
              sourceEntries,
              depth + 1,
              visited,
            )
          ) {
            found = true;
            return;
          }
        } else if (
          findLocalSymbol(entry.parsed.ast, node.expression.text) &&
          symbolReachesWorkspaceBody(
            entry,
            node.expression.text,
            sourceEntries,
            depth + 1,
            visited,
          )
        ) {
          found = true;
          return;
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(expression);
    return found;
  };

  return expressions.some(expressionReaches);
}

function scanWorkspacePageRecipe(sourceEntries) {
  const violations = [];
  for (const entry of sourceEntries.values()) {
    if (
      !entry.path.startsWith("src/app/(workspace)/") ||
      !/\/page\.(?:tsx|jsx|ts|js)$/u.test(entry.path)
    ) {
      continue;
    }
    if (!symbolReachesWorkspaceBody(entry, "default", sourceEntries, 0, new Set())) {
      violations.push(
        createViolation({
          ruleId: "workspace.missing-body-recipe",
          path: entry.path,
          line: 1,
          semanticKey: "missing-workspace-body-recipe",
          lexeme: path.posix.basename(entry.path),
        }),
      );
    }
  }
  return violations;
}

function cssNodeLine(node) {
  return node.source?.start?.line ?? 1;
}

function normalizeCssSyntax(value) {
  let output = "";
  let pendingSpace = false;
  let quote = null;
  let escaped = false;
  const tightPunctuation = new Set([",", ">", "+", "~", ":", ";", "{", "}"]);

  for (const character of String(value).trim()) {
    if (quote) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      if (pendingSpace && output && !tightPunctuation.has(output.at(-1))) output += " ";
      pendingSpace = false;
      quote = character;
      output += character;
      continue;
    }
    if (/\s/u.test(character)) {
      pendingSpace = true;
      continue;
    }
    if (tightPunctuation.has(character)) {
      output = output.trimEnd();
      output += character;
      pendingSpace = false;
      continue;
    }
    if (pendingSpace && output && !tightPunctuation.has(output.at(-1))) output += " ";
    pendingSpace = false;
    output += character;
  }
  return output.trim();
}

function splitTopLevelCssList(value) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[") depth += 1;
    else if (character === ")" || character === "]") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function normalizeCssSelector(value) {
  return splitTopLevelCssList(String(value))
    .map(normalizeCssSyntax)
    .sort(compareCodePoints)
    .join(",");
}

function cssColorScanText(value) {
  const input = String(value);
  let output = "";
  let index = 0;
  while (index < input.length) {
    const character = input[index];
    if (character === '"' || character === "'") {
      const quote = character;
      index += 1;
      while (index < input.length) {
        if (input[index] === "\\") index += 2;
        else if (input[index] === quote) {
          index += 1;
          break;
        } else index += 1;
      }
      output += " ";
      continue;
    }
    if (character === "/" && input[index + 1] === "*") {
      const end = input.indexOf("*/", index + 2);
      index = end === -1 ? input.length : end + 2;
      output += " ";
      continue;
    }
    if (
      input.slice(index, index + 3).toLowerCase() === "url" &&
      !/[a-z0-9_-]/iu.test(input[index - 1] ?? "")
    ) {
      let cursor = index + 3;
      while (/\s/u.test(input[cursor] ?? "")) cursor += 1;
      if (input[cursor] === "(") {
        let depth = 1;
        let quote = null;
        cursor += 1;
        while (cursor < input.length && depth > 0) {
          const current = input[cursor];
          if (quote) {
            if (current === "\\") cursor += 2;
            else {
              if (current === quote) quote = null;
              cursor += 1;
            }
            continue;
          }
          if (current === '"' || current === "'") quote = current;
          else if (current === "\\") cursor += 1;
          else if (current === "(") depth += 1;
          else if (current === ")") depth -= 1;
          cursor += 1;
        }
        output += " ";
        index = cursor;
        continue;
      }
    }
    output += character;
    index += 1;
  }
  return output;
}

function containsNamedCssColor(value) {
  for (const match of String(value).matchAll(/[a-z][a-z0-9-]*/giu)) {
    if (CSS_NAMED_COLORS.has(match[0].toLowerCase())) return true;
  }
  return false;
}

function scanCssVisualValues(source, root) {
  const violations = [];
  root.walkDecls((declaration) => {
    const isCustomProperty = declaration.prop.startsWith("--");
    const normalizedProperty = declaration.prop.toLowerCase().replaceAll("-", "");
    const isFontFaceFamilyDescriptor =
      normalizedProperty === "fontfamily" &&
      declaration.parent?.type === "atrule" &&
      declaration.parent.name.toLowerCase() === "font-face";
    const value = normalizeCssSyntax(declaration.value);
    const colorScanText = cssColorScanText(value);
    const ownsColor =
      COLOR_PROPERTIES.test(normalizedProperty) ||
      (isCustomProperty &&
        /(?:color|background|border|fill|stroke|accent)/iu.test(normalizedProperty));
    const namedColor = ownsColor && containsNamedCssColor(colorScanText);
    const semanticKeyword = SEMANTIC_COLOR_KEYWORDS.has(value.toLowerCase());
    const rawColor =
      RAW_COLOR_VALUE.test(colorScanText) ||
      namedColor ||
      (ownsColor && NON_APP_COLOR_VARIABLE.test(colorScanText));
    if (
      (ownsColor || (isCustomProperty && RAW_COLOR_VALUE.test(colorScanText))) &&
      rawColor &&
      !semanticKeyword
    ) {
      violations.push(
        createViolation({
          ruleId: "visual.raw-color",
          path: source.path,
          line: cssNodeLine(declaration),
          semanticKey: `${normalizedProperty}:${value.toLowerCase()}`,
          lexeme: declaration.prop,
        }),
      );
      return;
    }
    if (
      (RADIUS_SHADOW_FONT_PROPERTIES.test(normalizedProperty) ||
        (isCustomProperty && /(?:radius|shadow|font)/iu.test(normalizedProperty))) &&
      !isFontFaceFamilyDescriptor &&
      !/^var\(--app-[^)]+\)$/u.test(value)
    ) {
      violations.push(
        createViolation({
          ruleId: "visual.raw-radius-shadow-font",
          path: source.path,
          line: cssNodeLine(declaration),
          semanticKey: `${normalizedProperty}:${value}`,
          lexeme: declaration.prop,
        }),
      );
    }
  });
  return violations;
}

function scanBroadAntdStates(source, root) {
  const violations = [];
  root.walkRules((rule) => {
    const selector = normalizeCssSelector(rule.selector);
    const targetsAntd = /\.ant-[a-z0-9_-]+/iu.test(selector);
    const ownsState =
      /:(?:hover|active|focus|focus-visible|disabled|checked)\b/iu.test(selector) ||
      /\.ant-[a-z0-9_-]+-(?:selected|disabled|active)\b/iu.test(selector);
    if (targetsAntd && ownsState) {
      violations.push(
        createViolation({
          ruleId: "antd.broad-state-override",
          path: source.path,
          line: cssNodeLine(rule),
          semanticKey: selector,
          lexeme: selector,
        }),
      );
    }
  });
  return violations;
}

const GLOBAL_CSS_FREEZE_PATHS = new Set([
  "src/styles/foundation.css",
  "src/styles/global.css",
]);

function scanGlobalCssFreeze(source, root) {
  if (!GLOBAL_CSS_FREEZE_PATHS.has(normalizeRepoPath(source.path))) return [];
  const violations = [];
  root.walkRules((rule) => {
    const selector = normalizeCssSelector(rule.selector);
    violations.push(
      createViolation({
        ruleId: "global-css.selector-freeze",
        path: source.path,
        line: cssNodeLine(rule),
        semanticKey: selector,
        lexeme: selector,
      }),
    );
  });
  root.walkDecls((declaration) => {
    const ancestry = [];
    for (let node = declaration.parent; node && node.type !== "root"; node = node.parent) {
      if (node.type === "rule") ancestry.push(`rule:${normalizeCssSelector(node.selector)}`);
      else if (node.type === "atrule") {
        ancestry.push(
          `at:${node.name.toLowerCase()} ${normalizeCssSyntax(node.params ?? "")}`.trim(),
        );
      }
    }
    const scope = ancestry.reverse().join(">") || "root";
    const property = declaration.prop.toLowerCase();
    const value = normalizeCssSyntax(declaration.value);
    violations.push(
      createViolation({
        ruleId: "global-css.declaration-freeze",
        path: source.path,
        line: cssNodeLine(declaration),
        semanticKey: `${scope}|${property}|${value}|${
          declaration.important ? "important" : "normal"
        }`,
        lexeme: property,
      }),
    );
  });
  return violations;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactObjectKeys(value, expectedKeys, code) {
  if (!isPlainObject(value)) throw new UiContractError(code);
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expected)) {
    throw new UiContractError(code);
  }
}

function sortedCountObject(entries) {
  return Object.fromEntries(
    [...entries]
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => compareCodePoints(left, right)),
  );
}

function countBy(items, selectKey) {
  const counts = new Map();
  for (const item of items) {
    const key = selectKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function isUtcIsoTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function baselineSemanticContent(baseline) {
  return JSON.stringify({
    schemaVersion: baseline.schemaVersion,
    scannerVersion: baseline.scannerVersion,
    scannerDigest: baseline.scannerDigest,
    fingerprints: baseline.fingerprints,
    summaryByRule: baseline.summaryByRule,
    summaryByPath: baseline.summaryByPath,
  });
}

export function validateUiContractBaseline(
  baseline,
  { expectedScannerVersion = UI_CONTRACT_SCANNER_VERSION } = {},
) {
  assertExactObjectKeys(
    baseline,
    [
      "schemaVersion",
      "scannerVersion",
      "scannerDigest",
      "generatedAt",
      "fingerprints",
      "summaryByRule",
      "summaryByPath",
    ],
    "UI_BASELINE_INVALID",
  );
  if (
    baseline.schemaVersion !== UI_CONTRACT_BASELINE_SCHEMA_VERSION ||
    !Number.isInteger(baseline.scannerVersion) ||
    baseline.scannerVersion <= 0 ||
    baseline.scannerVersion !== expectedScannerVersion
  ) {
    throw new UiContractError("UI_BASELINE_VERSION_MISMATCH");
  }
  if (!isUtcIsoTimestamp(baseline.generatedAt)) {
    throw new UiContractError("UI_BASELINE_INVALID");
  }
  if (!/^[a-f0-9]{64}$/u.test(baseline.scannerDigest)) {
    throw new UiContractError("UI_BASELINE_INVALID");
  }

  for (const [name, counts, keyPattern] of [
    ["fingerprints", baseline.fingerprints, /^[a-f0-9]{64}$/u],
    ["summaryByRule", baseline.summaryByRule, /^\S.+|\S$/u],
    ["summaryByPath", baseline.summaryByPath, /^src\/.+/u],
  ]) {
    if (!isPlainObject(counts)) throw new UiContractError("UI_BASELINE_INVALID", { name });
    for (const [key, count] of Object.entries(counts)) {
      if (!keyPattern.test(key) || !Number.isInteger(count) || count <= 0) {
        throw new UiContractError("UI_BASELINE_INVALID", { name });
      }
    }
  }
  const fingerprintTotal = Object.values(baseline.fingerprints).reduce(
    (sum, count) => sum + count,
    0,
  );
  const ruleTotal = Object.values(baseline.summaryByRule).reduce((sum, count) => sum + count, 0);
  const pathTotal = Object.values(baseline.summaryByPath).reduce((sum, count) => sum + count, 0);
  if (fingerprintTotal !== ruleTotal || fingerprintTotal !== pathTotal) {
    throw new UiContractError("UI_BASELINE_INVALID");
  }
  return baseline;
}

export function createUiContractBaseline(
  violations,
  {
    generatedAt = new Date().toISOString(),
    previousBaseline = null,
    scannerDigest = TEST_SCANNER_DIGEST,
  } = {},
) {
  if (!isUtcIsoTimestamp(generatedAt) || !/^[a-f0-9]{64}$/u.test(scannerDigest)) {
    throw new UiContractError("UI_BASELINE_INVALID");
  }
  const baseline = {
    schemaVersion: UI_CONTRACT_BASELINE_SCHEMA_VERSION,
    scannerVersion: UI_CONTRACT_SCANNER_VERSION,
    scannerDigest,
    generatedAt,
    fingerprints: sortedCountObject(countBy(violations, (violation) => violation.fingerprint)),
    summaryByRule: sortedCountObject(countBy(violations, (violation) => violation.ruleId)),
    summaryByPath: sortedCountObject(countBy(violations, (violation) => violation.path)),
  };
  if (previousBaseline) {
    validateUiContractBaseline(previousBaseline);
    if (baselineSemanticContent(previousBaseline) === baselineSemanticContent(baseline)) {
      baseline.generatedAt = previousBaseline.generatedAt;
    }
  }
  return baseline;
}

export function assertCandidateMatchesCurrent(
  violations,
  candidateBaseline,
  { scannerDigest = candidateBaseline?.scannerDigest } = {},
) {
  validateUiContractBaseline(candidateBaseline);
  if (candidateBaseline.scannerDigest !== scannerDigest) {
    throw new UiContractError("UI_SCANNER_DIGEST_MISMATCH");
  }
  const expected = createUiContractBaseline(violations, {
    generatedAt: candidateBaseline.generatedAt,
    scannerDigest,
  });
  if (baselineSemanticContent(candidateBaseline) !== baselineSemanticContent(expected)) {
    throw new UiContractError("UI_BASELINE_CURRENT_MISMATCH");
  }
  return candidateBaseline;
}

export function compareAgainstBase(violations, baseBaseline) {
  validateUiContractBaseline(baseBaseline, {
    expectedScannerVersion: baseBaseline?.scannerVersion,
  });
  const seen = new Map();
  const newViolations = [];
  for (const violation of violations) {
    const count = (seen.get(violation.fingerprint) ?? 0) + 1;
    seen.set(violation.fingerprint, count);
    if (count > (baseBaseline.fingerprints[violation.fingerprint] ?? 0)) {
      newViolations.push(violation);
    }
  }
  return Object.freeze({ newViolations: Object.freeze(newViolations) });
}

const APPROVAL_FIELDS = [
  "id",
  "path",
  "ruleId",
  "fingerprint",
  "owner",
  "reason",
  "createdDate",
  "expiresDate",
  "removalCondition",
  "regressionEvidence",
];
const SECRET_LIKE =
  /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[a-z0-9_-]{12,}|\b(?:token|secret|password|service[_-]?role)\s*[:=])/iu;

function parseDateOnly(value, code) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new UiContractError(code);
  }
  const [year, month, day] = value.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new UiContractError(code);
  }
  return time;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function approvalCanonical(approval) {
  return JSON.stringify(stableValue(approval));
}

function assertSafeApprovalText(value, id) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 500) {
    throw new UiContractError("UI_APPROVAL_INVALID", { id });
  }
  if (SECRET_LIKE.test(value)) {
    throw new UiContractError("UI_APPROVAL_SECRET_LIKE", { id });
  }
}

export function validateApprovalManifest(manifest, { today, role = "candidate" } = {}) {
  assertExactObjectKeys(manifest, ["schemaVersion", "approvals"], "UI_APPROVAL_INVALID");
  if (manifest.schemaVersion !== UI_CONTRACT_SCHEMA_VERSION || !Array.isArray(manifest.approvals)) {
    throw new UiContractError("UI_APPROVAL_INVALID");
  }
  const todayTime = parseDateOnly(today, "UI_APPROVAL_DATE_INVALID");
  const ids = new Set();
  const fingerprints = new Set();
  for (const approval of manifest.approvals) {
    const id = isPlainObject(approval) && typeof approval.id === "string" ? approval.id : "unknown";
    assertExactObjectKeys(approval, APPROVAL_FIELDS, "UI_APPROVAL_INVALID");
    if (
      approval.id.length > 80 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(approval.id) ||
      ids.has(approval.id)
    ) {
      throw new UiContractError("UI_APPROVAL_INVALID", { id });
    }
    ids.add(approval.id);
    if (
      !UI_CONTRACT_RULE_ID_SET.has(approval.ruleId) ||
      !/^[a-f0-9]{64}$/u.test(approval.fingerprint) ||
      fingerprints.has(approval.fingerprint)
    ) {
      throw new UiContractError("UI_APPROVAL_INVALID", { id });
    }
    fingerprints.add(approval.fingerprint);
    let normalizedApprovalPath;
    let normalizedRegressionPath;
    try {
      normalizedApprovalPath = normalizeRepoPath(approval.path);
      normalizedRegressionPath = normalizeRepoPath(approval.regressionEvidence);
    } catch {
      throw new UiContractError("UI_APPROVAL_INVALID", { id });
    }
    if (normalizedApprovalPath !== approval.path) {
      throw new UiContractError("UI_APPROVAL_INVALID", { id });
    }
    if (
      normalizedRegressionPath !== approval.regressionEvidence ||
      !approval.regressionEvidence.startsWith("tests/")
    ) {
      throw new UiContractError("UI_APPROVAL_INVALID", { id });
    }
    assertSafeApprovalText(approval.owner, id);
    assertSafeApprovalText(approval.reason, id);
    assertSafeApprovalText(approval.removalCondition, id);
    assertSafeApprovalText(approval.regressionEvidence, id);

    const createdTime = parseDateOnly(approval.createdDate, "UI_APPROVAL_DATE_INVALID");
    const expiresTime = parseDateOnly(approval.expiresDate, "UI_APPROVAL_DATE_INVALID");
    const durationDays = (expiresTime - createdTime) / 86_400_000;
    if (createdTime > todayTime || durationDays <= 0 || durationDays > 90) {
      throw new UiContractError("UI_APPROVAL_DATE_INVALID", { id });
    }
    if (role === "candidate" && expiresTime < todayTime) {
      throw new UiContractError("UI_APPROVAL_EXPIRED", { id });
    }
  }
  return manifest.approvals;
}

export function validateExceptionManifest(manifest) {
  assertExactObjectKeys(manifest, ["schemaVersion", "exceptions"], "UI_EXCEPTION_INVALID");
  if (manifest.schemaVersion !== UI_CONTRACT_SCHEMA_VERSION || !Array.isArray(manifest.exceptions)) {
    throw new UiContractError("UI_EXCEPTION_INVALID");
  }
  const ids = new Set();
  const approvalIds = new Set();
  for (const exception of manifest.exceptions) {
    const id = isPlainObject(exception) && typeof exception.id === "string" ? exception.id : "unknown";
    assertExactObjectKeys(exception, ["id", "approvalId"], "UI_EXCEPTION_INVALID");
    if (
      exception.id.length > 80 ||
      exception.approvalId.length > 80 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(exception.id) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(exception.approvalId) ||
      ids.has(exception.id) ||
      approvalIds.has(exception.approvalId)
    ) {
      throw new UiContractError("UI_EXCEPTION_INVALID", { id });
    }
    ids.add(exception.id);
    approvalIds.add(exception.approvalId);
  }
  return manifest.exceptions;
}

function approvalExpired(approval, today) {
  return parseDateOnly(approval.expiresDate, "UI_APPROVAL_DATE_INVALID") <
    parseDateOnly(today, "UI_APPROVAL_DATE_INVALID");
}

export function applyUiContractExceptions(
  violations,
  {
    mode,
    today,
    baseApprovals = { schemaVersion: UI_CONTRACT_SCHEMA_VERSION, approvals: [] },
    candidateApprovals,
    candidateExceptions,
  },
) {
  if (mode !== "ci" && mode !== "local") throw new UiContractError("UI_EXCEPTION_MODE_INVALID");
  const candidateItems = validateApprovalManifest(candidateApprovals, {
    today,
    role: "candidate",
  });
  const exceptionItems = validateExceptionManifest(candidateExceptions);
  const baseItems =
    mode === "ci" ? validateApprovalManifest(baseApprovals, { today, role: "base" }) : [];
  const candidateById = new Map(candidateItems.map((item) => [item.id, item]));
  const baseById = new Map(
    baseItems
      .filter((item) => !approvalExpired(item, today))
      .map((item) => [item.id, item]),
  );
  const suppressedIndexes = new Set();
  const policyErrors = [];

  for (const exception of exceptionItems) {
    const candidateApproval = candidateById.get(exception.approvalId);
    const baseApproval = baseById.get(exception.approvalId);
    const authorized =
      Boolean(candidateApproval) &&
      (mode === "local" ||
        (Boolean(baseApproval) &&
          approvalCanonical(baseApproval) === approvalCanonical(candidateApproval)));
    if (!authorized) {
      policyErrors.push({ code: "UI_EXCEPTION_UNAUTHORIZED", id: exception.id });
      continue;
    }
    const matches = [];
    for (let index = 0; index < violations.length; index += 1) {
      const violation = violations[index];
      if (
        violation.path === candidateApproval.path &&
        violation.ruleId === candidateApproval.ruleId &&
        violation.fingerprint === candidateApproval.fingerprint
      ) {
        matches.push(index);
      }
    }
    if (matches.length !== 1 || suppressedIndexes.has(matches[0])) {
      policyErrors.push({ code: "UI_EXCEPTION_CARDINALITY", id: exception.id });
      continue;
    }
    suppressedIndexes.add(matches[0]);
  }

  return Object.freeze({
    marker: mode === "local" ? "LOCAL_NOT_BASE_AUTHORITY" : null,
    violations: Object.freeze(
      violations.filter((_, index) => !suppressedIndexes.has(index)),
    ),
    suppressedViolations: Object.freeze(
      violations.filter((_, index) => suppressedIndexes.has(index)),
    ),
    policyErrors: Object.freeze(policyErrors),
  });
}

function publicReportRows(violations) {
  const rows = new Map();
  for (const violation of violations) {
    const fingerprint = violation.fingerprint.slice(0, 12);
    const key = `${violation.path}\0${violation.ruleId}\0${violation.line}\0${fingerprint}`;
    const existing = rows.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      rows.set(key, {
        path: violation.path,
        ruleId: violation.ruleId,
        line: violation.line,
        fingerprint,
        count: 1,
      });
    }
  }
  return [...rows.values()].sort((left, right) =>
    compareCodePoints(
      `${left.path}\0${left.ruleId}\0${left.fingerprint}`,
      `${right.path}\0${right.ruleId}\0${right.fingerprint}`,
    ),
  );
}

function publicPolicyId(value) {
  return typeof value === "string" &&
    value.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
    ? value
    : "invalid";
}

export function formatUiContractReport(
  { marker = null, violations = [], policyErrors = [], suppressedViolations = [] },
  { format = "text" } = {},
) {
  const report = {
    marker,
    totalViolations: violations.length,
    totalSuppressed: suppressedViolations.length,
    violations: publicReportRows(violations),
    policyErrors: policyErrors.map(({ code, id }) => ({ code, id: publicPolicyId(id) })),
  };
  if (format === "json") return `${JSON.stringify(report, null, 2)}\n`;
  if (format !== "text") throw new UiContractError("UI_REPORT_FORMAT_INVALID");
  const lines = [];
  if (marker) lines.push(marker);
  lines.push(`violations=${report.totalViolations} suppressed=${report.totalSuppressed}`);
  for (const row of report.violations) {
    lines.push(
      `${row.ruleId} ${row.path}:${row.line} ${row.fingerprint} count=${row.count}`,
    );
  }
  for (const error of report.policyErrors) lines.push(`${error.code} id=${error.id}`);
  return `${lines.join("\n")}\n`;
}

export function scanUiContract(sources) {
  const violations = [];
  const sourceEntries = new Map();
  for (const source of sources) {
    const parsed = parseUiSource(source);
    const normalizedPath = normalizeRepoPath(source.path);
    sourceEntries.set(normalizedPath, { path: normalizedPath, source, parsed });
  }
  for (const entry of sourceEntries.values()) {
    const { source, parsed } = entry;
    if (parsed.kind === "typescript") {
      violations.push(...scanStaticInlineStyles(entry, sourceEntries));
      violations.push(...scanArbitraryTailwind(source, parsed.ast));
      violations.push(...scanRawTypeScriptVisualValues(entry, sourceEntries));
      violations.push(...scanAntdWrapperBypass(source, parsed.ast));
      violations.push(...scanExtraWorkspaceMain(source, parsed.ast));
    } else {
      violations.push(...scanCssVisualValues(source, parsed.ast));
      violations.push(...scanBroadAntdStates(source, parsed.ast));
      violations.push(...scanGlobalCssFreeze(source, parsed.ast));
    }
  }
  violations.push(...scanWorkspacePageRecipe(sourceEntries));
  violations.sort((left, right) =>
    compareCodePoints(
      `${left.path}\0${left.ruleId}\0${left.fingerprint}`,
      `${right.path}\0${right.ruleId}\0${right.fingerprint}`,
    ),
  );
  return Object.freeze({
    violations: Object.freeze(violations),
    suppressedViolations: Object.freeze([]),
  });
}
