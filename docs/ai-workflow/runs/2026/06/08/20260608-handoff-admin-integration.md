# HANDOFF — Admin(topik-ai) → v13 통합 실행 가이드

> **목적**: 확정된 설계(GPT-5.5 교차검토 반영)대로 **다음 세션/담당자가 실제 작업을 이어가도록** 하는
> 실행 핸드오프. "무엇을/왜"의 기준은 설계서, 이 문서는 **"무엇부터 · 어떤 승인 후 · 어떻게 검증"**.
>
> **작성** 2026-06-08 · **상태** Phase 0(문서) 완료, 실행은 **owner 승인 게이트 대기**.
>
> **먼저 읽기(순서)**
> 1. 설계 SoT: [`docs/admin-integration-plan.md`](../../../../admin-integration-plan.md) — 특히 **§11 확정 결정**, §3·4 매핑, §5 원칙, §6 단계
> 2. 인벤토리(전체 도메인): [`docs/user-admin-data-consistency.md`](../../../../user-admin-data-consistency.md) (2026-06-04, **보존**)
> 3. 경계/방법: [`docs/admin-scope-boundary.md`](../../../../admin-scope-boundary.md), [`docs/user-admin-consistency-method.md`](../../../../user-admin-consistency-method.md)
> 4. 쉬운 설명: `docs/ai-workflow/runs/2026/06/08/admin-migration-plan-explainer-ko.html`

---

## 0. 한 문단 요약

topik-ai(별도 Vite admin, **실제 DB 없음** — mock + 후보 계약 문서뿐)를 v13가 소유한 Supabase에
**스키마/백엔드만** 연결한다. UI는 이식하지 않는다. **겹치는 것 먼저**(회원·문제은행·결제). 배선 순서는
**인증 → 회원 → 문제 → 결제(읽기전용)**. 모든 쓰기는 **v13 감사 RPC 경유**, 권한은 **RPC/RLS에서 강제**,
스키마 변경은 **추가(additive)만 · owner 승인 후 · prod/초기화 금지**.

---

## 0-1. 어느 repo의 코드가 바뀌나 (중요)

| 시점 | v13 (이 repo) | topik-ai (별도 repo) |
|---|---|---|
| **지금 (Phase 0)** | 문서만 — 코드/DB 변경 **0** | **변경 없음** |
| **실행 (A~D, 승인 후)** | Phase C에서 **스키마 additive + RPC allowlist**만 | **데이터/인증 계층 코드 수정함** |

- **"스키마/백엔드만"의 뜻 = topik-ai UI를 이식/재작성하지 않는다.** 하지만 실행 단계에서는 topik-ai의
  **백엔드 연결부를 수정한다**: ① mock `src/features/*/api/*-service.ts` → supabase-js 호출,
  ② Supabase 로그인/세션 도입, ③ 하드코딩 actor 제거. 즉 *"topik-ai를 안 건드린다"가 아니라
  "**UI는 그대로 두고 데이터/인증 배관만 바꾼다**"*.
- topik-ai에서 **바뀌는 것**: 데이터 service 계층, 인증/세션, actor. **안 바뀌는 것**: 화면 컴포넌트·
  라우팅·레이아웃·AntD UI.
- topik-ai는 **별도 git repo** → 그쪽 변경은 **별도 승인 + 별도 커밋**(이 repo에서 임의 수정 금지).
  동시 작업 중인 다른 에이전트와 충돌 주의.

---

## 0-2. topik-ai 수정 범위 (실행 시, overlap 한정)

UI 변경 **0**. 아래 "배관"만, 그리고 **overlap 3개 도메인(회원·문제은행·결제)에 해당하는 service만** 수정.

**바뀜 — 공통 인프라 (1회):**
- `package.json`: `@supabase/supabase-js` 추가 + Supabase env(`VITE_SUPABASE_URL`/key).
- 신규: Supabase 클라이언트 init + **로그인/세션 모듈**(현재 topik-ai엔 로그인 화면 없음 → 추가).
- `src/shared/api/http-client.ts`(현재 axios `/api`): supabase 호출로 대체 또는 얇은 어댑터로 축소.
- 하드코딩 actor(`admin_current` 등) 제거 → 세션 사용자. `permission-store`에 실제 역할(`profiles.app_role`) 주입.

