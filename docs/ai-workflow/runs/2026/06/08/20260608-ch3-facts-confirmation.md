# Ch.3 미확정 사실 — 소스 확인 결과 (topik-ai → v13 통합)

> **무엇**: 핸드오프 §3의 "착수 전 반드시 확인할 미확정 사실 5건"을 topik-ai **소스에서 직접 확인**한
> 증거 패키지. 핸드오프 §8 step 2 수행 결과 → step 3(2장 승인 게이트 요청)의 근거.
>
> **작성** 2026-06-08 · **방법** 도메인 4영역(회원·결제·문제·역할/권한) 병렬 확인 → 코드값 1건씩
> **적대적 재검증**(라벨↔코드 둔갑/날조 색출) → 종합. 9 에이전트.
> **상태** 확인 완료. **모든 매핑은 여전히 PROPOSED ONLY**(R2). 코드/DB/경계 변경 0.
>
> **연결 문서**: [핸드오프](20260608-handoff-admin-integration.md) · 설계서 [`docs/admin-integration-plan.md`](../../../../admin-integration-plan.md) §3·§4·§11

---

## 0. 한 줄 요약 (비개발자용)

topik-ai에는 **진짜 데이터베이스가 없고**(가짜 데이터=mock만), 계약 문서엔 한글 라벨만 있어서, 실제 "코드값"은
프로그램 소스 파일에서 캐냈습니다. 회원 상태·등급·결제·역할 값은 **소스로 확정**됐고, 문제 분야/검수단계
이름과 "탈퇴(회원 영구처리)"의 의미는 **사장님(owner)이 정해야** 넘어갈 수 있습니다.

---

## 1. 결과 요약 (핸드오프 §3 표 대조)

| # | 확인 항목 | 결과 | 핵심 |
|---|---|---|---|
| 1 | 회원 `status` 코드값 집합 | **CONFIRMED** | `'정상'/'정지'/'탈퇴'` (한글이 곧 TS union 코드값) + 액션 `suspend/unsuspend/withdraw` |
| 2 | `withdraw`(탈퇴) 의미 | **OWNER_DECISION_REQUIRED** | 소스엔 삭제/익명화/복구 필드 **전무**. IA도 "탈퇴 후 보존정책 미정" 명기 → 사장님 결정 |
| 3 | 결제/환불 필드 계약 | **CONFIRMED(구조차이 노출)** | 결제 `완료/취소/환불`, 환불은 **별도 엔티티**(`처리 대기/승인/거절`) — v13엔 환불 테이블 없음 |
| 4 | topik-ai enum 내부 코드값 | **CONFIRMED(혼합)** | 회원/결제/역할=실코드 / 문제 분야·검수·운영상태=**한글 라벨뿐**(ASCII 코드 없음) |
| 5 | `tier` ↔ `plan_label` | **CONFIRMED** | `'일반'/'프리미엄'` 2값(User 엔티티). 구독상태 `구독/미구독`과 별개 |

**적대검증 종합**: 4개 도메인 전 코드값 검증 통과(ALL_VERIFIED ×3, 문제 도메인 SOME_REFUTED ×1).
유일한 적발 → 난이도 **`4`는 실제 데이터가 아님**(코드 임계값 `>=4` + 계약 예시일 뿐; 97개 픽스처 실측치 = `{5,6}`).
→ 확정에서 제외, "미확정"으로 강등. 날조·mojibake 없음(Read 도구 UTF-8, codex/PowerShell 경로 미사용).

---

## 2. 확정된 코드값 글로서리 (소스 file:line, 적대검증 VERIFIED)

### 회원 (src/features/users)
| 항목 | topik-ai 코드값 | 소스 | v13 제안 매핑 (PROPOSED) |
|---|---|---|---|
| status | `'정상' / '정지' / '탈퇴'` | `model/types.ts:1` (UserStatus union) | 정상→active · 정지→blocked · 탈퇴→deleted(**보류**) |
| 액션 | `'suspend' / 'unsuspend' / 'withdraw'` | `pages/user-detail-page.tsx:48` | suspend→blocked(=정지) · unsuspend→active |
| tier | `'일반' / '프리미엄'` | `model/types.ts:2` (UserTier) | 일반→plan_label 'free' · 프리미엄→'premium' |
| subscriptionStatus | `'구독' / '미구독'` | `model/types.ts:3` | 구독→subscriptions 'active'만 · 미구독→행없음 (그 외 4값 소스 없음) |
| (member role) | **없음** — UserSummary에 role 필드 자체가 없음 | `model/types.ts:5-15` | 회원엔 app_role 대응 없음. 역할 정합은 D-A(운영자 역할)에서만 |

