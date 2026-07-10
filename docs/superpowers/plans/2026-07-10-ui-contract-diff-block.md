# UI Contract Diff-Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development. Complete one RED/GREEN slice at a time and check the box only after reading the command output.

**Goal:** 기존 UI 부채는 baseline으로 보존하면서 신규 page-specific global CSS, raw visual token, AntD state 재구현, 공통 layout 우회를 차단하고 Page Recipe를 사람이 바로 적용할 수 있게 정리한다.

**Architecture:** TypeScript/TSX 의미는 현재 dependency인 TypeScript compiler API로, CSS는 PostCSS AST로 해석한다. scanner는 deterministic violation fingerprint multiset을 만든다. 로컬 `diff-block`은 committed candidate baseline을, CI는 base commit baseline을 ratchet authority로 사용한다. candidate baseline은 언제나 current scan과 exact match해야 하므로 baseline undercut과 stale baseline을 모두 막는다. 예외는 wildcard가 아니라 exact path/rule/fingerprint만 허용하며, base commit에 먼저 들어간 별도 approval이 있을 때만 다음 PR의 exact active exception이 한 건을 suppress할 수 있다. 제품 runtime과 `global.css` 자체는 이 Phase에서 수정하지 않는다.

**Tech Stack:** Node.js 24 ESM, TypeScript compiler API, PostCSS 8 AST, Vitest, GitHub Actions, JSON baseline/approval/exception manifest, Markdown SOT/QA report

---

## Scope and file map

- Create `scripts/lib/ui-contract.mjs`: parser, rule scanner, fingerprint, baseline/approval/exception pure contracts
- Create `scripts/check-ui-contract.mjs`: bounded collector, Git base reads, CLI output/exit codes
- Create `tests/scripts/check-ui-contract.test.mjs`: parser/rule/baseline/exception unit and CLI integration fixtures
- Create `config/ui-contract-baseline.json`: exact current debt fingerprint multiset
- Create `config/ui-contract-exception-approvals.json`: prior-policy-PR exact approvals; initially empty
- Create `config/ui-contract-exceptions.json`: active exact suppressions; initially empty
- Modify `DESIGN.md`: hierarchy, Korean reading, responsive hierarchy, primary action, Page Recipe
- Modify `docs/agent-workflow/ui.md`: checker modes, exact exception two-PR flow, Page Recipe selection
- Modify `docs/ant-design/07-review-checklist.md`: commands and desktop/mobile evidence boundary
- Append only `docs/sot-change-proposals/2026-07-10-codex-workflow-overhaul.md`: Phase 4 implementation history; do not make the superseded proposal an active owner
- Create `docs/qa/reports/2026-07-10-ui-contract-baseline.md`: baseline facts, bootstrap limitation, Phase 5 handoff
- Modify `package.json`, `.github/workflows/ci.yml`: report/diff-block scripts and CI base authority

## Fixed v1 decisions

1. `scannerVersion` and `schemaVersion` are fixed at `1` in this Phase. A later scanner rule change requires a separate STRICT two-stage migration plan; ordinary baseline regeneration cannot cross a version mismatch.
2. Candidate baseline fingerprints and derived summaries must exact-match the current post-exception scan in local/CI `diff-block` and `report --write-baseline`. Read-only `report` does not validate baseline freshness. `generatedAt` is informational and excluded from semantic equality.
3. In CI, base baseline is the ratchet authority. Current fingerprints must be a per-fingerprint subset of base. Therefore a same-PR source violation plus regenerated candidate baseline still fails.
4. Bootstrap is allowed only when the base commit lacks all three files—baseline, approval manifest, and active-exception manifest—and is reported as `BOOTSTRAP_NOT_INDEPENDENTLY_TAMPER_PROOF`. Partial presence is `UI_BOOTSTRAP_STATE_INVALID`. Bootstrap candidate approval/exception arrays must be empty. A missing/unreadable base ref, malformed base config, or version mismatch fails closed.
5. Active exceptions use exact normalized repo path, known rule ID, and 64-hex fingerprint. No glob or evidence regex is accepted. Each active exception must match exactly one current violation.
6. CI에서 현재 PR에 새로 추가한 approval은 아무것도 suppress할 수 없다. CI active exception은 동일한 exact approval이 base와 candidate manifest 양쪽에 존재해야 한다. 이 연속성은 approval만 삭제해 다음 PR을 깨뜨리는 것을 막고 `approval PR -> source/exception PR` 순서를 강제한다.
7. CLI output never prints source lines, full file contents, exception reason/removal text, environment values, or Git stderr. It may print normalized repo path, rule ID, line number, fingerprint prefix, count, exception ID, and stable error code.

