# Admin(topik-ai) → v13 통합 설계서 — 스키마/백엔드, overlap 먼저

> ## ⚠️ 2026-06-09 PIVOT — 이 설계서의 "문제(problems)" 전제는 무효
>
> 소유자 결정(2026-06-09): **관리자(topik-ai)가 외부/제3자 API에서 "검수 완료" 문제를 받아 노출 여부
> (공개/비공개)를 적용해 Supabase DB에 저장**하고, **v13은 그 데이터를 읽기만 한다(read-only)**. 동시에
> **v13 admin 섬 전체가 제거**되었다
> (`20260609130000_remove_v13_admin_island.sql` + 코드/네비/테스트 삭제 — 배경
> [`admin-scope-boundary.md`](admin-scope-boundary.md) 2026-06-09 §).
>
> 따라서 본 설계서의 다음 전제는 **더 이상 유효하지 않다**:
> - "문제 = topik-ai 관리자가 저작·검수" (3·4-B장) → 이제 외부 API 수급, v13 검수 없음.
> - "topik-ai가 **v13 기존 admin RPC 재사용**"(5장: `admin_update_problem` 등) → 그 RPC들은 **제거됨**.
> - 문제 정합 결정 중 **검수 관련은 폐기**: `review_status`(C-02 표시용 외엔 불필요)·`review_workflow_status`(D-C)
>   는 사실상 미사용. **D-B `topic_category_code`는 목록 필터/표시용으로 유지**(소유자 결정).
>
> **여전히 유효**: 회원/profiles, 결제 overlap(외부 API 전환과 무관). 문제 영역은 외부-API 모델로 **재설계 필요**.
> 본문 이하는 2026-06-08 시점 설계로, 문제 부분은 위 PIVOT 기준으로 읽을 것.

> **상태**: 설계 제안 (2026-06-08). **코드·스키마·경계 문서를 바꾸지 않는 문서 산출물**입니다.
>
> **사용자 결정(이번 세션)**: ① 스키마/백엔드만 통합(topik-ai는 별도 Vite 앱 유지) · ② 겹치는 것
> 먼저 · ③ 계획·문서 제안만(실제 적용은 owner 승인 후).
>
> **관계 문서**
> - 인벤토리(엔티티↔페이지 매핑, 전체 도메인): [`docs/user-admin-data-consistency.md`](user-admin-data-consistency.md)
>   — **이미 2026-06-04에 작성·존재**. 이 설계서는 그 위에 *값 수준 정합 + 통합 아키텍처 + 게이트*를
>   더하며, 그 문서를 덮어쓰지 않습니다.
> - 경계/방법: [`docs/admin-scope-boundary.md`](admin-scope-boundary.md),
>   [`docs/user-admin-consistency-method.md`](user-admin-consistency-method.md)

## 0. 이 문서가 더하는 것 (인벤토리와의 분담)

- 기존 인벤토리(`user-admin-data-consistency.md`)는 **테이블/페이지 수준**으로 "무엇이 겹치나"를 이미 정리.
- 이 설계서는 그 위에서 **값 수준(enum) 불일치**, **역할 매핑**, **인증/데이터레이어 전환 방법**,
  **단계·승인 게이트**, **경계 갱신 제안**을 추가합니다.
- 향후(승인 시) 3장의 enum 글로서리는 인벤토리 문서의 부록으로 병합 가능(이번엔 분리 보관).

---

## 1. 아키텍처 결정 — "스키마/백엔드만"

```
[ topik-ai (Vite+React18+AntD5, 별도 repo/배포) ]
        │  현재: mock axios  →  /api  (가짜 데이터)
        ▼  전환 후
   @supabase/supabase-js  ──►  [ v13 소유 Supabase ]  ◄── v13 (Next.js, 사용자 앱)
        │                         · 실제 스키마 = supabase/migrations/*  (SoT)
        └─ 기존 admin RPC 재사용 ─┘  · 기존 admin RPC + private.is_*_admin RLS
```

