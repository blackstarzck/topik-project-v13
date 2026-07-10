# Codex Lifecycle Report-only Implementation Plan

> **For agentic workers:** Use `executing-plans` and `test-driven-development`. This phase may inspect and report worktree state, but it must not remove worktrees or branches, acquire cleanup leases, or schedule cleanup supervisors.

**Goal:** Phase 2로 승인된 Codex lifecycle의 최소 task registry, 상태 전이, worktree 분류와 read-only inventory를 구현해 오래된 작업을 삭제 없이 안전하게 드러낸다.

**Architecture:** lifecycle state와 inventory disposition을 분리하고, 규칙은 side effect가 없는 상태 전이·분류 함수로 구현한다. registry writer는 report CLI와 다른 module로 격리하고, production capability는 `$CODEX_HOME/worktree-lifecycle/<repo-id>`만 허용한다. registry 저장은 canonical path·repo/task ID를 검증하고 per-record write lock, revision 비교, unique `wx` temporary file, fsync와 atomic rename을 사용하며, 테스트 capability는 OS temp directory만 주입한다. 실제 inventory CLI는 registry writer·network·timer·watcher를 import하지 않고, shell 없이 allowlist된 Git read-only 명령의 NUL-delimited porcelain만 파싱해 Markdown 또는 JSON 보고서만 stdout에 출력한다. GitHub PR, process/lock, owner, ignored-file 증거 중 하나라도 없거나 오래됐으면 `REVIEW_CANDIDATE`가 아니라 `NEEDS_ATTENTION`으로 분류한다. 모든 출력에는 `cleanupReady:false`와 “review-only; deletion not authorized”를 고정한다.

**Tech Stack:** Node.js 24, JavaScript ES modules, Git porcelain output, Vitest, pnpm

---

## Scope boundary

허용 범위는 registry schema 검증, synthetic 상태 전이, atomic record write, read-only Git inventory, report 렌더링, package/CI 검증 연결이다. 실제 `$CODEX_HOME` registry 쓰기는 사용자가 CLI로 명시적으로 요청할 때만 가능하도록 라이브러리 표면으로 남기고, 이번 실행 검증은 temp directory만 사용한다.

다음은 이 phase에서 금지한다.

- `git worktree remove`, `git worktree prune`, branch delete, `--force`
- cleanup lease, monitor, supervisor, task archive 자동화
- report mode에서 `FINALIZING`, `CLEANED` 전이 또는 `cleanupAuthorized=true`
- PR merge 상태를 commit ancestry만으로 추정
- owner, PR state, ignored-sensitive 상태가 불명확한 후보를 safe로 분류
- 기존 legacy inventory의 경로를 현재 사실처럼 재사용
- registry에 저장된 PR/owner hint를 live safety evidence로 승격

### Task 1: 계약 테스트를 RED로 고정

**Files:**

- Create: `tests/scripts/worktree-lifecycle.test.mjs`
- Create: `tests/scripts/report-worktree-lifecycle.test.mjs`

- [x] 최소 schema의 필수 필드, unknown/nested secret-like field 거부, 유효/무효 lifecycle 전이를 테스트한다.
- [x] report mode에서 `FINALIZING`/`CLEANED` 전이와 `cleanupAuthorized=true`가 어떤 입력에서도 거부되는지 테스트한다.
- [x] atomic write가 temp directory 안에서 완전한 JSON만 남기고 unique `wx` temporary file/write lock을 정리하며, 동일 revision 동시 쓰기 중 하나만 성공하는지 테스트한다.
- [x] write/fsync/rename 실패를 주입해 기존 valid record가 보존되고 temp/lock만 정리되는지, read-during-write가 old/new 완전한 JSON 중 하나만 보는지, Windows replace failure가 fail-closed하는지 테스트한다.
- [x] `repoId`/`taskId`의 traversal, slash/backslash, UNC/ADS 형태, trailing dot/space, Windows reserved name과 registry symlink/junction escape를 거부하는 fixture를 둔다.
- [x] production root가 `$CODEX_HOME/worktree-lifecycle/<repo-id>` 밖이거나 Git common dir/어떤 linked worktree와 포함 관계이면 거부하고, Windows case-insensitive canonical containment를 테스트한다.
- [x] 기존 target이 같은 schema/repo/task의 valid registry가 아니면 덮어쓰지 않는다.
- [x] corrupt/oversized record와 모든 nested object의 additional property, prototype-pollution key를 fail-closed로 처리하는지 테스트한다.
- [x] secret sentinel이 validation error, stdout/stderr, rendered report에 나오지 않는지 테스트한다.
- [x] detached clean/dirty, named branch conflict, untracked, ignored-sensitive, current/base checkout, process/lock unknown, PR open/merged/closed/unknown/stale fixture를 분류한다.
- [x] dirty, unknown owner, unknown PR state는 항상 `NEEDS_ATTENTION`으로 가는 것을 고정한다.
- [x] Markdown/JSON 보고서가 owner, 보존 이유, 재검토 조건을 포함하고 cleanup 명령을 포함하지 않는지 테스트한다.
- [x] Run RED: `pnpm exec vitest run tests/scripts/worktree-lifecycle.test.mjs tests/scripts/report-worktree-lifecycle.test.mjs --reporter=verbose --maxWorkers=1`

