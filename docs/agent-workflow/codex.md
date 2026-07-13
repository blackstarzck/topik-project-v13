# Codex Task and Worktree Lifecycle

## Current operating mode

Codex Desktop owner의 cleanup mode는 현재 `report`다. `docs/qa/reports/2026-07-10-codex-desktop-worktree-spike.md`에서 native cleanup API와 task 종료 뒤 heartbeat 지속성이 증명되지 않았기 때문이다.

따라서 이 문서는 목표 lifecycle과 안전 조건을 정의하지만, 실제 worktree/branch 자동 삭제는 활성화하지 않는다.

## 1. Identity and isolation

원칙은 `한 task = 한 의미 있는 slug = 한 branch = 한 worktree 소유권`이다.

- slug는 영어 소문자 kebab-case를 사용한다.
- branch 기본값은 `codex/<slug>`다.
- task 제목, branch, worktree metadata가 같은 slug를 가리키게 한다.
- Codex Desktop이 이미 worktree를 만들었다면 그 안에서 중첩 worktree를 만들지 않는다.
- 자동 생성된 경로명은 identity가 아니다. 실제 경로와 app task metadata를 기록한다.
- 같은 worktree에서 여러 쓰기 task를 병렬 실행하지 않는다.

## 2. Start inspection

수정 전에 최소한 다음을 확인한다.

```powershell
Get-Location
git rev-parse --git-dir
git rev-parse --git-common-dir
git branch --show-current
git status --short --branch
git worktree list --porcelain
```

확인 항목:

- linked worktree인지 기준 checkout인지
- named branch인지 detached인지
- tracked/untracked 변경이 누구 소유인지
- app-managed metadata가 가리키는 task/branch
- 같은 branch를 다른 worktree가 사용하는지
- 기준 branch와 remote ref가 무엇인지

예상하지 못한 사용자 변경은 되돌리지 않는다.

## 3. Lifecycle states

```text
DISCOVERED → ISOLATED → SYNC_DECISION → WORKING → VERIFIED
→ COMMITTED → PUBLISHED → PR_OPEN → MERGE_VERIFIED
→ FINALIZING → CLEANED
```

보존/오류 상태:

- `NEEDS_ATTENTION`: dirty, untracked, ignored-sensitive, owner unknown, process/lock 충돌, closed-unmerged PR
- `PRESERVED`: 사용자가 명시적으로 보존
- `BLOCKED`: 권한이나 외부 상태가 없어 진행 불가

각 전이는 앞 상태의 증거가 있을 때만 진행한다.

## 4. Sync decision

`pull → commit → push`를 고정 절차로 사용하지 않는다.

1. `fetch`로 remote ref만 갱신한다.
2. task의 current HEAD와 intended base를 비교한다.
3. dirty 상태와 published history를 확인한다.
4. fast-forward, rebase, merge, 현재 base 유지 중 안전한 방법을 결정한다.
5. conflict가 생기면 사용자 변경을 보존하고 자동 reset하지 않는다.

공유 기준 checkout에서 다른 task를 위해 `switch`, `checkout`, `reset`, `rebase`, `merge`하지 않는다.

### Detached HEAD

- clean detached worktree라도 app metadata와 branch ownership을 확인하기 전에는 branch를 자동 연결하지 않는다.
- 변경이 있는 detached worktree는 현재 HEAD와 diff를 먼저 보존하고 rescue/publish 방법을 결정한다.
- app-managed synced branch가 있다는 사실만으로 그 branch를 현재 task가 독점한다고 추정하지 않는다.

## 5. Work and verification

- 변경은 현재 task worktree 안에서만 수행한다.
- 포트, dev server, local DB, `.env.local`, test account는 worktree가 자동 격리하지 않는다.
- 병렬 runtime 검증은 port/data owner를 분리한다.
- 완료 전 관련 test, diff와 current status를 읽는다.

## 6. Publish

로컬 편집 요청은 stage/commit/push/PR을 자동 허용하지 않는다. 사용자가 publish를 요청했거나 검증 결과 보고 뒤 승인한 경우에만 진행한다.

Publish 전 확인:

- current branch/detached 상태와 intended remote branch
- `collab`이 대상에 포함되지 않는지
- secret-like file과 staged diff
- 최신 remote ref와 sync decision
- 검증 결과

기본 흐름은 다음과 같다.

```text
fetch → sync decision → verify → commit → push → PR
```

## 7. Task-owned PR monitoring

- PR을 만든 task가 PR number, repository, base, published head를 소유한다.
- 중앙 sweeper가 모든 worktree를 정리하지 않는다.
- merge 확인은 GitHub의 실제 PR state를 기준으로 하며 commit ancestry만으로 추정하지 않는다.
- closed-unmerged, head mismatch, unknown repository/base는 `NEEDS_ATTENTION`이다.
- GitHub 상태를 조회할 수 없으면 cleanup을 실행하지 않고 report-only로 남긴다.

## 8. Guarded cleanup

실제 cleanup을 활성화할 때도 대상 worktree 내부 process가 자신을 삭제하지 않는다. task별 ephemeral supervisor가 neutral CWD에서 `taskId + nonce` lease를 획득하고 모든 조건을 다시 검사해야 한다.

필수 조건:

- PR merged와 published head 일치
- tracked/untracked 변경 없음
- ignored file은 명시된 disposable allowlist만 존재
- `.env*`, local DB, fixture, report, screenshot 같은 preserve-sensitive file 없음
- task의 process/dev server/port 종료
- 다른 task/worktree가 branch나 path를 소유하지 않음
- 기준 checkout, `main`, `collab`이 아님
- owner와 cleanup lease 확인

하나라도 실패하면 삭제하지 않고 `NEEDS_ATTENTION`으로 전환한다. `--force`는 사용하지 않는다.

## 9. Legacy remediation

기존 worktree는 먼저 read-only inventory를 만들고 사용자 검토 묶음으로 처리한다. 오래됨, detached, clean status 하나만으로 삭제하지 않는다. 각 후보는 삭제 직전에 모든 guard를 다시 통과해야 한다.