원칙:
- **topik-ai UI는 이식하지 않음.** Vite 앱 그대로 두고 **데이터 계층만** v13 Supabase로 연결.
- **v13 마이그레이션이 유일한 실제 스키마**(SoT). topik-ai 후보 계약은 v13에 맞춰 reconcile.
- **additive only**: overlap 정합을 위해 v13 스키마를 바꿔야 하면 컬럼/enum 추가 위주, **owner 승인 후**.
  `db reset` 금지, prod 변경 금지.

---

## 2. 인증/역할 설계 (모든 연결의 선행 조건)

### 2-A. 인증
- **topik-ai는 현재 인증이 없음** — 화면이 "이미 인증됨"을 가정(`admin_current` 등 하드코딩 actor,
  topik-ai 측 `admin-page-gap-register` 기재). v13 Supabase에 붙이려면 **Supabase 로그인 + 세션**을
  topik-ai에 도입해야 함(`@supabase/supabase-js` 세션 → RLS가 역할로 게이트).

### 2-B. 역할 매핑 (체계가 다름 → **owner 결정**)
topik-ai = permission 묶음 기반 **5역할**, v13 = `app_role` **4종**(`src/lib/auth/roles.ts`) + RLS 헬퍼
`private.is_platform_admin/is_content_admin/is_org_admin`.

| topik-ai 역할 | 책임(admin-overview §6) | v13 후보 매핑 | 비고 |
|---|---|---|---|
| SUPER_ADMIN | 전체 + 고위험 | `platform_admin` | 근접 |
| OPS_ADMIN | Users/Community/Message/Operation/Commerce | **대응 부재** | 신설 vs platform_admin 흡수 결정 |
| CONTENT_MANAGER | Assessment/Content | `content_admin` | 근접(문제 검수/발행) |
| CS_MANAGER | 조회/메모/신고처리 | **대응 부재** | 읽기+메모 역할 신설 검토 |
| READ_ONLY | 조회 전용 | **대응 부재** | 읽기 전용 역할 신설 검토 |
| — | (v13 전용) | `org_admin` | topik-ai에 대응 개념 불명확 |

- **이슈**: v13엔 permission key 체계(`users.manage`, `assessment.review` 등)가 **없음**. 5역할의
  세분 권한을 v13에서 어떻게 표현할지(역할 확장 vs permission 레이어 신설) = owner 결정.
- overlap 단계에서 실제로 필요한 최소치: **platform_admin = 회원 관리**, **content_admin = 문제 관리**.
  (v13 기존 RPC가 이미 이 둘로 게이트됨.)

---

## 3. overlap 값-수준 정합 (enum 글로서리)

> v13 값 = 마이그레이션 대조 **확정**. topik-ai 값 = 계약 표기(대부분 **한글 라벨**, 내부 코드 미정).
> `?` = 출처에 값이 없어 **확인 필요**(추정 금지).

| 엔티티 | 필드 | v13 (확정) | topik-ai (계약 표기) | 결정/매핑 |
|---|---|---|---|---|
> 아래 "결정/매핑"은 GPT-5.5 교차검토(11장)로 확정된 값입니다. **모든 매핑은 topik-ai 내부 코드값
> 확정 전까지 "PROPOSED ONLY"** (R2) — 추정값으로 쓰기 매핑 고정 금지.