### 결제 (src/features/billing, commerce)
| 항목 | topik-ai 코드값 | 소스 | v13 제안 매핑 (PROPOSED) |
|---|---|---|---|
| PaymentStatus | `완료 / 취소 / 환불` | `billing/model/commerce-store.ts:3` | 완료→paid · 환불→refunded · **취소→? (v13 미존재, owner)** |
| RefundStatus | `처리 대기 / 승인 / 거절` | `commerce-store.ts:5` (RefundRow=**별도 엔티티**) | 승인→payment_history 'refunded'. 처리대기/거절은 **v13 표현 불가** |
| PaymentMethod | `카드 / 계좌이체 / 간편결제` | `commerce-store.ts:4` | v13에 method/product 컬럼 유무 owner 확인 |
| (포인트) | ledger `완료/보류/취소`, source `결제/환불` | `commerce/model/point-types.ts:4-14` | **혼동주의** — payment와 다른 엔티티, v13 범위 밖 |
| (쇼핑등급) | `SHOP-GRADE-WELCOME/CORE/VIP` | `commerce/model/coupon-template-form-schema.ts:17-34` | **혼동주의** — 쿠폰 타깃 CRM 세그먼트, plan/tier 아님 |

### 문제 (src/features/assessment) — ⚠️ 대부분 한글 라벨뿐, ASCII 코드 없음
| 항목 | topik-ai 코드값 | 소스 | 상태 |
|---|---|---|---|
| domain(주제) | `생활/학습/사회/문화/경제/교육/환경/기술` (한글 union) | `model/assessment-question-bank-types.ts:21-29` | **UNMAPPED** — `topic_category_code`는 net-new, owner가 코드철자 비준. 픽스처엔 5/8만 출현 |
| reviewStatus | `검수 대기/검수 중/보류/검수 완료/수정 필요` (한글 union 5) | `types.ts:5-10` | **PROPOSED** — final 3 + 신규 `review_workflow_status`(진행)로 분리. 진행 ASCII 철자 owner 비준 |
| operationStatus | `미지정/노출 후보/숨김 후보/운영 제외` (한글 union) | `types.ts:12-16` | **PROPOSED** — 소스/IA가 "공개정책과 등치 아님" 경고. 운영제외/미지정 매핑·v13 expired 소스없음 owner |
| difficulty | 표시 `상/중/하` + 원천 `meta.difficulty:number`(실측 `{5,6}`) | `types.ts:35,58` · 밴드로직 `store.ts:153-163`(>=6상,>=4중) | **PROPOSED** — 밴드매핑 vs 원천숫자(6→5 클램프) owner. **`4`는 데이터 아님(임계값)** |
| questionNumber | `'51'/'52'/'53'/'54'` | `types.ts:3` | **PROPOSED** — v13 question_no(51-54) 직호환(string→int) |
| questionType | label `빈칸완성/연결표현/자료설명/의견서술`(한글) · meta `importance_problem_effort/advantage_problem_solution/background_problem_response`(ASCII, 픽스처 실값) | `types.ts:30-34,56` | label은 코드없음 · meta.question_type만 코드후보. v13 컬럼 없음 → 노출여부 owner |

### 역할/권한 (src/features/system) — D-A
| 항목 | topik-ai 코드값 | 소스 | 비고 |
|---|---|---|---|
| RoleKey (5) | `SUPER_ADMIN / OPS_ADMIN / CONTENT_MANAGER / CS_MANAGER / READ_ONLY` | `model/permission-types.ts:3-8` | UPPER_SNAKE union(DB enum 아님). 한글명은 라벨. 5개 모두 staff, learner 없음 |
| permission key (36) | `dashboard.read … system.logs.read` (점표기 소문자 36개) | `permission-types.ts:52-305` | 역할별 defaultPermissions 묶음: SUPER=36 · OPS=24 · CONTENT=13 · CS=8 · READ_ONLY=7 |
| 모델 | 2단(RoleKey 묶음 + per-admin `permissions[]` 오버라이드) | `permission-types.ts:307-396` | v13엔 권한키 레이어 **전무** |
| 하드코딩 actor | `admin_park`(system/users/refunds) · `admin_current`(assessment) · seed `system_seed` | `system-permissions-page.tsx:42` · `assessment-question-bank-store.ts:20` | gap-register §3.5 "오구현" 명기 → 실 auth actor로 교체 필요 |

> v13 매핑 제안: SUPER_ADMIN→platform_admin · CONTENT_MANAGER→content_admin. OPS/CS/READ_ONLY는 v13 4역할에
> **1:1 대응 없음** → 권한키 레이어 또는 역할 추가 필요(owner 결정). 단 admin 전용 모듈 키(assessment.*/content.*/
> commerce.*)는 이 user-facing repo 범위 밖이므로 **shared-entity 키만** 관련.

