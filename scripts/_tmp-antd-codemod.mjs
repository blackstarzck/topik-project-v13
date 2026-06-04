// Deterministic TS-AST codemod for antd 6 deprecated -> recommended pure renames.
// Scoped by JSX component tag (no false positives on Flex.direction etc.).
// Excludes admin (frozen island). Skips when the target prop already present.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

// component base tag -> { oldProp: newProp }  (pure attribute-name renames only)
const RENAMES = {
  Space: { direction: "orientation" }, // also covers Space.Compact (base = Space)
  Steps: { direction: "orientation" },
  Alert: { message: "title" },
  Spin: { tip: "description" },
};

const lint = JSON.parse(fs.readFileSync("errors/antd-deprecated.json", "utf8"));
const RENAME_KINDS = new Set([
  "Space.direction",
  "Steps.direction",
  "Alert.message",
  "Spin.tip",
]);

// Collect non-admin files that the linter flagged with a pure-rename kind.
const files = new Set();
for (const it of lint.issues) {
  const m = it.message.match(/^(\w+) `([^`]+)`/);
  const kind = m ? `${m[1]}.${m[2]}` : "";
  if (!RENAME_KINDS.has(kind)) continue;
  if (it.file.includes("\\admin\\") || it.file.includes("/admin/")) continue;
  files.add(it.file.replace(/\\/g, "/"));
}

function baseTag(tagNode) {
  if (ts.isIdentifier(tagNode)) return tagNode.text;
  if (ts.isPropertyAccessExpression(tagNode)) {
    // Space.Compact -> "Space"
    let e = tagNode.expression;
    while (ts.isPropertyAccessExpression(e)) e = e.expression;
    return ts.isIdentifier(e) ? e.text : null;
  }
  return null;
}

const summary = {};
let totalEdits = 0;

for (const file of [...files].sort()) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = []; // {start, end, text}

  function handleOpening(opening) {
    const tag = baseTag(opening.tagName);
    const map = tag && RENAMES[tag];
    if (!map) return;
    const attrs = opening.attributes.properties;
    const present = new Set();
    for (const a of attrs) {
      if (ts.isJsxAttribute(a) && a.name && ts.isIdentifier(a.name)) present.add(a.name.text);
    }
    for (const a of attrs) {
      if (!ts.isJsxAttribute(a) || !a.name || !ts.isIdentifier(a.name)) continue;
      const oldName = a.name.text;
      const newName = map[oldName];
      if (!newName) continue;
      if (present.has(newName)) {
        console.warn(`SKIP (target exists): ${file} <${tag} ${oldName}/> already has ${newName}`);
        continue;
      }
      edits.push({ start: a.name.getStart(sf), end: a.name.getEnd(), text: newName });
      const key = `${tag}.${oldName}`;
      summary[key] = (summary[key] || 0) + 1;
    }
  }

  function walk(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) handleOpening(node);
    ts.forEachChild(node, walk);
  }
  walk(sf);

  if (edits.length === 0) continue;
  edits.sort((a, b) => b.start - a.start); // apply descending
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  fs.writeFileSync(file, out);
  totalEdits += edits.length;
  console.log(`${String(edits.length).padStart(3)} edits  ${file}`);
}

console.log("\n=== SUMMARY by kind ===");
for (const [k, v] of Object.entries(summary).sort()) console.log(String(v).padStart(3), k);
console.log(`TOTAL edits: ${totalEdits} across ${files.size} files`);
