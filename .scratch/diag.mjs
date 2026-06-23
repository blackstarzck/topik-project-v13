import { readFile } from "node:fs/promises";
const p = "C:\\Users\\admin\\AppData\\Local\\Temp\\claude\\C--Users-admin-Desktop-workspace-topik-project-v13\\31ebb429-5815-4ca2-b480-2952220e284b\\tasks\\wd53c7odh.output";
const raw = await readFile(p, "utf8");
console.log("len", raw.length);
console.log("first300:", JSON.stringify(raw.slice(0, 300)));
console.log("idxScreens", raw.indexOf('"screens"'));
console.log("idxCritic", raw.indexOf('"critic"'));
console.log("lines", raw.split("\n").length);
try { const d = JSON.parse(raw); console.log("topkeys", Object.keys(d)); console.log("screensLen", d.screens?.length); }
catch (e) { console.log("parseErr", e.message); }
