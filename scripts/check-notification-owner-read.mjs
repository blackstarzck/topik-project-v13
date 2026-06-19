import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = "src/components/notifications/notifications-data.ts";

function readProjectFile(rootDir, relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function extractFunction(content, functionName) {
  const start = content.indexOf(`export async function ${functionName}`);
  if (start === -1) return "";
  const nextExport = content.indexOf("\nexport ", start + 1);
  return content.slice(start, nextExport === -1 ? content.length : nextExport);
}

export function evaluateNotificationOwnerRead({ rootDir = ROOT_DIR } = {}) {
  const failures = [];
  const content = readProjectFile(rootDir, DATA_FILE);
  const fetchDeliveryHistory = extractFunction(content, "fetchDeliveryHistory");

  if (!fetchDeliveryHistory) {
    failures.push(`${DATA_FILE} must export fetchDeliveryHistory.`);
    return { failures };
  }

  const requiredTerms = [
    '.from("notification_delivery_attempts")',
    '.select("id, channel, template_key, status, sent_at, created_at")',
    '.eq("user_id", userId)',
    '.order("created_at", { ascending: false })',
    '.limit(limit)'
  ];

  for (const term of requiredTerms) {
    if (!fetchDeliveryHistory.includes(term)) {
      failures.push(`fetchDeliveryHistory must include ${term}.`);
    }
  }

  const forbiddenTerms = [".insert(", ".upsert(", ".update(", ".delete(", ".rpc("];
  for (const term of forbiddenTerms) {
    if (fetchDeliveryHistory.includes(term)) {
      failures.push(`fetchDeliveryHistory must remain read-only and not include ${term}.`);
    }
  }

  if (content.includes("notification_delivery_attempts") && content.includes(".eq(\"dispatch_id\"")) {
    failures.push("v13 must not read notification_delivery_attempts by dispatch_id; topik-ai owns admin dispatch detail reads.");
  }

  return { failures };
}

export function formatNotificationOwnerReadReport(result) {
  if (result.failures.length === 0) {
    return "Notification owner-read boundary check passed.";
  }

  return [
    "Notification owner-read boundary check failed:",
    ...result.failures.map((failure) => `- ${failure}`)
  ].join("\n");
}

function main() {
  const result = evaluateNotificationOwnerRead();
  const report = formatNotificationOwnerReadReport(result);

  if (result.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }

  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
