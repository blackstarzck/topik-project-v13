# A1·A3 GPT-5.5 공동 리뷰 기록 — 2026-06-09

> 입력: `a1a3review.txt`(영문 ASCII) · 모델 gpt-5.5(read-only) · 대상: `A1-plan.md`(경량), `A3-plan.md`

## A1 — 판정: **READY** (실행은 Docker 언블록 후)
- 현 상태 확인됨: `types.ts`에 lifecycle 3컬럼(:178)·`admin_toggle_problem_publish`(:1005)·`list_user_problems_writing_state`(:1036) 존재, `topic_category_code/review_workflow_status/admin_update_problem` 매칭 0(누락 확정).
- regen 접근·acceptance 적절(수동편집 금지).
- **caveat**: 현재 파일은 hand-aligned 스냅샷이라 생성기 출력과 포맷/주석 diff가 클 수 있음 → 생성물 **내부 diff에서 예상 외 스키마 변경(테이블/컬럼/RPC) 별도 review** 필요. (A1-plan §6/§3 반영됨.)

## A3 — 판정: **PASS** (필수 수정 없음)
- A3.1 상수값 인용대로 정확(constants.ts:21~). `isCountSubmittable`은 hard 사용(:31).
- A3.2 시드 발견 정확: 51=90/52=76/53=62/54=238(합 466); `200~300`=62, `600~700`=238, 51/52 내장 범위 없음. **54에 `200~300` 섞인 반례 없음**. 30점 62 / 50점 212 확인.
- A3.3 "hard<recommended 의도, 프롬프트=recommended" 추론 sound — WritingEditor.tsx:74·LongFormEditor.tsx:144도 hard로 게이트. **코드 어디에도 문제별 char limit read 없음**(타입 상수 정책 일치). ⚠️ 단, 프롬프트 문구("200~300자로 쓰시오")를 hard 규칙으로 본다면 #53 130자 제출허용은 UX 이슈가 될 수 있음 — 현재는 의도된 완화(owner 인지용).
- A3.4 guard test는 이번 blocker 아님(불일치 0·코드 무변경). 다음 seed/char-policy 변경 페이즈에서 요구 권장 → **A2 후속으로 이관**.
- A3.5 blind spot: live DB가 시드와 다를 수 있음 → DB 가능 시 `problems` 실제 prompt 집계 1회.

## 결론
A3 게이트 통과(코드 변경 없는 QA·정책 확정). A1은 계획 확정, 실행만 환경 대기.
