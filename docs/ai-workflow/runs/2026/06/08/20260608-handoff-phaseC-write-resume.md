# HANDOFF — Admin(topik-ai)↔v13 통합 재개 가이드 (Phase C 쓰기 슬라이스)

> **✅ 2026-06-08 완료**: Phase C 검수 쓰기 구현·검증·커밋(`db3d7b1`). overlap(회원/문제/결제) 통합 핵심 잔여 종료.
> 상세·검증 근거는 실행 로그 "Phase C 쓰기 슬라이스 — 완료" 절. 아래 본문은 당시 작업 지시(이력 보존용).
>
> **목적**(당시): 다른 세션이 **마지막 잔여 = Phase C 검수/발행 쓰기**부터 바로 이어가도록 하는 실행 핸드오프.
> A·B·D + C(스키마·읽기)는 끝났다. 이 문서 + 실행 로그만 읽으면 재개 가능.
>
> **작성** 2026-06-08 · **먼저 읽기 순서**
> 1. 이 문서
> 2. 실행 로그(전 단계 상세): [`20260608-phaseA-execution-log.md`](20260608-phaseA-execution-log.md)
> 3. 확정 사실/매핑: [`20260608-ch3-facts-confirmation.md`](20260608-ch3-facts-confirmation.md) · 설계 SoT [`docs/admin-integration-plan.md`](../../../../admin-integration-plan.md) §11
> 4. 경계/게이트: [`docs/admin-scope-boundary.md`](../../../../admin-scope-boundary.md) 상단 "OVERLAP INTEGRATION GATE — OPEN"

---

## 0. 한 문단 요약 (지금 어디까지)

topik-ai(별도 Vite admin) 데이터레이어를 v13 Supabase에 **플래그 게이트(env 있으면 실연동, 없으면 기존 mock)**로
연결 중. 게이트 OPEN(2026-06-08, owner 승인). **A 인증·B 회원(읽기+쓰기)·D 결제(읽기전용)·C 문제(스키마 적용+읽기)**
완료·검증·커밋. **남은 것은 Phase C 검수/발행 쓰기 하나** — 회원 정지/해제(Phase B 쓰기)와 똑같은 패턴으로
`admin_update_problem` 감사 RPC에 연결하면 통합이 사실상 끝난다.

---

## 1. 진행 상태 (topik-ai main 커밋 + 검증)

| Phase | 상태 | 커밋(topik-ai main) |
|---|---|---|
| A 인증(로그인/세션/역할해석) | ✅ 완료·검증 | `73fa63b` |
| B 회원 읽기(get_admin_users) | ✅ 완료·검증 | `c5f5fcc` |
| B 회원 쓰기(정지/해제, admin_set_user_status) | ✅ 완료·검증 | `acfc760` |
| D 결제 읽기전용(payment_history) | ✅ 완료·검증 | `e2f64b3` |
| C 문제 스키마(컬럼+RPC allowlist) | ✅ **owner가 dev 적용함·검증** | v13 `supabase/migrations/20260608120300_problems_topic_category_review_workflow.sql` (미커밋) |
| C 문제 읽기(problems→AssessmentQuestion) | ✅ 완료·검증 | `ccc05ed` |
| **C 문제 쓰기(검수)** | ✅ **완료·검증·커밋** | `db3d7b1` |

모든 단계: 타입오류 0(repo 기존 103과 별개)·vite build exit0·**실 dev Supabase 대상 헤드리스+브라우저 스모크 PASS**.
withdraw(탈퇴, D-F) 쓰기는 전 구간 **차단 유지**(서버도 `deleted` 거부). 매핑은 전부 **PROPOSED**(R2).

---

## 2. 다음 작업 = Phase C 쓰기 슬라이스 (정확한 seam)

**패턴은 Phase B 쓰기와 동일**(참고 커밋 `acfc760`: users-page/user-detail-page의 handleConfirmAction →
`setUserStatusSafe` → `admin_set_user_status`). 문제 쪽도 **service 함수를 `isSupabaseConfigured`로 분기**해
`admin_update_problem` RPC를 부르면 된다.

