# TALKPIK AI 사이트맵 및 페이지 연결도

> Status note (2026-05-18)
>
> 이 문서는 두 개의 라우트 맵을 분리해 보관합니다.
>
> 1. **Target React Route Map** — current route target. Use this document
>    together with `docs/spec.md`.
> 2. **Legacy HTML Route Map** — 2026-04-22 관측 기반 사이트맵. 제품 히스토리 컨텍스트로만 사용.
>
> Do not use `src/App.tsx` as the route authority. Until source exists, this
> document is the route authority; after implementation starts, the Next.js
> `src/app/` route tree becomes the implementation reference.

확인 기준: 2026-04-22에 배포 사이트를 Playwright MCP로 직접 탐색한 화면과 클릭 결과입니다.

이 문서는 사이트맵, 페이지 뎁스, 주요 연결 상태를 Mermaid 코드로 볼 수 있게 정리한 문서입니다. Mermaid는 문서 안에서 화면 구조를 다이어그램으로 표현하는 문법입니다.

## Target React Route Map

| Page (IA Code) | React route | Notes |
| --- | --- | --- |
| Home V1 (B-01) | `/` | 홈 대시보드 |
| Home V2 | `/home-v2` | 쓰기 중심 변형 홈 |
| Practice generation (C-01) | `/practice/create` | AI 맞춤 문제 생성 |
| Practice solving (C-02) | `/practice/solve` | 문제 풀이 |
| Writing setup | `/writing/setup` | 쓰기 집중 연습 설정 |
| Writing task 51 (D-01) | `/writing/51` | 51번 단답 |
| Writing task 52 (D-02) | `/writing/52` | 52번 답안 작성 |
| Writing task 53 (D-03) | `/writing/53` | 53번 장문 |
| Writing task 54 (D-04) | `/writing/54` | 54번 에세이 |
| Library (F-01) | `/library` | 내 서재 |
| Vocabulary | `/vocabulary` | 단어장 |
| Writing feedback list | `/writing/feedback` | 쓰기 보관함 |
| Writing feedback detail (E-01 / E-02) | `/writing/feedback/:id` | 단답 / 장문 피드백 상세 |
| Mock results | `/mock/results` | 모의고사 결과 |
| Mock exam (live) | `/mock/exam` | 실전 모의고사 풀이 |
| Board | `/board` | 게시판 |
| Profile (X-05 / G-01) | `/profile` | 프로필 / 언어 설정 |
| Paywall (X-03) | `/paywall` | 페이월 / 구독 진입 |
| Subscription (X-04) | `/subscription` | 구독 관리 |
| Growth dashboard (X-02) | `/growth` | 성장 대시보드 |
| Notifications (X-09) | `/notifications` | 알림 설정 |
| Admin: problems (H-01) | `/admin/problems` | 관리자 문제 관리 |
| Admin: users (X-10) | `/admin/users` | 관리자 사용자 관리 |
| Org admin (X-08) | `/admin/org` | 기관 관리자 대시보드 |

모달(D-M1 / D-M2 / D-M3 / F-M1 / C-03)은 라우트가 아니라 호출 화면 위에 오버레이로 뜨며, 복귀 대상은 호출 원본 화면입니다(`docs/flow/user-flow.md` 참조).

## Legacy HTML Route Map (관측, 참고용)

| Legacy observed URL | Maps to (current) | Notes |
| --- | --- | --- |
| `/home.html` | `/` | Home V1 |
| `/home_v2.html` | `/home-v2` | Home V2 |
| `/practice_create.html` | `/practice/create` | |
| `/practice_solve.html` | `/practice/solve` | |
| `/writing_practice_create.html` | `/writing/setup` | |
| `/writing_51.html` | `/writing/51` | |
| `/writing_53.html` | `/writing/53` | |
| `/my_library.html` | `/library` | |
| `/my_vocabulary.html` | `/vocabulary` | |
| `/writing_feedback_list.html` | `/writing/feedback` | |
| `/writing_feedback_detail_*.html` | `/writing/feedback/:id` | |
| `/mock_exam_results.html` | `/mock/results` | |
| `/mock_test_exam.html` | `/mock/exam` | |
| `/board.html` | `/board` | |
| `/profile_settings.html` | `/profile` | |
| `/mock_exam_history.html` | no dedicated route | 모의고사 결과 하위 탭으로 흡수 검토 |
| `/mock_test_setup.html` | no dedicated route | 모의고사 결과 하위 흐름으로 흡수 검토 |
| `/notice_detail.html` | no dedicated route | 게시판 상세 라우트(`/board/:id`)로 정리 검토 |

## 뎁스 기준

- Depth 0: 사용자가 처음 들어오는 홈
- Depth 1: 사이드바나 홈에서 바로 갈 수 있는 주요 화면
- Depth 2: 주요 화면에서 한 번 더 들어가는 설정, 목록, 상세, 풀이 화면
- Depth 3: 풀이나 상세 화면 안에서 이어지는 세부 행동 화면
- 공통 오버레이: 특정 페이지에 속하지 않고 여러 화면 위에 뜨는 AI 튜터

