# A1 실행계획 — Supabase 생성 타입 동기화 (G12) (2026-06-09)

> 페이즈 A1 (Track A, v13) · 상위: [`2026-06-09-writing-questionbank-remediation.md`](../../../../superpowers/plans/2026-06-09-writing-questionbank-remediation.md)
> 리뷰 깊이: **경량(lightweight)** — 순수 기계적(생성물 재생성).
> **상태: ✅ DONE (검증된 수기 보정, owner 승인) — 2026-06-09.** regen은 환경상 불가 + live 드리프트(§8)로 부적절하여, 마이그레이션 기준 수기 보정으로 누락 3건 추가(lifecycle 보존). typecheck✓·단위✓·E2E 스모크✓. 보고: [`A1-report.md`](A1-report.md). 정식 gen types 재생성은 A1-pre(마이그 적용) 후로 이관.

## 0. 목표
`src/lib/supabase/types.ts`(생성물)를 live 스키마에서 **재생성**하여 누락 3건이 타입에 나타나게 한다:
`topic_category_code`(problems Row/Insert/Update), `review_workflow_status`(동), `admin_update_problem`(Functions).
기존 `lifecycle_status/lifecycle_reason/expires_at`·`list_user_problems_writing_state`·`admin_toggle_problem_publish` 타입은 보존.

## 1. 실행 명령 (둘 중 하나)
- **로컬(권장)**: `supabase start` → `supabase gen types typescript --local > src/lib/supabase/types.ts` → `supabase stop`
- **원격**: `supabase gen types typescript --project-id <PROJECT_REF> > src/lib/supabase/types.ts` (CLI 로그인/`SUPABASE_ACCESS_TOKEN` 필요) 또는 `--db-url <DB_URL>`
- **수동 편집 금지** — 반드시 생성기 사용(드리프트/오타 방지).

## 2. 수용 기준
- `types.ts`에 `topic_category_code`·`review_workflow_status`·`admin_update_problem` 모두 등장(grep 적중).
- 기존 lifecycle 3컬럼·`list_user_problems_writing_state`·`admin_toggle_problem_publish` 보존(회귀 0).
- `pnpm typecheck`(또는 build) 통과.
- diff가 **생성물만**(다른 소스 무변경).

## 3. 검증
- `pnpm test:e2e` 통과(E2E 게이트).
- **스키마 문서 게이트**: 재생성 결과가 `docs/development/database-schema.md`·`docs/supabase-table-inventory.md` 등과 어긋나면(드리프트) 해당 문서 갱신.

## 4. 환경 (실행 차단 사유)
- supabase CLI 존재(2.105.0). **그러나 Docker 데몬 미기동** → `supabase start`(로컬) 불가.
- 원격 생성에 필요한 `SUPABASE_ACCESS_TOKEN`/프로젝트 ref/`DB_URL` 부재(`NEXT_PUBLIC_SUPABASE_URL`만 존재, 이는 anon용이라 gen types 불가).
- **언블록(owner 액션)**: ① Docker Desktop 기동 후 알려주시면 제가 로컬 재생성 실행, 또는 ② 프로젝트 ref + access token(또는 db-url) 제공 시 원격 재생성. (비밀값은 출력·커밋하지 않음.)

## 5. 롤백
- 생성물 단일 파일 → `git checkout src/lib/supabase/types.ts`로 즉시 복원.

## 6. 리스크
- 재생성이 다른 스키마 드리프트까지 끌고 올 수 있음 → diff 검토 + 스키마 문서 게이트로 흡수.

## 7. GPT-5.5 리뷰 / 실행 결과
- 리뷰: **READY** (경량 공동 리뷰, [`A3-gpt55-review.md`](A3-gpt55-review.md)). 누락 3건·기존 보존 확인. caveat: 재생성 시 생성물 **내부 diff에서 예상 외 스키마 변경 별도 review**(현 파일은 hand-aligned 스냅샷).
- 실행: **BLOCKED — §8 live 스키마 드리프트로 재스코프 필요.** (regen 자체가 gen types CLI 미인증/바이너리 손상 + 더 근본적으로 live가 lifecycle 미적용)

## 8. live DB 검증 발견 (2026-06-09, service role 읽기 전용)

`.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`로 live DB(앱이 쓰는 dev 프로젝트) 읽기 검증. **읽기만, 쓰기 없음, 비밀 미출력.**

**스키마 드리프트(핵심)**: live에 컬럼 존재 여부 —
- ✅ 있음: `publish_status, visibility, review_status, source, topic_category_code, review_workflow_status` (마이그 `20260608120300` 적용)
- ❌ 없음: `lifecycle_status, lifecycle_reason, expires_at` (마이그 **`20260608120100` 미적용**)
- → **types.ts는 lifecycle을 "있다"고 하는데 live엔 없음**(types가 live보다 앞섬), 동시에 topic_category_code/review_workflow_status는 types에 없는데 live엔 있음(types가 뒤짐). **양방향 드리프트.**

**파급(A1 재스코프)**:
- 지금 `gen types`(설령 가능해도)를 live에서 돌리면 **lifecycle_* 타입이 제거**되어 lifecycle 코드(server.ts 등)와 어긋남 → **금지**.
- A1의 올바른 선행 = **pending 마이그 `20260608120100`(lifecycle)을 live에 적용**해 live==마이그레이션으로 맞춘 뒤 regen. 적용은 DB/마이그 접근 필요(이 환경엔 db-url 없음·CLI 미인증·Docker off) → **여전히 환경 게이트**. cf. [[project-conformance-9-decisions-finalized]]("적용은 Docker 환경 대기").
- 대안(owner 승인 시): types.ts를 **마이그레이션 전체 집합 기준으로** 수기 보정(lifecycle 보존 + topic/review_workflow/admin_update_problem 추가). live가 아닌 **migration이 source of truth**. 단 "수동 편집 금지" 룰 변경이라 owner ok 필요.

**데이터(live 470건, B0 live 검증 겸함)**: 51=91/52=77/53=63/54=239. `published/public/approved`=221 ↔ `draft/private/pending`=249(완벽 1:1). **D6 누수(approved인데 비공개)=0**. `topic_category_code` 470 전부 NULL(B1 백필 규모). `review_workflow_status` 470 전부 NULL. 시드(466) 대비 **+4건(전부 published/public/approved)**.
