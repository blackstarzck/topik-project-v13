# 관리자 페이지 구성안 — 현재 사용자 화면 구현 기반 도출

> **상태:** 도출 참고 문서 (설계 입력용 / derived planning reference)
> **작성:** 2026-06-04
> **근거 산출물:** [`docs/user-admin-data-consistency.md`](user-admin-data-consistency.md)(사용자↔admin 데이터 인벤토리), [`docs/admin-scope-boundary.md`](admin-scope-boundary.md), [`docs/user-admin-consistency-method.md`](user-admin-consistency-method.md)

---

## ⚠️ 0. 먼저 읽어야 할 범위 경고 (중요)

이 문서는 **"관리자 페이지를 새로 만들라"는 지시서가 아닙니다.** 다음을 반드시 전제로 읽어 주세요.

1. **관리자(admin) 앱은 이 저장소가 아니라 별도 저장소 `topik-ai`가 소유합니다.** (Vite + React + AntD, 별도 git) 실제 관리자 기능은 거기서 만들고, 이 저장소(v13)는 **사용자 화면 전용**입니다.
2. 그래서 이 문서는 **"지금 v13에 실제로 구현돼 있는 사용자 기능을 운영하려면, 관리자 콘솔에 어떤 화면·기능이 필요한가"를 거꾸로 도출(reverse-derive)한 설계 입력 자료**입니다. v13에 admin을 새로 짓기 위한 게 아니라, 나중에 있을 **admin↔v13 정합(sync) 단계**의 참고 자료입니다.
3. 이 문서를 근거로 **v13 안에 admin 코드를 새로 만들거나 확장하면 안 됩니다.** 데이터 스키마도 admin 우선으로 설계됐기 때문에, 사용자 화면을 스키마에 맞추는 방향이지 그 반대가 아닙니다.
4. 실제 화면 명세의 최종 권위는 `topik-ai/docs/specs/admin-data-contract.md`와 `topik-ai/docs/page-sync/*.md`에 있습니다. 여기 표의 화면 이름·용어는 그 문서들과 정렬한 것입니다.

> 한 문장으로: **"지금 v13이 굴러가게 하려면 관리자가 무엇을 보고 무엇을 만질 수 있어야 하는가"의 지도** — 만드는 작업이 아니라 만들 때를 위한 밑그림.

---

## 1. 한 줄 요약

지금 v13에 구현된 사용자 기능(회원·문제·쓰기 제출·AI 피드백·추천·결제·알림·라이브러리)을 운영하려면, 관리자 콘솔은 크게 **9개 영역**이 필요합니다. 이 중 **직접 만지는(CRUD) 영역은 "문제은행"과 "회원/결제 카탈로그"뿐**이고, **나머지 대부분은 사용자 소유 데이터라서 "읽기/지원/분석" 전용**으로만 두는 것이 안전합니다.

---

## 2. 도출의 출발점 — 지금 "실제로 구현된 것"

### 2-1. 사용자 화면 (현재 v13에 구현된 32개 라우트)

| 영역 | 라우트 |
| --- | --- |
| 인증/온보딩 | `/login`, `/sign-up`, `/password-reset`(+confirm), `/auth/*`, `/onboarding/learning-goal` |
| 대시보드/성장 | `/dashboard`, `/growth` |
| 연습/추천 | `/practice/problems`, `/practice/recommendations`, `/practice/weakness`, `/practice/next` |
| 쓰기 | `/writing/short-answer-writing-51`, `/answer-writing-52`, `/long-form-writing-53`, `/essay-writing-54` |
| 피드백/리포트 | `/writing/feedback/short/[id]`, `/writing/feedback/long/[id]`, `/writing/reports/[id]/compare` |
| 라이브러리 | `/library` |
| 프로필/설정 | `/profile`, `/settings/language`, `/settings/notifications` |
| 결제 | `/paywall`, `/subscription` |
| 약관/정책 | `/terms`, `/privacy` |