---

## 3. 결정 상태 (D-A ~ D-G + operationStatus + F3)

| 결정 | 상태 | 요지 |
|---|---|---|
| D-A 역할 | **PROPOSED_ONLY** | 소스 인벤토리 확정(5역할·36키·묶음·actor). v13 정합(역할 추가 vs 권한키 레이어)은 owner |
| D-B 주제분류 | **UNMAPPED** | 한글 라벨뿐 확정. `topic_category_code`는 net-new — owner가 코드 비준 전엔 매핑 불가 |
| D-C 검수상태 | **PROPOSED_ONLY** | 한글 5값 + ASCII audit-action 3값 확정. final+progress 분리·진행 ASCII 철자 owner |
| D-F status 쓰기 | **BLOCKED_OWNER** | 정상/정지/탈퇴 확정·suspend→blocked 일관. **withdraw→deleted 의미 미정 → 쓰기 금지** |
| D-G 난이도 | **PROPOSED_ONLY** | 상/중/하·원천 {5,6} 확정(4는 임계값). 1..5 매핑법(밴드 vs 원천,6→5) owner. 기존 상→5만 확정 |
| operationStatus | **PROPOSED_ONLY** | 4 한글값 + audit 3값 확정. lifecycle_status 매핑 경고 다수 → owner |
| F3 결제/환불 | **PROPOSED_ONLY** | 전 코드값 확정. 구조차이(환불 별도엔티티·취소 v13없음·pending/failed 소스없음) owner |

---

## 4. Owner 결정 필요 목록 (게이트에서 수집 — 소스로 추론 불가)

1. **D-F withdraw 의미**: 소프트삭제(복구가능) / 개인정보삭제 / 상태값만 — 정하기 전 `탈퇴→deleted` **쓰기 금지**.
2. **D-A 역할 모델**: v13 역할 추가 vs 권한키 레이어(~36키+묶음+오버라이드) 신설. shared-entity 키로 한정.
3. **D-B topic_category_code**: 8개 주제의 ASCII 코드 철자 + 한글 룩업 비준. 픽스처 미출현 3개(생활/학습/문화) 처리.
4. **D-C review_workflow_status**: 신규 진행필드 ASCII 철자 + 5값→final(3)+progress(5) 분리 확정.
5. **operationStatus→lifecycle_status**: 운영제외→inactive vs 신규 'excluded' / 미지정 매핑 / 이게 lifecycle 소스가 맞는지(공개정책≠ 경고).
6. **D-G 난이도**: 밴드매핑 vs 원천숫자(6→5 클램프).
7. **환불 구조(F3)**: v13에 환불요청 엔티티 신설 vs admin앱 전용 유지(승인/거절 워크플로·CS필드 손실).
8. **결제 '취소'(F3)**: 환불로 매핑 vs 미이관. 'failed' 무단 과부하 금지.
9. **결제 필드(F3)**: v13 payment_history에 method/product 컬럼 유무.
10. **question type**: meta.question_type 노출 여부(코드 후보). questionNumber→question_no는 확정.

---

## 5. 게이트 권고 (핸드오프 §2 / 설계서 §6)

**권고: 2장 승인 게이트를 지금 요청 가능 — 단 아래 단서 동반.**

- (1) 모든 매핑은 **PROPOSED ONLY** — 이 확인이 코드/DB/경계 변경을 함의하지 않음(R2).
- (2) **D-F withdraw 쓰기 매핑 금지/차단** — owner가 의미 확정 전 `탈퇴→deleted` 쓰기 절대 금지.
- (3) 문제 3건(D-B/D-C/operationStatus)은 **한글 라벨만 확정, ASCII 코드 net-new** → 마이그레이션 컬럼 확정 전 owner 비준 필요.
- (4) topik-ai는 **완전 mock**(실 DB·RLS·영속 없음) → 확정은 "명명 의도"이지 런타임 동작이 아님.
- (5) CLAUDE.md 경계: 이 확인은 LATER admin-sync 단계용 어휘 확정일 뿐, user-facing repo에 admin 기능 구축을 승인하지 않음. admin-oriented 스키마 추가 금지.

**게이트 목적** = 위 §4의 10개 owner 결정 수집. Phase A 시작 차단요소 = D-A(역할 모델) + 게이트 §2의 (1)경계해제·(3)Supabase 연결. Phase B 시작엔 withdraw 불필요(suspend→blocked만으로 가능, 탈퇴는 UNMAPPED 유지).
