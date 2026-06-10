# 18-F-01 내 서재 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: F-01 / `/library`
- **audience**: user
- **상태**: PASS
- **host**: 단독 페이지. PDF 내보내기는 F-M1 모달에서 별도 검증.

## 2. 보정 요약
- 저장 답안 행의 제목을 `문제 <UUID prefix>`가 아니라 실제 `problems.title` 기반으로 표시하도록 `problem_id -> problems.title` 조인을 추가했다.
- 검색 입력은 40자 제한을 유지하고, 2자 미만 검색어는 필터링하지 않도록 F-01 명세의 2-40자 조건을 맞췄다.
- 제출/리포트/문제/내보내기 탭 모두 10개 단위 페이지네이션과 결과 수 표시를 공유하도록 정리했다.
- 우측 통계 패널은 저장 수, 평균 점수/취약 유형, 복습 상태의 최대 3개 카드로 제한했다.
- Ant Design deprecated `List.Item` 사용을 제거해 F-01 브라우저 검증 중 콘솔 오류가 남지 않게 했다.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 검색/필터 (#1) | 2-40자 검색, 상태/기간 필터, 결과 수 표시 | 일치 | `library-search` maxlength 40, fixture 검색 결과 1건 |
| 내보내기/생성 액션 (#2) | 선택 필요, 액션 3개 이하, 선택 전 disabled | 일치 | 선택 0건에서 PDF/복습 생성 disabled, 선택 후 PDF enabled |
| 저장 콘텐츠 목록 (#3) | 10개/페이지, 제목 32자 이하, 미리보기 2줄, 상태 배지 | 일치 | 공통 `LibraryPagination`, 행 제목은 실제 문제 제목 사용 |
| 우측 통계 (#4) | 통계 카드 3개 이하, 최근 갱신 정보 | 일치 | 모바일/태블릿/데스크톱 모두 `library-stat-card` 3개 |
| 페이지 이동 (#5) | 페이지 버튼 최대 5개, 총 건수 하단 | 일치 | 모든 탭에 공통 10개 단위 페이지네이션 적용 |

**종합 verdict: PASS.** 이전 P2였던 저장 항목 UUID 라벨은 제거됐다.

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/18-F-01-my-library.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/18-F-01-my-library/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/18-F-01-my-library/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/18-F-01-my-library/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/18-F-01-my-library/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/18-F-01-my-library/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec tsc --noEmit --pretty false`
- `pnpm lint`
- `pnpm exec playwright test tests/e2e/screens/library.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280`
- F-01 캡처 생성 스크립트: 모바일/태블릿/데스크톱 rowCount 1, statCardCount 3, console error 0

## 6. 남은 리스크
- 복습 세트 생성은 현재 구현의 `study_events` 기록 흐름을 유지했다. 별도 review-set 저장 대상은 현행 F-01 문서와 DB 기준에서 확정된 스키마가 아니므로 이번 범위에서 새로 만들지 않았다.