| 엔티티 | 필드 | v13 (확정) | topik-ai (계약 표기) | 결정/매핑 (GPT-5.5 교차검토 확정) |
|---|---|---|---|---|
| 회원 | status | active / blocked / deleted | `?` ("회원 상태" 컬럼 + "정지/해제" 액션, 코드 미명시) | **정지(suspend)→`blocked` 확정**; **탈퇴(withdraw)는 의미(소프트삭제/개인정보삭제/복구) 확정 전 UNMAPPED** (D-F) |
| 회원 | role | learner / content_admin / org_admin / platform_admin | SUPER/OPS/CONTENT/CS/READ_ONLY | 11장 D-A: v13 4역할 유지 + permission-key(RPC/RLS 강제). overlap엔 SUPER→platform_admin·CONTENT→content_admin만 |
| 회원 | plan/tier | `plan_label` 자유텍스트('free'…) | `tier`(등급, enum 후보) | 값 집합 정의 + 매핑 (보류) |
| 회원 | 구독상태 | `subscriptions.status` (별도 테이블) | `subscriptionStatus`(User 컬럼, 외부 정보) | 위치 다름 — v13는 join |
| 문제 | domain | reading / listening / writing (**영역**) | 생활/학습/사회/문화/경제/교육/환경/기술 (**주제**) | ⚠️ 의미 다름 → **신규 컬럼 `topic_category_code`(코드 기반)** (D-B). v13 `domain` 재사용 금지 |
| 문제 | review_status | pending / approved / rejected (3) | 검수 대기/검수 중/보류/검수 완료/수정 필요 (5) | **축약 금지** — v13 `review_status`=최종결과 유지 + 진행상태는 **신규 `review_workflow_status`** 분리 (D-C) |
| 문제 | publish/operation | `publish_status`(draft/published/archived) + `lifecycle_status`(active/inactive/expired) | `operationStatus`(미지정/노출 후보/숨김 후보/운영 제외) | `lifecycle_status ↔ operationStatus` (마이그레이션 `20260608120100` 주석에 타깃 명시) |
| 문제 | difficulty | 1..5 (int) | 상/중/하 (+ meta 4/5/6) | 표시 low=1-2·mid=3·high=4-5 / **쓰기 low→1·mid→3·high→5** (D-G, 독립 결정자 채택; 토론측 high→4 소수의견) |
| 문제 | visibility | private / public / org | (대응 없음) | v13 고유 |
| 문제 | question_no | 51/52/53/54 | questionNumber 51/52/53/54 | **정합** |
| 결제 | status | paid / failed / refunded / pending | `?` (계약 미문서화) | **이번 phase 읽기전용 인벤토리로 축소** (R3); 매핑은 page-ia/코드 확인 후 |
| 구독 | status | active / canceled / past_due / trialing / paused | `?` | 확인 필요 (읽기전용) |

핵심 충돌 요약(교차검토 후 상태): **C1 `domain` 의미 충돌 → 신규 컬럼으로 해소(D-B)** ·
**C2 역할 5↔4 → permission-key 레이어(D-A)** · **C3 회원 status 코드 미확정(잔존, 확인 필요)** ·
**C4 review_status → 진행/최종 분리(D-C), difficulty → low1/mid3/high5(D-G)** ·
**C5 결제 계약 부재 → 읽기전용 축소(R3)** · **C6 topik-ai enum 한글 라벨뿐 → 매핑은 PROPOSED ONLY(R2)**.

---

## 4. 필드 매핑 (overlap, 후보)

### 4-A. 회원: topik-ai `User` → v13 `profiles`
| topik-ai | v13 | 비고 |
|---|---|---|
| `id` | `profiles.id` (= auth.users.id) | |
| `email` | `auth.users.email` | profiles엔 email 없음 — auth에서 join |
| `realName` | `display_name` | 의미 확인 |
| `nickname` | `nickname`(citext) | |
| `status` | `status` | 값 매핑(3장) |
| `tier` | `plan_label` | 형태 매핑(3장) |
| `subscriptionStatus` | `subscriptions.status` | join |
| 역할 | `app_role` | 2-B |

### 4-B. 문제: topik-ai `AssessmentQuestion` → v13 `problems`
| topik-ai | v13 | 비고 |
|---|---|---|
| `questionNumber` | `question_no` | 정합 |
| `domain`(주제) | **신규 `topic_category_code`** | ⚠️ v13 `domain`(영역) 재사용 금지 (D-B) |
| `questionText`/`reviewDocument.prompt_text` | `prompt` | |
| `modelAnswer` | `answer_key`(jsonb) 또는 `explanation` | 구조 결정 |
| `scoringCriteria`/`reviewDocument.rubric` | `rubric`(jsonb) | |
| `reviewStatus` | `review_status`(최종) + **신규 `review_workflow_status`**(진행) | 축약 금지·분리 (D-C) |
| `operationStatus` | `lifecycle_status`(+ `publish_status`) | 마이그레이션 주석 타깃 |
| `difficultyLevel` | `difficulty` | 쓰기 low→1·mid→3·high→5 (D-G) |
| `questionTypeLabel` | (신규 컬럼 후보) | v13 갭 |