**바뀜 — 도메인 service (overlap만):**
- 회원: `src/features/users/api/users-service.ts`(+`mock-users.ts`) → `get_admin_users`/`admin_set_user_status`/`admin_change_user_role` (회원 목록/상세만).
- 문제은행: `src/features/assessment/api/assessment-question-bank-service.ts`(+fixtures) → 문제 RPC.
- 결제(읽기전용): `src/features/billing/`의 결제/환불 service → `payment_history`/`subscriptions` 읽기.
- 각 service에 **필드 매핑 어댑터**(v13 컬럼→topik-ai row 타입, 예 `display_name`→`realName`)만 추가. **Zustand store/페이지/컬럼 정의는 그대로.**

**안 바뀜:**
- 모든 화면 컴포넌트 · 라우팅(`app-router.tsx`) · 레이아웃(`admin-shell`) · AntD UI · store 형태.
- **보류 도메인 service(같은 폴더라도)**: 강사 `instructors-service.ts` · 추천인 `referrals-service.ts` ·
  쿠폰 `coupons-service.ts` · 포인트 `points-service.ts`, 그리고 community/message/operation/system/analytics/content 일체 → **mock 유지**.

**규모 감각**: 공통 인프라 ~3-4개 모듈(supabase client·auth·session·actor 교체) + overlap service ~3개 교체 +
도메인별 매핑 어댑터. **UI 컴포넌트 수정 0.** (파일 경로는 topik-ai 실제 구조 확인 후 확정 — 일부는 후보.)

---

## 1. 확정 결정 (relitigate 금지 — 근거는 설계서 §11)

| # | 항목 | 확정 |
|---|---|---|
| D-A | 역할 5↔4 | v13 4역할 유지 + **permission-key를 RPC/RLS에서 강제**. overlap엔 `SUPER_ADMIN→platform_admin`, `CONTENT_MANAGER→content_admin`만 |
| D-B | 주제 분류 | **신규 컬럼 `problems.topic_category_code`**(코드 기반). v13 `domain`(영역) 재사용 금지 |
| D-C | 검수 상태 | `review_status`(최종) 유지 + **신규 `problems.review_workflow_status`**(진행) 분리. 5→3 축약 금지 |
| D-D | 글쓰기 admin 읽기 | **이번 단계 전면 보류** |
| D-E | 순서 | **배선=회원/profiles 먼저** → 문제 / **문서=문제은행 먼저** |
| D-F | 회원 status 쓰기 | 정지(suspend)→`blocked`만. **탈퇴(withdraw)는 의미 확정 전 UNMAPPED** |
| D-G | 난이도 쓰기 | 표시 하=1-2·중=3·상=4-5 / **쓰기 하→1·중→3·상→5** (독립 결정자; 토론측 상→4 소수의견) |

**공통 원칙(R1~R7):** R1 권한 RPC/RLS 강제 · R2 매핑은 topik-ai 내부 코드 확정 전까지 **PROPOSED ONLY** ·
R3 결제 **읽기전용** · R4 쓰기는 **감사 RPC로만(직접 테이블 쓰기 금지)** · R5 감사 인프라(`admin_audit_logs`
+ 감사 RPC) **이미 존재** → 갭=RPC경유+실제 actor · R6 withdraw 매핑 보류 · R7 아래 수용기준 명문화.

---

## 2. 착수 전 — owner 승인 게이트 (이게 열려야 코드 시작)

1. **경계 해제(overlap 한정)** — `docs/admin-scope-boundary.md`/`CLAUDE.md`/`AGENTS.md`에 "overlap(회원/문제/
   결제) 통합 착수, 보류 도메인은 계속 동결" 단서 추가(설계서 §8 제안문). **승인 전엔 admin 코드/스키마 금지.**
2. **v13 스키마 추가 변경** — Phase C의 신규 컬럼(`topic_category_code`, `review_workflow_status`) +
   `admin_update_problem` allowlist 확장. additive·승인 후.
3. **topik-ai ↔ 실제 dev Supabase 연결** — 공유 DB + 비밀키 사용 → 승인.
4. **역할 모델 확정(D-A)** — permission-key를 어떻게 RPC/RLS에 박을지 owner 결정.

