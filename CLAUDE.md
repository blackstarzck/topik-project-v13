# CLAUDE.md

Claude와 Claude 계열 AI 에이전트는 이 파일을 진입점으로 읽고, 상세 규칙은 `AGENTS.md`를 따른다.

## 최우선 규칙

- 답변과 작업 보고는 한국어로 한다.
- 작업 전 `AGENTS.md`와 `README.md`를 먼저 확인한다.
- 제품, 화면, 데이터, 보안, UX 동작을 새로 만들거나 바꾸기 전에는 관련 SOT와 현재 source를 함께 확인한다.
- secret, token, private key, service role key는 출력하거나 commit하지 않는다.

## 병렬 작업과 worktree

이 저장소에서 병렬 작업은 반드시 `한 작업/세션 = 한 branch = 한 worktree`로 진행한다.

- 여러 AI 세션이 같은 프로젝트 폴더에서 동시에 수정하면 안 된다.
- 기준 폴더 `v13`은 가능하면 `main` 기준 확인, 통합, 전체 검증용으로 둔다.
- 새 병렬 작업을 시작할 때는 별도 git worktree를 만들고, 해당 worktree 폴더에서만 작업한다.
- 이미 Codex Desktop 또는 다른 도구가 worktree를 만들어 세션을 시작했다면 그 안에서 다시 중첩 worktree를 만들지 않는다.
- worktree를 만들기 전 사람이 읽을 수 있는 `slug`를 먼저 정한다. `slug`는 영어 소문자 kebab-case로 쓰고, 공백/한글/랜덤 형용사/의미 없는 숫자는 피한다. 예: `practice-filter`, `auth-redirect`, `analysis-loading`.
- Claude thread 제목, branch, worktree 폴더명은 같은 `slug`를 공유해야 한다. 예: thread `auth-redirect - 로그인 이동 수정`, branch `claude/auth-redirect`, worktree `../v13-auth-redirect`.
- 도구가 `festive-yalow-f5e2c0`처럼 자동 이름을 만들면 경로명만 믿지 않는다. 즉시 thread 제목과 branch 이름을 의미 있는 `slug`로 맞추고, 완료 보고에 실제 worktree 경로와 branch를 함께 적는다.
- 이미 생성된 worktree의 용도가 불분명하면 삭제하지 말고 `git worktree list --verbose`, `git branch -vv`, 해당 worktree의 `git status --short --branch`, 최근 commit log를 확인한 뒤 판단한다.
- 작업 시작 전 `pwd`, `git branch --show-current`, `git status`, 필요하면 `git worktree list`로 현재 위치와 branch를 확인한다.
- 예상한 worktree가 아니면 파일을 수정하지 말고 먼저 위치를 바로잡는다.
- 병렬 작업 중 공유 기준 폴더에서 `git switch`, `git checkout`, `git reset`, `git rebase`, `git merge`를 실행하지 않는다.

수동 생성 예시:

```powershell
git worktree add ..\v13-practice-filter -b codex/practice-filter main
git worktree add ..\v13-auth-redirect -b codex/auth-redirect main
```

작업 완료 후에는 해당 worktree에서 검증과 diff를 확인하고 commit 또는 PR 단위로 정리한다. 병합은 기준 폴더에서 최신 `main`을 기준으로 branch를 하나씩 통합한다.

worktree는 코드 파일을 격리하지만 포트, 로컬 DB, Supabase 테스트 데이터, `.env.local`, dev server 같은 런타임 자원은 자동으로 격리하지 않는다. 병렬 실행 검증이 필요하면 포트와 데이터 자원 충돌을 별도로 피한다.

## 배포 브랜치 보호

Vercel 프로덕션 배포는 **keduall 저장소의 `main` 브랜치**에 연결돼 있다. 이 작업 폴더에서 keduall 저장소는 git remote 이름 **`collab`**(별칭)으로 등록돼 있다. 즉 이 저장소 맥락에서 `collab`은 브랜치가 아니라 **keduall 배포 저장소를 가리키는 remote 이름**이다. remote `collab`의 `main`(= keduall `main`)에 merge 또는 push되면 Vercel 프로덕션이 갱신돼 사용자에게 바로 노출되므로 아래 규칙을 반드시 지킨다.

- 사용자가 `main에 머지`, `git에 올려`, `push해`, `PR 만들어`, `배포해`라고 말해도 기본 대상은 절대 keduall 배포 저장소(remote `collab`)의 `main`이 아니다. 기본 대상은 `origin`(blackstarzck) 또는 기능 branch다.
- keduall 배포 저장소를 대상으로 merge, rebase, push, force-push, PR target 변경, `git push collab main`, `git push collab HEAD:main`, `git push collab <branch>:main` 같은 작업을 임의로 하지 않는다.
- keduall(remote `collab`)의 `main` 대상 작업은 사용자가 정확히 `collab에 배포`, `keduall main에 배포`, `collab의 main으로 push`처럼 대상 저장소와 배포 의도를 명시한 경우에만 고려한다.
- 그래도 바로 실행하지 않는다. 먼저 `keduall 배포 저장소(remote collab)의 main은 Vercel 프로덕션이라 즉시 노출됩니다`라고 경고하고, 변경 범위, 검증 결과, secret 점검 결과를 보고한 뒤 명시 확인을 받아야 한다.
- Git 작업 전에는 `git branch --show-current`, `git status --short --branch`, `git remote -v`로 push/merge/PR 대상 **remote와 branch**를 확인한다. 대상이 keduall(remote `collab`)의 `main`이면 위 조건을 만족하지 않는 한 중단한다.
