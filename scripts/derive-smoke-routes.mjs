// C1 — derive the routes a dev-mode smoke (M1) must cover, from a git diff.
// (PLAN.md §강제성 게이트 표 C1.)
//
// Two pure pieces (unit-tested) + impure glue (git diff, import-graph scan):
//   routeForSpecialFile  — a route special file path → its URL segment + kind
//   deriveRequiredRoutes — changed files (+ page list + reverse-ref map) → the
//                          set of visitable routes that must be smoke-tested
//
// Reverse-ref note: a changed shared component must pull in EVERY route that
// renders it. We approximate this with a static import graph rooted at route
// special files. Limitations (documented, expansion-tier per master plan §A):
// route groups make a group-level layout over-approximate to all descendants,
// and dynamic segments (`[id]`) are emitted literally (not visitable as-is).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const SPECIAL = new Set([
  "page",
  "layout",
  "loading",
  "error",
  "not-found",
  "template",
  "default",
]);

// ---- pure ------------------------------------------------------------------

/**
 * @param {string} relPath repo-relative path (forward or back slashes)
 * @returns {{ segment: string, special: string } | null}
 */
export function routeForSpecialFile(relPath) {
  const norm = String(relPath).split("\\").join("/");
  if (!norm.startsWith("src/app/") || !norm.endsWith(".tsx")) return null;
  const afterApp = norm.slice("src/app/".length);
  const parts = afterApp.split("/");
  const base = parts.pop().replace(/\.tsx$/, "");
  if (!SPECIAL.has(base)) return null;
  // strip route groups `(group)` and parallel-route `@slot` segments — they
  // add no URL path.
  const segParts = parts.filter(
    (p) => !(p.startsWith("(") && p.endsWith(")")) && !p.startsWith("@"),
  );
  const segment = segParts.length === 0 ? "/" : "/" + segParts.join("/");
  return { segment, special: base };
}

function ownedRoutes(special, segment, pageRoutes) {
  if (special === "layout") {
    const prefix = segment === "/" ? "/" : segment + "/";
    return pageRoutes.filter((r) => r === segment || r.startsWith(prefix));
  }
  if (pageRoutes.includes(segment)) return [segment];
  if (special === "page") return [segment];
  return [];
}

// Why a derived route is NOT a smoke target. Excluded routes are reported, never
// silently dropped. admin = frozen scope (PLAN.md); dynamic = needs param
// fixtures (expansion-tier, not directly visitable).
function exclusionReason(route) {
  if (route === "/admin" || route.startsWith("/admin/")) return "admin-frozen";
  if (route.includes("[")) return "dynamic-segment";
  return null;
}

/**
 * @param {{ changedFiles: string[], pageRoutes?: string[], reverseRefs?: Record<string,string[]> }} input
 * @returns {{ requiredRoutes: string[], excludedRoutes: {route:string,reason:string}[], overApproximated: boolean }}
 */
export function deriveRequiredRoutes({
  changedFiles,
  pageRoutes = [],
  reverseRefs = {},
}) {
  const routes = new Set();
  let overApproximated = false;
  for (const raw of changedFiles) {
    const f = String(raw).split("\\").join("/");
    const special = routeForSpecialFile(f);
    if (special) {
      if (special.special === "layout") {
        // A layout affects only its own subtree. Only the ROOT layout (segment
        // "/") truly reaches every route → over-approximation. Nested layouts
        // (e.g. /admin) scope to their subtree (cross-audit P2).
        const seg = special.segment;
        const prefix = seg === "/" ? "/" : seg + "/";
        for (const r of pageRoutes) {
          if (r === seg || r.startsWith(prefix)) routes.add(r);
        }
        if (seg === "/") overApproximated = true;
      } else if (pageRoutes.includes(special.segment)) {
        routes.add(special.segment);
      } else if (special.special === "page") {
        routes.add(special.segment);
      }
    } else {
      const refs = reverseRefs[f];
      if (refs) for (const r of refs) routes.add(r);
    }
  }
  const requiredRoutes = [];
  const excludedRoutes = [];
  for (const r of [...routes].sort()) {
    const reason = exclusionReason(r);
    if (reason) excludedRoutes.push({ route: r, reason });
    else requiredRoutes.push(r);
  }
  return { requiredRoutes, excludedRoutes, overApproximated };
}

// ---- impure ----------------------------------------------------------------

function toRel(root, abs) {
  return relative(root, abs).split(sep).join("/");
}

function walkFiles(dir, root, acc, exts) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e === ".git") continue;
    const full = join(dir, e);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(full, root, acc, exts);
    else if (exts.some((x) => e.endsWith(x))) acc.push(toRel(root, full));
  }
}