### 4-C. 결제: topik-ai Commerce → v13 `payment_history`/`subscriptions`
- topik-ai 측 필드 계약 부재 → **page-ia/코드 확인 후** 매핑. v13 환불은 별도 테이블 없이
  `payment_history.status='refunded'` — 환불을 별도 엔티티로 볼지 결정 필요.

---

## 5. 데이터레이어 전환 설계 (topik-ai 측, 별도 repo)

- topik-ai의 `*-service.ts`(mock) 뒤를 **supabase-js 호출로 교체**. 페이지/스토어는 service 계약만
  알므로(topik-ai 원칙) UI 변경 최소.
- **v13 기존 admin RPC 재사용**(신규 작성 최소화):
  - 회원: `get_admin_users`, `get_admin_user_stats`, `admin_set_user_status`(active↔blocked),
    `admin_change_user_role`
  - 문제: `admin_update_problem`, `admin_toggle_problem_publish`, `admin_delete_problem`,
    `admin_add_problem_asset`, `admin_remove_problem_asset`
  - 감사: `get_admin_audit_logs`
- **신규 필요 식별(설계만)**: 회원 status가 active/blocked 외 값을 요구하면 RPC 확장 필요;
  문제 `topic_category_code`/`review_workflow_status`/`questionTypeLabel` 신규 컬럼 시
  `admin_update_problem` allowlist 확장 필요. 결제는 service_role 경유 읽기 설계 필요(RLS상 client write 없음).

**원칙 (GPT-5.5 교차검토 반영):**
- **R4 — 쓰기는 감사 RPC로만**: topik-ai는 테이블에 **직접 쓰기 금지**. 모든 상태/역할/문제 변경은
  v13의 감사 RPC(`admin_*`)를 통해서만. 읽기는 RPC 또는 RLS-가드 select.
- **R1 — 권한은 RPC/RLS에서 강제**: permission-key는 UI 편의가 아니라 Supabase RPC/RLS에서 실제
  authorization으로 닫혀야 함(클라이언트 게이트만으로 불충분).
- **R5 — 감사**: v13에 `admin_audit_logs`(append-only) + 감사 기록 RPC가 **이미 존재**. 갭은 좁다 →
  (i) topik-ai 액션을 감사 RPC로만 태우고, (ii) 하드코딩 actor 대신 **Supabase auth의 실제 actor** 공급.
- **R3 — 결제 범위 축소**: topik-ai 결제 필드 계약이 없으므로 이번 phase는 **읽기전용 인벤토리**로 한정.

---

## 6. 단계 + 승인 게이트

> **문서 순서 ≠ 배선 순서 (D-E, 교차검토 합의).** *문서*는 충돌이 가장 많은 **문제은행 먼저**(발견 가치
> 최대) 정밀화. 하지만 *실제 배선*은 **회원/profiles 먼저** — 인증·역할·RLS·감사 기반을 가장 낮은 위험
> 작업(목록 읽기 + 이미 감사되는 status 토글)으로 검증한 뒤, 더 위험한 문제 콘텐츠 쓰기로 진행.

| 단계 | 내용 | 선행 게이트(owner 승인) |
|---|---|---|
| **0** | (이번) 본 설계서 + 인벤토리 정밀화 (문서는 문제은행 매핑 우선) | — (문서만) |
| **A. 인증** | topik-ai에 Supabase 로그인/세션 + 실제 actor + 역할 매핑(D-A) 확정 | 2-B 역할 결정 |
| **B. 회원(배선 먼저)** | `User`↔`profiles` 연결 — 목록 읽기 + 감사 status 토글로 기반 검증 | status 코드 확정, 역할 매핑 |
| **C. 문제은행** | `AssessmentQuestion`↔`problems` 연결 (콘텐츠 쓰기, 더 위험) | `topic_category_code`/`review_workflow_status` additive 승인 |
| **D. 결제(읽기전용)** | Commerce↔`payment_history`/`subscriptions` 읽기 인벤토리 | topik-ai 결제 계약 확인 |
| **(보류)** | 강사/추천인/쿠폰/포인트/커뮤니티/메시지/운영/시스템/통계 | **신규 admin 스키마 = owner 승인 + topik-ai 계약 정합 후에만** |

