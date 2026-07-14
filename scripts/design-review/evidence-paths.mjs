import { lstatSync, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function requireEvidenceSlug(value) {
  if (typeof value !== "string" || !SAFE_SLUG.test(value)) {
    throw new Error(
      "UI evidence slug is required and must be lowercase kebab-case.",
    );
  }
  return value;
}

export function evidenceRoot(cwd, slug) {
  return path.resolve(
    cwd,
    ".codex",
    "work",
    requireEvidenceSlug(slug),
    "ui-evidence",
  );
}

function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function relativeInside(parent, child, { allowSame = false } = {}) {
  const relative = path.relative(parent, child);
  if (!relative) return allowSame;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function lstatIfPresent(target) {
  try {
    return lstatSync(target);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function assertUnlinkedPath(target, status, { requireDirectory = true } = {}) {
  if (status.isSymbolicLink()) {
    throw new Error(`UI evidence path has a symbolic or reparse ancestor: ${target}`);
  }
  if (requireDirectory && !status.isDirectory()) {
    throw new Error(`UI evidence path ancestor is not a directory: ${target}`);
  }
  let realTarget;
  try {
    realTarget = realpathSync.native(target);
  } catch {
    throw new Error(`UI evidence path has a dangling or linked ancestor: ${target}`);
  }
  if (normalizedPath(realTarget) !== normalizedPath(target)) {
    throw new Error(`UI evidence path has a symbolic or reparse ancestor: ${target}`);
  }
}

function walkExistingEvidenceAncestors(cwd, target) {
  const root = path.resolve(cwd);
  if (!relativeInside(root, target, { allowSame: true })) {
    throw new Error("UI evidence path must stay inside the repository root.");
  }

  const relative = path.relative(root, target);
  const segments = relative.split(path.sep).filter(Boolean);
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const status = lstatIfPresent(current);
    if (!status) break;
    assertUnlinkedPath(current, status, {
      requireDirectory: index < segments.length - 1,
    });
  }
}

function createEvidenceDirectorySegments(cwd, target) {
  const root = path.resolve(cwd);
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let status = lstatIfPresent(current);
    if (!status) {
      mkdirSync(current);
      status = lstatSync(current);
    }
    assertUnlinkedPath(current, status);
  }
}

function assertRealEvidenceContainment(cwd, root, output) {
  const realRepository = realpathSync.native(path.resolve(cwd));
  const realRoot = realpathSync.native(root);
  const realOutput = realpathSync.native(output);
  if (
    !relativeInside(realRepository, realRoot) ||
    !relativeInside(realRoot, realOutput, { allowSame: true })
  ) {
    throw new Error("UI evidence real path escapes the repository evidence root.");
  }
}

export function resolveEvidenceOutput({ cwd, slug, child }) {
  const root = evidenceRoot(cwd, slug);
  const output = path.resolve(root, child);
  const relative = path.relative(root, output);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error("UI evidence output must stay inside the slug evidence root.");
  }
  walkExistingEvidenceAncestors(cwd, output);
  return output;
}

export function prepareEvidenceOutputDirectory({ cwd, slug, child }) {
  const root = evidenceRoot(cwd, slug);
  const output = resolveEvidenceOutput({ cwd, slug, child });
  createEvidenceDirectorySegments(cwd, output);
  walkExistingEvidenceAncestors(cwd, output);
  assertRealEvidenceContainment(cwd, root, output);
  return output;
}
