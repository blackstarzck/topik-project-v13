# B4 결정 — review_workflow_status enum 확정 + CHECK 제약 + NULL 정책 (D-C) (2026-06-09)

> owner가 **Opus 4.8 에이전트에 위임**. 에이전트가 v13(스키마 SoT)·topik-ai(별도 저장소) 실소스 대조 후 확정.
> 파일:라인 근거 포함. **이 결정 = docs-only(now)**. CHECK 마이그레이션 적용은 DB/Docker 게이트(이 환경 불가).

## DECISION (한 줄)
**frozen CHECK 채택**(관리형 테이블 아님). 고정·소규모(5값)·프로세스 소유 enum이라 B1(주제 분류, 46+ 자유텍스트 롱테일 → 관리형)과 **반대 성격**. 확정 enum = `not_started / in_progress / on_hold / done / revision_requested`(5값 그대로). CHECK는 **NULL 허용**(470 live 행 = "워크플로우 미진입"). `review_status`와 **병합 없음**, `보류(on_hold)`는 `review_status` 불변. cross-field 규칙은 **DB에 강제하지 않고 admin write 로직에 위임**.

---

## 1. frozen CHECK vs 관리형 테이블 — CHECK

**채택: 컬럼에 frozen CHECK.** B1과 결정적으로 다르다.

| 축 | review_workflow_status (B4) | 주제 분류 topic_category_code (B1) |
|---|---|---|
| 집합 크기 | **고정 5값** | 46+ 자유텍스트 라벨(롱테일) |
| 변동성 | 검수 **프로세스 단계** — 거의 안 바뀜 | 운영 중 카테고리 추가/비활성 빈번 |
| 소유 | 프로세스(시스템 정의) | 콘텐츠 운영자(데이터) |
| 출처 | topik-ai 코드의 **닫힌 TS union 5값**(`assessment-question-bank-types.ts:3-8`) | topik-ai 자유 라벨 + 신규 |
| 결론 | **frozen CHECK**(작고 고정 → 마이그레이션 빈도 0에 가까움) | 관리형 참조 테이블(FK+RPC 검증) |

근거: 검수 단계는 TOPIK 검수 워크플로우의 **상태 기계**다. 상태가 늘어나는 건 제품 프로세스 변경이라 드물고, 그때는 마이그레이션이 정당하다(데이터 운영이 아니라 프로세스 변경). B1처럼 운영자가 일상적으로 값을 추가하는 taxonomy가 아니다. 별도 테이블/FK는 5값 상태 기계엔 과설계.

---

## 2. 확정 enum + KO↔ASCII 매핑

PROPOSED 5값 **그대로 확정**. topik-ai가 실제로 쓰는 값과 1:1 일치(`supabase-assessment-question-bank-service.ts:236-240`), 변경 불필요.

| topik-ai 한글 라벨 | ASCII 코드(확정) | admin 액션 시 동반 review_status |
|---|---|---|
| 검수 대기 | `not_started` | (변경 없음) |
| 검수 중 | `in_progress` | (변경 없음) |
| 보류 | `on_hold` | **(변경 없음 — 보존)** |
| 검수 완료 | `done` | `approved` |
| 수정 필요 | `revision_requested` | `rejected` |

근거: 매핑은 `REVIEW_STATUS_WRITE_MAP`(서비스 235-241)에 코드로 박혀 있고, 라벨 union은 `AssessmentQuestionReviewStatus`(타입 3-8)로 **닫혀 있다**. 다섯 외 값은 타입상 생성 불가.

---

## 3. NULL 정책 + CHECK 술어 — NULL 허용(백필 안 함)

**CHECK는 NULL을 허용한다. 백필하지 않는다.**
- live 470 writing 행 전부 NULL = "관리자 검수 워크플로우 **미진입**" — 정확한 의미. `not_started`로 백필하면 "검수 대기 큐에 올랐다"는 **없던 의미를 주입**(B0 §9: 숨김 249건은 의도된 staging이지 "검수 시작됨"이 아님). NULL("미진입") vs `not_started`("대기 진입")는 의미가 다르므로 보존한다.
- 백필 없음 → 적용 즉시 위반 행 0(470 NULL 모두 통과). 추가 데이터 마이그레이션 불필요.

**확정 CHECK 술어:**
```sql
alter table public.problems
  add constraint problems_review_workflow_status_check
  check (
    review_workflow_status is null
    or review_workflow_status in
       ('not_started','in_progress','on_hold','done','revision_requested')
  );
```
> `add column if not exists`(20260608120300:48-49)는 그대로 두고, **별도 마이그레이션에서 명명된 CHECK를 추가**(idempotent: `alter table ... add constraint` 전에 `drop constraint if exists` 권장). 익명 CHECK 금지(재실행/롤백 위해 이름 고정).

---

## 4. review_status와의 관계 — 분리 유지, cross-field는 admin write에 위임

**분리 유지(병합 없음) 확정.** 두 축은 의미가 다르다:
- `review_status` = **최종 결과**(pending/approved/rejected), `text NOT NULL default 'pending'` CHECK(`20260520120200_problems.sql:29-30`).
- `review_workflow_status` = **진행 단계**(5값), NULLABLE.

**보류(on_hold)는 review_status를 바꾸지 않는다 — 코드로 보증됨.** `보류` 패치는 `{ review_workflow_status: 'on_hold' }`뿐(`서비스:238`), `review_status` 키가 없다. RPC는 patch의 **키별로만** update를 돌리므로(`admin_update_problem` 키 루프 `20260608120400:65-128`), `review_status` 키가 없으면 그 컬럼을 건드리지 않아 최종 결과가 보존된다. ✔ D-C 충족.

