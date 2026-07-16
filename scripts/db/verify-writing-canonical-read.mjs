#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex < 1) continue;
      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // The explicit validation below reports missing inputs without exposing them.
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const email = process.env.E2E_STUDENT_EMAIL?.trim();
const password =
  process.env.E2E_STUDENT_PASSWORD?.trim() ||
  process.env.SUPABASE_TEST_PASSWORD?.trim();
const samples = Number(process.env.WRITING_CANONICAL_SAMPLES ?? 20);

if (!url || !publishableKey || !email || !password) {
  throw new Error(
    "Supabase URL, publishable key, and E2E student credentials are required.",
  );
}
if (!Number.isInteger(samples) || samples < 5 || samples > 100) {
  throw new Error("WRITING_CANONICAL_SAMPLES must be an integer from 5 to 100.");
}

const client = createClient(url, publishableKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});
const signedIn = await client.auth.signInWithPassword({ email, password });
if (signedIn.error) throw new Error("E2E student sign-in failed.");

const allowedKeys = new Set([
  "problem_id",
  "question_id",
  "canonical_import_id",
  "payload_hash",
  "item_number",
  "topik_level",
  "difficulty",
  "title",
  "prompt",
  "tags",
  "materials",
  "source_created_at",
  "source_updated_at",
]);
const latencies = [];
const countsByQuestion = new Map();
const seenProblemIds = new Set();

for (let sample = 0; sample < samples; sample += 1) {
  for (const questionNo of [51, 52, 53, 54]) {
    const startedAt = performance.now();
    const result = await client.rpc("get_available_writing_questions", {
      p_item_number: questionNo,
      p_problem_id: null,
    });
    latencies.push(performance.now() - startedAt);
    if (result.error) {
      throw new Error(`Canonical Q${questionNo} read failed.`);
    }
    const rows = result.data ?? [];
    if (rows.length === 0) {
      throw new Error(`Canonical Q${questionNo} returned no public rows.`);
    }
    const previousCount = countsByQuestion.get(questionNo);
    if (previousCount != null && previousCount !== rows.length) {
      throw new Error(`Canonical Q${questionNo} count changed during sampling.`);
    }
    countsByQuestion.set(questionNo, rows.length);

    if (sample === 0) {
      for (const row of rows) {
        const unexpectedKeys = Object.keys(row).filter(
          (key) => !allowedKeys.has(key),
        );
        if (unexpectedKeys.length > 0) {
          throw new Error("Canonical learner RPC exposed unexpected fields.");
        }
        if (seenProblemIds.has(row.problem_id)) {
          throw new Error("Canonical learner RPC returned a duplicate problem_id.");
        }
        seenProblemIds.add(row.problem_id);
      }
    }
  }
}

const mirrorResult = await client
  .from("problems")
  .select("id", { count: "exact", head: true })
  .eq("domain", "writing");
if (mirrorResult.error) throw new Error("Writing mirror absence check failed.");
if ((mirrorResult.count ?? -1) !== 0) {
  throw new Error("public.problems still contains writing rows.");
}

const controlResult = await client.rpc("get_writing_submission_control");
if (controlResult.error) throw new Error("Submission control read failed.");
const control = Array.isArray(controlResult.data)
  ? controlResult.data[0]
  : controlResult.data;
if (
  control?.submission_mode !== "blocked" ||
  control?.submission_contract_state !== "unverified"
) {
  throw new Error("Submission control is not blocked + unverified.");
}

const orderedLatencies = latencies.slice().sort((a, b) => a - b);
const p95 =
  orderedLatencies[Math.max(0, Math.ceil(orderedLatencies.length * 0.95) - 1)];

console.log(
  JSON.stringify({
    event: "writing_canonical_read_evidence",
    projectRef: new URL(url).hostname.split(".")[0],
    samples,
    counts: Object.fromEntries(countsByQuestion),
    uniqueProblemCount: seenProblemIds.size,
    p95Ms: Number(p95.toFixed(3)),
    mirrorWritingRows: 0,
    submissionMode: "blocked",
    submissionContractState: "unverified",
    unexpectedLearnerFields: 0,
    passed: true,
  }),
);