---

## 3. 착수 전 — 반드시 먼저 "확인"할 미확정 사실 (추정 금지)

> 이 값들이 확정되기 전에는 해당 매핑을 **쓰기로 고정하지 말 것**(R2/R6). 확인처 = topik-ai
> `docs/specs/page-ia/*`, `admin-page-tables.md`, 또는 topik-ai 소스.

| 확인 항목 | 영향 | 어디서 |
|---|---|---|
| 회원 `status` 실제 코드 값 집합 | D-F(정지/탈퇴 매핑) | topik-ai page-ia / 코드 |
| `withdraw`(탈퇴)의 의미: 소프트삭제 vs 개인정보삭제 vs 복구 | D-F(→deleted 가능 여부) | topik-ai 운영 정책 / owner |
| 결제/환불 필드 계약 | Phase D 매핑 | topik-ai page-ia / 코드 |
| topik-ai enum **내부 코드값**(현재 한글 라벨뿐) | 전 매핑(R2) | topik-ai schema 파일 |
| `tier` 값 집합 ↔ `plan_label` | 회원 등급 매핑 | topik-ai / v13 billing |

---

## 4. 단계별 실행 체크리스트

### Phase A — 인증 (선행 조건, 양쪽 repo)
- [ ] topik-ai: `@supabase/supabase-js` 도입 + Supabase 로그인/세션.
- [ ] topik-ai: 하드코딩 actor(`admin_current` 등) 제거 → 세션의 **실제 사용자**로 교체.
- [ ] 역할: 세션 사용자의 `profiles.app_role`을 읽어 topik-ai 권한 해석(D-A 매핑).
- [ ] permission-key 레이어 설계 = **RPC/RLS authorization**으로 닫기(클라 게이트만 금지, R1).
- **완료 정의**: topik-ai 인증 세션이 v13 admin RPC를 **실제 actor로** 1건 호출 성공 + `admin_audit_logs`에 실제 actor 기록.

### Phase B — 회원/profiles (배선 먼저, 가장 낮은 위험)
- [ ] (선행) 3장의 회원 status 값 집합 확인.
- [ ] topik-ai `users-service.ts`(mock) → supabase-js: 읽기 `get_admin_users`/`get_admin_user_stats`,
      쓰기 `admin_set_user_status`(active↔blocked), `admin_change_user_role`.
- [ ] 필드 매핑: `id`=profiles.id, `email`=auth.users.email(join), `realName`↔`display_name`, `nickname`↔nickname.
- [ ] status: 정지→`blocked`만. **탈퇴 UNMAPPED**(D-F).
- [ ] `tier`↔`plan_label`: 값 확정 전 표시만(쓰기 보류).
- **완료 정의**: 목록/상세/정지·해제/역할변경이 **RPC 경유**로 동작 + 감사 기록 + RLS 강제, **직접 테이블 쓰기 0**.

### Phase C — 문제은행/problems (콘텐츠 쓰기, 더 위험)
- [ ] (승인) v13 additive: `problems.topic_category_code`, `problems.review_workflow_status` 추가 + `admin_update_problem` allowlist 확장.
- [ ] 매핑(설계서 §4-B): `questionNumber`↔`question_no`(정합), 본문↔`prompt`, 정답/루브릭↔`answer_key`/`rubric`(jsonb),
      `operationStatus`↔`lifecycle_status`, `difficultyLevel` 쓰기 하→1/중→3/상→5(D-G).
- [ ] topik-ai 주제(domain)는 **`topic_category_code`로**(v13 `domain` 금지, D-B).
- [ ] `reviewStatus` → `review_status`(최종) + `review_workflow_status`(진행) 분리(D-C).
- [ ] `assessment-question-bank-service.ts`(mock) → RPC 호출로 교체.
- **완료 정의**: 문제 목록/검수/발행이 **RPC 경유** 동작 + 감사 기록. 매핑은 topik-ai 코드 확정 전까지 **PROPOSED** 표기.