### Mode and authority matrix

| Mode | Exception authority | Baseline behavior | Marker/exit |
| --- | --- | --- | --- |
| local `report` | candidate approval/exception을 preview authority로 적용 | baseline을 읽거나 freshness 검증하지 않음 | `LOCAL_NOT_BASE_AUTHORITY`; rule violation은 exit 0 |
| local `report --write-baseline` | candidate preview authority | effective current와 exact한 candidate baseline 생성 | `LOCAL_NOT_BASE_AUTHORITY`; config/I/O error만 exit 2 |
| local `diff-block` | candidate manifest를 advisory authority로 적용 | candidate = effective current exact 검증; candidate 자체 기준 | `LOCAL_NOT_BASE_AUTHORITY`; CI 보장을 주장하지 않음 |
| CI `diff-block` | candidate active exception + base/candidate 양쪽 exact approval | candidate = effective current exact 검증 후 base per-fingerprint ratchet | same-PR approval suppression 불가; new violation exit 1 |

공통 처리 순서는 `raw scan -> base/candidate approval 구조·날짜 검증 -> mode별 exception authorization/cardinality -> effective current -> candidate exact-current(해당 mode만) -> base ratchet(CI만)`이다.

### Task 1: parser and normalization foundation

**Files:** Create `scripts/lib/ui-contract.mjs`; create/test `tests/scripts/check-ui-contract.test.mjs`

- [x] **1.1 RED — TypeScript/PostCSS parser boundaries**

Write fixtures proving that TSX comments and ordinary strings containing `<main>`, `style={{}}`, `#fff`, or `bg-[#fff]` do not count, while actual multiline JSX and class expressions do. CSS comments do not count. Parse errors return `UI_CONTRACT_PARSE_ERROR`, not partial results.

Run: `pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs -t "parser foundation" --reporter=verbose --maxWorkers=1`

Expected: missing module/export failure.

- [x] **1.2 GREEN — parser adapters**

Implement `parseTypeScriptSource` with `typescript.createSourceFile` and extension-appropriate `ScriptKind.TS`, `TSX`, `JS`, or `JSX`; implement `parseCssSource` with `postcss.parse`. Preserve source positions for line numbers. Never use regex to decide TSX component/import/attribute semantics.

- [x] **1.3 RED/GREEN — deterministic paths and lexemes**

Add fixtures for LF/CRLF, Windows backslash/drive-case, spaces, Korean path segments, multiline formatting, and repeated identical violations. Implement POSIX repo path normalization, whitespace/control-character normalization, maximum 160-character matched lexeme, and SHA-256 fingerprint:

```text
sha256(scannerVersion + NUL + ruleId + NUL + posixRepoPath + NUL + semanticKey)
```

Line numbers and raw formatting must not be part of `semanticKey`. Same semantic violation across OS/newline/reformatting must yield the same fingerprint.

Run: `pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs -t "parser foundation|normalization" --reporter=verbose --maxWorkers=1`

Expected: PASS.

### Task 2: TypeScript/TSX rules, one RED/GREEN slice at a time

**Files:** Modify/test `scripts/lib/ui-contract.mjs`, `tests/scripts/check-ui-contract.test.mjs`

- [x] **2.1 `react.static-inline-style`**

RED fixtures: static JSX `style={{...}}`, AntD `styles={{...}}`, multiline object, object constant passed to the prop. Allowed fixtures: runtime-only geometry whose exact fingerprint is later approved, non-style object literals, comment/string examples.

GREEN: inspect JSX attributes and resolve same-file const object initializers only. Dynamic expressions are reported for review only when used by `style`/`styles`; do not scan arbitrary objects.

- [x] **2.2 `tailwind.arbitrary-visual` and TS visual literals**

RED fixtures: prohibited `bg/text/border/rounded/shadow/font/max-w-[...]` in `className`, template literal static segments, arrays, `.join(" ")`, project helpers `cn`, `clsx`, `classNames`, `twMerge`, and `cva`; raw color/radius/shadow/font values in recognized style/theme property contexts outside `src/theme/**` and the documented difficulty source.

Allowed fixtures: Korean prose containing `#fff`, arbitrary nonvisual utilities, values under the canonical theme source, dynamic variable names without a static prohibited token.

