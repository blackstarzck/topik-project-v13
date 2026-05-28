import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const REPO_ROOT = process.cwd();

export function readText(path) {
  return readFileSync(resolvePath(path), "utf8");
}

export function readJson(path) {
  return JSON.parse(readFileSync(resolvePath(path), "utf8"));
}

export function writeJson(path, value) {
  const fullPath = resolvePath(path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(path, value) {
  const fullPath = resolvePath(path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, value);
}

export function resolvePath(path) {
  return isAbsolute(path) ? path : join(REPO_ROOT, path);
}

export function normalizeSlashes(path) {
  return path.split(sep).join("/");
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current.startsWith("--")) {
      const key = current.slice(2);
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        index += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

export function resolveAuditDir() {
  const args = parseArgs();
  if (typeof args["audit-dir"] === "string") return normalizePathText(args["audit-dir"]);
  if (process.env.IA_AUDIT_DIR) return normalizePathText(process.env.IA_AUDIT_DIR);

  const runsRoot = join(REPO_ROOT, "reports/ia-verification/runs");
  if (existsSync(runsRoot)) {
    const candidates = readdirSync(runsRoot)
      .filter((name) => statSync(join(runsRoot, name)).isDirectory())
      .sort()
      .reverse();
    if (candidates[0]) return `reports/ia-verification/runs/${candidates[0]}`;
  }

  const runId = timestampId();
  return `reports/ia-verification/runs/${runId}`;
}

export function ensureAuditDir(auditDir) {
  mkdirSync(resolvePath(auditDir), { recursive: true });
}

export function normalizeRelative(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function normalizePathText(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function timestampId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

export function runIdFromAuditDir(auditDir) {
  return auditDir.split("/").filter(Boolean).at(-1) ?? timestampId();
}

export function gitMeta() {
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();
  const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).stdout.trim();

  return {
    sourceCommit: commit || "unknown",
    dirtyState: status ? "dirty" : "clean",
  };
}

export function evidenceBundleId({ runId, sourceCommit, dirtyState }) {
  return createHash("sha256").update(`${runId}:${sourceCommit}:${dirtyState}`).digest("hex").slice(0, 16);
}

export function generatedAt() {
  return new Date().toISOString();
}

export function stripInlineCode(value) {
  return value.replaceAll("`", "").trim();
}

export function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseIaInventory() {
  const readme = readText("docs/IA/README.md");
  const entries = [];
  const seen = new Set();
  const linkPattern = /\]\(\.\/([^/]+)\/description\.md\)/g;
  let match;

  while ((match = linkPattern.exec(readme))) {
    const folder = match[1];
    const codeMatch = folder.match(/^\d+-([A-Z]+-(?:M\d|\d{2}))/);
    if (!codeMatch) continue;

    const iaCode = codeMatch[1];
    if (seen.has(iaCode)) continue;

    seen.add(iaCode);
    entries.push({
      iaCode,
      iaFolder: `docs/IA/${folder}`,
      descriptionPath: `docs/IA/${folder}/description.md`,
      wireframePath: `docs/IA/${folder}/wireframe.png`,
    });
  }

  return entries;
}

export function parseIaPackTable() {
  const procedure = readText("docs/ai-workflow/ia-page-implementation-verification.md");
  const rows = new Map();
  const lines = procedure.split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const cells = splitMarkdownRow(line);
    if (cells.length < 4) continue;
    if (cells[0] === "---" || cells[0] === "IA") continue;

    const codeAndName = stripInlineCode(cells[0]);
    const codeMatch = codeAndName.match(/^([A-Z]+-(?:M\d|\d{2}))\s+(.+)$/);
    if (!codeMatch) continue;

    const iaCode = codeMatch[1];
    rows.set(iaCode, {
      iaCode,
      screenName: codeMatch[2].trim(),
      routeOrHostRoute: normalizeRouteText(cells[1]),
      routeType: normalizeRouteType(cells[2]),
      packs: cells[3]
        .split(",")
        .map((pack) => stripInlineCode(pack).trim())
        .filter(Boolean),
    });
  }

  return rows;
}

export function parseSupportSurfaces() {
  const procedure = readText("docs/ai-workflow/ia-page-implementation-verification.md");
  const marker = "Route handler support checks:";
  const start = procedure.indexOf(marker);
  if (start === -1) return [];

  const section = procedure.slice(start).split(/\n## /)[0];
  const rows = [];

  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = splitMarkdownRow(line);
    if (cells.length < 3 || cells[0] === "Route" || cells[0] === "---") continue;
    const routeOrHostRoute = normalizeRouteText(cells[0]);
    if (!routeOrHostRoute.startsWith("/")) continue;
    rows.push({
      routeOrHostRoute,
      routeType: normalizeRouteType(cells[1]),
      packs: cells[2]
        .split(",")
        .map((pack) => stripInlineCode(pack).trim())
        .filter(Boolean),
    });
  }

  return rows;
}

export function parseSitemapRoutes() {
  const sitemap = readText("docs/sitemap.md");
  const rows = new Map();

  for (const line of sitemap.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = splitMarkdownRow(line);
    if (cells.length < 4 || cells[0] === "IA" || cells[0] === "---") continue;
    const iaCode = stripInlineCode(cells[0]);
    if (!/^[A-Z]+-(?:M\d|\d{2})$/.test(iaCode)) continue;
    rows.set(iaCode, {
      iaCode,
      screenName: stripInlineCode(cells[1]),
      routeOrHostRoute: normalizeRouteText(cells[2]),
      routeType: normalizeRouteType(cells[3]),
      notes: stripInlineCode(cells[4] ?? ""),
    });
  }

  return rows;
}

export function normalizeRouteText(value) {
  return stripInlineCode(value)
    .replace(/^hosted by\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeRouteType(value) {
  const type = stripInlineCode(value).toLowerCase();
  if (type === "modal") return "hosted modal";
  return type;
}

export function inferAudience({ iaCode, routeOrHostRoute, packs }) {
  const publicCodes = new Set(["X-01", "A-01", "A-02", "X-06", "X-11", "X-12"]);
  if (publicCodes.has(iaCode)) return "public";
  if (routeOrHostRoute.includes("/auth/")) return "public";
  if (routeOrHostRoute.includes("/admin/") || packs.includes("ADMIN") || packs.includes("RBAC")) return "admin";
  return "user";
}

export function buildManifest(auditDir = resolveAuditDir()) {
  ensureAuditDir(auditDir);
  const runId = runIdFromAuditDir(auditDir);
  const meta = gitMeta();
  const bundleId = evidenceBundleId({ runId, ...meta });
  const inventory = parseIaInventory();
  const packRows = parseIaPackTable();
  const sitemapRows = parseSitemapRoutes();

  const entries = inventory.map((entry) => {
    const packRow = packRows.get(entry.iaCode);
    const sitemapRow = sitemapRows.get(entry.iaCode);
    const routeOrHostRoute = sitemapRow?.routeOrHostRoute ?? packRow?.routeOrHostRoute ?? "unknown";
    const routeType = sitemapRow?.routeType ?? packRow?.routeType ?? "unknown";
    const screenName = sitemapRow?.screenName ?? packRow?.screenName ?? entry.iaCode;
    const packs = packRow?.packs ?? ["CORE"];

    return {
      runId,
      sourceCommit: meta.sourceCommit,
      dirtyState: meta.dirtyState,
      evidenceBundleId: bundleId,
      iaCode: entry.iaCode,
      screenName,
      routeOrHostRoute,
      routeType,
      audience: inferAudience({ iaCode: entry.iaCode, routeOrHostRoute, packs }),
      packs,
      descriptionPath: entry.descriptionPath,
      wireframePath: entry.wireframePath,
      wireframeStatus: existsSync(join(REPO_ROOT, entry.wireframePath)) ? "present" : "missing",
      iaFolder: entry.iaFolder,
      requiredEvidenceInputs: requiredEvidenceFor({ routeType, audience: inferAudience({ iaCode: entry.iaCode, routeOrHostRoute, packs }), packs }),
      generatedBy: "build-ia-manifest.mjs",
      generatedAt: generatedAt(),
    };
  });

  return {
    runId,
    sourceCommit: meta.sourceCommit,
    dirtyState: meta.dirtyState,
    evidenceBundleId: bundleId,
    generatedBy: "build-ia-manifest.mjs",
    generatedAt: generatedAt(),
    sourceDocs: [
      "docs/sitemap.md",
      "docs/IA/README.md",
      "docs/ai-workflow/ia-page-implementation-verification.md",
    ],
    entries,
    supportSurfaces: parseSupportSurfaces().map((surface) => ({
      ...surface,
      runId,
      sourceCommit: meta.sourceCommit,
      dirtyState: meta.dirtyState,
      evidenceBundleId: bundleId,
      audience: surface.routeOrHostRoute.includes("/auth/") ? "public" : "n/a",
      generatedBy: "build-ia-manifest.mjs",
      generatedAt: generatedAt(),
    })),
    summary: {
      totalIa: entries.length,
      docGapNotes: [
        "docs/sitemap.md source-order prose still says docs/IA/README.md is the current 32-screen IA inventory.",
        "docs/IA/README.md currently lists 34 IA entries.",
      ],
    },
  };
}

export function requiredEvidenceFor({ routeType, audience, packs }) {
  const required = ["document-receipt", "source-map"];
  if (routeType === "page") required.push("browser");
  if (routeType.includes("modal") || routeType.includes("state") || routeType.includes("toast")) {
    required.push("hosted-surface");
  }
  if (audience !== "public" || packs.some((pack) => ["AUTH", "SESSION", "OWNER-CHECK", "ADMIN", "RBAC", "SECURITY"].includes(pack))) {
    required.push("security-navigation");
  }
  required.push("ai-ux-review");
  if (packs.some((pack) => ["MODAL", "FORM", "AUTH", "ADMIN", "POLICY", "DEFERRED-BILLING", "TRANSPORT-DEFERRED", "RECOMMENDATION"].includes(pack))) {
    required.push("human-confirmation");
  }
  return [...new Set(required)];
}

export function listFilesRecursive(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const name of readdirSync(root)) {
    const fullPath = join(root, name);
    if (statSync(fullPath).isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export function buildAppRouteIndex() {
  const appRoot = join(REPO_ROOT, "src/app");
  const files = listFilesRecursive(appRoot).filter((file) => file.endsWith("page.tsx") || file.endsWith("route.ts"));

  return files.map((file) => {
    const kind = file.endsWith("route.ts") ? "route handler" : "page";
    const routeDir = dirname(relative(appRoot, file));
    const segments = routeDir
      .split(sep)
      .filter((segment) => segment && segment !== "." && !segment.startsWith("("))
      .map((segment) => {
        const dynamic = segment.match(/^\[(.+)\]$/);
        return dynamic ? `:${dynamic[1]}` : segment;
      });
    const route = `/${segments.join("/")}`.replace(/\/$/, "") || "/";
    return {
      route,
      kind,
      sourceFile: normalizeSlashes(relative(REPO_ROOT, file)),
    };
  });
}

export function routeMatches(expected, sourceRoute) {
  if (expected === sourceRoute) return true;
  if (!expected.startsWith("/") || !sourceRoute.startsWith("/")) return false;

  const pattern = sourceRoute
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment.startsWith(":")) return "[^/]+";
      return escapeRegExp(segment);
    })
    .join("/");

  return new RegExp(`^${pattern}$`).test(expected);
}

export function firstRouteCandidate(routeOrHostRoute) {
  const match = routeOrHostRoute.match(/\/[A-Za-z0-9:_/-]+/);
  return match?.[0] ?? routeOrHostRoute;
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function componentAnchorForIa(iaCode) {
  const anchors = {
    "C-03": "src/components/practice/RetryModal.tsx",
    "D-M1": "src/components/writing/SubmissionConfirmModal.tsx",
    "D-M2": "src/components/feedback/AnalysisLoadingModal.tsx",
    "D-M3": "src/components/writing/AutosaveWarningModal.tsx",
    "F-M1": "src/components/library/ExportPdfButton.tsx",
  };
  return anchors[iaCode];
}

export function statusSummary(rows) {
  return rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
}

export function loadManifest(auditDir) {
  const path = `${auditDir}/ia-manifest.json`;
  if (!existsSync(join(REPO_ROOT, path))) {
    const manifest = buildManifest(auditDir);
    writeJson(path, manifest);
    return manifest;
  }
  return readJson(path);
}

export function maybeReadJson(path) {
  const fullPath = resolvePath(path);
  if (!existsSync(fullPath)) return null;
  return JSON.parse(readFileSync(fullPath, "utf8"));
}