### Phase D — 결제 (읽기 전용 인벤토리)
- [ ] (선행) topik-ai 결제/환불 필드 계약 확인.
- [ ] `payment_history`/`subscriptions`를 **RLS-가드 select 또는 읽기 RPC**로만 노출(쓰기 없음 — service_role 전용).
- [ ] 환불은 별도 테이블 없이 `payment_history.status='refunded'` — 표현만.
- **완료 정의**: 결제/환불 목록이 실제 데이터로 렌더(읽기 전용), 쓰기 경로 없음.

### 보류 (착수 금지)
강사·추천인·쿠폰·포인트·커뮤니티·메시지·운영·시스템 메타데이터·통계 — v13 스키마 전무.
**STOP_AT_ESCALATION_GATE**: owner 승인 + topik-ai 계약 정합 전까지 설계/구축 금지.

---

## 5. 불변식 / 안전 (전 단계 공통)

- 스키마는 **추가(additive)만**, `db reset` 금지, **prod 변경 금지**(prod면 report-only).
- 쓰기는 **감사 RPC로만**(직접 테이블 쓰기 금지). 권한은 **RPC/RLS에서** 강제.
- **실제 auth actor**만 기록(하드코딩 actor 금지).
- 비밀키 출력 금지. admin/frozen 객체는 **이름 denylist**로 제외.
- 매핑은 topik-ai 내부 코드 확정 전까지 **PROPOSED ONLY**.
- 적용 시 **적용 후 증명**(스크린샷/쿼리/감사로그). 동시 다중 에이전트 주의: `git add -A` 금지, 파일 명시.

---

## 6. 핵심 파일 레퍼런스

**v13 (스키마 SoT)**
- 마이그레이션: `supabase/migrations/20260520120100_profiles_goals.sql`(profiles), `20260520120200_problems.sql`,
  `20260608120100_problems_lifecycle_expiry.sql`, `20260602120100_billing.sql`, `20260602120400_admin_and_user_rpcs.sql`(admin RPC)
- 역할: `src/lib/auth/roles.ts` (app_role 4종). admin 코드 섬: `src/lib/admin/*`, `src/components/admin/*`(동결, 참고용)
- RLS 헬퍼: `private.is_platform_admin/is_content_admin/is_org_admin`, 감사: `admin_audit_logs`

**topik-ai (별도 repo, 후보 계약 SoT)**
- `docs/specs/admin-data-contract.md`(§9.1 회원·§9.6 문제·§11 시스템), `docs/specs/admin-page-tables.md`,
  `docs/architecture/admin-overview.md`(§5 라우트·§6 역할)
- 데이터 계층: `src/features/*/api/*-service.ts`(mock — 교체 대상), `*/model/*-store.ts`

**설계/핸드오프**
- 설계 SoT: `docs/admin-integration-plan.md` · 인벤토리: `docs/user-admin-data-consistency.md` · 이 핸드오프

---

## 7. 수용 기준 (R7 — "완료"의 정의)

각 Phase는 다음을 모두 만족해야 완료:
1. 하드코딩 actor 0 — 모든 admin 액션이 실제 Supabase auth actor로 감사됨.
2. 직접 테이블 쓰기 0 — 변경은 감사 RPC 경유만.
3. 권한이 RPC/RLS에서 강제됨(클라 게이트 우회로 권한 상승 불가).
4. 미확정 enum은 PROPOSED 표기, `withdraw` 쓰기 매핑 없음.
5. 적용 후 증명 + 무변경(해당 없을 때) 또는 변경 범위 명시.

---

## 8. 재개 절차 (다음 세션이 할 일)

1. 본 핸드오프 + 설계서 §11 읽기.
2. **3장 미확정 사실 먼저 확인**(topik-ai page-ia/코드).
3. **2장 승인 게이트** owner에게 요청 — 열리기 전엔 문서/확인만.
4. 승인되면 **Phase A → B → C → D** 순서로, 각 단계 5·7장 기준 충족하며 진행.
5. 결정 변경 필요 시 설계서 §11 갱신 + 사유 기록(특히 D-G 상→5는 가역적).

## 9. 교차검토 출처

GPT-5.5(codex CLI, `gpt-5.5`) 3라운드(리뷰→토론→독립 결정자), 2026-06-08. 영어/ASCII 패킷 인라인 전달로
mojibake 회피. 상세·소수의견은 설계서 §11. codex 설정 우회는 메모리 `reference-codex-config-service-tier-windows`.
