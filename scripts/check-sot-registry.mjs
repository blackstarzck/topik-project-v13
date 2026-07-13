#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const VALID_ROLES = new Set([
  "constitution",
  "entry",
  "active-sot",
  "workflow",
  "proposal",
  "decision-record",
  "reference",
  "archive",
  "unclassified",
]);

export const VALID_STATUSES = new Set([
  "proposed",
  "accepted_pending_promotion",
  "active",
  "superseded",
  "rejected",
  "withdrawn",
]);

const REQUIRED_DOCUMENT_FIELDS = [
  "id",
  "title",
  "path",
  "role",
  "scope",
  "owner",
  "status",
  "precedence",
  "effectiveDate",
  "replaces",
  "replacedBy",
  "decisionLink",
];

function normalizeRelative(relativePath) {
  return relativePath.replaceAll("\\", "/");
}

function isSafeRelativePath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) return false;
  const normalized = normalizeRelative(relativePath);
  return !path.isAbsolute(relativePath) && !normalized.split("/").includes("..");
}

function isFile(rootDir, relativePath) {
  if (!isSafeRelativePath(relativePath)) return false;
  try {
    return statSync(path.join(rootDir, relativePath)).isFile();
  } catch {
    return false;
  }
}

function isDirectory(rootDir, relativePath) {
  if (!isSafeRelativePath(relativePath)) return false;
  try {
    return statSync(path.join(rootDir, relativePath)).isDirectory();
  } catch {
    return false;
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function indexLink(relativePath) {
  const fromDocs = path.posix.relative("docs", normalizeRelative(relativePath));
  const href = fromDocs.startsWith(".") ? fromDocs : `./${fromDocs}`;
  return `[${markdownCell(relativePath)}](${href})`;
}

export function validateRegistry(registry, { rootDir = process.cwd() } = {}) {
  const errors = [];

  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    return ["[sot-registry] registry must be a JSON object"];
  }
  if (registry.schemaVersion !== 2) {
    errors.push(`[sot-registry] unsupported schemaVersion: ${registry.schemaVersion}`);
  }
  if (!isSafeRelativePath(registry.generatedIndex)) {
    errors.push("[sot-registry] generatedIndex must be a safe relative path");
  }
  if (!VALID_ROLES.has(registry.classificationDefault?.role)) {
    errors.push(
      `[sot-registry] invalid classificationDefault role: ${registry.classificationDefault?.role}`,
    );
  }
  if (!Array.isArray(registry.documents)) {
    errors.push("[sot-registry] documents must be an array");
    return errors;
  }

  const ids = new Set();
  const documentsById = new Map();
  const activeScopes = new Map();
  const activePathPrefixes = new Map();

  for (const [index, document] of registry.documents.entries()) {
    const label = document?.id || `documents[${index}]`;
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      errors.push(`[sot-registry] ${label} must be an object`);
      continue;
    }

    for (const field of REQUIRED_DOCUMENT_FIELDS) {
      if (!(field in document)) {
        errors.push(`[sot-registry] ${label} missing required field: ${field}`);
      }
    }

    if (!isNonEmptyString(document.id)) {
      errors.push(`[sot-registry] ${label} has invalid id`);
    } else if (ids.has(document.id)) {
      errors.push(`[sot-registry] duplicate id: ${document.id}`);
    } else {
      ids.add(document.id);
      documentsById.set(document.id, document);
    }

    for (const field of ["title", "scope", "owner"]) {
      if (!isNonEmptyString(document[field])) {
        errors.push(`[sot-registry] ${label} ${field} must be a non-empty string`);
      }
    }

    if (!VALID_ROLES.has(document.role)) {
      errors.push(`[sot-registry] ${label} invalid role: ${document.role}`);
    }
    if (!VALID_STATUSES.has(document.status)) {
      errors.push(`[sot-registry] ${label} invalid status: ${document.status}`);
    }
    if (!Number.isInteger(document.precedence) || document.precedence < 0) {
      errors.push(`[sot-registry] ${label} precedence must be a non-negative integer`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(document.effectiveDate ?? "")) {
      errors.push(`[sot-registry] ${label} effectiveDate must use YYYY-MM-DD`);
    }
    if (!isFile(rootDir, document.path)) {
      errors.push(`[sot-registry] ${label} missing path: ${document.path}`);
    }
    if (document.pathPrefix !== undefined && document.pathPrefix !== null) {
      const normalizedPrefix = normalizeRelative(document.pathPrefix);
      if (
        !isSafeRelativePath(document.pathPrefix) ||
        !normalizedPrefix.endsWith("/") ||
        !isDirectory(rootDir, normalizedPrefix)
      ) {
        errors.push(
          `[sot-registry] ${label} pathPrefix must be an existing safe relative directory ending in /`,
        );
      } else if (document.status !== "active") {
        errors.push(`[sot-registry] ${label} pathPrefix is allowed only for active documents`);
      } else {
        const previous = activePathPrefixes.get(normalizedPrefix);
        if (previous) {
          errors.push(
            `[sot-registry] duplicate active pathPrefix ${normalizedPrefix}: ${previous}, ${label}`,
          );
        } else {
          activePathPrefixes.set(normalizedPrefix, label);
        }
      }
    }
    for (const field of ["replaces", "replacedBy"]) {
      if (!Array.isArray(document[field]) || document[field].some((id) => typeof id !== "string")) {
        errors.push(`[sot-registry] ${label} ${field} must be an array of registry IDs`);
      }
    }
    if (document.decisionLink !== null && !isFile(rootDir, document.decisionLink)) {
      errors.push(
        `[sot-registry] ${label} decisionLink must reference an existing file or be null`,
      );
    }

    if (document.role === "proposal" && document.status === "active") {
      errors.push(`[sot-registry] ${label} proposal cannot be active`);
    }
    if (
      document.status === "superseded" &&
      Array.isArray(document.replacedBy) &&
      document.replacedBy.length === 0
    ) {
      errors.push(`[sot-registry] ${label} superseded replacedBy must not be empty`);
    }
    if (
      document.status === "active" &&
      Array.isArray(document.replacedBy) &&
      document.replacedBy.length > 0
    ) {
      errors.push(`[sot-registry] ${label} active replacedBy must be empty`);
    }

    if (document.status === "active") {
      const previous = activeScopes.get(document.scope);
      if (previous) {
        errors.push(
          `[sot-registry] duplicate active scope ${document.scope}: ${previous}, ${label}`,
        );
      } else if (typeof document.scope === "string" && document.scope.length > 0) {
        activeScopes.set(document.scope, label);
      }
    }
  }

  for (const document of registry.documents) {
    if (!document || typeof document !== "object") continue;
    for (const replacementId of Array.isArray(document.replaces) ? document.replaces : []) {
      if (!ids.has(replacementId)) {
        errors.push(
          `[sot-registry] ${document.id ?? "unknown"} unknown replacement id: ${replacementId}`,
        );
        continue;
      }
      const replaced = documentsById.get(replacementId);
      if (!Array.isArray(replaced?.replacedBy) || !replaced.replacedBy.includes(document.id)) {
        errors.push(
          `[sot-registry] replacement mismatch: ${document.id} replaces ${replacementId}, but ${replacementId}.replacedBy does not include ${document.id}`,
        );
      }
    }
    for (const replacementId of Array.isArray(document.replacedBy) ? document.replacedBy : []) {
      if (!ids.has(replacementId)) {
        errors.push(
          `[sot-registry] ${document.id ?? "unknown"} unknown replacement id: ${replacementId}`,
        );
        continue;
      }
      const replacement = documentsById.get(replacementId);
      if (document.status === "superseded" && replacement?.status !== "active") {
        errors.push(
          `[sot-registry] ${document.id} superseded replacement ${replacementId} must be active`,
        );
      }
      if (!Array.isArray(replacement?.replaces) || !replacement.replaces.includes(document.id)) {
        errors.push(
          `[sot-registry] replacement mismatch: ${document.id}.replacedBy includes ${replacementId}, but ${replacementId}.replaces does not include ${document.id}`,
        );
      }
    }
  }

  return errors;
}

export function resolveRegistryOwner(registry, relativePath) {
  if (!isSafeRelativePath(relativePath)) return null;
  const normalizedPath = normalizeRelative(relativePath);
  const active = Array.isArray(registry?.documents)
    ? registry.documents.filter((document) => document?.status === "active")
    : [];
  const exact = active
    .filter((document) => normalizeRelative(document.path ?? "") === normalizedPath)
    .toSorted((left, right) => left.precedence - right.precedence)[0];
  if (exact) return exact;

  return (
    active
      .filter(
        (document) =>
          typeof document.pathPrefix === "string" &&
          normalizedPath.startsWith(normalizeRelative(document.pathPrefix)),
      )
      .toSorted((left, right) => {
        const lengthDifference = right.pathPrefix.length - left.pathPrefix.length;
        return lengthDifference || left.precedence - right.precedence;
      })[0] ?? null
  );
}

export function renderIndex(registry) {
  const documents = Array.isArray(registry?.documents) ? registry.documents : [];
  const active = documents
    .filter((document) => document.status === "active")
    .toSorted((a, b) => a.precedence - b.precedence || a.id.localeCompare(b.id));
  const lifecycle = documents
    .filter((document) => document.status !== "active")
    .toSorted((a, b) => a.status.localeCompare(b.status) || a.id.localeCompare(b.id));

  const lines = [
    "<!-- GENERATED FILE: edit docs/sot-registry.json, then run node scripts/check-sot-registry.mjs --write-index -->",
    "",
    "# Active SOT Registry",
    "",
    "이 파일은 `docs/sot-registry.json`에서 생성된다. 직접 수정하지 않는다.",
    "",
    "낮은 precedence 숫자가 먼저 적용된다. 동일 scope에는 active owner가 하나만 존재해야 한다.",
    "",
    "## Active contracts",
    "",
    "| Precedence | Scope | Role | Title | Path | Inherited path prefix | Owner | Effective |",
    "| ---: | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const document of active) {
    lines.push(
      `| ${document.precedence} | \`${markdownCell(document.scope)}\` | ${markdownCell(document.role)} | ${markdownCell(document.title)} | ${indexLink(document.path)} | ${document.pathPrefix ? `\`${markdownCell(document.pathPrefix)}\`` : "-"} | ${markdownCell(document.owner)} | ${markdownCell(document.effectiveDate)} |`,
    );
  }
  if (active.length === 0) {
    lines.push("| - | - | - | No active contracts | - | - | - | - |");
  }

  lines.push(
    "",
    "## Lifecycle records",
    "",
    "| Status | Role | Title | Path | Replaced by |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const document of lifecycle) {
    lines.push(
      `| ${markdownCell(document.status)} | ${markdownCell(document.role)} | ${markdownCell(document.title)} | ${indexLink(document.path)} | ${markdownCell(document.replacedBy.join(", ") || "-")} |`,
    );
  }
  if (lifecycle.length === 0) {
    lines.push("| - | - | No lifecycle records | - | - |");
  }

  lines.push(
    "",
    "## Unlisted documents",
    "",
    `Registry에 명시되지 않은 문서의 기본 role은 \`${markdownCell(registry.classificationDefault?.role)}\`이다. lifecycle status는 추정하지 않는다.`,
    "",
  );

  return lines.join("\n");
}

export function evaluateRegistry({
  rootDir = process.cwd(),
  registryPath = "docs/sot-registry.json",
  checkIndex = true,
} = {}) {
  const absoluteRegistryPath = path.join(rootDir, registryPath);
  let registry;

  try {
    registry = JSON.parse(readFileSync(absoluteRegistryPath, "utf8"));
  } catch (error) {
    return {
      registry: null,
      expectedIndex: "",
      errors: [`[sot-registry] cannot read ${registryPath}: ${error.message}`],
    };
  }

  const errors = validateRegistry(registry, { rootDir });
  if (errors.length > 0) {
    return { registry, expectedIndex: "", errors };
  }

  const expectedIndex = renderIndex(registry);

  if (checkIndex && isSafeRelativePath(registry.generatedIndex)) {
    const absoluteIndexPath = path.join(rootDir, registry.generatedIndex);
    if (!existsSync(absoluteIndexPath)) {
      errors.push(`[sot-registry] generated index missing: ${registry.generatedIndex}`);
    } else if (readFileSync(absoluteIndexPath, "utf8") !== expectedIndex) {
      errors.push(
        `[sot-registry] generated index drift: run node scripts/check-sot-registry.mjs --write-index`,
      );
    }
  }

  return { registry, expectedIndex, errors };
}

function parseMode(argv) {
  if (argv.includes("--check")) return "block";
  const modeIndex = argv.indexOf("--mode");
  const mode = modeIndex === -1 ? "block" : argv[modeIndex + 1];
  if (!new Set(["report", "block"]).has(mode)) {
    throw new Error(`invalid mode: ${mode}`);
  }
  return mode;
}

function main() {
  const argv = process.argv.slice(2);
  const mode = parseMode(argv);
  const writeIndex = argv.includes("--write-index");
  let result = evaluateRegistry({ checkIndex: !writeIndex });

  if (writeIndex && result.registry && result.errors.length === 0) {
    writeFileSync(
      path.join(process.cwd(), result.registry.generatedIndex),
      result.expectedIndex,
      "utf8",
    );
    result = evaluateRegistry();
  }

  if (result.errors.length === 0) {
    console.log(
      `[sot-registry] PASS: ${result.registry.documents.length} registered documents; generated index is current.`,
    );
    return;
  }

  const report = [
    `[sot-registry] ${mode === "block" ? "FAIL" : "REPORT"}: ${result.errors.length} issue(s)`,
    ...result.errors.map((error) => `- ${error}`),
  ].join("\n");
  if (mode === "block") {
    console.error(report);
    process.exitCode = 1;
  } else {
    console.warn(report);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`[sot-registry] FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
