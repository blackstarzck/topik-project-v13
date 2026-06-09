# A2 완료 보고 — 데이터 형태 계약 + 화면 견고화 (G2·G9·G11, F3) (2026-06-09)

> 사이클: 실행계획([`A2-plan.md`](A2-plan.md)) → **적대검수**([`A2-claude-review.md`](A2-claude-review.md), 임시 Claude 게이트, PASS-WITH-FIXES) → 실행 → 검증 → 본 보고. Track A(owner 게이트 없음).
> 검수 게이트: codex(GPT-5.5) 토큰 만료로 **임시 Claude 새-맥락 적대검수**로 대체(owner 승인). codex 복구 시 GPT-5.5 재검수 권장.

## 1. 한 줄 요약 (비개발자용)
학생 화면에 들어가는 "문제 데이터 변환기"는 점검해 보니 **이미 잘못된 데이터에도 안 깨지게** 돼 있었습니다(약 4,100조합 자동 테스트로 확인). 그래서 큰 수술 없이 **① 그 튼튼함을 테스트로 못 박고 ② 데이터 모양 규칙을 문서로 적고 ③ "도저히 풀 수 없는 문제"는 제출을 막도록 보강**했습니다. 빌드·테스트·실제 쓰기 화면 모두 통과했습니다.

## 2. 한 일 / 변경
- **문서(신규)** `docs/writing-problem-content-shape-contract.md` — 타입별 데이터 모양 + 폴백 + 제출차단 규약. C3/C-TAX의 write 검증 기준.
- **코드** `src/lib/writing/problem-normalizer.ts` (3곳, 최소):
  - 바닥 배열 rubric → conditions·criteria **둘 다** 흡수(미래 admin raw write 대비; 객체 경로 불변).
  - **q51 빈칸 0개 → 제출차단**(problem_data_incomplete) 신규.
  - **q53 차트 0 AND 과제 0 → 제출차단** 신규(둘 다 없으면 풀 수 없음). 하나라도 있으면 차단 안 함.
- **테스트** `tests/lib/writing/problem-normalizer.test.ts` 확장: 적대 입력 40케이스(4타입×10) throw 없음 + 배열 rubric 양쪽 채움(52 오탐 방지) + 51/53 차단 + **글자수↔프롬프트 드리프트 가드**(53 "200~300"·54 "600~700" = recommended).

> (위 normalizer·test 파일은 세션 이전부터 untracked인 진행 중 쓰기 기능 파일 — A2 편집이 그 안에 포함. 커밋 시 함께. [[feedback-concurrent-agent-worktree]])

## 3. 검수 반영 (Claude 적대검수 PASS-WITH-FIXES)
- **P0 크래시 경로 0건** — 퍼징으로 "이미 방어적" 확인(prompt는 DB not-null, jsonb 전부 가드).
- P1-1 적대 테스트 보강 / P1-2 배열 rubric early-branch+양쪽 채움 / P1-3 51·53 제출차단 / P2 계약에 top-level 차트·prompt 폴백·scenario 필드·prompt=string 불변식 명시 — **전부 반영**.

## 4. 수용 기준 충족 증거
- **typecheck** `pnpm typecheck` exit 0.
- **단위** `pnpm vitest run tests/lib/writing/` → **10 files, 97 passed**(기존 466 스모크 등 회귀 0 + 신규).
- **E2E** `playwright core-writing-flow --project=desktop-1280` → **2 passed**(로그인 + 작성→제출→피드백→비교→라이브러리→내보내기). 실제 쓰기 화면 회귀 0.

## 5. owner 인지 (사용자 영향 변경)
- **51·53 제출차단 신규**: "빈칸이 하나도 없는 51" 또는 "차트도 과제도 없는 53" = 풀 수 없는 문제 → 제출 버튼 차단(기존 52·54와 동일 패턴). **정상 출제된 문제엔 영향 없음**(공개된 217개는 데이터 완전). 원치 않으면 쉽게 되돌림(조건 1~2줄). 계약 §4에 명시.

## 6. 잔여 · 후속
- codex 복구 시 A2를 **GPT-5.5로 재검수** 권장(현재 같은 계열 Claude 검수).
- 형태 계약은 C3(저작기 클라 검증)·C-TAX가 재사용. 서버측 검증 RPC 필요 여부는 C3c 결정.

## 7. Docs consulted
`problem-normalizer.ts`·`constants.ts`·기존 test, `A2-plan.md`·`A2-claude-review.md`, 정합문서 §10(G8), `20260608120200`(rubric/차트 형태), 상위 계획.