각 단계 공통 게이트: **v13 스키마 실제 변경 / topik-ai를 실제 dev DB에 연결 / 비밀키 사용**은 모두
owner 승인 + 적용 후 증명(불변식: 비밀 미출력, admin/frozen 이름 denylist, additive only, prod 금지).

**수용 기준 (R7 — 구현 brief에 박을 acceptance criteria):**
1. 하드코딩 actor 금지 — 모든 admin 액션은 **Supabase auth의 실제 actor**로 기록.
2. **직접 테이블 쓰기 금지** — 변경은 감사 RPC 경유만(R4).
3. 권한은 **RPC/RLS에서 강제**(클라이언트 게이트만으로 불가, R1).
4. 모든 enum 매핑은 topik-ai 내부 코드 확정 전까지 **PROPOSED ONLY**(R2), `withdraw` 쓰기 매핑 금지(D-F).

---

## 7. 보류 도메인 (overlap 아님)

강사·추천인·쿠폰·포인트·커뮤니티·메시지·운영·시스템 메타데이터·통계 — v13에 대응 테이블 **전무**.
새 admin-oriented 스키마가 필요하므로 **STOP_AT_ESCALATION_GATE**: owner 승인 + topik-ai 계약 정합
전에는 설계/구축하지 않음.

---

## 8. 경계 갱신 제안 (⚠️ 제안만 — 미적용)

> 아래는 **실제 작업(스키마/연결) 착수가 승인될 때** 바꿔야 할 파일/문구의 *제안*입니다. 이 문서는
> 어떤 경계 문서도 수정하지 않습니다.

1. **`docs/admin-scope-boundary.md`** — "Admin은 LATER 동기화, 지금 만들지 말 것" 규칙에
   "**overlap(회원/문제/결제) 한정 통합은 [승인일]부터 착수**, 보류 도메인은 계속 동결" 단서 추가 제안.
2. **`CLAUDE.md`** — "Scope Boundary — Admin" 절에 "overlap 통합 단계 진행 중(B/C/D), 보류 도메인은
   여전히 금지" 한 줄 추가 제안.
3. **`AGENTS.md`** — "Non-Negotiable Rules"의 admin 금지 항목에 동일 단서 추가 제안.
4. **topik-ai (별도 repo, 별도 승인)** — `admin-data-contract.md`에 `users→profiles`,
   `domain`(주제) 컬럼 분리, status/role 매핑 결과를 기록.

---

## 9. 검증 / 무변경 증명 (이번 산출물)

- **무변경**: 작업 후 `git status`에 신규/수정 문서는 `docs/admin-integration-plan.md`(신규) +
  `docs/ai-workflow/runs/2026/06/08/admin-migration-plan-explainer-ko.html`(설명용)만,
  `supabase/migrations/*`·`src/**`·`CLAUDE.md`·`AGENTS.md`·`docs/admin-scope-boundary.md`·
  **`docs/user-admin-data-consistency.md`(기존 보존)** 변경 없음.
- **사실 대조**: 3·4장의 v13 값/컬럼은 `supabase/migrations` 실파일 대조 완료(profiles/problems/
  lifecycle/billing/roles). topik-ai 값은 `admin-data-contract.md`/`admin-page-tables.md`/
  `admin-overview.md` 표기대로, 미명시는 `?`.
- **교차 검수 완료**: GPT-5.5(codex CLI, `gpt-5.5`)로 3라운드(리뷰→토론→독립 결정자) 수행 — 11장 참조.
  영어/ASCII 패킷 인라인 전달로 mojibake 회피(파일 읽기 미사용).

## 10. 출처