## 사이트맵

```mermaid
flowchart TD
  D0_HOME["Depth 0\n홈 V1\n/home.html"]

  subgraph D1["Depth 1: 주요 진입 화면"]
    HOME_V2["홈 V2\n/home_v2.html"]
    LIBRARY["내 서재\n/my_library.html"]
    VOCAB["단어장\n/my_vocabulary.html"]
    WRITING_LIST["쓰기 보관함\n/writing_feedback_list.html"]
    MOCK_RESULTS["모의고사 결과\n/mock_exam_results.html"]
    BOARD["게시판\n/board.html"]
    PROFILE["프로필 설정\n/profile_settings.html"]
    PRACTICE_CREATE["AI 맞춤 문제 생성\n/practice_create.html"]
    WRITING_CREATE["쓰기 집중 연습 설정\n/writing_practice_create.html"]
  end

  subgraph D2["Depth 2: 풀이, 상세, 기록 화면"]
    PRACTICE_SOLVE["문제 풀이\n/practice_solve.html"]
    WRITING_51["쓰기 51번 연습\n/writing_51.html"]
    WRITING_53["쓰기 53번 연습\n/writing_53.html"]
    FEEDBACK_DETAIL["쓰기 피드백 상세\n/writing_feedback_detail_*.html"]
    MOCK_HISTORY["전체 응시 기록\n/mock_exam_history.html"]
    MOCK_SETUP["실전 모의고사 생성\n/mock_test_setup.html"]
    NOTICE_DETAIL["공지 상세\n/notice_detail.html"]
  end

  subgraph D3["Depth 3: 시험 및 세부 진행"]
    MOCK_EXAM["실전 모의고사 풀이\n/mock_test_exam.html"]
    OMR["OMR 답안지\n시험 화면 내부 패널"]
  end

  subgraph OVERLAY["공통 오버레이"]
    AI_TUTOR["AI 튜터 패널\n홈 / 채팅 / 알림"]
  end

  D0_HOME --> HOME_V2
  D0_HOME --> PRACTICE_CREATE
  D0_HOME --> WRITING_CREATE
  D0_HOME --> WRITING_51
  D0_HOME --> WRITING_53
  D0_HOME --> BOARD

  D0_HOME --> LIBRARY
  D0_HOME --> VOCAB
  D0_HOME --> WRITING_LIST
  D0_HOME --> MOCK_RESULTS
  D0_HOME --> PROFILE

  HOME_V2 --> D0_HOME
  HOME_V2 --> WRITING_CREATE
  HOME_V2 --> WRITING_LIST
  HOME_V2 --> BOARD
  HOME_V2 --> VOCAB
  HOME_V2 --> LIBRARY

  PRACTICE_CREATE --> PRACTICE_SOLVE
  WRITING_CREATE --> WRITING_51
  WRITING_CREATE --> WRITING_53

  WRITING_LIST --> FEEDBACK_DETAIL
  FEEDBACK_DETAIL --> WRITING_LIST
  FEEDBACK_DETAIL --> WRITING_51
  FEEDBACK_DETAIL --> WRITING_53

  MOCK_RESULTS --> MOCK_HISTORY
  MOCK_RESULTS --> MOCK_SETUP
  MOCK_HISTORY --> MOCK_SETUP
  MOCK_SETUP --> MOCK_EXAM
  MOCK_EXAM --> OMR

  BOARD --> NOTICE_DETAIL
  NOTICE_DETAIL --> BOARD

  D0_HOME -.->|전역 실행| AI_TUTOR
  LIBRARY -.->|전역 실행| AI_TUTOR
  VOCAB -.->|전역 실행| AI_TUTOR
  WRITING_LIST -.->|전역 실행| AI_TUTOR
  MOCK_RESULTS -.->|전역 실행| AI_TUTOR
  BOARD -.->|전역 실행| AI_TUTOR
  PROFILE -.->|전역 실행| AI_TUTOR

  D0_HOME -.->|클릭 가능하지만 이동 미확인| MOCK_SETUP
```

## 주요 사용자 흐름 연결도