GREEN: traverse AST string/template nodes only when they are reachable from a recognized `className` expression/helper call or a recognized visual property. Do not scan all strings.

- [x] **2.3 `antd.shared-wrapper-bypass`**

RED fixtures: named import, named alias (`Card as AntCard`), namespace import plus `Antd.Card`, and `export { Card } from "antd"` outside wrapper definition files. Allowed fixtures: project wrapper named `Card`, type-only imports, approved wrapper definition files. Dynamic `import("antd")` resolving a protected component fails with `UI_CONTRACT_UNSUPPORTED_DYNAMIC_ANTD_IMPORT`; unrelated dynamic imports are ignored.

GREEN: use `ImportDeclaration`, `ExportDeclaration`, and property-access AST nodes. Protected names are `Card`, `Modal`, and `Drawer`; wrapper definition paths are an exact allowlist exported by the rule catalog.

- [x] **2.4 `workspace.extra-main` and `workspace.missing-body-recipe`**

RED fixtures: direct `<main>` and a workspace `page.tsx` whose render path contains neither `WorkspaceBody` nor a delegated local component/function that reaches it. Allowed fixtures: direct `WorkspaceBody`; a thin page returning an imported local component; a thin page calling an imported local render function; `@/` alias and relative imports.

GREEN: build a bounded repo-local import graph from the default page export's reachable return expressions. Follow only static relative or `@/` imports, at most 8 files/depth, cycle-safe, and only the referenced symbol. External, unresolved, wildcard, or over-depth delegation fails closed. Existing thin pages whose delegated component still uses raw `app-workspace-body` classes remain baseline debt rather than being falsely treated as compliant.

After each rule slice run its named test. At the end run:

`pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs -t "tsx rules" --reporter=verbose --maxWorkers=1`

Expected: all TSX rule fixtures PASS.

### Task 3: PostCSS rules and global debt freeze

**Files:** Modify/test `scripts/lib/ui-contract.mjs`, `tests/scripts/check-ui-contract.test.mjs`

- [x] **3.1 `visual.raw-color` and `visual.raw-radius-shadow-font`**

RED fixtures: raw color/radius/shadow/font declarations outside the documented canonical bridge. Allowed fixtures: declarations inside exact canonical `@theme inline`/theme bridge ownership and CSS variables consuming `--app-*` tokens. Use PostCSS declarations; do not scan comments or arbitrary text.

- [x] **3.2 `antd.broad-state-override`**

RED fixtures: `.ant-*` combined with hover/active/focus/focus-visible/selected/disabled states, including comma and nested at-rule contexts. Allowed fixture: project class state that does not target AntD.

- [x] **3.3 `global-css.selector-freeze` and `global-css.declaration-freeze`**

Fingerprint both normalized selector multiset and each `(selector, property, normalized value, important)` declaration multiset in `src/styles/global.css`. Use a quote/bracket/escape-aware lexical normalizer for selector whitespace around commas/combinators and declaration whitespace; it must not rewrite token content or infer selector meaning. Existing selector plus new property or changed value must FAIL. Comment/whitespace/reformatting/declaration reorder must PASS. Duplicate declarations retain multiset counts. Adding/removing debt is distinguished by the baseline ratchet.

Run: `pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs -t "css rules" --reporter=verbose --maxWorkers=1`

Expected: all PostCSS rule fixtures PASS.

### Task 4: exact baseline and anti-poisoning authority

**Files:** Modify/test `scripts/lib/ui-contract.mjs`, `tests/scripts/check-ui-contract.test.mjs`

- [x] **4.1 RED — baseline schema and exact-current invariant**

Fixtures must reject missing/unknown fields, negative/non-integer counts, invalid fingerprint, wrong schema/scanner version, summary mismatch, same-total fingerprint swap, candidate undercut, candidate overcount, and baseline-only decrease with unchanged source. Use stable codes such as `UI_BASELINE_INVALID`, `UI_BASELINE_CURRENT_MISMATCH`, and `UI_BASELINE_VERSION_MISMATCH`.

- [x] **4.2 GREEN — candidate exact current**

Implement `createUiContractBaseline`, `validateUiContractBaseline`, and `assertCandidateMatchesCurrent`. Fingerprints and counts must match current violations exactly; `summaryByRule`/`summaryByPath` are recomputed and compared.

- [x] **4.3 RED/GREEN — base ratchet and bootstrap**

