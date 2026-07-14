# Legacy Worktree Read-only Inventory

- Date: 2026-07-10
- Repository: TALKPIK AI v13
- Mode: report-only
- Destructive commands executed: none

## Summary

`git worktree list --porcelain`과 각 경로의 `git status --porcelain`을 읽은 시점의 결과다.

| Metric | Count |
| --- | ---: |
| Registered worktrees | 25 |
| Detached HEAD | 14 |
| Named branch | 11 |
| Tracked/untracked surface clean | 23 |
| Untracked changes present | 2 |
| Missing path | 0 |
| Git locked | 0 |
| Git prunable flag | 0 |

“clean 23”은 tracked/untracked status만 뜻한다. ignored-sensitive file, active process, task owner, unpublished commit, PR merge 여부를 모두 통과했다는 뜻이 아니다. 따라서 자동 삭제 가능한 후보는 0개다.

## Worktrees with visible changes

| Path | Checkout | Visible status | Decision |
| --- | --- | --- | --- |
| `C:/Users/admin/Desktop/workspace/topik-project/v13` | `main` | untracked 6 | 기준 폴더이므로 보존, 사용자 소유 변경 확인 필요 |
| `C:/Users/admin/.codex/worktrees/da58/v13` | detached | untracked 16 | 현재 task이므로 보존 |

## Detached worktrees requiring ownership review

- `C:/Users/admin/.codex/worktrees/13db/v13`
- `C:/Users/admin/.codex/worktrees/162b/v13-dev`
- `C:/Users/admin/.codex/worktrees/29d4/v13-dev`
- `C:/Users/admin/.codex/worktrees/4681/v13-dev`
- `C:/Users/admin/.codex/worktrees/506f/v13-dev`
- `C:/Users/admin/.codex/worktrees/6425/v13-dev`
- `C:/Users/admin/.codex/worktrees/8e37/v13-dev`
- `C:/Users/admin/.codex/worktrees/92ee/v13-dev`
- `C:/Users/admin/.codex/worktrees/9f62/v13-dev`
- `C:/Users/admin/.codex/worktrees/c199/v13-dev`
- `C:/Users/admin/.codex/worktrees/da58/v13` — current task
- `C:/Users/admin/.codex/worktrees/ea28/v13-dev`
- `C:/Users/admin/.codex/worktrees/eab2/v13-dev`
- `C:/Users/admin/Desktop/workspace/topik-project/v13-pr25-review-fixes`

Detached라는 사실은 삭제 근거가 아니다. 각 경로의 task metadata, commit reachability, 관련 PR을 다시 확인해야 한다.

## Named-branch worktrees requiring PR/owner review

| Branch | Worktree |
| --- | --- |
| `main` | `C:/Users/admin/Desktop/workspace/topik-project/v13` |
| `codex/writing-direct-entry-untouched` | `C:/Users/admin/.codex/worktrees/43a4/v13-dev` |
| `codex/feedback-next-direct-start` | `C:/Users/admin/.codex/worktrees/a3e7/v13-dev` |
| `codex/pr32-followup-fixes` | `C:/Users/admin/.codex/worktrees/main-push-4384303e` |
| `codex/merge-codex-dev-to-main-20260703` | `C:/Users/admin/.codex/worktrees/merge-codex-dev-to-main-20260703` |
| `claude/pre-collab-deployment-e717f5` | `C:/Users/admin/Desktop/workspace/topik-project/v13/.claude/worktrees/eloquent-wright-16ca2b` |
| `before-convention` | `C:/Users/admin/Desktop/workspace/topik-project/v13-before-convention` |
| `codex/dev` | `C:/Users/admin/Desktop/workspace/topik-project/v13-dev` |
| `codex/feedback-page-sync` | `C:/Users/admin/Desktop/workspace/topik-project/v13-feedback-page-sync` |
| `codex/first-qa` | `C:/Users/admin/Desktop/workspace/topik-project/v13-first-qa` |
| `codex/institution-invitation-ux` | `C:/Users/admin/Desktop/workspace/topik-project/v13-institution-invitation-ux` |

## Manual remediation gate

Phase 2A에서 한 worktree씩 다음 순서로 재검사한다.

1. owning task와 branch/PR identity 확인
2. PR merged 또는 명시적 보존 결정 확인
3. tracked, untracked, ignored-sensitive inventory 재검사
4. unpublished commit과 다른 worktree의 branch 사용 여부 확인
5. active process, dev server, port, file lock 확인
6. 사용자 검토 묶음에 포함
7. neutral CWD에서 non-force removal

한 조건이라도 불명확하면 `NEEDS_ATTENTION`으로 보존한다.