```mermaid
flowchart LR
  START["사용자 진입\n홈 V1"] --> DASHBOARD["학습 현황 확인"]

  DASHBOARD --> READ_CARD["듣기/읽기 집중 선택"]
  READ_CARD --> PRACTICE_SETUP["AI 맞춤 문제 생성"]
  PRACTICE_SETUP --> TYPE_SELECT["영역 / 급수 / 유형 선택"]
  TYPE_SELECT --> PRACTICE_SOLVE["문제 풀이"]

  DASHBOARD --> WRITING_CARD["쓰기 집중 연습 선택"]
  WRITING_CARD --> WRITING_SETUP["쓰기 유형 / 주제 선택"]
  WRITING_SETUP --> WRITING_WORK["쓰기 답안 작성"]
  WRITING_WORK --> WRITING_SUBMIT["제출"]
  WRITING_SUBMIT --> FEEDBACK["쓰기 피드백 확인"]

  DASHBOARD --> CONTINUE["이어하기"]
  CONTINUE --> WRITING_51["51번 쓰기 연습"]

  DASHBOARD --> WEAK["약점 공략"]
  WEAK --> WRITING_53["53번 쓰기 연습"]

  DASHBOARD --> MOCK_RESULTS["모의고사 결과"]
  MOCK_RESULTS --> MOCK_SETUP["새 모의고사 응시"]
  MOCK_SETUP --> MOCK_EXAM["실전 모의고사 풀이"]
  MOCK_EXAM --> OMR["OMR 확인"]
  MOCK_EXAM --> END_EXAM["시험 종료"]
```

## 공통 내비게이션 연결도

```mermaid
flowchart TD
  NAV["공통 사이드바"]
  NAV --> HOME["홈\n/home.html"]
  NAV --> LIBRARY["내 서재\n/my_library.html"]
  NAV --> VOCAB["단어장\n/my_vocabulary.html"]
  NAV --> WRITING_LIST["쓰기 보관함\n/writing_feedback_list.html"]
  NAV --> MOCK_RESULTS["모의고사 결과\n/mock_exam_results.html"]
  NAV --> BOARD["게시판\n/board.html"]

  USER["사용자 프로필 영역\n김토픽 님 / Premium Plan"] --> PROFILE["프로필 설정\n/profile_settings.html"]

  LANG["언어 버튼"] --> KO["KO"]
  LANG --> VI["VI"]
  LANG --> EN["EN"]
```

## AI 튜터 연결도

```mermaid
flowchart TD
  FAB["AI 튜터 플로팅 버튼"] --> AI_HOME["AI 튜터 홈"]

  AI_HOME --> WORD["단어 검색"]
  AI_HOME --> SENTENCE["문장 교정"]
  AI_HOME --> QA["Q&A"]
  AI_HOME --> SUPPORT["1:1 문의"]
  AI_HOME --> RECENT["최근 대화방"]

  AI_HOME --> TAB_HOME["하단 탭: 홈"]
  AI_HOME --> TAB_CHAT["하단 탭: 채팅"]
  AI_HOME --> TAB_NOTI["하단 탭: 알림"]

  TAB_CHAT --> CHAT_LIST["대화방 목록\nQ&A / 단어 검색 / 문장 교정 / FAQ / 1:1 문의"]
  TAB_NOTI --> NOTI_LIST["알림 목록\n학습 리마인더 / 응원 알림 / 공지사항"]

  QA --> INPUT["메시지 입력"]
  WORD --> INPUT
  SENTENCE --> INPUT
  SUPPORT --> INPUT
  INPUT --> SEND["전송"]
  SEND --> ANSWER["답변 표시"]
```

## 깊이별 페이지 목록

```mermaid
flowchart TB
  subgraph DEPTH0["Depth 0"]
    P0["홈 V1"]
  end

  subgraph DEPTH1["Depth 1"]
    P1A["홈 V2"]
    P1B["내 서재"]
    P1C["단어장"]
    P1D["쓰기 보관함"]
    P1E["모의고사 결과"]
    P1F["게시판"]
    P1G["프로필 설정"]
    P1H["AI 맞춤 문제 생성"]
    P1I["쓰기 집중 연습 설정"]
  end

  subgraph DEPTH2["Depth 2"]
    P2A["문제 풀이"]
    P2B["쓰기 51번"]
    P2C["쓰기 53번"]
    P2D["쓰기 피드백 상세"]
    P2E["전체 응시 기록"]
    P2F["실전 모의고사 생성"]
    P2G["공지 상세"]
  end

  subgraph DEPTH3["Depth 3"]
    P3A["실전 모의고사 풀이"]
    P3B["OMR 답안지"]
  end

  P0 --> P1A
  P0 --> P1B
  P0 --> P1C
  P0 --> P1D
  P0 --> P1E
  P0 --> P1F
  P0 --> P1G
  P0 --> P1H
  P0 --> P1I

  P1H --> P2A
  P1I --> P2B
  P1I --> P2C
  P1D --> P2D
  P1E --> P2E
  P1E --> P2F
  P1F --> P2G

  P2F --> P3A
  P3A --> P3B
```

## 표시 규칙

- 실선 화살표: 직접 확인된 이동 또는 화면 연결입니다.
- 점선 화살표: 전역 패널처럼 여러 화면에서 뜨는 연결이거나, 클릭 가능하지만 이동이 명확하지 않은 연결입니다.
- `*`가 들어간 URL은 같은 구조의 상세 페이지가 여러 개 있다는 뜻입니다.
