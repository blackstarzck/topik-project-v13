# Domain Glossary

이 문서는 **용어를 정의하지 않습니다.** 모든 정의는 아래가 가리키는 정본 문서에 있으며, 이 파일은 AI/사람 양쪽이 "이 단어는 어디서 정의되는가"를 빠르게 찾기 위한 라우팅 인덱스입니다.

**규칙**: 본문에 정의를 적지 않습니다. 셀에는 정본 파일의 헤더 링크나 앵커만 허용합니다. PR 리뷰에서 정의가 추가된 것이 발견되면 reject 합니다. 정의가 바뀌었다면 정본을 갱신하고 이 표는 그대로 둡니다.

## 핵심 도메인 용어

| 용어 | 정본 위치 | 한 줄 안내 |
| --- | --- | --- |
| 학습 목표 (Learning Goal) | [docs/Wireframe/03-A-03-learning-goal-setup/description.md](Wireframe/03-A-03-learning-goal-setup/description.md) | 사용자가 설정하는 학습 단위 목표. 정의는 정본 참조. |
| 문제 풀이 (Problem Solving) | [docs/Wireframe/06-C-02-problem-list/description.md](Wireframe/06-C-02-problem-list/description.md) | 문제 선택과 풀이 진입 흐름의 도메인 표현. |
| 문제 추천 (Problem Recommendation) | [docs/Wireframe/05-C-01-problem-type-recommendations/description.md](Wireframe/05-C-01-problem-type-recommendations/description.md) | 사용자 상태에 따른 문제 추천 규칙. |
| 시도 (Attempt) | [docs/Wireframe/07-C-03-retry-modal/description.md](Wireframe/07-C-03-retry-modal/description.md) | 사용자의 문제 풀이 시도 단위. |
| 글쓰기 (Writing) | [docs/Wireframe/08-D-01-short-answer-writing-51/description.md](Wireframe/08-D-01-short-answer-writing-51/description.md) | 단답·장문 작성 도메인. |
| 피드백 (Feedback) | [docs/Wireframe/14-E-01-short-answer-feedback/description.md](Wireframe/14-E-01-short-answer-feedback/description.md) | 작성 결과에 대한 평가/비교 도메인. |
| 사용자 흐름 (User Flow) | [docs/flow/user-flow.md](flow/user-flow.md) | 화면 간 사용자 이동의 정본. |
| 라우트 (Route) | [docs/sitemap.md](sitemap.md) | Target React Route Map의 라우트 정의. |
| 제품 요구사항 (PRD) | [docs/prd.md](prd.md) | 제품 의도와 비기능 요구의 정본. |
| 기능 스펙 (Spec) | [docs/spec.md](spec.md) | 기능 단위 스펙의 정본. |

> 이 표가 비어 보이는 도메인이 있다면, 정본 문서에 해당 도메인이 아직 정리되지 않았다는 신호입니다. 새 정의는 정본에 먼저 만든 뒤 이 표에 라우팅을 추가합니다.

## 모듈 경계 (Module Boundaries)

모듈 경계의 정본은 **코드의 폴더 구조**입니다(예: `src/learning/`, `src/writing/`, `src/feedback/`, `src/auth/`). 이 문서는 폴더와 도메인을 잇는 라우팅만 제공합니다.

| 도메인 | 코드 폴더(목표) | 비고 |
| --- | --- | --- |
| 학습 | `src/learning/` | Phase 4에서 시작. |
| 글쓰기 | `src/writing/` | Phase 5에서 시작. |
| 피드백 | `src/feedback/` | Phase 5에서 시작. |
| 인증/세션 | `src/auth/` | Phase 2에서 시작. |
| 공통 UI/테마 | `src/theme/`, `src/components/` | Phase 1에서 시작. |
| 라우트/레이아웃 | `src/app/` | Phase 1·3에서 시작. |

폴더 경계가 흐려졌다고 판단되면 Architecture Pass 단계에서 잡습니다.

## 관련 파일

- 사용자 흐름 정본: [docs/flow/user-flow.md](flow/user-flow.md)
- IA 인덱스: [docs/Wireframe/README.md](Wireframe/README.md)
