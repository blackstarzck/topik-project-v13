import { readFileSync } from "node:fs";
const c = readFileSync("docs/qa/reports/qa-report-20260612-1205.html", "utf8");
for (const tag of ["span", "td", "tr", "div", "table", "h2", "h3"]) {
  const open = (c.match(new RegExp(`<${tag}(?=[\\s>])`, "g")) || []).length;
  const close = (c.match(new RegExp(`</${tag}>`, "g")) || []).length;
  console.log(`${tag.padEnd(6)} open=${open} close=${close} ${open === close ? "OK" : "DIFF " + (open - close)}`);
}
// locate stray </span> or unclosed <span by simple stack on span only
let depth = 0, line = 1, firstBad = null;
const re = /<span(?=[\s>])|<\/span>|\n/g;
let m;
while ((m = re.exec(c))) {
  if (m[0] === "\n") { line++; continue; }
  if (m[0] === "</span>") { depth--; if (depth < 0 && !firstBad) firstBad = `extra </span> at line ${line}`; }
  else depth++;
}
console.log("span final depth:", depth, firstBad || "");