Implement `compareAgainstBase(current, base)` per fingerprint. Current may remove/decrease existing fingerprints but may not add/increase any. Candidate is still exact current. Only the all-three-files-absent base tuple selects exact-current candidate for bootstrap and emits the explicit marker. Base ref unreadable, partial config tuple, malformed baseline, or version mismatch is not bootstrap.

Run: `pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs -t "baseline authority" --reporter=verbose --maxWorkers=1`

Expected: poisoning/swap/bypass fixtures PASS by asserting their rejection.

### Task 5: exact two-stage exceptions and redacted reports

**Files:** Modify/test `scripts/lib/ui-contract.mjs`, `tests/scripts/check-ui-contract.test.mjs`; create three `config/*.json` files after GREEN

- [x] **5.1 RED — schema, dates, and cardinality**

Approval schema fields: `id`, exact `path`, known `ruleId`, 64-hex `fingerprint`, `owner`, `reason`, `createdDate`, `expiresDate`, `removalCondition`, `regressionEvidence`. Active exception fields: `id`, `approvalId`. Reject unknown/empty fields, duplicate IDs or fingerprint ownership, absolute/traversal paths, invalid/non-UTC dates, expiry before creation, expiry over 90 days, and secret-like metadata. Candidate manifests may not retain an expired approval/exception. Base manifests receive structural validation, but an expired base approval is inert and non-authoritative so a cleanup PR can remove it. Dates use an injected UTC clock in unit tests; CLI exposes no `--today` override.

- [x] **5.2 RED/GREEN — base approval authority**

CI applies candidate active exceptions only if the same unexpired exact approval exists in both the base and candidate approval manifests. A same-PR candidate approval is validation-only and cannot suppress. Local modes use candidate approval/exception manifests as preview/advisory authority and print `LOCAL_NOT_BASE_AUTHORITY`. An active exception must match exactly one current violation; zero or over one returns `UI_EXCEPTION_CARDINALITY`. Unused candidate approvals are allowed because they are staged policy decisions, but expire within 90 days.

Fixtures:

1. base approval + candidate active exception + exact runtime geometry violation => PASS;
2. CI authority에서 same-PR approval + exception + violation => FAIL; local preview는 marker와 함께 PASS 가능;
3. approval path/rule/fingerprint mismatch => FAIL;
4. candidate approval 삭제 + active exception 유지 => FAIL;
5. expired base approval + candidate approval/exception/source violation 동시 제거 => PASS;
6. expired candidate approval 유지 => exit 2;
7. expired base approval로 suppression 시도 => FAIL;
8. zero/duplicate match => FAIL.

- [x] **5.3 RED/GREEN — output redaction and exit class**

Public report rows contain only path, ruleId, line, 12-character fingerprint prefix, and count. Config errors contain only manifest kind, ID, and stable error code. Add a fixture with a fake token in source/evidence/reason/Git stderr and assert it is absent from text and JSON output. Rule violations produce exit `1` only in `diff-block`; parse/I/O/config/expired exception errors produce exit `2` in both `report` and `diff-block`.

| Condition | Exit |
| --- | --- |
| `UI_BASELINE_CURRENT_MISMATCH`, base ratchet new violation | `1` |
| `UI_EXCEPTION_CARDINALITY`, unauthorized active exception | `1` |
| malformed schema/config, expired candidate approval, parse/I/O/Git authority error | `2` |

Run: `pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs -t "exceptions|redaction" --reporter=verbose --maxWorkers=1`

Expected: PASS.

### Task 6: bounded collector, Git base read, and CLI

**Files:** Create/modify/test `scripts/check-ui-contract.mjs`, `tests/scripts/check-ui-contract.test.mjs`

- [x] **6.1 RED/GREEN — collector containment**

Canonicalize repo root once. Collect only regular `.ts`, `.tsx`, `.js`, `.jsx`, `.css` files below `src/`, with deterministic POSIX ordering. Reject symlink/junction entries, root escape, invalid UTF-8, files over 2 MiB, and more than 20,000 files. Do not follow filesystem links. Add Windows space/non-ASCII/backslash/drive-case fixtures and a symlink/junction escape fixture where supported; unsupported link creation must be an explicit test skip with diagnostic.

- [x] **6.2 RED/GREEN — env/argv base-ref resolution**

Implement `resolveBaseRef(argv, env)`. `--base-ref` and `UI_CONTRACT_BASE_REF` accept only a 40-hex SHA; if both exist they must match. In `CI=true` + `diff-block`, missing/malformed/mismatched base ref fails `UI_BASE_REF_REQUIRED`/`UI_BASE_REF_MISMATCH`. Local runs may omit it.