### 2-A. 대상 파일 / seam
- 서비스: `topik-ai/src/features/assessment/api/assessment-question-bank-service.ts`
  - `updateReviewStatus(payload)` (mock store 호출) ← **여기 분기**: configured면 `admin_update_problem(questionId, patch)`.
  - `updateReviewMemo(payload)` ← (선택) `admin_update_problem({ explanation })`.
  - `updateOperationStatus(payload)` ← **보류**(operationStatus↔lifecycle_status는 lifecycle_status 컬럼 필요 = #31/#32 미적용. 적용 전까지 mock 유지 또는 configured면 비활성).
  - 패턴: 새 `supabase-assessment-question-bank-service.ts`(이미 읽기용 존재)에 `setReviewStatusViaRpc` 등 추가 → service가 분기.
- 페이지: `topik-ai/src/features/assessment/pages/assessment-question-review-page.tsx`
  - 검수 액션이 `updateAssessmentQuestionReviewStatusSafe`(검수 완료/보류/수정 필요) 호출 → service가 RPC로.
  - 하드코딩 actor `CURRENT_ACTOR='admin_current'`는 **로컬 audit 표시용**일 뿐, 실제 actor는 RPC가 `auth.uid()`로 기록(서버). `use-current-actor.ts`(`getCurrentActor`) seam을 actor 표시에 쓰면 됨.

### 2-B. v13 RPC 계약 (확정)
`admin_update_problem(problem_id uuid, patch jsonb)` — **content_admin 전용**, SECURITY DEFINER, 감사로그 자동(diff, action `problem.update`).
patch allowlist(2026-06-08 확장 적용됨): `title, prompt, materials, answer_key, rubric, tags, explanation, difficulty,
visibility, review_status, publish_status, topic_category_code, review_workflow_status`. **unknown 키는 무시.**

### 2-C. 쓰기 매핑 (PROPOSED, ch3/§11)
- 검수 액션 → patch:
  - `검수 완료` → `{ review_status:'approved', review_workflow_status:'done' }`
  - `수정 필요` → `{ review_status:'rejected', review_workflow_status:'revision_requested' }`
  - `보류`     → `{ review_workflow_status:'on_hold' }` (review_status 최종결과는 유지/미변경 — D-C 분리)
  - (검수 중 → `review_workflow_status:'in_progress'` 필요 시)
- 난이도 쓰기(D-G): 상→`difficulty:5` · 중→`3` · 하→`1`.
- 발행: topik-ai operationStatus는 보류(위). publish_status(draft/published/archived) 쓰기가 필요하면 `{ publish_status }`로 가능(allowlist에 있음).
- **topic_category_code 쓰기**: 코드 세트 owner 비준 전까지 보류(읽기 미분류). 비준 후 매핑.

### 2-D. 완료 정의 (R7)
검수/발행이 **`admin_update_problem` 경유** 동작 + `admin_audit_logs`에 **실 content_admin actor**(auth.uid()) diff 기록 +
직접 테이블 쓰기 0 + 권한 RPC/RLS 강제. 매핑은 PROPOSED 표기. withdraw류 보류 없음(문제엔 해당 없음).

---

## 3. 검증 레시피 (재현 가능 — 이게 핵심)

이 환경에서 실 dev Supabase로 **헤드리스(node) + 브라우저(playwright)** 검증을 했다. 동일 패턴 사용.

### 3-A. 자격증명 (출력 금지, 스크립트 내부에서만)
- dev 키: v13 `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(=anon),
  `SUPABASE_SERVICE_ROLE_KEY`(읽기/시드/검증 전용), `SUPABASE_TEST_PASSWORD`.
- 로그인 계정(시드, @audit.local): `platform_admin`·`content_admin`·`org_admin`. **비번 = `SUPABASE_TEST_PASSWORD`** 공통.
  - **검수 쓰기는 content_admin 계정으로** 로그인(admin_update_problem이 content_admin 요구).
- topik-ai `.env.local`(gitignore됨)에 dev URL/키 주입돼 있어 실연동 ON. mock으로 되돌리려면 그 파일 삭제.

### 3-B. 헤드리스 쓰기 검증 스크립트 패턴 (가역적)
`cd topik-ai && node -e '...'`:
1. service_role로 content_admin id+email 조회 + 테스트 문제 1개 id + 원본 review_status 캡처.
2. anon 클라이언트로 `signInWithPassword(content_admin email, SUPABASE_TEST_PASSWORD)`.
3. 세션으로 `rpc('admin_update_problem',{problem_id, patch:{review_status:'rejected', review_workflow_status:'revision_requested'}})`.
4. service_role로 problems 재조회 → 값 변경 확인 + `admin_audit_logs` 최신 행(admin_user_id=content_admin·action `problem.update`·diff) 확인.
5. **원복**: `admin_update_problem(problem_id,{review_status:<원본>, review_workflow_status:null})`.
> (Phase B/C 검증 스크립트 예시는 실행 로그 + 과거 세션 참고. env 파싱은 `.split(/\r?\n/)` + `^"|"$` 제거.)

### 3-C. 브라우저 스모크 (Playwright, topik-ai에 1.58.2 설치됨)
- dev 서버: `npm run dev`(background) → **포트 5174**(5173은 동시 작업자 vite가 점유). 로그 `localhost:5174`.
- 시나리오: `goto /assessment/question-bank/review/<questionId>` 또는 review 페이지 → 로그인(content_admin) →
  검수 액션 클릭 → ConfirmAction 모달(textarea 사유 입력 + okText 버튼) → 상태 반영 확인 → DB/원복.
- 판정 = **DOM 상태**(상태 배지 변화·콘솔에러 0), 스크린샷 시각판단 금지(헤드리스 캡처 불신 — 메모리 교훈).
- **끝나면 dev 서버 반드시 종료**(PowerShell `Get-NetTCPConnection -LocalPort 5174 ... Stop-Process`). 누수 서버가 localhost 가로채면 hang.

### 3-D. ConfirmAction 모달 (검수 사유 입력)
`shared/ui/confirm-action/confirm-action.tsx`: AntD Modal, okText=confirmText, reason=Input.TextArea(필수, 입력 전 OK 비활성).
Playwright: `.ant-modal textarea` fill → `.ant-modal-footer` 내 confirmText 버튼 클릭.

---

## 4. 환경 현실 / 함정 (반드시 읽기)

- **Supabase CLI 없음** — `supabase db push`/`db reset` 불가. DDL 적용은 **owner가 대시보드 SQL Editor**로 함(Phase C 컬럼은 이미 적용·검증). 추가 마이그레이션도 같은 방식.
- **DDL 적용 검증은 필수**(적용 후 증명): 컬럼 EXISTS 확인 + RPC가 실제로 쓰는지 헤드리스 1회.
- **dev 데이터**: problems 471행(writing 470, question_no 51-54). payment_history/subscriptions 0행. profiles 7(learner4·admin3 @audit.local). **lifecycle_status/lifecycle_reason/expires_at·legal #31/#32는 미적용.**
- **동시 다중 에이전트(같은 트리)**: topik-ai working tree에 내 것 아닌 변경 상존 — `dev*.log` 삭제·`docs/README.md`·`logs/admin-doc-update-log.md`·`docs/page-sync/`·`docs/templates/`. 또 동시 작업자가 `supabase-users-service.ts`(nickname 개선)·`.env.example`·`supabase-client.ts`(키 이름 `VITE_SUPABASE_PUBLISHABLE_KEY`로 정리, `ANON_KEY` 폴백 유지) 수정. **건드리지 말 것.** 커밋 시 `git add -A` 금지, **내 파일만 명시**. ([[feedback-concurrent-agent-worktree]])
- **mojibake**: codex CLI는 한글 깨짐 → 한글 검토는 Claude. 검증 스크립트 한글은 Read/node(UTF-8)로 정상.
- **날조 금지**: v13에 없는 필드(method/product/주제코드/검수메타 등)는 지어내지 말고 센티넬(미확인/미연동/미분류/미상/미지정)로. 필요한 enum은 additive 센티넬 추가(Phase C에서 domain/difficulty/validation/source에 추가함).
- **플래그 게이트 불변**: 모든 연동은 `isSupabaseConfigured` 분기 + mock 폴백(frozen 앱 안 깨짐, 가역).

---

## 5. 불변식 / 안전 (전 단계 공통)
- 쓰기는 **감사 RPC로만**(직접 테이블 쓰기 금지), 권한 **RPC/RLS 강제**, **실 auth actor**.
- **withdraw(탈퇴) 쓰기 금지**(D-F, 서버도 `deleted` 거부). 회원 status는 active/blocked만.
- 매핑 **PROPOSED ONLY**(R2). 스키마는 **additive·idempotent·prod 금지**(prod면 report-only).
- 비밀키 출력 금지(스크립트 내부 사용만). 검증 후 dev 데이터/시드 **원복**. dev 서버 **종료**.
- admin/frozen 보류 도메인(강사/추천인/쿠폰/포인트/커뮤니티/메시지/운영/시스템/통계) **착수 금지** — overlap(회원/문제/결제)만.

---

## 6. 핵심 레퍼런스

**v13 (스키마 SoT, supabase/migrations)**
- `20260520120200_problems.sql`(problems), `20260608120300_problems_topic_category_review_workflow.sql`(**Phase C 신규, 적용됨**),
  `20260602120400_admin_and_user_rpcs.sql`(admin RPC: get_admin_users·get_admin_user_stats·admin_set_user_status·**admin_update_problem**·admin_delete_problem·get_admin_audit_logs),
  `20260602120100_billing.sql`(payment_history/subscriptions, admin RLS read).
- 역할: `src/lib/auth/roles.ts`(app_role 4: learner/content_admin/org_admin/platform_admin). RLS: `private.is_platform_admin/is_content_admin`.
- **문제 목록 admin READ RPC는 없음** → content_admin이 problems 직접 SELECT(RLS 허용, 검증됨).

**topik-ai (별도 repo, `C:\Users\admin\Desktop\workspace\topik-ai`)**
- 인증: `src/shared/api/supabase-client.ts`, `src/features/auth/*`(auth-store·app-role-mapping·auth-gate·login-page·use-current-actor).
- 회원: `src/features/users/api/{users-service,supabase-users-service}.ts` + pages.
- 결제: `src/features/billing/api/{billing-service,supabase-billing-service}.ts` + pages(환불 쓰기 비활성).
- 문제: `src/features/assessment/api/{assessment-question-bank-service,supabase-assessment-question-bank-service}.ts` + `model/assessment-question-bank-types.ts`(센티넬) + `pages/{assessment-question-bank-page,assessment-question-review-page}.tsx`.

**역할 매핑(D-A, 클라 해석)**: platform_admin→SUPER_ADMIN · content_admin→CONTENT_MANAGER · org_admin→READ_ONLY · learner→접근불가.

---

## 7. owner 결정 잔여 (ch3 §4 — 쓰기/정밀화 전 확인)
1. **topic_category_code 코드 세트**(D-B) 비준 → 주제 쓰기/표시(현재 미분류).
2. **review_workflow_status ASCII enum**(D-C) 비준(현 PROPOSED: not_started/in_progress/on_hold/done/revision_requested).
3. **난이도 상→5**(D-G)는 확정(상→5·중→3·하→1). 가역.
4. **operationStatus↔lifecycle_status**: lifecycle 마이그레이션(#31/#32) 적용 + admin_update_problem에 lifecycle_status 분기 추가 후.
5. 결제 '취소'(failed/pending) 매핑·환불 엔티티·method/product 컬럼 — Phase D 정밀화 시.
6. 회원 withdraw 의미(소프트삭제/PII삭제/상태만) — 정해질 때까지 쓰기 차단.

---

## 8. 재개 절차 (다음 세션 step by step)
1. 이 문서 + 실행 로그 읽기. 메모리 `project-ch3-facts-confirmed-from-topik-ai` 참고.
2. (확인) topik-ai `.env.local`에 dev URL/키 있는지 + content_admin 로그인 되는지 헤드리스 1회.
3. **Phase C 쓰기 구현**(§2): supabase-assessment service에 `setReviewStatusViaRpc` 등 추가 → service 분기 → review 페이지 액션 배선. operationStatus 쓰기는 보류(§2-A). difficulty 상→5.
4. **검증**(§3): 헤드리스 review_status 토글(content_admin)+감사로그+원복 → 브라우저 스모크 → dev 서버 종료.
5. 타입체크(`npx tsc --noEmit -p tsconfig.app.json`, 새 오류 0 확인; repo 기존 103은 무관) + `npx vite build`.
6. **커밋**(topik-ai main, 내 파일만 명시): `feat(assessment): wire review/publish writes via admin_update_problem (Phase C write)`.
7. 실행 로그 + 메모리 갱신. owner에 §7 잔여 결정 보고.

> 이걸로 overlap(회원/문제/결제) 통합의 핵심이 완료된다. 이후는 보류 도메인(owner 별도 승인) + 갭 정밀화.
