import { execFileSync, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  realpathSync,
  readSync,
  writeSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const profiles = new Set(["app", "e2e"]);
const appRequiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];
const e2eRequiredKeys = ["SUPABASE_SERVICE_ROLE_KEY", "E2E_STUDENT_EMAIL"];
const e2ePasswordKeys = ["E2E_STUDENT_PASSWORD", "SUPABASE_TEST_PASSWORD"];

function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function canonicalPath(value) {
  try {
    return normalizedPath(realpathSync.native(value));
  } catch {
    return normalizedPath(value);
  }
}

function defaultGetGitCommonDir(checkoutRoot) {
  const output = execFileSync(
    "git",
    [
      "-C",
      checkoutRoot,
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ],
    { encoding: "utf8", windowsHide: true },
  ).trim();
  return path.isAbsolute(output) ? output : path.resolve(checkoutRoot, output);
}

function defaultListWorktrees(currentRoot) {
  const output = execFileSync(
    "git",
    ["worktree", "list", "--porcelain", "-z"],
    {
      cwd: currentRoot,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  return parseWorktreePorcelain(output);
}

function defaultIsIgnored(file, currentRoot) {
  const relative = path.relative(currentRoot, file);
  const result = spawnSync("git", ["check-ignore", "--quiet", "--", relative], {
    cwd: currentRoot,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  return interpretCheckIgnoreResult(result);
}

export function interpretCheckIgnoreResult(result) {
  if (!result.error && !result.signal && result.status === 0) return true;
  if (!result.error && !result.signal && result.status === 1) return false;
  throw new Error("Unable to verify that destination .env.local is ignored.");
}

function assertSafeRegularFile(file, label) {
  let status;
  try {
    status = lstatSync(file);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${label} .env.local is missing.`);
    }
    throw new Error(`Unable to inspect ${label} .env.local.`);
  }

  if (status.isSymbolicLink() || !status.isFile()) {
    throw new Error(
      `${label} .env.local must be a regular file, not a symbolic or reparse point.`,
    );
  }
  if (canonicalPath(file) !== normalizedPath(file)) {
    throw new Error(
      `${label} .env.local must not resolve through a symbolic or reparse point.`,
    );
  }
}

function fileIdentity(status) {
  return { dev: status.dev, ino: status.ino, size: status.size };
}

function sameIdentity(left, right) {
  return (
    left.dev === right.dev && left.ino === right.ino && left.size === right.size
  );
}

function readHandleBytes(fileDescriptor, status) {
  const bytes = Buffer.alloc(status.size);
  let offset = 0;
  while (offset < bytes.length) {
    const count = readSync(
      fileDescriptor,
      bytes,
      offset,
      bytes.length - offset,
      offset,
    );
    if (count === 0) break;
    offset += count;
  }
  return offset === bytes.length ? bytes : bytes.subarray(0, offset);
}

function writeAllBytes(fileDescriptor, bytes, writer) {
  let offset = 0;
  while (offset < bytes.length) {
    const count = writer(
      fileDescriptor,
      bytes,
      offset,
      bytes.length - offset,
      offset,
    );
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error("Destination handle did not accept the remaining bytes.");
    }
    offset += count;
  }
}

function inspectHandleAndPath(destination, fileDescriptor) {
  const handleStatus = fstatSync(fileDescriptor);
  if (!handleStatus.isFile())
    throw new Error("Destination handle is not a regular file.");
  const pathStatus = lstatSync(destination);
  if (pathStatus.isSymbolicLink() || !pathStatus.isFile()) {
    throw new Error("Destination path is not a regular file.");
  }
  if (canonicalPath(destination) !== normalizedPath(destination)) {
    throw new Error(
      "Destination path resolves through a symbolic or reparse point.",
    );
  }
  if (!sameIdentity(fileIdentity(handleStatus), fileIdentity(pathStatus))) {
    throw new Error(
      "Destination path identity does not match its open handle.",
    );
  }
  return handleStatus;
}

function readStableRegularFile(file, label) {
  assertSafeRegularFile(file, label);
  const fileDescriptor = openSync(file, "r");
  try {
    const handleStatus = fstatSync(fileDescriptor);
    const pathStatus = lstatSync(file);
    if (
      !handleStatus.isFile() ||
      !sameIdentity(fileIdentity(handleStatus), fileIdentity(pathStatus))
    ) {
      throw new Error(`${label} .env.local changed while it was opened.`);
    }
    return readHandleBytes(fileDescriptor, handleStatus);
  } finally {
    closeSync(fileDescriptor);
  }
}

function unquote(value) {
  let quote = null;
  let commentAt = -1;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "#") {
      commentAt = index;
      break;
    }
  }
  const trimmed = (commentAt >= 0 ? value.slice(0, commentAt) : value).trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseEnvironment(content) {
  const values = new Map();
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice(7).trimStart()
      : trimmed;
    const separator = normalized.indexOf("=");
    if (separator <= 0) continue;
    const key = normalized.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) continue;
    values.set(key, unquote(normalized.slice(separator + 1)));
  }
  return values;
}

function validateEnvironment(content, profile) {
  const values = parseEnvironment(content);
  const missing = [
    ...appRequiredKeys,
    ...(profile === "e2e" ? e2eRequiredKeys : []),
  ].filter((key) => !values.get(key)?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment keys: ${missing.join(", ")}.`,
    );
  }
  if (
    profile === "e2e" &&
    !e2ePasswordKeys.some((key) => values.get(key)?.trim())
  ) {
    throw new Error(
      `Missing required environment key alternative: ${e2ePasswordKeys.join(" or ")}.`,
    );
  }

  let supabaseUrl;
  try {
    supabaseUrl = new URL(values.get("NEXT_PUBLIC_SUPABASE_URL"));
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }
  const normalizedHostname = supabaseUrl.hostname
    .replace(/^\[|\]$/gu, "")
    .toLowerCase();
  const isLoopback = new Set(["localhost", "127.0.0.1", "::1"]).has(
    normalizedHostname,
  );
  if (values.get("SUPABASE_LOCAL_STACK") === "1" && !isLoopback) {
    throw new Error(
      "SUPABASE_LOCAL_STACK requires NEXT_PUBLIC_SUPABASE_URL to use a loopback host.",
    );
  }
  if (
    supabaseUrl.protocol !== "https:" &&
    !(supabaseUrl.protocol === "http:" && isLoopback)
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must use HTTPS, except HTTP is allowed for a loopback host.",
    );
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function parseArguments(args) {
  if (args.length !== 2 || args[0] !== "--profile") {
    if (args.length > 2 || (args.length > 0 && args[0] !== "--profile")) {
      throw new Error("Unknown argument. Use --profile app or --profile e2e.");
    }
    throw new Error(
      "A profile is required. Use --profile app or --profile e2e.",
    );
  }
  if (!profiles.has(args[1])) {
    throw new Error("Unknown profile. Use --profile app or --profile e2e.");
  }
  return { profile: args[1] };
}

export function parseWorktreePorcelain(output) {
  const worktrees = [];
  let current = null;
  for (const field of output.split("\0")) {
    if (!field) {
      if (current?.path) worktrees.push(current);
      current = null;
      continue;
    }
    if (field.startsWith("worktree ")) {
      if (current?.path) worktrees.push(current);
      current = { path: field.slice("worktree ".length) };
    } else if (field.startsWith("branch ") && current) {
      current.branch = field.slice("branch ".length);
    }
  }
  if (current?.path) worktrees.push(current);
  return worktrees;
}

export function selectMainCheckout(
  entries,
  { currentCommonDir, getGitCommonDir },
) {
  const currentCanonical = canonicalPath(currentCommonDir);
  const mainCheckouts = entries.filter((entry) => {
    if (entry.branch !== "refs/heads/main") return false;
    try {
      return canonicalPath(getGitCommonDir(entry.path)) === currentCanonical;
    } catch {
      return false;
    }
  });
  if (mainCheckouts.length !== 1) {
    throw new Error(
      `Expected exactly one main checkout in the current repository; found ${mainCheckouts.length}.`,
    );
  }
  return mainCheckouts[0];
}

export async function prepareWorktreeEnvironment({
  currentRoot = process.cwd(),
  profile,
  dependencies = {},
}) {
  if (!profiles.has(profile)) {
    throw new Error("Unknown profile. Use app or e2e.");
  }
  const getGitCommonDir =
    dependencies.getGitCommonDir ?? defaultGetGitCommonDir;
  const listWorktrees = dependencies.listWorktrees ?? defaultListWorktrees;
  const isIgnored = dependencies.isIgnored ?? defaultIsIgnored;
  const currentCommonDir = getGitCommonDir(currentRoot);
  const main = selectMainCheckout(await listWorktrees(currentRoot), {
    currentCommonDir,
    getGitCommonDir,
  });
  const source = path.join(main.path, ".env.local");
  const destination = path.join(currentRoot, ".env.local");
  assertSafeRegularFile(source, "Source");

  if (existsSync(destination)) {
    assertSafeRegularFile(destination, "Destination");
    if (!(await isIgnored(destination, currentRoot))) {
      throw new Error("Destination .env.local must be ignored by Git.");
    }
    validateEnvironment(
      readStableRegularFile(destination, "Destination").toString("utf8"),
      profile,
    );
    return { action: "validated", profile };
  }

  const sourceBytes = readStableRegularFile(source, "Source");
  validateEnvironment(sourceBytes.toString("utf8"), profile);
  if (!(await isIgnored(destination, currentRoot))) {
    throw new Error("Destination .env.local must be ignored by Git.");
  }
  await dependencies.beforeCopy?.(destination);
  const state = { fileDescriptor: null, originalIdentity: null };
  try {
    const createDestination =
      dependencies.createDestination ??
      ((file) => openSync(file, "wx+", 0o600));
    state.fileDescriptor = createDestination(destination);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        "Destination .env.local already exists; exclusive-copy race refused.",
      );
    }
    throw new Error("Unable to create destination .env.local exclusively.");
  }

  const sourceHash = sha256(sourceBytes);
  try {
    const writer = dependencies.writeDestination ?? writeSync;
    writeAllBytes(state.fileDescriptor, sourceBytes, writer);
    fsyncSync(state.fileDescriptor);
    const inspectDestination =
      dependencies.inspectDestination ?? inspectHandleAndPath;
    const initialStatus = inspectDestination(destination, state.fileDescriptor);
    state.originalIdentity = fileIdentity(initialStatus);
    if (
      sha256(readHandleBytes(state.fileDescriptor, initialStatus)) !==
      sourceHash
    ) {
      throw new Error(
        "Copied destination .env.local failed the content hash check.",
      );
    }
    await dependencies.afterCopy?.(destination);
    const afterCopyStatus = inspectHandleAndPath(
      destination,
      state.fileDescriptor,
    );
    if (
      !sameIdentity(fileIdentity(afterCopyStatus), state.originalIdentity) ||
      sha256(readHandleBytes(state.fileDescriptor, afterCopyStatus)) !==
        sourceHash
    ) {
      throw new Error("Copied destination .env.local changed after copy.");
    }
    if (!(await isIgnored(destination, currentRoot))) {
      throw new Error("Copied destination .env.local is not ignored by Git.");
    }
    const finalStatus = inspectHandleAndPath(destination, state.fileDescriptor);
    if (
      !sameIdentity(fileIdentity(finalStatus), state.originalIdentity) ||
      sha256(readHandleBytes(state.fileDescriptor, finalStatus)) !== sourceHash
    ) {
      throw new Error(
        "Copied destination .env.local changed during post-copy verification.",
      );
    }
  } catch {
    throw new Error(
      "NEEDS_ATTENTION: generated .env.local was preserved for manual review after verification failed.",
    );
  } finally {
    if (state.fileDescriptor !== null) {
      try {
        closeSync(state.fileDescriptor);
      } catch {
        throw new Error(
          "NEEDS_ATTENTION: generated .env.local was preserved for manual review after close failed.",
        );
      }
    }
  }
  return { action: "copied", profile };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const { profile } = parseArguments(process.argv.slice(2));
    const result = await prepareWorktreeEnvironment({ profile });
    process.stdout.write(
      `.env.local ${result.action} for profile ${result.profile}.\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Worktree env preparation failed."}\n`,
    );
    process.exitCode = 1;
  }
}