- [x] **6.3 RED/GREEN — exact Git object classification**

Run Git with `spawnSync`, `shell:false`, fixed `cwd`, argv array, timeout 5 seconds, bounded `maxBuffer`, and no stderr passthrough. First run `git cat-file -e <sha>^{commit}`. Only after commit existence succeeds may `git show` read the baseline, approval manifest, and active-exception manifest. All three paths absent means bootstrap; all three present means normal authority; partial presence returns `UI_BOOTSTRAP_STATE_INVALID`. In bootstrap, candidate approval and active-exception arrays must both be empty. Once the baseline exists, a missing/malformed companion manifest is exit `2`. Any other Git failure is also exit `2`. Git object paths always use `/`.

- [x] **6.4 GREEN — CLI modes**

Implement:

```text
node scripts/check-ui-contract.mjs --mode report [--format text|json]
node scripts/check-ui-contract.mjs --mode diff-block [--format text|json] [--base-ref <40-hex>]
node scripts/check-ui-contract.mjs --mode report --write-baseline config/ui-contract-baseline.json
```

`--write-baseline` is legal only in local `report` mode with the exact repository-relative output path. Unknown args fail. Env-only CI integration must prove the base is used even when candidate baseline is regenerated with a new violation. Integration fixtures cover the all-absent bootstrap tuple, invalid partial tuple, and normal all-present tuple.

Run: `pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs -t "collector|CLI|Git base" --reporter=verbose --maxWorkers=1`

Expected: PASS.

### Task 7: generate the real baseline twice and prove stability

**Files:** Create `config/ui-contract-baseline.json`, `config/ui-contract-exception-approvals.json`, `config/ui-contract-exceptions.json`

- [x] **7.1 Create empty approval and active exception manifests after schema tests pass**

Both manifests use `schemaVersion: 1` and empty arrays. Do not add a production exception during bootstrap.

- [x] **7.2 Generate baseline run A**

Run: `node scripts/check-ui-contract.mjs --mode report --format json --write-baseline config/ui-contract-baseline.json`

Expected: exit 0, existing debt reported, baseline written.

- [x] **7.3 Generate baseline run B and compare bytes/fingerprints**

Copy run A hash in memory, rerun the exact command, and compare file SHA-256 plus fingerprint/rule/path summaries. The writer preserves existing `generatedAt` when semantic fingerprint content is unchanged and replaces it with the injected/current UTC timestamp only when semantic content changes. Serialize recursively sorted object keys, sorted path/rule/fingerprint entries, two-space indentation, and one final LF. Two runs without source changes must be byte-identical.

- [x] **7.4 Local diff-block**

Run: `node scripts/check-ui-contract.mjs --mode diff-block`

Expected: PASS, candidate exact current, new violations 0.

### Task 8: active UI SOT and Page Recipe contract

**Files:** Modify `DESIGN.md`, `docs/agent-workflow/ui.md`, `docs/ant-design/07-review-checklist.md`; append-only proposal history

Before editing, report to the user: target documents, reason, and direction. The approved A plan is the authorization; do not change product behavior.

- [x] **8.1 `DESIGN.md` hierarchy contract**

Document existing runtime anchors and forward contract:

| Role | Contract |
| --- | --- |
| Page title | existing `PageHeader`/`ReportPageHeader`, one `h1`, current 24px/1.35/600 anchor |
| Section title | one section purpose, 18px/1.45/600 target |
| Card title | `AppCard` title/extra; no ad-hoc duplicate header row |
| Korean reading | 16px minimum, about 1.7 line-height, reading width about 760px; no arbitrary `max-w-[...]` |
| Helper/status | current 14px/1.57 anchor, semantic secondary token; never color-only meaning |

One primary action per task area. Desktop title/actions share a header axis where space allows; mobile wraps actions below without shrinking hierarchy.

- [x] **8.2 Page Recipe matrix**

Document `workspace`, `form`, `reading`, `task`, `wide`, `full`, `public/auth`, and `empty/error` recipes with shell/body/header/surface/action/state owner. The reading variant is documentation-only until its first Phase 5 consumer; do not add unused runtime API.

- [x] **8.3 checker/exception workflow**

