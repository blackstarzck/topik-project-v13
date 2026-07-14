# Agent Workflow

이 디렉터리는 TALKPIK AI 저장소에서 일하는 AI 에이전트의 상세 작업 계약이다. root `AGENTS.md`는 짧은 진입점이고, 어떤 문서가 active인지는 `docs/sot-registry.json`과 생성된 `docs/INDEX.md`에서 확인한다.

## 문서 지도

| 문서 | 책임 |
| --- | --- |
| `core.md` | 정책 우선순위, SOT lifecycle, FAST/STANDARD/STRICT, 계획·검증·보고, Git publish 권한 |
| `codex.md` | Codex Desktop task/worktree/branch/PR/cleanup lifecycle |
| `ui.md` | 공통 레이아웃과 Page Recipe, AntD/Tailwind/theme 소유권, CSS 예외와 UI 검증 |

## 적용 원칙

- 공통 규칙은 `core.md`에 한 번만 정의한다.
- runtime 고유 절차는 해당 adapter가 정의한다.
- adapter가 root constitution이나 active SOT와 충돌하면 상위 정책이 우선한다.
- 제안서와 설계 기록은 registry에서 `active`가 아니면 현재 제품 동작을 바꾸는 근거로 사용하지 않는다.
- 사실과 절차가 달라지면 같은 결정을 여러 문서에 복제하지 말고 owner 문서를 갱신한다.