### Task 2: 최소 registry와 상태 전이 구현

**Files:**

- Create: `scripts/lib/task-lifecycle-schema.mjs`
- Create: `scripts/lib/task-lifecycle-registry.mjs`
- Create: `scripts/lib/worktree-lifecycle.mjs`

- [x] schema version 1과 active/terminal state 목록을 한 소스에 정의한다.
- [x] `validateTaskRecord`, `transitionTaskRecord`, `writeTaskRecordAtomic`, `readTaskRecords`를 최소 구현한다.
- [x] 전이는 현재 상태와 evidence를 검증하며 입력 객체를 mutate하지 않는다.
- [x] top-level과 모든 nested object에 exact key/type/enum/length/size를 적용한다. 기록에는 task identity, repo/worktree/branch/base, display-only PR hint, state, ports, 제한된 verification schema, revision, timestamp, `cleanupAuthorized:false`만 허용하고 secret 값·unknown field·자유형 사용자 입력을 받지 않는다.
- [x] report mode에서 `cleanupAuthorized`는 생성부터 읽기·전이·쓰기까지 `false`로 고정한다.
- [x] production root는 `$CODEX_HOME/worktree-lifecycle/<repo-id>`로 파생하고, test-only capability만 temp root 주입을 허용한다. canonical root가 Git common dir 또는 모든 linked worktree와 양방향 포함 관계이거나 task ID path/symlink/junction escape가 있으면 거부한다.
- [x] per-record write lock은 cleanup lease와 별개이며 scheduler나 retry loop를 만들지 않는다. expected revision이 다르거나 lock이 이미 있으면 fail-closed한다.
- [x] Run GREEN: registry 관련 test만 실행한다.

### Task 3: 보수적 worktree 분류기 구현

**Files:**

- Modify: `scripts/lib/worktree-lifecycle.mjs`

- [x] lifecycle `state`와 분리된 `classifyWorktreeSnapshot` report disposition을 순수 함수로 구현한다.
- [x] clean하고 owner가 확인된 current task와 base checkout은 `ACTIVE` 또는 `PRESERVED`로 보존한다. dirty/unknown이면 `NEEDS_ATTENTION`이 우선한다.
- [x] dirty/untracked/ignored-sensitive/branch conflict/unknown owner/closed-unmerged/unknown PR은 `NEEDS_ATTENTION`으로 보낸다.
- [x] known owner, clean tracked/untracked, 모든 ignored entry의 allowlist 일치, branch/path 단독 소유, live provider가 전달한 GitHub API의 fresh merged evidence, published/PR head 일치, process/port/file-lock inactive가 모두 증명된 synthetic fixture만 `REVIEW_CANDIDATE`가 된다.
- [x] registry의 PR/owner metadata는 display hint로만 사용하고 `REVIEW_CANDIDATE` gate의 live evidence를 충족하지 못한다.
- [x] 실제 scanner가 process/port/file-lock 또는 fresh GitHub evidence를 확인하지 못하면 clean worktree도 `NEEDS_ATTENTION`으로 유지한다.
- [x] 분류 결과에 owner, reasons, preserve reasons, next review checks, `cleanupReady:false`, `deletionAuthorized:false`를 포함한다.
- [x] Run GREEN: lifecycle test 전체를 실행한다.

### Task 4: read-only inventory CLI와 보고서 구현

**Files:**

- Create: `scripts/report-worktree-lifecycle.mjs`
- Modify: `package.json`

