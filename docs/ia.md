# TALKPIK AI IA 인덱스

이 문서는 TALKPIK AI의 페이지별 IA 문서 진입점입니다. IA는 Information
Architecture의 줄임말로, 각 화면이 어떤 영역으로 구성되고 사용자가 어디로 이동할 수
있는지를 정의합니다.

현재 `docs/Wireframe/` 기준 IA는 35개 화면입니다(기존 34개 화면 + 코드베이스 기준 추가 화면 5개(X-13~X-17) − 별도 관리자 앱(topik-ai) 소관으로 제거된 관리자 화면 4개).

| 산출물 | 위치 | 역할 | 우선순위 |
| --- | --- | --- | --- |
| 페이지별 IA (현행) | `docs/Wireframe/{순번}-{코드}-{slug}/description.md` + `functional-spec.md` | 35개 페이지의 화면 설명 + 기능명세. X-13~X-17은 기존 34개 이후 코드베이스 기준으로 추가된 화면 | **현행 정본** |

구현/QA/리뷰는 `docs/Wireframe/`를 정본으로 사용합니다. 사용자 플로우는
`docs/flow/user-flow.md`가 정본이며 `docs/Wireframe/`의 `Source` 값과 노드명이
1:1 대응됩니다.

## 현행 페이지별 IA (정본)

전체 35페이지의 목록은 `docs/Wireframe/README.md`에서 관리합니다.

- 인덱스: [`docs/Wireframe/README.md`](Wireframe/README.md)
- 기능명세 인덱스: [`docs/Wireframe/functional-spec-index.md`](Wireframe/functional-spec-index.md)
- 데이터 사용 인덱스: [`docs/Wireframe/data-usage-index.md`](Wireframe/data-usage-index.md)
- 연동된 사용자 플로우: [`docs/flow/user-flow.md`](flow/user-flow.md)

페이지 그룹:

- 인증 / 온보딩: A-01, A-02, A-03, X-06, X-16, X-17
- 학습 홈 / 추천: B-01, C-01, C-02, X-02, X-07
- 작성 (51/52/53/54): D-01, D-02, D-03, D-04
- 작성 보조 모달: C-03, D-M1, D-M2, D-M3
- 피드백 / 리포트 / 추천: E-01, E-02, R-01, R-02
- 내 서재 / 내보내기: F-01, F-M1
- 설정 / 결제 / 알림: G-01, X-03, X-04, X-05, X-09
- 랜딩 / 법적 문서: X-01, X-13, X-14

## 연결 문서

- [사이트맵 및 페이지 연결도](sitemap.md)
- [현행 사용자 플로우](flow/user-flow.md)
- [PRD](prd.md)
- [Implementation Spec](spec.md)