Document `pnpm report:ui-contract`, `pnpm check:ui-contract`, candidate exact-current rule, base ratchet, bootstrap limitation, and `approval PR -> source/active-exception PR`. Explicitly forbid baseline increase, CI same-PR approval suppression, wildcard exceptions, and scanner v1 migration without a STRICT plan. Local preview/advisory PASS는 CI authorization 증거가 아님을 함께 적는다.

- [x] **8.4 review checklist and history**

Add the command/evidence checklist and desktop/mobile boundary. Append a Phase 4 implementation-history section to the superseded proposal; do not rewrite its decision. Record that active owners remain `DESIGN.md`, `docs/agent-workflow/ui.md`, and `docs/ant-design/07-review-checklist.md`, with no registry path/status change.

### Task 9: package, CI, and baseline QA report

**Files:** Modify `package.json`, `.github/workflows/ci.yml`; create `docs/qa/reports/2026-07-10-ui-contract-baseline.md`

- [x] **9.1 package scripts**

```json
{
  "report:ui-contract": "node scripts/check-ui-contract.mjs --mode report",
  "check:ui-contract": "node scripts/check-ui-contract.mjs --mode diff-block"
}
```

- [x] **9.2 CI base authority**

Set `fetch-depth: 0` on the Linux verify checkout only. Add after policy checks:

```yaml
- name: Check UI contract diff baseline
  env:
    UI_CONTRACT_BASE_REF: ${{ github.event.pull_request.base.sha || github.event.before }}
  run: pnpm check:ui-contract
```

The CLI, not shell interpolation, reads the env. Windows lifecycle job does not duplicate the UI checker.

- [x] **9.3 QA report**

Record total/rule/path counts, `global.css` selector and declaration counts, zero production exceptions, deterministic double-run evidence, bootstrap limitation, future base-authority behavior, new-violation fixture examples, active SOT owners, registry unchanged, and Phase 5 priority candidates. Do not record absolute local paths, task/thread IDs, source evidence, or secrets.

### Task 10: full verification, critic, and publish

**Files:** Check off this plan; update draft PR #39 only after all evidence is read

- [x] `pnpm check:ui-contract`
- [x] `pnpm report:ui-contract`
- [x] `pnpm exec vitest run tests/scripts/check-ui-contract.test.mjs --reporter=verbose --maxWorkers=1`
- [x] `pnpm check:sot-registry`
- [x] `pnpm check:agent-skill-policy`
- [x] `pnpm check:worktree-lifecycle`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] Prettier all changed files, `git diff --check`, changed-file secret-like filename/content scan
- [x] Confirm product route output and `src/styles/global.css` bytes are unchanged; this policy/checker phase does not substitute Playwright evidence for a runtime change
- [x] Independent critic rechecks AST boundaries, selector/declaration freeze, baseline swap/undercut/poisoning, env-to-CLI authority, bootstrap classification, exception approval authority/cardinality, output redaction, collector containment, Windows path behavior, and SOT/Phase 5 boundary
- [x] Re-run targeted tests after critic fixes
- [ ] Commit with Lore trailers, push `codex/workflow-overhaul`, update draft PR #39 against `main`, and read CI result; never target or modify `collab`

### Task 10A: critic NO-GO remediation

- [x] Add RED fixtures for const/local-helper/repo-import inline-style mutation, lexical shadowing/loop initializer scope, AntD subpath/star/CommonJS/type-only exports, `page.jsx`, CSS custom property/at-rule declaration/named and modern functional colors/non-`--app-*` variables/URL-string exclusion, invalid-ID redaction, failed baseline write mutation, non-ASCII ordering, and comma-selector order
- [x] Resolve const-bound inline-style fingerprint content and protected AntD/module/page extension AST boundaries
- [x] Scan raw custom-property visual values and freeze all `global.css` declarations with at-rule ancestry
- [x] Redact invalid public IDs and refuse baseline writes when policy errors exist
- [x] Replace locale-dependent ordering and canonicalize comma selector lists
- [x] Clarify verified Phase 5 debt-reduction baseline updates and bootstrap repository-protection assumptions
- [x] Regenerate the bootstrap baseline twice, update the QA counts/hash, and prove current diff-block exactness
- [x] Independent critic re-review returns GO with Critical 0 / Important 0 / Minor 0

## Rollback

Phase 4 is one policy/checker commit group. Rollback removes the scanner/library/tests/config manifests, package/CI wiring, active UI SOT additions, QA report, and append-only implementation history. It must not touch product data, Supabase, worktrees, branches, runtime components, or existing `global.css` debt.
