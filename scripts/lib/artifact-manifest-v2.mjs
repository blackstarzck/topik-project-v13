import path from "node:path";

const MANIFEST_KEYS = new Set(["schemaVersion", "recordType", "taskId", "files", "updatedAt"]);
const FILE_KEYS = new Set(["path", "sha256", "purpose"]);
const TASK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function issue(code, field) { return { code, path: field }; }
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }

export function isSafeArtifactRelativePath(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 &&
    !value.includes("\\") && !path.posix.isAbsolute(value) && !/^[A-Za-z]:/u.test(value) &&
    path.posix.normalize(value) === value &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

export function validateArtifactManifestV2(record, { folderSlug } = {}) {
  const errors = [];
  if (!plain(record)) return [issue("INVALID_OBJECT", "record")];
  for (const key of Object.keys(record)) if (!MANIFEST_KEYS.has(key)) errors.push(issue("UNKNOWN_FIELD", key));
  try { if (Buffer.byteLength(JSON.stringify(record), "utf8") > 64 * 1024) errors.push(issue("RECORD_TOO_LARGE", "record")); }
  catch { errors.push(issue("INVALID_SERIALIZATION", "record")); }
  if (record.schemaVersion !== 2) errors.push(issue("INVALID_SCHEMA_VERSION", "schemaVersion"));
  if (record.recordType !== "ArtifactManifest") errors.push(issue("INVALID_RECORD_TYPE", "recordType"));
  if (!TASK_ID.test(record.taskId ?? "")) errors.push(issue("INVALID_TASK_ID", "taskId"));
  if (folderSlug && record.taskId !== folderSlug && !record.taskId?.endsWith(`-${folderSlug}`)) errors.push(issue("TASK_FOLDER_MISMATCH", "taskId"));
  const parsed = Date.parse(record.updatedAt);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== record.updatedAt) errors.push(issue("INVALID_TIMESTAMP", "updatedAt"));
  if (!Array.isArray(record.files) || record.files.length > 128) { errors.push(issue("INVALID_FILES", "files")); return errors; }
  const seen = new Set();
  record.files.forEach((entry, index) => {
    const prefix = `files[${index}]`;
    if (!plain(entry)) { errors.push(issue("INVALID_FILE", prefix)); return; }
    for (const key of Object.keys(entry)) if (!FILE_KEYS.has(key)) errors.push(issue("UNKNOWN_FIELD", `${prefix}.${key}`));
    if (!isSafeArtifactRelativePath(entry.path)) errors.push(issue("INVALID_PATH", `${prefix}.path`));
    const lower = String(entry.path ?? "").toLowerCase();
    if (seen.has(lower)) errors.push(issue("PATH_CASE_COLLISION", `${prefix}.path`));
    seen.add(lower);
    if (!SHA256.test(entry.sha256 ?? "")) errors.push(issue("INVALID_SHA256", `${prefix}.sha256`));
    if (typeof entry.purpose !== "string" || entry.purpose.length < 1 || entry.purpose.length > 256) errors.push(issue("INVALID_PURPOSE", `${prefix}.purpose`));
  });
  return errors;
}
