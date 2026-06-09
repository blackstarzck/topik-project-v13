# 07-C-03 다시 풀기 모달 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: C-03 / (host: 문제 목록 `/practice/problems`)
- **audience**: user
- **캡처 상태**: **DEFERRED (live 트리거 불가)** — 컴포넌트 소스 + SOT 기반 평가
- **host**: 문제 목록 위 모달(`RetryModal`)

## 2. 캡처 증거 / DEFERRED 사유
- 실시간 캡처 실패: 학생은 제출 5건이 있으나 `problem_attempts`가 비어 있어 `list_user_problems`의 solve_state가 어떤 행도 "풀이함"으로 표시하지 않음 → "다시 풀기" 버튼이 안 떠 모달을 열 수 없음(solve=solved 필터·기본 목록·제목 검색 3가지 모두 실패). 진단 증거: `_diag-07-C-03-retry-modal.png`, `_diag-c03-search.png`. ([[06-C-02]] 풀이 상태 미반영 finding과 동일 근본)
- 평가 근거: `src/components/practice/RetryModal.tsx`(소스) + SOT description.

## 3. Layer 1 — SOT 정합 리뷰 (소스 기준)

| 항목 | 요소/상태 | 판정(소스) | 근거 |
| --- | --- | --- | --- |
| 배경 문제 목록(#1) | dim + 스크롤 잠금 + 포커스 고정, 위험 시 배경 닫기 비활성 | 일치 | `AppModal` + `risky(starting)`일 때 `mask.closable=false`·`keyboard=false` |
| 제목/문제 요약(#2) | 제목 28자 + 요약 3항목, 만료 시 만료 안내+닫기 | 일치 | `title="이전 풀이가 있어요"` + Descriptions(제목 slice(28)·유형 tag·이전 상태+시도횟수+마지막 시각); `expired` 분기로 만료 안내+닫기만 |
| 재풀이 모드 선택(#3) | 모드 3개 이하, 1개 기본 선택, 선택 전 시작 비활성 | 일치 | Radio 3개(새 답안/이전 답안 기반/힌트), 기본=resume(시도 있으면) 또는 fresh |
| 취소/시작 CTA(#4) | CTA 2개 고정, 중복 차단, 실패 시 모달 유지 | **부분(개수 차이)** | 버튼 3개(시작/결과 보기/취소). 중복 차단(`starting`)·시작 실패 시 모달 유지+재시도는 구현 |

**종합 verdict: 부분일치 (소스 기준) + live UNVERIFIED** — 구현은 명세에 충실하나 CTA 개수(3 vs 2) 차이, 그리고 현재 데이터로는 사용자가 도달 불가.

## 4. Layer 2 — 멀티 에이전트 독립 분석 (소스 기준)

- **데이터/도달성 (P1)**: solve_state 미반영으로 **이 모달은 실데이터에서 열리지 않음**. C-03의 가치(이전 풀이 확인 → 다시 풀기)가 현재 작동하지 않음. 근본은 [[06-C-02]]의 풀이 상태/`problem_attempts` 연동 갭.
- **UX/IA (양호, 소스)**: "힌트 포함" 모드를 **정직하게 비활성 + 툴팁("준비 중")**으로 처리 — 가짜 기능 안 만듦(좋은 패턴). "결과 보기"로 기존 제출 피드백 deep-link 제공.
- **상태 커버리지 (양호, 소스)**: 만료(expired)·시작 실패·시도 없음(resume 비활성) 분기 모두 처리. 단 `expired`는 problems 스키마에 만료 컬럼이 없어 기본 false(상위 주입 seam) — [[38-X-16]]·lifecycle 미적용과 연결.
- **접근성/반응형**: 소스상 block 버튼·Radio 세로 스택 — 모바일 친화. (실측 불가 → UNVERIFIED-LIVE)
- **적대적 검증**: "도달 불가"는 3가지 방법으로 확정. "CTA 2개" 명세 대비 3개는 소스로 확정. 단 소스 품질 자체는 양호(과소평가 금지).

## 5. 결론 — 개선안

### P1 (이번 주 안에)
- **도달성 복구**: [[06-C-02]] solve_state가 `writing_submissions`를 반영하도록 해 "다시 풀기"가 뜨게 → C-03 진입 가능. — 근거: Layer 2 데이터/도달성.

### P2 (여유 있을 때)
- **CTA 개수 정렬**: SOT "CTA 2개 고정" vs 현재 3개(시작/결과 보기/취소). "결과 보기"를 요약 영역 링크로 옮기는 등 정렬 검토.
- **만료 분기 배선**: lifecycle/만료 컬럼이 적용되면 `expired` 주입 연결(현재 seam).

> 참고: live 캡처 불가로 소스+SOT 기준 평가. attempts가 채워진 환경에서 실측 재확인 권장.
