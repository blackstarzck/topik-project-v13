# Worktree Lifecycle Phase 2 Verification

- Date: 2026-07-10
- Mode: `report`
- Repository entries observed: 25
- Registry writes outside test temp directories: 0
- Worktree/branch cleanup commands executed: 0
- Result: every observed worktree is `NEEDS_ATTENTION`; `REVIEW_CANDIDATE` is 0

## Conclusion

Phase 2의 최소 task registry, 상태 전이, read-only inventory와 보수적 분류기를 구현했다. 실제 저장소를 재수집했지만 process/port/file lock과 fresh GitHub PR evidence를 확인하는 capability는 의도적으로 넣지 않았기 때문에 어떤 worktree도 정리 후보로 승격되지 않았다.

모든 report와 entry는 `cleanupReady=false`, `deletionAuthorized=false`, `review-only; deletion not authorized`를 포함한다. report CLI 실행 전후 worktree 목록, refs, 현재 status는 동일했다.

## Implemented safety boundary

| Area | Contract |
| --- | --- |
| Lifecycle state | `FINALIZING`, `CLEANED`, `cleanupAuthorized=true`는 report mode에서 거부 |
| Registry | `$CODEX_HOME/worktree-lifecycle/<repo-id>` production root, closed schema, protected path containment, revision/write lock, unique temp + fsync + atomic rename |
| Test registry | OS temp directory capability만 사용; 실제 `$CODEX_HOME` write 없음 |
| PR metadata | registry 값은 display hint이며 live GitHub evidence로 사용하지 않음 |
| Git inspection | `GIT_OPTIONAL_LOCKS=0`, `--no-optional-locks`, NUL-delimited porcelain, shell 미사용 |
| Snapshot race | worktree HEAD/path/flags와 refs를 전후 비교하고 변화가 있으면 fail-closed |
| Cleanup | remove/prune/branch delete/force, monitor, supervisor, cleanup lease 없음 |

## Actual read-only inventory

| Observation | Count | Meaning |
| --- | ---: | --- |
| Total | 25 | 이번 실행에서 다시 관찰한 현재 worktree 수 |
| `NEEDS_ATTENTION` | 25 | 삭제나 정리로 진행할 수 없음 |
| `REVIEW_CANDIDATE` | 0 | 사용자 검토 묶음으로도 승격할 후보 없음 |
| owner identified from Codex metadata | 16 | thread ID 값은 읽은 결과에 포함하지 않고 owner 종류만 사용 |
| owner unknown | 8 | task/person owner를 증명하지 못함 |
| detached or branch unknown | 13 | branch identity와 exclusive ownership을 증명하지 못함 |
| tracked changes present | 2 | 사용자/작업 변경 보존 필요 |
| untracked files present | 2 | 소유권 확인 전 보존 필요 |
| ignored entry outside disposable allowlist | 25 | ignored라고 해서 disposable로 간주하지 않음 |
| process/port/file-lock state unknown | 25 each | Phase 2 scanner가 runtime ownership을 추측하지 않음 |
| live PR evidence missing | 24 | base checkout을 제외하고 registry hint를 merge 증거로 사용하지 않음 |

`ignored entry outside disposable allowlist`는 secret이 발견됐다는 뜻이 아니다. `node_modules/`, `.next/`, coverage/cache/build output처럼 명시적으로 허용한 경로 외 ignored entry가 하나라도 있으면 내용과 관계없이 보존하도록 한 결과다. 보고서에는 secret 값이나 task/thread ID를 기록하지 않았다.

## Verification evidence

- RED: 두 production module이 없을 때 전용 Vitest 2개가 `ERR_MODULE_NOT_FOUND`로 실패함을 확인
- GREEN: `pnpm check:worktree-lifecycle` — 2 files, 83 tests passed
- Full regression: `pnpm test` — 255 files passed, 7 skipped; 1,820 tests passed, 14 skipped; 147.35 seconds
- Actual report: 25 entries, snapshot stable, 0 review candidates
- Before/after: worktree porcelain unchanged, refs unchanged, current status unchanged
- Registry fault fixtures: write/fsync/rename failure, concurrent revision, read-during-write, corrupt target preservation, foreign lock replacement
- Registry boundary fixtures: explicit test capability, invalid production `CODEX_HOME`, full-schema validation, safe public projection
- Windows path fixtures: case-insensitive containment, reserved/UNC/ADS/traversal ID, junction escape, reserved filename stem
- Parser fixtures: spaces, Unicode, CRLF, rename/copy, detached, locked, prunable, bare, malformed output, command failure, double-scan race
- CLI integration: a valid `--registry-root` is loaded without cleanup authority or secret-bearing registry fields in output
- Schema boundary: closed predicates are exported instead of mutable transition/state collections

## Phase 2A handoff

현재 자동 또는 수동 removal로 넘길 후보는 없다. Phase 2A는 아래 증거를 별도로 모은 뒤 사용자 검토 묶음을 다시 만들어야 한다.

1. owner task/person과 branch/worktree identity
2. GitHub API에서 새로 확인한 PR 상태, base, published head 일치
3. tracked/untracked 파일 소유권과 모든 non-disposable ignored entry
4. process, dev server, port, file lock 상태
5. 검사 직전과 직후의 stable repository snapshot

위 항목이 모두 갖춰져도 결과는 `REVIEW_CANDIDATE`일 뿐 삭제 권한이 아니다. 삭제는 별도 명시 권한과 직전 재검사가 필요하다.

## SOT check

- 읽은 SOT: `AGENTS.md`, `README.md`, `docs/agent-workflow/core.md`, `docs/agent-workflow/codex.md`
- 확인한 요구사항: report-only downgrade, unknown/dirty fail-closed, task-owned identity, no force, external registry boundary
- 충돌 여부: 없음
- 갱신 필요 문서: active workflow 변경 없음; superseded proposal에는 Phase 2 구현 이력만 append