export function listPageRoutes(root = process.cwd()) {
  const acc = [];
  walkFiles(join(root, "src", "app"), root, acc, [".tsx"]);
  const routes = new Set();
  for (const f of acc) {
    const s = routeForSpecialFile(f);
    if (s && s.special === "page") routes.add(s.segment);
  }
  return [...routes].sort();
}

function normalizeRel(p) {
  const parts = [];
  for (const seg of p.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

function resolveImport(fromRel, spec, root) {
  let baseRel;
  if (spec.startsWith("@/")) baseRel = "src/" + spec.slice(2);
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    const fromDir = fromRel.split("/").slice(0, -1).join("/");
    baseRel = normalizeRel(fromDir + "/" + spec);
  } else return null; // bare specifier (node_modules) — ignore
  const cands = [
    baseRel, // exact path — asset side-effect imports (.css/.scss/.json)
    baseRel + ".tsx",
    baseRel + ".ts",
    baseRel + "/index.tsx",
    baseRel + "/index.ts",
  ];
  for (const c of cands) {
    try {
      if (existsSync(join(root, c)) && statSync(join(root, c)).isFile()) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

// Capture every import specifier form: `... from "x"`, dynamic `import("x")`,
// re-export `export ... from "x"`, AND side-effect `import "x"` (no `from`, e.g.
// `import "../styles/global.css"`). The side-effect form was missed before, so
// global CSS fell out of the reverse-ref graph → CSS-only changes derived 0
// routes (cross-audit P1).
export function parseImportSpecifiers(text) {
  const specs = new Set();
  const src = String(text);
  for (const m of src.matchAll(/(?:import|export)\b[^'"]*?\bfrom\s*["']([^"']+)["']/g)) {
    specs.add(m[1]);
  }
  for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
    specs.add(m[1]);
  }
  for (const m of src.matchAll(/(?:^|[\n;{}])\s*import\s+["']([^"']+)["']/g)) {
    specs.add(m[1]);
  }
  return [...specs];
}

function importsOf(absFile) {
  let text;
  try {
    text = readFileSync(absFile, "utf8");
  } catch {
    return [];
  }
  return parseImportSpecifiers(text);
}

/**
 * Build file → routes-that-render-it via a static import graph rooted at route
 * special files. Conservative (over-approximates rather than misses).
 */
export function buildReverseRefs(root = process.cwd()) {
  const srcFiles = [];
  walkFiles(join(root, "src"), root, srcFiles, [".ts", ".tsx"]);
  const fwd = new Map();
  for (const f of srcFiles) {
    const deps = new Set();
    for (const spec of importsOf(join(root, f))) {
      const r = resolveImport(f, spec, root);
      if (r) deps.add(r);
    }
    fwd.set(f, deps);
  }
  const pageRoutes = listPageRoutes(root);
  const reverse = {};
  for (const f of srcFiles) {
    const s = routeForSpecialFile(f);
    if (!s) continue;
    const owned = ownedRoutes(s.special, s.segment, pageRoutes);
    if (owned.length === 0) continue;
    const seen = new Set([f]);
    const stack = [f];
    while (stack.length) {
      const cur = stack.pop();
      for (const dep of fwd.get(cur) ?? []) {
        if (!seen.has(dep)) {
          seen.add(dep);
          stack.push(dep);
        }
      }
    }
    for (const reached of seen) {
      (reverse[reached] ??= new Set());
      for (const r of owned) reverse[reached].add(r);
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(reverse)) out[k] = [...v].sort();
  return out;
}

export function getChangedFiles(baseRef, root = process.cwd()) {
  const set = new Set();
  const run = (args) => {
    try {
      return execFileSync("git", args, { cwd: root, encoding: "utf8" });
    } catch {
      return "";
    }
  };
  const add = (out) =>
    out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((f) => set.add(f.split("\\").join("/")));
  if (baseRef) add(run(["diff", "--name-only", baseRef]));
  add(run(["diff", "--name-only", "HEAD"]));
  add(run(["ls-files", "--others", "--exclude-standard"]));
  return [...set];
}

async function main() {
  const argv = process.argv.slice(2);
  const bi = argv.indexOf("--base");
  const baseRef = bi !== -1 ? argv[bi + 1] : null;
  const root = process.cwd();
  const changedFiles = getChangedFiles(baseRef, root);
  const pageRoutes = listPageRoutes(root);
  const reverseRefs = buildReverseRefs(root);
  const { requiredRoutes, excludedRoutes, overApproximated } =
    deriveRequiredRoutes({ changedFiles, pageRoutes, reverseRefs });
  process.stdout.write(
    JSON.stringify(
      {
        baseRef: baseRef ?? null,
        changedFiles,
        pageRoutes,
        requiredRoutes,
        excludedRoutes,
        overApproximated,
      },
      null,
      2,
    ) + "\n",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
