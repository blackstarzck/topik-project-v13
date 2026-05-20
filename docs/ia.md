# TALKPIK AI IA 인덱스

이 문서는 TALKPIK AI의 페이지별 IA 문서 진입점입니다. IA는 Information
Architecture의 줄임말로, 각 화면이 어떤 영역으로 구성되고 사용자가 어디로 이동할 수
있는지를 정의합니다.

이 프로젝트는 두 개의 IA 산출물을 서로 다른 역할로 보관합니다.

| 산출물 | 위치 | 역할 | 우선순위 |
| --- | --- | --- | --- |
| 페이지별 IA (현행) | `docs/IA/{순번}-{코드}-{slug}/description.md` + `wireframe.png` | 32개 페이지의 와이어프레임 + 상세 영역 맵 | **현행 정본** |
| 페이지별 화면 구성 (레거시 관측) | `docs/ia-pages/*.md` | 2026-04-22 배포 HTML 사이트의 화면 영역 관측 기록 | 참고용 레거시 |

두 산출물은 시점과 목적이 다릅니다.

- `docs/IA/`는 새로 만들 화면의 **목표 IA**입니다(쓰기 51/52/53/54, 페이월, 구독,
  관리자, 기관 관리자, 약점 기반 추천 등을 포함).
- `docs/ia-pages/`는 레거시 HTML 사이트가 실제 어떻게 구성되어 있었는지의
  **관측 기록**입니다(단어장, 게시판 등 현행 IA에 1:1 대응되지 않는 영역도 포함).

구현/QA/리뷰는 `docs/IA/`를 정본으로 사용하고, `docs/ia-pages/`는 보조 컨텍스트로만
참조합니다. 사용자 플로우는 `docs/flow/user-flow.md`가 정본이며 `docs/IA/`의
`Source` 값과 노드명이 1:1 대응됩니다.

## 현행 페이지별 IA (정본)

전체 32페이지의 목록은 `docs/IA/README.md`에서 관리합니다.

- 인덱스: [`docs/IA/README.md`](IA/README.md)
- 정합성 분석 리포트: [`docs/IA/analysis-report.md`](IA/analysis-report.md)
- 연동된 사용자 플로우: [`docs/flow/user-flow.md`](flow/user-flow.md)

페이지 그룹:

- 인증 / 온보딩: A-01, A-02, A-03, X-06
- 학습 홈 / 추천: B-01, C-01, C-02, X-02, X-07
- 작성 (51/52/53/54): D-01, D-02, D-03, D-04
- 작성 보조 모달: C-03, D-M1, D-M2, D-M3
- 피드백 / 리포트 / 추천: E-01, E-02, R-01, R-02
- 내 서재 / 내보내기: F-01, F-M1
- 설정 / 결제 / 알림: G-01, X-03, X-04, X-05, X-09
- 관리자 / 기관: H-01, X-08, X-10
- 랜딩: X-01

## 레거시 화면 구성 관측 (참고)

확인 기준: 2026-04-22에 배포 사이트 `https://topik-ai-nqgl.vercel.app/home.html`를
Playwright MCP로 직접 탐색한 화면과 클릭 결과.

이 목록은 새 구현의 기준이 아니라 제품 히스토리 컨텍스트입니다.

### 공통

- [공통 레이아웃 및 전역 요소](ia-pages/00-common-layout.md)

### 홈

- [홈 V1](ia-pages/01-home-v1.md)
- [홈 V2](ia-pages/02-home-v2.md)

### 학습 생성 및 풀이

- [AI 맞춤 문제 생성](ia-pages/03-practice-create.md)
- [문제 풀이](ia-pages/04-practice-solve.md)
- [쓰기 집중 연습 설정](ia-pages/05-writing-practice-create.md)
- [쓰기 연습 51번](ia-pages/06-writing-51.md)
- [쓰기 연습 53번](ia-pages/07-writing-53.md)

### 개인 학습 관리

- [내 서재](ia-pages/08-my-library.md)
- [단어장](ia-pages/09-my-vocabulary.md)
- [쓰기 보관함](ia-pages/10-writing-feedback-list.md)
- [쓰기 피드백 상세](ia-pages/11-writing-feedback-detail.md)

### 모의고사

- [모의고사 결과](ia-pages/12-mock-exam-results.md)
- [전체 응시 기록](ia-pages/13-mock-exam-history.md)
- [실전 모의고사 생성](ia-pages/14-mock-test-setup.md)
- [실전 모의고사 풀이](ia-pages/14-1-mock-test-exam.md)

### 커뮤니티 및 계정

- [게시판](ia-pages/16-board.md)
- [공지 상세](ia-pages/17-notice-detail.md)
- [프로필 설정](ia-pages/18-profile-settings.md)

### 레거시 미해결 항목

- [확인 필요 및 남은 위험](ia-pages/99-open-questions.md)

## 연결 문서

- [사이트맵 및 페이지 연결도](sitemap.md)
- [현행 사용자 플로우](flow/user-flow.md)
- [레거시 사용자 플로우 (관측)](user-flow.md)
- [PRD](prd.md)
- [Implementation Spec](spec.md)
