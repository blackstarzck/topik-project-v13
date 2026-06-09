# A1 완료 보고 — Supabase 생성 타입 동기화 (G12) (2026-06-09)

> 페이즈 A1 (Track A, v13) · 사이클: 실행계획([`A1-plan.md`](A1-plan.md)) → GPT-5.5 리뷰([`A3-gpt55-review.md`](A3-gpt55-review.md), READY) → owner 승인(수기 보정 경로) → 실행 → 검증 → 본 보고
> 실행 방식: **검증된 수기 보정**(owner 승인) — `gen types`가 환경상 불가(CLI 미인증·바이너리 손상·DB url 없음·Docker off)하고, **live가 lifecycle 마이그 미적용**이라 live-regen은 lifecycle 타입을 유실시키므로 부적절.

## 1. 한 줄 요약 (비개발자용)
코드의 "데이터 사전(타입)"에 빠져 있던 항목 3개를 **마이그레이션 정의 기준으로** 채워 넣었습니다. 자동 생성기는 이 환경에서 못 돌고(게다가 돌리면 다른 게 지워질 상황) owner 승인 하에 안전하게 수기로 정확히 추가했고, **빌드·단위·E2E 검사 모두 통과**했습니다.

## 2. 한 일 / 변경
- `src/lib/supabase/types.ts` — problems Row/Insert/Update에 **`review_workflow_status: string | null`**, **`topic_category_code: string | null`** 추가(둘 다 CHECK 없는 nullable text → 유니온 아님이 정식 표현). Functions에 **`admin_update_problem: { Args: { problem_id: string; patch: Json }; Returns: undefined }`** 추가. **lifecycle_* 기존 타입 보존**(삭제·변경 안 함).
- `tests/components/admin/AdminProblemPublishToggle.test.tsx` — `makeProblemRow` 픽스처에 위 2개 필드(`null`) 추가. **필수 사유**: Row에 필수 필드가 늘어 픽스처가 깨짐 → lifecycle 필드 추가 때와 동일 패턴의 최소 보정(이 파일은 세션 전부터 수정돼 있던 동시작업 파일 → 2줄만 additive 추가, 다른 변경 미접촉).

## 3. 수용 기준 충족 증거
- `types.ts`에 `topic_category_code`(3)·`review_workflow_status`(3)·`admin_update_problem`(1) 등장. `lifecycle_status`(4) 보존.
- **typecheck**: `pnpm typecheck` → exit 0 (PASS).
- **단위 테스트**: `AdminProblemPublishToggle.test.tsx` 3/3 PASS.
- **E2E 스모크**: 기존 dev 서버(127.0.0.1:3000) 대상 `playwright test screens-public --project=desktop-1280` → setup(로그인)+공개화면 2개 **3 passed**.

## 4. 게이트 결과
- GPT-5.5 리뷰: READY(경량). · owner 승인: 수기 보정 경로 채택 ✅. · E2E 게이트: 스모크 PASS. · 스키마 문서 게이트: 스키마 **변경 없음**(타입 파일만) → 미발동.

## 5. 정확성 근거 (수기 보정의 신뢰성)
- `topic_category_code`/`review_workflow_status`: **live DB에서 selectable(존재)·전부 NULL** 확인(service role 읽기) + 마이그 `20260608120300`이 `text` nullable·CHECK 없음으로 정의 → `string | null` 정확.
- `admin_update_problem`: 마이그 `20260608120400` 시그니처 `(problem_id uuid, patch jsonb) returns void` 기준.
- lifecycle 보존: live엔 없지만 **migration이 source of truth**이고 server.ts가 미적용 상태를 fallback으로 견딤 → 타입은 목표 스키마(=마이그) 기준 유지가 옳음.

## 6. 잔여 리스크 · 후속
- **A1-pre(신규·미완)**: live DB가 lifecycle 마이그(`20260608120100`) 미적용 → live≠migrations. 추후 **마이그 적용 후 정식 `gen types`로 재생성**하면 이 수기 보정은 자연히 덮어써짐(정합). 마이그 적용은 DB/Docker 접근 게이트(cf. [[project-conformance-9-decisions-finalized]]).
- 동시작업 주의: 위 두 파일 외 working tree의 다른 미커밋 변경은 미접촉. 커밋 시 관심사 분리([[feedback-concurrent-agent-worktree]]).

## 7. Docs consulted
`A1-plan.md`, `A3-gpt55-review.md`, `20260608120300/120400 마이그레이션`, `src/lib/admin/types.ts`, `src/lib/supabase/types.ts`, `playwright.config.ts`, 상위 계획.
