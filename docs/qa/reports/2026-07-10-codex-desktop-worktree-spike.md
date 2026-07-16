# Codex Desktop Worktree Lifecycle Spike

- Date: 2026-07-10
- Mode: read-only
- Decision: `report`
- Destructive commands executed: none

## Conclusion

현재 Codex Desktop 환경에서는 task와 worktree의 연결은 확인할 수 있지만, task 종료 후 worktree를 안전하게 제거하는 native API와 heartbeat 지속성은 증명되지 않았다. 따라서 Codex Desktop owner의 cleanup은 자동화하지 않고 report-only로 유지한다.

## Observed evidence

| Check | Observation | Consequence |
| --- | --- | --- |
| Git ownership | 현재 작업은 linked worktree이며 별도 gitdir와 공통 repository gitdir를 사용한다. | 같은 공통 repository의 다른 task를 함께 고려해야 한다. |
| Current checkout | 현재 checkout은 detached HEAD다. | branch switch나 중첩 worktree를 자동 실행하지 않는다. |
| App metadata | worktree gitdir에 `codex-thread.json`과 `codex-synced-branch.json`이 있다. 전자는 version과 owner thread ID, 후자는 `codex/workflow-update` 동기화 branch와 tree ref를 기록한다. | 앱이 task ownership과 sync ref를 알고 있다는 증거는 있으나 cleanup lease 증거는 아니다. |
| CLI surface | `codex-cli 0.128.0`의 help에는 worktree cleanup, task finalization, post-merge supervisor 명령이 노출되지 않는다. | CLI 기반 native cleanup을 전제할 수 없다. |
| App tool surface | thread create/fork/read/handoff/archive와 automation heartbeat는 노출된다. worktree remove/cleanup tool은 노출되지 않는다. | archive와 cleanup의 안전한 순서는 알 수 없다. |
| Heartbeat semantics | app heartbeat는 현재 task에 후속 prompt를 예약하는 기능이다. task registry lease나 archive 뒤 cleanup 재개 보장은 명시되지 않는다. | PR merge monitor의 내구성으로 간주하지 않는다. |
| Current metadata fields | 확인한 task metadata에는 heartbeat timestamp, lease nonce, cleanup state가 없다. | task-local registry를 추측 생성하거나 자동 삭제에 사용하지 않는다. |

Thread ID와 tree ref는 소유권 확인에만 사용했고 보고서에는 기록하지 않았다.

## Failed or unproven assumptions

- task를 archive하면 app이 worktree를 자동 제거한다: 증명되지 않음
- task가 종료된 뒤 heartbeat가 계속 재예약된다: 증명되지 않음
- Handoff가 현재 calling task의 cleanup 대체 수단이다: 증명되지 않음
- detached worktree를 synced branch에 연결해도 다른 task와 충돌하지 않는다: 추가 owner 확인 필요

## Safe operating mode

1. Phase 1/2에서는 worktree 상태를 읽고 보고만 한다.
2. task 종료나 PR merge를 이유로 `git worktree remove`, branch delete, `git worktree prune`을 자동 실행하지 않는다.
3. Desktop native cleanup을 별도 disposable repository에서 재현할 수 있을 때만 owner별 opt-in을 검토한다.
4. 증거가 생기기 전까지 상태는 `NEEDS_ATTENTION` 또는 `PRESERVED`로 남긴다.

## Follow-up acceptance evidence

cleanup opt-in 전에는 다음이 모두 필요하다.

- disposable repository에서 archive/handoff/task 종료별 worktree 변화 재현
- task 종료 뒤 monitor 재개 여부 확인
- dirty, untracked, ignored-sensitive, active process fixture에서 삭제 거부 확인
- merge 종류별 PR 상태 확인
- calling worktree 밖의 neutral CWD에서만 cleanup 실행 확인