### 2-2. 이미 이 저장소에 "동결된 채" 존재하는 admin 코드 (확장 금지 / 참고만)

v13 안에는 과거에 만들어졌다가 **동결(frozen)된 최소 관리자 골격**이 있습니다. 이건 권위 있는 admin 구현이 아니며 **삭제도 확장도 하지 않습니다.** 다만 "이미 어떤 모양을 시도했는가"의 참고가 됩니다.

| 동결된 화면 | 위치 | 다루던 것 (코드상) |
| --- | --- | --- |
| 관리 허브 | `src/app/(workspace)/admin/page.tsx` → `AdminHub` | 역할별 진입 메뉴 |
| 문제 관리 | `admin/problems` | 문제 목록·발행 토글·상세·에셋·KPI (`AdminProblemTable`, `AdminProblemPublishToggle`, `AdminProblemAssetsManager`, `AdminProblemDetailPanel`, `AdminProblemKpiBand`) |
| 회원 관리 | `admin/users` | 회원 목록·역할 변경·상세·감사로그 드로어·KPI (`AdminUsersConsole`, `AdminUserTable`, `AdminUserRoleModal`, `AdminAuditLogDrawer`, `AdminUserKpiBand`) |
| 조직 관리 | `admin/org` | 조직 KPI·과제 배정·구성원별 현황 (`AdminOrgKpiCards`, `AdminOrgAssignmentModal`, `AdminOrgPerUserTable`) |

> **주의:** `admin/org`가 쓰는 조직(organizations/assignments) 스키마는 과거 "전체 빌드(admin 포함)" 지시 아래 추가됐다가 그 지시가 철회된 항목입니다(dev에만 적용, 사용자 기능 미사용). **현재 사용자 화면 범위 밖**이며, 유지/롤백은 정합 단계에서 소유자가 결정합니다.

---

## 3. 관리자 콘솔 영역 — 한눈에 보기

> **관리 성격** 표기: **CRUD**=직접 생성·수정·삭제 / **상태변경**=특정 상태/역할만 변경 / **읽기·지원**=조회와 고객지원(CS) 진단용 / **분석**=집계 통계용.