- [x] `GIT_OPTIONAL_LOCKS=0`와 `git --no-optional-locks` 아래에서 `git worktree list --porcelain -z`, 각 경로의 `git status --porcelain=v2 -z --untracked-files=all --ignore-submodules=none`, `git status --porcelain=v1 -z --ignored=matching --untracked-files=all --ignore-submodules=none`, read-only refs snapshot만 shell 없이 exact argv allowlist로 실행한다.
- [x] parser는 spaces, Unicode, CRLF, rename/copy records, detached, bare, locked, prunable 항목과 submodule/status command failure를 처리한다.
- [x] command nonzero, stderr, worktree path 소실, list→status→list 사이 HEAD/path/flags 또는 refs 변화는 snapshot race로 fail-closed한다.
- [x] Codex task metadata는 owner 확인에 필요한 존재·식별 정보만 읽고 thread ID, token, env value는 출력하지 않는다.
- [x] registry root가 없으면 display hint 없는 degraded mode로 유지한다. 명시된 root의 read가 실패하면 hint를 추측하지 않고 report 생성 자체를 fail-closed한다.
- [x] Phase 2 scanner에는 live GitHub/network provider가 없으므로 실제 entry는 PR evidence unknown이며 `REVIEW_CANDIDATE`가 될 수 없음을 contract test로 고정한다.
- [x] `--format markdown|json`, `--repo`, `--registry-root`를 지원하고 기본은 현재 repository의 Markdown stdout이다.
- [x] `report:worktree-lifecycle` package script를 추가한다.
- [x] injected runner transcript가 exact operation 순서·argv·env·`shell:false`와 일치하는지 테스트한다. report CLI는 registry writer, network, timer/watcher/scheduler, deletion capability를 import하지 않는다.

### Task 5: 실제 저장소 report-only 재수집과 문서화

**Files:**

- Create: `docs/qa/reports/2026-07-10-worktree-lifecycle-phase-2.md`
- Modify: `docs/sot-change-proposals/2026-07-10-codex-workflow-overhaul.md`

- [x] 실제 저장소에서 CLI를 실행하되 stdout을 검토하고 어떠한 cleanup도 실행하지 않는다.
- [x] 보고서에는 분류 수, current/base 보존, owner/PR/ignored-sensitive 미확정 위험, Phase 2A 재검토 조건을 기록한다.
- [x] proposal에는 Phase 2 구현 이력만 append하고 `superseded` lifecycle 상태는 바꾸지 않는다.
- [x] active `docs/agent-workflow/codex.md`와 구현의 상태명·안전 경계가 일치하는지 확인한다.

### Task 6: 검증, critic review, publish

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `docs/superpowers/plans/2026-07-10-codex-lifecycle-report-only.md`

- [x] CI에 lifecycle 전용 test step을 독립적으로 연결한다.
- [x] Run: `pnpm exec vitest run tests/scripts/worktree-lifecycle.test.mjs tests/scripts/report-worktree-lifecycle.test.mjs --reporter=verbose --maxWorkers=1`
- [x] Run: `pnpm report:worktree-lifecycle -- --format json` and confirm every entry is classified with reasons.
- [x] Run: `pnpm check:sot-registry`
- [x] Run: `pnpm check:agent-skill-policy`
- [x] Run: `pnpm lint`
- [x] Run: `pnpm typecheck`
- [x] Run: `git diff --check` and secret-like filename/content checks on the candidate diff.
- [x] 실제 report CLI 실행 전후 worktree porcelain, refs, current status snapshot을 비교해 Git/worktree/branch 변화가 0건인지 확인한다.
- [x] 독립 critic이 unsafe-safe classification, hidden destructive path, registry path escape, Windows path handling을 검토하고 Critical/Important 0건까지 수정한다.
- [ ] GitHub Actions의 Windows 전용 job에서 두 lifecycle test를 실행해 Windows path/rename 동작을 검증한다.
- [ ] 기존 사용자 publish 권한 범위에서 `main` 대상 draft PR #39의 같은 branch에 commit/push하고 PR 본문을 갱신한다. `collab`은 건드리지 않는다.

## Rollback

이 phase의 rollback 단위는 lifecycle module, report CLI, 두 test, package/CI wiring, Phase 2 보고서와 proposal append다. 외부 registry나 worktree를 변경하지 않으므로 rollback은 해당 commit을 되돌리는 것으로 끝나야 한다. 실제 temp test artifact는 test 종료 시 제거한다.

## Completion evidence

- synthetic fixture 전부가 기대 상태로 분류됨
- dirty/unknown 상태의 false-safe가 0건
- 실제 inventory 모든 항목에 owner와 보존/주의 이유가 표시됨
- destructive command 실행 0건, actual worktree/branch 변화 0건
- 관련 tests, policy checks, lint, typecheck, diff/secret scan 통과
