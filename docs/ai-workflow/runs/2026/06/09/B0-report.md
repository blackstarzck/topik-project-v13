# B0 완료 보고 — 기존 데이터 노출·분류 백필 판정 (2026-06-09)

> 페이즈 B0 (Track B, owner 결정) · 상위: [`2026-06-09-writing-questionbank-remediation.md`](../../../../superpowers/plans/2026-06-09-writing-questionbank-remediation.md)
> 사이클: 실행계획([`B0-plan.md`](B0-plan.md)) → GPT-5.5 리뷰([`B0-gpt55-review.md`](B0-gpt55-review.md), PASS-WITH-FIXES) → owner 승인 ✅ → 실행 → 검증 → 본 보고

## 1. 한 줄 요약 (비개발자용)
쓰기 문제 466개 중 숨겨진 249개는 **"아직 검수 안 된" 문제라 일부러 숨긴 것**이 맞았습니다. 그래서 **그대로 두기로** 했고(일괄 공개 안 함), 앞으로는 **검수 통과 후 관리자가 직접 "공개"를 눌러야** 사용자에게 보이도록 규칙을 정했습니다. 데이터·코드는 **아무것도 바꾸지 않았습니다**(규칙 문서화만).

## 2. 한 일 / 변경
- **데이터/스키마 변경 없음**(D1=현재 상태 유지 → 백필 마이그레이션 불필요).
- 문서:
  - 본 B0 산출 3종(plan/review/report) 작성.
  - 노출 규칙을 정합 문서에 명문화: `docs/writing-questionbank-reconciliation.md` (노출 규칙 절).
  - 상위 계획에 B0 확정 결과 반영(→ C1: 명시적 공개 + D6 리포트, → B1: CHECK 전 NULL 백필 필수).

## 3. owner 확정 결정 (승인됨)
| 결정 | 내용 |
|---|---|
| **D1** | **현재 노출 상태 유지** — 249개(검수 대기) 일괄 공개 안 함. 검수 통과분만 개별 공개. |
| **D2** | 노출 규칙 = **기술 게이트** `published + public(RLS) + lifecycle active(화면)` / **프로세스 전제** `review_status=approved`(관례, 시스템이 강제 안 함). |
| **D3** | **명시적 공개 액션** — 검수 완료가 자동 공개를 트리거하지 않음. 관리자가 게시+공개를 따로 수행(C1). |
| **D4** | `topic_category_code` NULL 처분은 **B1로 위임**. **단 B1은 CHECK 추가 전 NULL 백필/NULL 허용을 먼저 결정.** |
| **D5** | `lifecycle_status` 전부 active 유지(이상 없음). |
| **D6** | **신규**: `approved AND NOT(published&public&active)` **관리자 리포트/필터** → C1 또는 후속 운영 점검에 포함(숨김 고착 방지). |

## 4. 수용 기준 충족 증거
- "어떤 문제가 왜 보이는가" 단정: 기술 게이트 3축 + 프로세스 전제 1개로 분리 명문화(D2).
- 의도치 않은 공개/비공개 0: 시드 466건에서 `published/public/approved=217`·`draft/private/pending=249`, 반례(`draft/approved`·`published/pending`) **0건** — Claude 파서 + **GPT-5.5 독립 재확인** 일치.
- D3/D4/D6가 각각 C1/B1/C1의 선행 입력으로 기록됨.

## 5. 게이트 결과
- **GPT-5.5 리뷰 게이트**: PASS-WITH-FIXES → 지적 R1–R5 전부 plan 반영 후 통과.
- **owner 승인**: D1=유지, D3=명시적 액션, D2/D4/D5/D6=권고 채택. ✅
- **스키마 문서 게이트**: 미발동(스키마 변경 없음).
- **E2E**: 코드 변경 없음 → 해당 없음.

## 6. 잔여 리스크 · 후속
- **live DB 재확인: ✅ 완료(2026-06-09, service role 읽기)** — A1-plan §8 참조. live 470건: `published/public/approved`=221 ↔ `draft/private/pending`=249(완벽 1:1), **D6 누수=0**, `topic_category_code` 470 전부 NULL. **B0 결론(D1 현상유지) live에서도 유효.** 시드(466) 대비 +4건(전부 정상 published).
- **드리프트 발견(중요)**: live는 `lifecycle_status` **미적용**(마이그 20260608120100 pending). → B0 노출 규칙의 "lifecycle active" 기술 게이트는 **현재 live에서 미작동**(컬럼 없어 화면 fallback). lifecycle 적용 후에야 3축 완성. → A1/마이그 적용 트랙으로 이관.
- **`list_user_problems_writing_state` lifecycle 누수(R5)**: live에 lifecycle 컬럼 없으므로 현재는 누수 개념 자체가 N/A. lifecycle 적용 후 재확인.
- **숨김 고착(D3 선택의 부작용)**: D6 리포트로 완화 — C1에서 구현.

## 7. 다음
- **C1**(노출 표면)에 D3(명시적 공개)·D6(누수 리포트) 반영.
- **B1**(주제 코드셋)에 D4 시퀀싱(NULL 백필/허용 → CHECK) 반영.
- 권장 다음 페이즈: **A1**(타입 동기화, v13 즉시) 또는 **B1**(주제 코드셋, B0 후속).

## 8. Docs consulted
`B0-plan.md`, `B0-gpt55-review.md`, `2026-06-09-writing-questionbank-remediation.md`, `writing-questionbank-reconciliation.md`, `20260608120200_seed_writing_problem_fixtures.sql`, `20260520121100_rls_policies.sql`, `src/lib/writing/server.ts`, `20260609120000_list_user_problems_writing_state.sql`.
