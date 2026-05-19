# AI Workflow 문서 안내

이 폴더는 AI가 이 프로젝트에서 어떻게 일해야 하는지 정리한 운영 문서입니다.
Codex, Claude Code, 멀티 에이전트 작업을 사용할 때 "AI가 놓치면 안 되는 절차"를 담고 있습니다.

## 한눈에 보는 역할

```mermaid
flowchart TD
    A["사용자 요청"] --> B["관련 docs 찾기"]
    B --> C["계획 세우기"]
    C --> D["필요하면 에이전트 분업"]
    D --> E["작업 기록 남기기"]
    E --> F["검증"]
    F --> G["보고서 작성"]
```

## 이 폴더의 문서들

| 문서 | 쉽게 말하면 | 언제 보나요 |
| --- | --- | --- |
| [agent-packets.md](./agent-packets.md) | 여러 AI에게 일을 나눠줄 때 쓰는 작업지시서 양식입니다. | Codex와 Claude Code를 같이 쓰거나 하위 에이전트를 만들 때 |
| [context-ledger-template.md](./context-ledger-template.md) | 긴 작업의 작업일지 양식입니다. | 작업이 길거나, 나중에 이어서 할 가능성이 있을 때 |
| [harness-and-skills.md](./harness-and-skills.md) | GStack, Superpowers, Codex, Claude Code의 skill 이름과 harness 구조입니다. | AI 실행 환경이나 skill 라우팅을 점검할 때 |
| [report-template.md](./report-template.md) | AI가 마지막에 보고할 때 쓰는 양식입니다. | 작업 완료 보고를 표준화할 때 |
| [git-publication-decision.md](./git-publication-decision.md) | GitHub 공개 저장소 관련 결정 기록입니다. | 저장소 공개/배포 이력을 확인할 때 |
| [plans/README.md](./plans/README.md) | 큰 계획 문서를 넣는 곳의 안내서입니다. | 실행 전 계획을 파일로 남길 때 |
| [runs/README.md](./runs/README.md) | 실제 작업일지를 넣는 곳의 안내서입니다. | 작업별 진행 기록을 찾을 때 |

## 비개발자를 위한 이해

AI 작업은 말로만 주고받으면 중간에 맥락이 흐려질 수 있습니다.
그래서 이 폴더는 AI에게 다음 세 가지를 강제합니다.

| 장치 | 왜 필요한가요 |
| --- | --- |
| 작업지시서 | 여러 AI가 같은 목표를 보고 움직이게 합니다. |
| 작업일지 | 작업이 길어져도 이전 결정과 근거를 잃지 않게 합니다. |
| 완료 보고서 | 무엇을 했고, 무엇을 검증했고, 남은 위험이 무엇인지 확인하게 합니다. |

## AI에게 이렇게 말하면 됩니다

> 이번 작업은 길어질 수 있으니 `docs/ai-workflow` 기준으로 context ledger를 만들고 진행해줘.

> Codex가 구현하고 Claude Code가 리뷰하는 방식으로 agent packet을 만들어줘.

> 완료 보고는 `docs/ai-workflow/report-template.md` 형식으로 해줘.
