# Capture-phase ground-truth findings (2026-06-09) — carry-forward for the 2-layer review

> **2026-06-09 RE-VERIFICATION CORRECTION**: The "D-02 q52 BLOCKED → admin content gap" framing below was
> OVER-GENERALIZED. Re-check: q53 (46/47) and q54 (81/82) published problems are COMPLETE and render fine
> with a real problem id. The "blocked" state only appears because `getWritingProblem` picks with
> `.limit(1)` and NO `ORDER BY` → direct/deep-link entry loads an empty seed example (`2222/3333/4444`).
> Real cause = (a) unordered default pick + (b) empty seed examples are published. q52 IS a genuine
> exception (its only published problem is the empty placeholder). See README §0/§4 (corrected).

These are facts established during Phase-1 capture that a screenshot-only reviewer
would MISS (console errors, DB state, trigger reachability). Feed into Layer 2.
All evidence under `.design-review-shots/20260609/` (gitignored).

## Console / runtime errors (from `_health.json`)
- **X-16 (`/password-reset/confirm`)** — `pageerror: Hydration failed because the
  server rendered HTML didn't match the client`. ROOT CAUSE: the page renders a
  time-based expiry string "약 60분 후 (12:19쯤) 만료돼요" computed at render time, so
  SSR vs client differ. Page still renders (React regenerates) but it's a real
  hydration error on every load. Severity P1. Visible in 38-X-16-*.png ("1 Issue" badge).
- **X-11 (`/auth/error?reason=otp_expired`)** — console.error `legacyBehavior is
  deprecated` (a `<Link legacyBehavior>`). The rate-limit variant has NO error →
  the deprecated Link is on the otp branch only. Severity P2 (tech-debt).
- **D-02 (q52) & D-04 (q54) writing** — console.error `[antd: Alert] 'message' is
  deprecated. Please use 'title' instead.` Source: `WritingEditor.tsx:235` (and the
  q54 LongFormEditor equivalent) — the submit-blocked Alert uses `message=`. Only
  fires when the blocked Alert renders (i.e. only on broken-data problems). antd6
  migration gap. Severity P2.

## Data / content findings
- **D-02 (q52) is BLOCKED for the user**: screenshot shows 작성 조건 = "조건 정보를
  불러오지 못했어요" + warning "문제 조건을 불러오지 못해 제출할 수 없어요" + 임시저장/제출하기
  BOTH disabled. The only published q52 problem is the placeholder `2222...` whose
  condition/rubric data is incomplete. Ties to the known **admin content-authoring
  gap** (writing-questionbank-reconciliation, 2026-06-09). Severity P1 (screen
  unusable for q52). Evidence 09-D-02-*.png.
- **Double prefix in q52 title**: "52번 — TOPIK 52번 — 설명문 빈칸 쓰기 (예시)" — redundant
  "52번 —". Label/content bug. (Check q53/q54 titles for the same pattern.)
- **F-M1 PDF preview shows raw UUID**: "문제 11111111 · 답안 · 피드백" — the preview prints
  the truncated problem UUID instead of a human title / "51번". Severity P2. Evidence
  19-F-M1-*.png.
- **C-02 solve-state does NOT reflect writing_submissions**: the student has 5
  submissions (problems 1111..–4444..) but `problem_attempts` is EMPTY, and
  `list_user_problems` derives solve_state from attempts → every row (incl. the exact
  problems submitted) shows "시작하기", never "다시 풀기". Verified 3 ways (solve=solved
  filter, default list, title search). Consequence: **C-03 retry modal is unreachable**
  via normal navigation with current data → captured as DEFERRED. Open question for the
  review: is this a seed-data gap (submissions without attempts) or a product
  inconsistency? Evidence _diag-c03-search.png.

## Schema / environment observations (read-only; review does NOT change schema)
- `problems.lifecycle_status` column does NOT exist in this dev DB (PostgREST:
  "column problems.lifecycle_status does not exist"). Matches memory note that
  migrations #31/#32 (lifecycle_status/lifecycle_reason) are "pending Docker env".
  UI tolerates it via `row.lifecycle_status ?? "active"`, so screens render. This is a
  schema-vs-docs lag observation, not a user-screen defect.

## Capture heuristic caveats (do NOT mislabel)
- `02-A-02-login*` flagged "LOGIN-REDIRECT" is a FALSE POSITIVE: the login page's own
  finalUrl is `/login`, which the redirect heuristic trivially matches. The page is
  fully hydrated (Segmented control, password show/hide all work). Treat as OK.
- Korean innerText is dense → a low `bodyTextLen` (e.g. login=107) is NOT thin content.
  Judge by the screenshot, not bodyLen.
- The small dark "N"/"1 Issue" badge bottom-left is the Next.js dev indicator, not a
  page chrome element. "1 Issue" means dev logged 1 console issue (see errors above).

## Deferred captures (evaluate from component source + SOT)
- **C-03 retry modal** — unreachable (see solve-state finding). Source: `RetryModal.tsx`.
- **D-M2 AI-analysis loading** — transient (mock feedback resolves sub-second); not
  attempted live. Source: `AnalysisLoadingModal.tsx` / `FeedbackPendingPanel.tsx`.