| # | 관리 영역 | 핵심 관리 대상 (v13 데이터) | 관리 성격 | topik-ai 기존 화면 매핑 | 우선순위 |
| --- | --- | --- | --- | --- | --- |
| 1 | **문제은행(쓰기 문제)** | `problems`, `problem_assets` | **CRUD** | Assessment > TOPIK 쓰기 문제은행 | **1순위 (직접 겹침)** |
| 2 | **회원·계정** | `profiles`, `learning_goals`, `avatars` | 상태변경 + 읽기·지원 | Users > 회원 목록 / 회원 상세 | **2순위 (직접 겹침)** |
| 3 | **결제·구독** | `subscription_plans`, `subscriptions`, `payment_history` | 카탈로그 CRUD + 읽기·지원 | Commerce > 결제 내역 / 환불 관리 / 이커머스 관리 | 3순위 (부분 겹침) |
| 4 | **알림·메시지** | `notification_settings`, `notification_log` | 읽기·지원 (캠페인은 별도) | Message > 메일 / 푸시 / 대상 그룹 / 발송 이력 | 4순위 (부분 겹침) |
| 5 | **쓰기 제출물·AI 피드백** | `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `sentence_feedback`, `writing_drafts` | **읽기·지원 전용** | Users > 회원 상세(지원 탭) / Analytics | 5순위 (지원/품질) |
| 6 | **학습 활동·추천** | `problem_attempts`, `recommendation_runs`, `recommendation_items`, `study_events` | 분석 + 설정(선택) | Analytics / Content | 6순위 (분석) |
| 7 | **라이브러리·리포트·내보내기** | `library_items`, `comparison_reports`, `export_files` | 읽기·지원 전용 | (현재 topik-ai에 대응 화면 없음) | 낮음 (지원) |
| 8 | **대시보드·분석 지표** | `get_dashboard_kpi`, `study_events` 집계 | 분석(읽기) | Dashboard / Analytics > 통계 개요 | 상시 |
| 9 | **시스템·권한·감사** | `profiles.app_role`, `admin_audit_logs` | 내부 운영 | System > 관리자 계정 / 권한 관리 / 감사 로그 | 내부 |

---

## 4. 화면별 상세 구성안

각 화면은 다음 형식으로 기술합니다: **목적 / 화면에 보일 것 / 가능한 동작 / 데이터 소스 / 권한 / 관리 성격 / topik-ai 매핑 / 주의.**

### 4-1. 문제은행(쓰기 문제) 관리 — 최우선

- **목적:** TOPIK 쓰기 문제(51·52·53·54형)를 등록·검토·발행하고 사용자 화면에 노출되는 문제를 통제한다.
- **화면에 보일 것:** 문제 목록(유형/상태/공개여부 필터), 문제 상세(지문·자료·채점기준 rubric·모범답안 answer_key), 첨부 에셋(이미지/오디오) 목록, 발행·검토 상태 KPI.
- **가능한 동작:** 문제 생성·수정, 발행/비발행 토글(`publish_status`), 검토 상태 변경(`review_status`), 공개범위 설정(`visibility`), 에셋 업로드/교체.
- **데이터 소스:** `problems`, `problem_assets` + `problem-assets` 스토리지. (사용자 화면 `/writing/*`, `/practice/*`, `/library`가 이 데이터를 읽음)
- **권한:** content_admin / platform_admin.
- **관리 성격:** **CRUD (직접 관리).** 이 영역이 사용자 화면과 가장 직접적으로 겹치는 1순위 정합 슬라이스.
- **topik-ai 매핑:** Assessment > TOPIK 쓰기 문제은행(`assessment_questions` 후보 + 97문항 JSON fixture). **단, 필드/테이블 이름이 다름** — v13 `problems.prompt/materials/rubric/answer_key/publish_status/...` ↔ topik-ai `assessment_questions`. 매핑 계약(field-level mapping)이 정합의 첫 작업.
- **주의:** topik-ai fixture는 문서(JSON) 중심이라 에셋(`problem_assets`) 관리가 명시적이지 않음. 에셋을 관리 대상으로 둘지 정해야 함.

### 4-2. 회원·계정 관리

- **목적:** 가입 회원을 조회하고, 운영상 꼭 필요한 상태(차단/역할 등)만 통제한다. 프로필 본문은 원칙적으로 사용자 소유.
- **화면에 보일 것:** 회원 목록(상태/플랜/역할 필터), 회원 상세(프로필, 학습 목표, 결제/구독 상태, 최근 활동), 가입/접속 지표 KPI.
- **가능한 동작:** 계정 상태 변경(`profiles.status` active/blocked 등), 역할 부여(`app_role`), 지원용 조회. **프로필 본문·학습목표는 기본 읽기**(필요 시 지원 목적 한정).
- **데이터 소스:** `profiles`(인증 미러·상태·역할·로케일·플랜라벨·아바타 경로), `learning_goals`, `avatars` 스토리지.
- **권한:** 상태/역할 변경은 platform_admin. 조회는 지원 권한.
- **관리 성격:** **상태변경 + 읽기·지원.** RLS가 신뢰 필드(역할/상태)를 admin 전용으로 보호 중.
- **topik-ai 매핑:** Users > 회원 목록(`/users`), 회원 상세(`/users/:userId`). **핵심 매핑 이슈:** v13 테이블은 `profiles`인데 topik-ai 후보는 `users`. **이메일 출처**(`auth.users` vs mock `users`)와 `id/display_name/nickname/status/plan_label/app_role` 필드 매핑을 먼저 합의해야 함.
- **주의:** `learning_goals`는 admin 전용 화면이 없음 — admin이 목표를 "관리"할지, "조회만" 할지 제품 결정 필요.

### 4-3. 결제·구독 관리

- **목적:** 요금제 카탈로그를 관리하고, 사용자 구독/결제 상태를 조회·지원한다.
- **화면에 보일 것:** 요금제(plan) 목록, 사용자별 구독 상태, 결제 내역/영수증, 환불 상태.
- **가능한 동작:** 요금제 카탈로그 CRUD(`subscription_plans`), 구독/결제 **조회**, 환불 처리(정책에 따라).
- **데이터 소스:** `subscription_plans`(카탈로그), `subscriptions`(사용자별 상태, 서비스가 씀), `payment_history`(영수증/결제시도, 서비스가 씀).
- **권한:** platform_admin / 결제 운영 권한.
- **관리 성격:** **카탈로그 CRUD + 상태 읽기·지원.** 구독/결제 레코드는 서비스가 쓰는 것이라 직접 편집은 위험.
- **topik-ai 매핑:** Commerce > 결제 내역(`commerce_payments`), 환불 관리(`commerce_refunds`), 이커머스 관리(`commerce_products/packages`). **부분 겹침 — 1:1 아님.** v13는 `payment_history.status='refunded'`로 환불을 표현하지만 별도 환불 테이블이 없음. 요금제를 `subscription_plans`로 관리할지 commerce 상품/패키지로 볼지 결정 필요.
- **주의:** "구독 상태"와 "결제 거래"를 admin 모델에서 분리해야 함.

### 4-4. 알림·메시지

- **목적:** 발송 결과를 추적하고, (별도로) 운영 캠페인을 발송한다. 사용자 개인 알림 설정은 사용자 소유.
- **화면에 보일 것:** 발송 이력(채널/상태/수신자), 메일·푸시 템플릿(운영 캠페인), 대상 그룹.
- **가능한 동작:** 캠페인 템플릿/대상 관리(운영), 발송 이력 조회. **사용자별 알림 설정은 조회만.**
- **데이터 소스:** `notification_settings`(사용자별 리마인더 설정·채널, 사용자 소유), `notification_log`(발송 이력).
- **권한:** 메시지 운영 권한.
- **관리 성격:** **읽기·지원** + 운영 캠페인(별도 모델).
- **topik-ai 매핑:** Message > 메일/푸시(`message_templates`), 대상 그룹(`message_groups`), 발송 이력(`message_histories`). **부분 겹침** — v13의 "사용자 알림 설정"과 admin의 "캠페인 타겟팅"은 다른 개념. **합치지 말 것.** v13에는 아직 세그먼트/그룹 DB가 없음.
- **주의:** 수신자 모델·발송 상태·템플릿 필드 매핑 필요.

### 4-5. 쓰기 제출물·AI 피드백 (읽기·지원 전용)

- **목적:** 사용자가 제출한 글과 AI 피드백을 **품질 점검·고객지원** 목적으로 들여다본다. 편집이 아님.
- **화면에 보일 것:** 제출물 본문(읽기), AI 피드백(전체/항목별 점수/문장별 교정), 피드백 생성 상태.
- **가능한 동작:** **조회·진단만.** 필요 시 재생성 요청/오류 표시 정도.
- **데이터 소스:** `writing_submissions`(제출물, **불변 immutable**), `writing_feedback`, `feedback_dimension_scores`, `sentence_feedback`, `writing_drafts`(자동저장 초안).
- **권한:** 지원/품질 권한(개인정보 접근 최소화).
- **관리 성격:** **읽기·지원 전용.** 직접 CRUD는 데이터 무결성·신뢰를 깨므로 금지.
- **topik-ai 매핑:** Users > 회원 상세의 지원 탭 또는 Analytics에 read 형태로. 현재 topik-ai에 직접 CRUD 화면 없음.
- **주의:** 제출물은 불변 유지. 초안·제출물 열람은 **개인정보 경계와 읽기 전용 경로**를 먼저 정의해야 함.

### 4-6. 학습 활동·추천 (분석/지원)

- **목적:** 학습 활동과 추천 결과를 **집계·분석**한다. 추천 규칙(설정)은 선택적으로 운영.
- **화면에 보일 것:** 추천 실행 이력·요약, 추천 문항·이유·약점 태그, 문제 풀이 시도 통계, 학습 활동 추이.
- **가능한 동작:** **조회·분석.** (선택) 추천 규칙/설정 관리. 사용자 진행상황은 직접 수정 금지.
- **데이터 소스:** `problem_attempts`, `recommendation_runs`, `recommendation_items`(서비스 생성/사용자 소유), `study_events`(학습 활동 원장).
- **권한:** 분석/운영 권한.
- **관리 성격:** **분석(읽기)** + (선택) 추천 설정. raw 이벤트 변경 금지.
- **topik-ai 매핑:** Analytics / Content 후보. 현재 직접 CRUD 화면 없음.
- **주의:** "추천 결과 CRUD"는 일반적인 admin 작업이 아님 — 규칙·설정 운영인지, 생성물 관찰인지 명확히.

### 4-7. 라이브러리·리포트·내보내기 (읽기·지원 전용)

- **목적:** 사용자가 저장한 항목·비교 리포트·내보내기 파일을 지원 목적으로 조회.
- **화면에 보일 것:** 저장 항목, 비교 리포트(`comparison_reports`), 내보내기(PDF) 메타/상태.
- **가능한 동작:** **조회.** (선택) 실패한 내보내기 지원 큐.
- **데이터 소스:** `library_items`, `comparison_reports`, `export_files` + `generated-exports` 스토리지.
- **권한:** 지원 권한.
- **관리 성격:** **읽기·지원 전용** (사용자 소유 산출물).
- **topik-ai 매핑:** 현재 대응 화면 없음.
- **주의:** CS 요구가 명확할 때만 읽기 경로를 추가.

### 4-8. 대시보드·분석 지표 (집계 읽기)

- **목적:** 서비스 전반의 운영 지표를 본다(개별 CRUD 아님).
- **화면에 보일 것:** 가입/활동/학습/결제/알림 집계 카드, 추이 차트.
- **데이터 소스:** `get_dashboard_kpi` RPC(사용자용 집계), `study_events`/결제/알림/피드백 집계.
- **관리 성격:** **분석(읽기).** 사용자용 대시보드 RPC를 admin CRUD 소스로 쓰면 안 됨.
- **topik-ai 매핑:** Dashboard(`/dashboard`), Analytics > 통계 개요(`/analytics/overview`).
- **주의:** admin은 집계 뷰가 필요하지 사용자 KPI RPC 자체가 아님.

### 4-9. 시스템·권한·감사 로그 (내부 운영)

- **목적:** 관리자 계정/권한과 감사 로그를 운영한다.
- **화면에 보일 것:** 관리자 계정, 역할/권한, 감사 로그, 시스템 로그.
- **데이터 소스(v13 측 관련):** `profiles.app_role`(역할), `admin_audit_logs`(감사), `private.is_*_admin` RLS 헬퍼. — 이들은 **admin 전용이 아니라 앱 전체 인증/RLS의 토대**라 삭제 금지.
- **권한:** platform_admin.
- **관리 성격:** **내부 운영.**
- **topik-ai 매핑:** System > 관리자 계정(`admin_accounts`), 권한 관리(`system_roles/permissions`), 감사 로그(`audit_logs`), 시스템 로그. **감사 로그의 최종 SoT는 topik-ai admin 백엔드**가 가져가는 방향.
- **주의:** B2C 노출 없음. v13의 `admin_audit_logs`와 topik-ai `audit_logs` 매핑 필요.

---

## 5. 권한·역할 모델 (현재 v13 구현 기준)

현재 v13에 실제로 구현된 역할(`src/lib/auth/admin-guard.ts`, `roles.ts`):

| 역할 | 범위 | 접근 가능 영역(도출) |
| --- | --- | --- |
| `platform_admin` | 전체 | 모든 영역 |
| `content_admin` | 콘텐츠 | 문제은행, (읽기) 피드백 품질 |
| `org_admin` | 조직 | 조직 대시보드(동결, 범위 밖) |

> topik-ai 쪽에는 별도 RBAC(System > 권한 관리: `system_roles`/`system_permissions`/`admin_accounts`)가 있습니다. 최종 권한 모델은 정합 단계에서 두 모델을 매핑해야 하며, B2C 사용자에는 노출되지 않습니다.

---

## 6. "쓰기 가능" vs "읽기·지원 전용" 원칙 (가장 중요한 안전선)

관리자 화면을 만들 때 가장 위험한 실수는 **사용자 소유 데이터를 admin이 직접 편집(CRUD)하게 만드는 것**입니다. 인벤토리에서 도출한 분류:

| 분류 | 대상 | 이유 |
| --- | --- | --- |
| ✅ **직접 관리(CRUD) 적정** | `problems`/`problem_assets`(카탈로그), `subscription_plans`(요금제 카탈로그) | 운영자가 만들고 관리하는 "공급 측" 데이터 |
| 🟡 **상태/역할만 변경** | `profiles`(status/app_role) | 운영상 필요하지만 본문은 사용자 소유 |
| 🔒 **읽기·지원 전용** | `writing_submissions`(불변), `writing_feedback`/`sentence_feedback`, `writing_drafts`, `library_items`, `comparison_reports`, `export_files`, `subscriptions`/`payment_history`(서비스가 씀), `notification_settings`(사용자 소유) | 사용자 소유·서비스 생성·불변 데이터. 직접 편집은 신뢰·무결성 훼손 |
| 📊 **분석/집계 전용** | `study_events`, `problem_attempts`, `recommendation_*`, `get_dashboard_kpi` | 원본 변경 금지, 집계 뷰로만 |

원칙:
1. **사용자 소유 데이터는 기본 읽기.** CS 필요가 명확할 때만 읽기 경로를 추가하고 개인정보 경계를 먼저 정의.
2. **제출물(`writing_submissions`)은 불변** — admin도 수정 불가.
3. **서비스가 쓰는 데이터(구독/결제/피드백/추천)는 admin이 직접 쓰지 않음.**
4. **admin용 스키마를 새로 추가해 사용자 화면을 끼워 맞추지 않음** — 스키마 정합 이슈는 소유자에게 에스컬레이션.

---

## 7. topik-ai 기존 admin과의 매핑·갭 요약

| v13 데이터 | topik-ai 화면 | 적합도 | 핵심 갭 |
| --- | --- | --- | --- |
| `problems`/`problem_assets` | Assessment > 쓰기 문제은행 | 직접 | 필드/테이블 이름 매핑(JSON fixture↔`problems`), 에셋 관리 추가 여부 |
| `profiles` | Users > 회원 목록/상세 | 직접 | `profiles`↔`users` 이름, 이메일 출처, 필드 매핑 |
| `subscription_plans`/`subscriptions`/`payment_history` | Commerce > 결제/환불/이커머스 | 부분 | 환불 테이블 부재, 요금제↔상품/패키지 모델 차이 |
| `notification_settings`/`notification_log` | Message > 메일/푸시/그룹/이력 | 부분 | 사용자 설정 vs 캠페인 타겟팅 분리, 세그먼트 DB 부재 |
| `writing_submissions`/feedback류 | Users 상세/Analytics | 부분/없음 | 직접 CRUD 화면 없음, 읽기·진단 경로 설계 필요 |
| `study_events`/attempts/추천 | Analytics | 부분 | 집계 뷰/이벤트 탐색기 필요 |
| `library_items`/`comparison_reports`/`export_files` | 없음 | 없음 | CS 필요 시 읽기 경로만 |
| `admin_audit_logs` | System > 감사 로그 | 부분/내부 | 최종 감사 SoT는 topik-ai |

> topik-ai에는 v13에 대응 테이블이 아직 없는 계획 화면도 많습니다(Community, Operation 공지/FAQ/이벤트/정책/챗봇, Commerce 쿠폰/포인트, Content 콘텐츠/배지/단어장/미션, Assessment EPS/레벨테스트, 추천인). 이들은 **해당 사용자 화면이 생기기 전까지 v13의 "관리 갭"으로 취급하지 않습니다.**

---

## 8. 우선순위 로드맵 (어디부터?)

인벤토리의 권장 슬라이스 순서와 동일:

| 순서 | 슬라이스 | 이유 |
| --- | --- | --- |
| 1 | **문제은행**: `problems`/`problem_assets` ↔ Assessment 쓰기 문제은행 | 사용자에게 가장 직접 보이는 콘텐츠, 이미 97문항 JSON fixture 존재 |
| 2 | **회원/계정**: `profiles` ↔ Users 회원 목록/상세 | 핵심 계정 관리, 소유권·RLS 매핑 신중히 |
| 3 | **결제/구독**: `subscription_plans`/`subscriptions`/`payment_history` ↔ Commerce | 매출·지원 중요, 모델이 1:1 아님 |
| 4 | **알림**: `notification_settings`/`notification_log` ↔ Message | 개념은 가깝지만 캠페인↔개인설정 분리 |
| 5 | **학습 산출물**: 제출물·피드백·라이브러리·내보내기·이벤트 | 대부분 읽기·지원, 개인정보·불변 규칙 먼저 설계 |
| 6 | topik-ai 계획 화면(대응 테이블 없음) | 해당 사용자 화면/제품 범위 확정 후로 연기 |

각 슬라이스는 "필드 단위 매핑 → 상태/enum 용어집 → CRUD 검증 체크리스트" 순으로 구체화합니다(method 문서 참고).

---

## 9. 반드시 지킬 원칙 / 주의사항

1. **이 문서로 v13에 admin을 만들지 않는다.** admin은 topik-ai 소유, 정합은 사용자 화면 완료 후 단계.
2. **스키마는 admin-first.** 사용자 화면을 스키마에 맞춘다. admin용 스키마 신규 추가 금지(소유자 승인 시 예외).
3. **사용자 소유 데이터는 기본 읽기·지원.** 제출물 불변, 서비스 작성 데이터 직접 편집 금지.
4. **상태/enum 용어 일치가 최대 리스크 표면** — `publish_status`, profile `status`(active/blocked), 피드백 상태 등은 양쪽 값을 합의해야 함.
5. **개인정보 경계 우선.** 제출물·초안·피드백 열람은 최소 권한·읽기 경로·접근 로그를 먼저 정의.
6. **이 문서는 실증(live DB CRUD) 전 단계.** 실제 정합은 슬라이스별 검증으로 확정.

---

## 10. Docs consulted

- `docs/user-admin-data-consistency.md` — 사용자↔admin 데이터 인벤토리 (이 문서의 1차 근거)
- `docs/admin-scope-boundary.md` — admin 범위 경계 (권위 지침)
- `docs/user-admin-consistency-method.md` — 정합 방법론 / SoT 앵커링
- `src/app/(workspace)/admin/*` , `src/lib/auth/admin-guard.ts`, `src/components/admin/*`, `src/lib/admin/*` — 동결된 v13 admin 코드 (참고)
- `src/app/**/page.tsx` — 현재 사용자 화면 라우트
- (간접) `topik-ai/docs/specs/admin-data-contract.md`, `topik-ai/docs/page-sync/*.md` — 화면 이름·용어 앵커 (인벤토리를 통해 반영)

> **다음 단계:** 1순위 슬라이스(문제은행)의 필드 단위 매핑 + 상태/enum 용어집부터. 단, 실제 정합 작업 착수는 사용자 화면 완료 이후이며 소유자 판단에 따른다.
