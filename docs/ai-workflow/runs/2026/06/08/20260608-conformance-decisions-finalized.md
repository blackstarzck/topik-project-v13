# 와이어프레임 DB 정합성 — 9개 결정 확정 & 후속 설계 브리프

- **작성일**: 2026-06-08 (KST)
- **상태**: 결정 9가지 **모두 확정(FINAL)**. #2·#4 **마이그레이션 작성·검수 완료**(`#31` `20260608120000`, `#32` `20260608120100` — 적대적 4-렌즈 검수 결과 **`READY_TO_APPLY`**, 블로커 0).
- **소유자 승인**: 받음(2026-06-08, 사용자 지시 "관리자측은 이후 개발할 예정, 마이그레이션 진행"). 게이트의 "소유자 승인" 충족.
- **적용(DB 반영)**: **아직 안 됨.** 이 환경엔 Docker/Supabase CLI 없음 → billing(#26-30)과 동일하게 **파일 작성 단계**. 적용은 Docker 있는 환경에서 `supabase db reset`/`db push`.
- **근거 점검**: `docs/ai-workflow/runs/2026/06/05/20260605-122712-wireframe-db-conformance.html`(기술) · `…-easy-ko.html`(쉬운 설명판)
- **재검증**: 다중 에이전트 워크플로우 2회(① 실제 스키마 audit + 거버넌스 + 적대적 범위검증 → `STOP_AT_ESCALATION_GATE`; ② 작성된 마이그레이션 적대적 4-렌즈 검수 → `READY_TO_APPLY`). typecheck 통과.

이 문서는 `CLAUDE.md`가 net-new 스키마 착수 전에 요구하는 **게이트 산출물**입니다. 소유자 승인을 받아 마이그레이션을 작성했고(아래 7장), **파일은 additive·idempotent이며 적용 전까지 DB는 변경되지 않습니다.**

---

## 1. 확정된 9개 결정

| # | 항목 | 확정 | 새 스키마 필요? | 게이트 |
|---|------|------|------------------|--------|
| 1 | 추천 규칙표(약점→유형 매핑·가중치) | **보류** (나중 결정) | — | — |
| 2 | 약관/개인정보 동의 기록 | **B** — 문서 버전별 저장 + 사용자 동의 이력 | **예** | 소유자 승인 + 계약 정합 |
| 3 | 작문 유형별 결제 잠금 | **A** — 전 작문 유형 무료 | 아니오 | — |
| 4 | 문제 "만료"의 의미 | **채택** — `problems`에 상태·만료 **전용 컬럼** 추가, 만료 *기준*은 보류 | **예** | 소유자 승인 + 계약 정합 |
| 5 | 보관함 복습세트/폴더/공유 | **A** — 태그·메모만 | 아니오 | — |
| 6 | 인증·보안 로그 | **A** — Supabase 기본 로그만 | 아니오 | — |
| 7 | 운영 문구 관리 | **B** — i18n/문구 파일로 관리(CMS 없음) | 아니오 | — |
| 8 | 결제 체크아웃 연동 | **A** — 페이월/구독 안내 화면만(체크아웃 없음) | 아니오 | — |
| 9 | 공개 프로필/팔로우 | **A** — 만들지 않음 | 아니오 | — |

→ **7가지(#1,#3,#5,#6,#7,#8,#9)는 새 DB 작업 없음.** 기존 화면 문구·동작을 확정에 맞게 유지하면 끝(#7은 문구를 i18n 파일에 둠).
→ **2가지(#2,#4)만 새 스키마가 필요**하고, 둘 다 **관리자 앱(`topik-ai`) 소유 공유 엔티티**라 아래 게이트를 거칩니다.

---

## 2. 게이트가 필요한 이유 (거버넌스)

검증된 사실:

1. **`problems` = admin-first 공유 문제은행.** 관리자 앱이 문제를 저작·큐레이션하고, 사용자 앱(이 저장소)은 읽기 전용으로 소비. admin 계약 후보 테이블 `assessment_questions`. (`docs/user-admin-consistency-method.md` 공유 엔티티 목록)
2. **약관/정책 = admin 소유(Operation > 정책 관리).** admin 계약 후보 테이블 `operation_policies`, 필드 `requiresConsent`. 사용자 앱은 정책을 읽고 동의만 함.
3. **`admin-data-contract.md`는 이 저장소에 없음.** 별도 `topik-ai/docs/specs/admin-data-contract.md`에만 존재. 따라서 표·컬럼·enum 이름을 이 저장소 안에서는 계약에 정합시킬 수 없음.
4. **실제 admin 계약 필드명이 임시 제안명과 크게 다름** (예: 계약은 `policyType`/`versionLabel`/`effectiveDate`/`exposureSurfaces`/`bodyHtml`/`status`/`requiresConsent`). 지금 임의 이름으로 만들면 거의 확실히 네이밍/의미 드리프트 발생.

`CLAUDE.md` / `docs/admin-scope-boundary.md` 규칙:
> "사용자 화면을 맞추려고 admin 성격 스키마/마이그레이션을 추가하지 말 것 — 화면을 스키마에 맞추고, 진짜 갭은 소유자에게 에스컬레이션. 공유 스키마 변경은 소유자 명시 승인 후에만."

→ #2·#4는 **진짜 갭(라이브에 실제로 없음)** 이면서 동시에 **admin 소유**라, 두 조건 모두 소유자 승인을 요구.

**적용 순서(두 결정 공통):**
`① 소유자(admin 계약) 승인` → `② 모든 표/컬럼/enum 이름을 admin-data-contract에 정합` → `③ additive + idempotent 마이그레이션 작성·적용` → `④ 실화면 증명`.

---

## 3. #2 약관·동의 — 제안 스키마 (승인·정합 전 PROPOSAL)

> 검증: 마이그레이션 30개 전수 확인 결과 약관 버전 테이블·사용자 동의 이력 테이블·`profiles` 동의 컬럼이 **전부 부재**. `profiles.content_prefs`는 콘텐츠 선호용 → 재사용 금지.

화면 요구(와이어프레임): A-01(가입 시 약관 링크/동의), D-M1(제출 동의 체크), X-13(약관, "정식 게시 시 재동의" 명시), X-14(개인정보).

### `legal_documents` — 문서 버전별 본문 (버전당 1행, append 이력, 덮어쓰기 금지)
| column | type | 용도 |
|--------|------|------|
| `id` | uuid PK (`gen_random_uuid()`) | |
| `doc_type` | text check (`terms`,`privacy`) | X-13=terms / X-14=privacy |
| `version` | text | 사람이 읽는 버전 라벨 |
| `locale` | text check (`ko`,`en`,`vi`) | 콘텐츠 언어 |
| `title`,`body` | text | 화면 본문 |
| `summary` | text (nullable) | 요약 블록 |
| `is_placeholder` | boolean default true | 법무 검토 전 placeholder 표시 |
| `status` | text check (`draft`,`published`,`archived`) | 게시 lifecycle |
| `requires_consent` | boolean default true | 가입 시 동의 필요 여부 (계약 `requiresConsent` 매핑) |
| `effective_at` | timestamptz (nullable) | 적용 시작 시각 |
| `created_at`,`updated_at` | timestamptz default now() | |

### `user_consents` — 동의 이력 (accept 이벤트당 1행, append-only, update/delete 금지)
| column | type | 용도 |
|--------|------|------|
| `id` | uuid PK | |
| `user_id` | uuid FK → `profiles(id)` on delete cascade | |
| `document_id` | uuid FK → `legal_documents(id)` on delete restrict | 정확히 어떤 버전에 동의 |
| `doc_type`,`version` | text | accept 시점 비정규화(감사 안정) |
| `accepted_at` | timestamptz default now() | **"언제 동의했는지" — 결정 #2 핵심** |
| `source` | text check (`signup`,`re_consent`,`settings`) | A-01 가입 vs 향후 X-13 재동의 |
| `created_at` | timestamptz default now() | (updated_at 없음 — 불변 ledger) |

**정합 항목(승인 시 admin 계약과 맞출 것):** `legal_documents` ↔ `operation_policies` (계약 필드 `policyType`/`versionLabel`/`effectiveDate`/`bodyHtml`/`requiresConsent`로 이름 재맵). `status`/`locale` enum이 계약과 동일한지 확인(현재 "재사용" 주장은 미검증 가정).

---

## 4. #4 문제 상태·만료 — 제안 컬럼 (승인·정합 전 PROPOSAL)

> 검증: `problems`에 `publish_status`/`review_status`/`visibility` enum은 있으나 **lifecycle·만료 컬럼은 없음**. `expires_at`은 `recommendation_runs`(추천 묶음)에만 존재 — 문제 만료와 **별개 개념**. C-02 화면은 "만료/비공개 문제는 행 비활성 + 사유 표시"를 요구, 만료는 별도 timestamp가 아니라 **상태(status)** 로 표현.

`public.problems`에 추가할 additive 컬럼:

| column | type | 용도 |
|--------|------|------|
| `lifecycle_status` | text not null default `'active'` check (`active`,`inactive`,`expired`) | C-02 상태 배지 구동. `inactive`=비공개, `expired`=만료 → 행 비활성. **`publish_status`(편집 게시 상태)와 의미가 달라 별도 enum** |
| `lifecycle_reason` | text (nullable) | 비활성 행 옆 "사유 표시"(C-02) |
| `expires_at` | timestamptz (nullable) | **문제 전용** 만료 시각. `recommendation_runs.expires_at`(추천 만료)과 분리 |

**중요(결정 #4 단서):** 만료 *기준*은 미정 → **컬럼만** 추가하고, `expires_at`↔`lifecycle_status`를 잇는 **자동 만료 트리거/계산 배지/cron은 만들지 않음**(기준 확정 후 별도 작업). `recommendation_runs`는 손대지 않아 분리 보존.

**정합 항목:** 문제은행 owner의 계약(`assessment_questions`)에서 lifecycle/expiry 어휘를 확인해 `lifecycle_status` enum·컬럼명을 맞출 것.

---

## 5. 마이그레이션 메커니즘 (승인·정합 후에만)

승인+정합이 끝나면 마이그레이션 자체는 저위험·기계적:
- **strictly additive + idempotent**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`. drop/reset/db-reset 금지.
- 기존 컨벤션 준수: `text + check` enum, `profiles` FK on delete cascade, RLS enable+force(소유자/admin 정책은 `private.is_platform_admin`), `updated_at`은 `public.touch_updated_at` 트리거.
- `recommendation_runs.expires_at` 무접촉(분리 유지).
- 프론즌 admin 객체(H-01/X-08/X-10/X-15, organizations/org_members/assignments/admin_*) 무접촉.

---

## 6. 사용자가 직접 확인할 것

1. **적용 실행** — 이 환경엔 Docker가 없어 마이그레이션 파일만 작성됨. Docker 있는 환경에서 `pnpm dlx supabase db reset`(로컬) 또는 `db push`(원격 linked)로 적용해야 실제 DB에 반영됩니다.
2. **#4 만료 기준** — "어떤 조건에서 문제가 만료되는가"는 아직 미정. 기준이 정해져야 자동 만료 동작(트리거/cron)까지 구현 가능(현재는 컬럼만, `lifecycle_status`는 전부 `active` 기본값).
3. **#1 추천 규칙표** — 보류. 추천 이유 문구를 화면에 노출할 시점에 다시 결정.
4. **관리자 앱 개발 시 정합** — 아래 7장 "정합 대상" 표대로 admin 빌드 시 이름을 맞추세요.

---

## 7. 적용 상태 & 정합 대상 (2026-06-08)

**작성된 마이그레이션 (additive · idempotent · 검수 `READY_TO_APPLY`):**

| # | 파일 | 내용 |
|---|------|------|
| 31 | `supabase/migrations/20260608120000_legal_documents_and_consents.sql` | `legal_documents`(버전별 약관/개인정보; published는 anon+authenticated read, draft/archived는 admin) + `user_consents`(append-only 동의 ledger; owner read+insert, update/delete 없음) + RLS enable/force + `touch_updated_at` 트리거 |
| 32 | `supabase/migrations/20260608120100_problems_lifecycle_expiry.sql` | `problems`에 `lifecycle_status`(active/inactive/expired) + `lifecycle_reason` + `expires_at` 추가 + 부분 인덱스. RLS 변경 없음(컬럼만). 자동 만료 로직 없음(기준 미정) |

**검수 통과 항목:** 멱등성·additive(드롭/리셋 0), RLS(enable+force; published anon read 의도적; consent ledger 불변), 참조(`touch_updated_at`/`is_platform_admin`/FK 타깃 모두 선행 마이그레이션에 존재·순서 OK), 범위(프론즌 admin 객체 무접촉).

**관리자 앱 개발 시 정합 대상 (이름만 맞추면 됨, 구조 동일):**

| v13 (작성됨) | admin 계약 (`topik-ai`) |
|--------------|--------------------------|
| `legal_documents` (+ `user_consents`) | `operation_policies` + `operation_policy_histories` |
| `legal_documents.requires_consent` | `requiresConsent` |
| `legal_documents.version` / `body` / `effective_at` | `versionLabel` / `bodyHtml` / `effectiveDate` |
| `problems.lifecycle_status` | `assessment_questions.operationStatus` |
| `problems.expires_at` | (net-new — 계약 대응 없음) |

**설계 메모(검수 권고 반영):**
- `user_consents → legal_documents` FK는 `on delete restrict`(저장소 일반 패턴인 cascade와 다름) — 동의한 약관 버전이 실수로 삭제되어 감사 이력이 끊기지 않도록 의도. admin 도구가 약관 버전을 지우려면 종속 동의를 먼저 확인/이관해야 함.
- 자동 만료: `expires_at`가 지나도 `lifecycle_status`는 자동으로 `expired`가 되지 않음(기준 미정). 만료 기준 확정 시 트리거/cron/서비스 프로세스로 전이 로직 추가 — 후속 작업.