- v13: `supabase/migrations/20260520120100_profiles_goals.sql`, `20260520120200_problems.sql`,
  `20260608120100_problems_lifecycle_expiry.sql`, `20260602120100_billing.sql`,
  `20260602120400_admin_and_user_rpcs.sql`, `src/lib/auth/roles.ts`
- topik-ai: `docs/architecture/admin-overview.md`, `docs/specs/admin-data-contract.md`(§9.1·§9.6·§11),
  `docs/specs/admin-page-tables.md`
- v13 기존: `docs/user-admin-data-consistency.md`(2026-06-04 인벤토리), `docs/admin-scope-boundary.md`,
  `docs/user-admin-consistency-method.md`

---

## 11. GPT-5.5 교차검토 (review → debate → consensus → tie-break)

2026-06-08, 본 설계안을 **GPT-5.5**(OpenAI codex CLI, model `gpt-5.5`)로 교차검토. mojibake 회피를 위해
영어/ASCII 패킷을 인라인 전달, 3라운드 진행(세션 의존 없이 매 라운드 맥락 재주입).

- **R1 리뷰**: 제안 6개(P1~P6)·미결정 5개(D-A~E) 비평 + 미지적 갭 7개 제기.
- **R2 토론→합의**: 쟁점 4건 전부 CONVERGE(잔여 blocker 없음).
- **R3 독립 결정자(타이브레이크)**: 토론 맥락 없는 **새 GPT-5.5 세션**이 백지에서 D-A~D-G 재판정 →
  6/7 합의와 일치, **D-G만 합의(→4)를 뒤집어 →5로 판정**. 사용자 위임 원칙에 따라 **독립 결정자 채택(high→5)**,
  토론측(→4, "5는 very hard 예약") 소수의견 병기 (트레이드오프 작고 가역적).

**확정 결정 (D-A ~ D-G):**

| # | 결정 | 채택 | 근거 |
|---|---|---|---|
| D-A | 역할 5↔4 | (b) v13 4역할 유지 + permission-key를 **RPC/RLS에서 강제** | enum 확장은 blast radius 큼; 5역할은 permission 묶음 성격 |
| D-B | 주제 분류 저장 | (a) **신규 컬럼 `topic_category_code`**(코드 기반) | v13 `domain`(영역)과 의미 달라 재사용·tags[] 부적합 |
| D-C | 검수 상태 | (a) `review_status`(최종) + **신규 `review_workflow_status`**(진행) 분리 | 최종결과와 진행상태는 별개 lifecycle, 축약은 정보손실 |
| D-D | 글쓰기 admin 읽기 | (a) **이번 phase 전면 보류** | v13-only, overlap 범위 밖(scope creep) |
| D-E | 배선 순서 | (a) **회원/profiles 먼저** → 문제은행 (문서는 문제은행 먼저) | 인증·역할·RLS·감사 기반을 먼저 닫고 콘텐츠 쓰기 |
| D-F | 회원 status 쓰기 | (a) **정지→blocked만**; 탈퇴(withdraw) 의미 확정 전 UNMAPPED | withdraw가 삭제/개인정보/복구 중 무엇인지 미확정 |
| D-G | 난이도 high 쓰기 | (b) **high→5** (독립 결정자; 토론측 →4 소수의견) | 최상위 버킷→최상위 값(순서 보존) |

**반영된 갭 (R1~R7):** R1 권한 RPC/RLS 강제 · R2 매핑은 PROPOSED ONLY · R3 결제 읽기전용 축소 ·
R4 쓰기는 감사 RPC로만(직접 테이블 쓰기 금지) · R5 감사 인프라 이미 존재(갭=RPC경유+실제 actor) ·
R6 withdraw 매핑 보류 · R7 수용기준 명문화 → 5·6장에 반영.

**정직성 메모**: GPT-5.5 응답은 모델 출력이라 한글이 정상(파일 읽기 mojibake 아님). 토론은 합의로 끝났고
타이브레이크는 D-G 1건만 발생. codex `~/.codex/config.toml`의 `service_tier="default"`가 CLI 0.128.0과
비호환이라 **사용자 설정을 건드리지 않고** 임시 홈으로 우회 실행(사용자가 영구 수정 권장).