**cross-field 규칙(예: done ⇒ review_status=approved)은 DB에 강제하지 않는다 → admin write 로직에 위임.**
- 이유 1(상태 천이 비단조): `보류`는 의도적으로 단계만 바꾸고 결과를 보존한다. 즉 `on_hold` 행은 review_status가 pending/approved/rejected **무엇이든 합법**이다. 단순 "단계⇒결과" 동치 CHECK는 보류를 깨뜨린다.
- 이유 2(원자성): admin 매핑이 `검수 완료→{approved, done}`, `수정 필요→{rejected, revision_requested}`를 **한 RPC 호출에서 같이 쓴다**(서비스 239-240) → 일관성은 write 시점에 이미 보장. DB 트리거/복합 CHECK는 보류 예외 때문에 부분 함수가 되어 유지비만 늘고, 미래 단계 추가 시 트리거를 매번 손봐야 한다.
- 결론: 단일 컬럼 CHECK(§3)로 **철자(domain) 무결성만** 강제하고, 단계↔결과 의미 일관성은 닫힌 매핑(`REVIEW_STATUS_WRITE_MAP`)이라는 admin write 계약에 둔다. (DB 트리거/복합 CHECK 추가 안 함.)

---

## 5. 시퀀싱/게이트 + admin-write 안전성

**적용 순서(DB/Docker 게이트):**
1. (선행) `20260608120300` 적용 — `review_workflow_status` 컬럼 자체(이미 live에 존재, 470 NULL 확인됨 → 사실상 충족).
2. **신규 마이그레이션**: §3 명명된 CHECK 추가(`drop constraint if exists` → `add constraint`, additive·idempotent, prod=report-only).
3. (G12) 적용 후 live DB에서 Supabase 타입 재생성(현재 types.ts에 review_workflow_status 누락, 정합성 §7).
- **지금 가능 = 이 결정 문서까지.** CHECK 적용은 DB 접근 시.

**admin-write 안전성 체크(중요 — CHECK가 admin 현재 write를 거부하나?): NO.**
- admin이 review_workflow_status에 쓰는 **유일한 경로**는 `setReviewStatusViaRpc` → `REVIEW_STATUS_WRITE_MAP`(서비스 243-261, 235-241). 저장소 전체에서 이 컬럼 write는 여기뿐(grep 확인: 다른 writer 없음).
- 그 맵이 내보내는 값은 **정확히 5 ASCII**(`not_started/in_progress/on_hold/done/revision_requested`)이고, 입력 타입 `AssessmentQuestionReviewStatus`는 **5 한글 라벨로 닫힌 union**(타입 3-8) → 6번째 값 생성 불가.
- 따라서 §3 CHECK는 admin이 **현재 쓰는 모든 값을 통과**시킨다. 거부 위험 0.
- 추가 안전: `admin_update_problem`은 allowlist에 `review_workflow_status` 포함(`20260608120400:48`)하고, CHECK는 잘못된 철자(오타·미래 비인가 값)만 거부 → defense-in-depth.

---

## RISKS + DE-RISK
1. **익명 CHECK로 롤백 불가** → 명명 제약 + `drop constraint if exists` 선행(idempotent).
2. **`not_started` 백필 유혹**(NULL 깔끔하게) → 금지. NULL("미진입")≠not_started("대기 진입"), 의미 손실(§3).
3. **미래 단계 추가**(예: `escalated`) → 프로세스 변경이므로 마이그레이션 정당. 빈도 낮음, 관리형 테이블 불필요.
4. **admin이 우회 경로로 다른 값 write** → 현재 그런 경로 없음(grep 확인). 새 writer 생기면 동일 닫힌 맵 재사용 강제(코드리뷰 게이트).
5. **cross-field 일관성 드리프트**(done인데 review_status≠approved) → admin write가 원자적으로 둘 다 씀(서비스 239-240). DB 강제 안 하는 대신, 필요 시 정합성 **리포트**(B0 D6 식 `approved AND NOT published…`과 동류)로 감지 — 트리거 아님.

## OPEN/ESCALATE
없음. 5값·CHECK·NULL·분리·cross-field 위임 모두 확정. (미래 단계 추가나 cross-field를 DB로 끌어올릴지는 그때 별도 owner 게이트.)

## 출처
- v13: `supabase/migrations/20260608120300_problems_topic_category_review_workflow.sql:44-56`(컬럼·PROPOSED enum), `20260608120400_admin_update_problem_audit_note.sql:48`(allowlist)·`:65-128`(키별 루프), `20260520120200_problems.sql:29-30`(review_status NOT NULL CHECK pending/approved/rejected).
- topik-ai: `src/features/assessment/api/supabase-assessment-question-bank-service.ts:235-241`(REVIEW_STATUS_WRITE_MAP, 보류=on_hold만·review_status 없음)·`:243-261`(setReviewStatusViaRpc, 유일 writer)·`:50-56`(WORKFLOW_STATUS_MAP read), `src/features/assessment/model/assessment-question-bank-types.ts:3-8`(5라벨 닫힌 union).
- 정합성: `docs/writing-questionbank-reconciliation.md` §3 행15-16(D-C, ALIGNED), §9(B0 노출 규칙).
- live(이번 세션 검증): 컬럼 존재 + writing 470행 전부 NULL.
