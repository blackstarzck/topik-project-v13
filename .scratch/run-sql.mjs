// 안전한 Supabase Management API SQL 실행 헬퍼.
// .env.local 에서 SUPABASE_ACCESS_TOKEN 을 읽고(시크릿은 절대 출력하지 않음),
// supabase/.temp/project-ref 에서 프로젝트 ref 를 읽어
// POST /v1/projects/{ref}/database/query 로 SQL 파일을 실행한다.
//
//   node .scratch/run-sql.mjs <sql-file-path>
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function parseEnvLocal() {
  const out = {};
  try {
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      out[k] = v;
    }
  } catch {
    // ignore
  }
  return out;
}

const env = parseEnvLocal();
const token = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
const ref = readFileSync(
  path.join(root, "supabase", ".temp", "project-ref"),
  "utf8",
).trim();

if (!token) {
  console.error("MISSING_ACCESS_TOKEN");
  process.exit(2);
}

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("USAGE: node run-sql.mjs <sql-file>");
  process.exit(2);
}
const query = readFileSync(sqlPath, "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);

const text = await res.text();
console.log("HTTP_STATUS:", res.status);
console.log("BODY:", text);
