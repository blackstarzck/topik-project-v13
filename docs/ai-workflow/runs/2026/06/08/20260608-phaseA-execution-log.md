# Phase A 실행 로그 — Admin(topik-ai) 통합

> 핸드오프 `20260608-handoff-admin-integration.md` §8 절차의 실행 기록. 핸드오프가 동시 에이전트에
> 의해 편집 중이라 충돌 회피로 **별도 파일**에 기록. 확인 근거 = `20260608-ch3-facts-confirmation.md`.
> **작성** 2026-06-08.

## Step 2 — 3장 미확정 사실 확인 ✅
`20260608-ch3-facts-confirmation.md` 참조(9에이전트 + 코드값 적대검증, 적발 1건: 난이도 '4'는 데이터 아님).
회원/결제/역할 값 소스 확정 · 문제 domain/review/operation은 한글 라벨뿐(ASCII net-new) · withdraw 의미 미정.

## Step 3 — 2장 게이트 owner 승인 (AskUserQuestion, 2026-06-08)
1. overlap 게이트 **OPEN** → Phase A부터 착수. 보류 도메인 계속 동결.
2. D-A 구현 = **권한키 레이어 신설, shared-entity 키만**(v13 4역할 유지·RPC/RLS 강제).
3. dev Supabase 연결 = **읽기 먼저**(쓰기는 감사 RPC 단계적). **withdraw 쓰기 계속 BLOCKED**.

경계 해제 기록 = `docs/admin-scope-boundary.md` 상단 "OVERLAP INTEGRATION GATE — OPEN" 절.
(CLAUDE/AGENTS는 그 문서를 detail SoT로 가리키므로 충분. **AGENTS.md는 동시 미커밋 변경 +141/-60 있어 미편집.**)

## Phase A (인증) foundation — topik-ai, 컴파일·빌드 통과, 런타임 미검증

**설계 원칙**: additive + **플래그 게이트** + 가역적. `VITE_SUPABASE_URL`+`VITE_SUPABASE_ANON_KEY` 있으면
Supabase 인증 ON, 없으면 기존 mock 동작 그대로(zero-flash). frozen 앱 안 깨짐.

**신규 파일**
- `src/shared/api/supabase-client.ts` — anon 전용 싱글톤(service_role 금지), `isSupabaseConfigured` 플래그.
- `src/features/auth/model/session-types.ts` — `V13AppRole`/`AuthStatus`/`AdminSession`.
- `src/features/auth/model/app-role-mapping.ts` — v13 app_role → RoleKey + permission set (D-A, PROPOSED).
- `src/features/auth/model/auth-store.ts` — Zustand 세션(initialize/signIn/signOut), profiles 읽어 역할 해석.
- `src/features/auth/model/use-current-actor.ts` — actor seam(세션 id 또는 fallback). Phase B 채택용.
- `src/features/auth/ui/auth-gate.tsx` — 플래그 게이트(미설정=passthrough, 설정+미인증=login).
- `src/features/auth/pages/login-page.tsx` — AntD 이메일/비번 로그인.
- `.env.example` — 두 키 문서화(값은 v13 .env.local에서 복사).

**수정(additive)**
- `src/features/system/model/permission-store.ts` — `setSessionAdmin` 추가(세션 admin 주입 → currentAdminId).
- `src/app/app.tsx` — `<AuthGate>`로 AppRouter 래핑.
- `.gitignore` — `.env.local`/`.env.*.local` 추가(라이브 키 보호).

**역할 매핑(D-A, PROPOSED)**: platform_admin→SUPER_ADMIN · content_admin→CONTENT_MANAGER ·
org_admin→READ_ONLY(보수적, owner 확정 대기) · learner→접근불가. 세션 actor를 permission-store에 주입해
admin-shell 메뉴 게이팅이 실제 역할 반영(**admin-shell 무수정**).

**검증**
- 내 파일 **타입오류 0** (`tsc --noEmit -p tsconfig.app.json`). repo 전체 기존오류 103건은 전부 미관여
  파일(lib 타깃 ES2020에서 `.at`/`.replaceAll`, antd 타입 등) — repo의 `tsc --noEmit`는 solution config라 평소 no-op.
- **vite 프로덕션 빌드 exit 0** (10.72s) → 컴파일·번들 OK.

**런타임 검증 — 완료 (읽기-먼저 범위), 2026-06-08**
실 dev Supabase(`*.supabase.co`, auth/health 200 reachable) 대상, 앱의 auth-store와 동일 경로를 headless(node
+ @supabase/supabase-js)로 실행해 확인:
- ✅ SIGN-IN OK — anon 클라이언트 `signInWithPassword(p***@audit.local, SUPABASE_TEST_PASSWORD)` → 세션·토큰 발급.
- ✅ PROFILE READ OK — 세션으로 `profiles.select(app_role,...).eq(id).single()` (RLS 자기-읽기 통과) → `app_role=platform_admin`.
- ✅ ROLE MAP OK — platform_admin → `SUPER_ADMIN` (app-role-mapping).
- ✅ RPC OK — 세션으로 `get_admin_user_stats`·`get_admin_users` 호출 가능(platform_admin RLS 통과).
- ✅ APP-CONFIG OK — `topik-ai/.env.local`(v13 dev URL/anon 주입, **gitignore 확인**)의 VITE_ 키로도 로그인 성공
  → 실제 앱이 이 계정을 인증함.
- 계정 비번 위치: v13 `.env.local`의 `SUPABASE_TEST_PASSWORD`(owner 제공). 로그인 계정 = platform_admin 시드 `p***@audit.local`.
- 주의: 이 시드 계정은 `display_name`/`nickname`이 비어 있어 표시명이 email/id로 fallback(실유저는 값 있음, 버그 아님).

**미수행(=Phase B 범위, 의도적)**: audited **쓰기** RPC로 `admin_audit_logs`에 실 actor 기록(쓰기 경로는 Phase B).
브라우저로 렌더된 로그인 화면 클릭-스루는 미실시(로직은 위에서 실DB로 검증됨 — login-page는 검증된 signIn 위의
얇은 AntD 폼이며 타입체크·빌드 통과). 원하면 `npm run dev` + 브라우저 스모크 추가 가능. [[feedback-ui-completion-requires-dev-server]]

**Phase B로 미룬 것**: 하드코딩 actor(`admin_current`/`admin_park`) 전면 교체 = 쓰기 경로 → Phase B.
이번엔 `use-current-actor.ts` seam만 마련(읽기-먼저 범위). `getCurrentActor()`/`useCurrentActor()`로 점진 채택.

## git 위생 (topik-ai)
내 변경분만: 위 신규 7파일 + `.env.example`, 수정 `.gitignore`·`package.json`(+supabase-js 한 줄)·
`package-lock.json`·`app.tsx`·`permission-store.ts`. **미커밋.**
`dev*.log 삭제`·`docs/page-sync/`·`docs/README.md`·`logs/admin-doc-update-log.md`는 **동시/기존 작업 = 내 것 아님**,
손대지 않음. 커밋 시 내 파일만 명시(`git add -A` 금지). [[feedback-concurrent-agent-worktree]]

## 커밋 (topik-ai, main)
- Phase A: `73fa63b` feat(auth): flag-gated Supabase auth (13파일).
- Phase B read slice: `c5f5fcc` feat(users): read members directory via get_admin_users (2파일).
- 동시 작업물(dev*.log·docs/README·logs·page-sync·templates)은 미스테이지·미커밋(보존).

---

## Phase B (회원/profiles) — 읽기 슬라이스 완료, 검증됨 (2026-06-08)

**범위(읽기 먼저)**: 회원 목록을 v13 실 RPC로 읽기. 쓰기 헬퍼는 마련(페이지 버튼 배선은 다음 슬라이스).

**v13 RPC 계약(확인)**: `get_admin_users(search,sort,page,page_size)` → user_id·email(auth.users 조인)·
display_name·app_role·plan_label·status·submission_count·last_activity·**last_sign_in_at**·created_at·total_count
(platform_admin, SECURITY DEFINER). `admin_set_user_status(uuid,text)` → **active/blocked만**(서버가 deleted 거부=
withdraw 자동 차단, D-F 정합)·감사로그 기록. **`admin_change_user_role`는 미존재** + topik-ai에 역할변경 UI도 없음 → 무관.

**구현(신규 `src/features/users/api/supabase-users-service.ts` + 수정 `users-service.ts`)**:
- 매핑: id←user_id · realName←display_name · email←email · joinedAt←created_at · lastLoginAt←last_sign_in_at ·
  status(active→정상/blocked→정지/deleted→탈퇴) · tier←plan_label(free/basic→일반·그외→프리미엄, PROPOSED).
  **갭(PROPOSED)**: nickname(RPC 미반환→display_name/email local-part fallback) · subscriptionStatus(구독조인 없음→
  tier 휴리스틱, 실구독 아님). 둘 다 정확히 하려면 v13 RPC additive 필요(게이트 §2-2).
- `loadUsers`: env 있으면 RPC, 없으면 mock(페이지 무수정 seam). `setUserStatusSafe`(suspend/unsuspend) 마련, withdraw 하드차단.
- 페이지네이션: dev(7명)는 page_size=100 1페이지로 충분. prod(>100)는 서버 페이지네이션 후속.

**검증**: 내 파일 타입오류 0(총 103=기존). 헤드리스 — 세션으로 get_admin_users 7행 반환 → 전부 유효 UserSummary
매핑(shape 실패 0, status/tier/날짜/이메일 정상). **브라우저 스모크** — 로그인 → `/users`가 실제 7명(@audit.local)
렌더(mock 420·member@topik.ai 아님), 컬럼 정상, 콘솔에러 0. VERDICT PASS.

### Phase B 쓰기 슬라이스 — 완료·검증·커밋 `acfc760` (2026-06-08)
- 페이지 쓰기 배선: users-page + user-detail-page의 `handleConfirmAction` → `setUserStatusSafe`(suspend→정지/
  unsuspend→정상), 실패 시 에러 알림·성공 시에만 반영. withdraw 버튼 **비활성**(configured) + 핸들러에서도 차단(D-F).
- 상세 page async 전환: `getMockUserById`(동기) → `fetchUserByIdSafe`(연결 시 get_admin_users 재사용, UUID id 해석).
  Spin/empty/error 상태 추가. (이전엔 UUID를 mock id로 못 찾아 상세가 깨졌음 → 해결.)
- 검증: 타입오류 0(총 103 불변)·vite build exit0. **헤드리스 쓰기** — platform_admin 세션으로 테스트 learner
  active→blocked, `admin_audit_logs`에 **실 actor**(action=profile.status_change, diff from/to) 기록, `deleted`는
  서버 거부("invalid new_status"), active 원복. **브라우저 스모크** — 상세 실데이터 로드·계정정지↔정지해제 영속+화면반영·
  탈퇴 비활성·dev 원복·콘솔0. R7 수용기준(하드코딩actor0·직접쓰기0·RPC/RLS강제·withdraw차단) 충족.

**Phase B 다음(선택)**: 갭 정밀화(nickname/subscription) 필요 시 v13 RPC additive 제안(게이트 §2-2 별도 승인) ·
프로덕션 >100명 서버 페이지네이션 · KPI 밴드에 get_admin_user_stats 연결.

## Phase D (결제) — 읽기 전용 인벤토리, 완료·검증·커밋 `e2f64b3` (2026-06-08)
- **읽기 메커니즘**: v13 `payment_history`/`subscriptions`는 RLS에서 platform_admin **직접 SELECT 허용** →
  **read RPC/스키마 변경 0**(세션이 바로 조회). subscription_plans 3행 seed 외 dev 결제데이터 0.
- 신규 `src/features/billing/api/supabase-billing-service.ts`(payment_history→PaymentRow/RefundRow 매핑)+
  `billing-service.ts`(fetchPaymentsSafe/fetchRefundsSafe, isSupabaseConfigured 분기). 수정 commerce-store.ts
  (PaymentMethod에 `'미확인'` additive)·billing-payments-page·billing-refunds-page(AsyncState+에러Alert, 환불 승인/거절 **비활성**+읽기전용 안내).
- **매핑(PROPOSED·정직, 날조 금지)**: status paid→완료·refunded→환불·failed/pending→취소(lossy, topik-ai 3값 vs v13 4값) ·
  method=`'미확인'`(v13 컬럼 없음) · product=구독 플랜명 또는 `(미연동)` · amount=amount_cents/100 ·
  환불=status='refunded' 결제를 합성(상태 승인; v13엔 환불 엔티티/처리대기·거절 없음).
- 검증: 타입오류 0(총 103)·vite build exit0. 임시 시드 2건(paid/refunded)→헤드리스 세션 SELECT+매핑(₩9,900 완료/₩26,700 환불)→
  브라우저 스모크(/commerce/payments 2건 실데이터·method 미확인 / /commerce/refunds 1건 읽기전용·승인거절 비활성·콘솔0)→**시드 삭제(dev 청결)**.
- **owner-decision 잔존(ch3 §4)**: '취소'(failed/pending) 매핑·환불 엔티티 신설 여부·method/product 컬럼·구독 5상태. 정밀화 시 v13 additive(게이트 §2-2).

## Phase C (문제은행) — 스키마 승인 + 마이그레이션 작성·검수, READY_TO_APPLY (2026-06-08)
- **게이트 §2-2 스키마 승인 받음**(owner). v13 additive 마이그레이션 작성:
  `supabase/migrations/20260608120300_problems_topic_category_review_workflow.sql` —
  `problems.topic_category_code`(D-B, domain과 별개·NULLABLE·check없음) + `problems.review_workflow_status`
  (D-C, review_status와 별개·진행단계·NULLABLE·check없음) 추가 + `admin_update_problem` allowlist·분기 확장(13키).
  코드/enum ASCII 철자는 owner 비준 전이라 **check 제약 미부여**(PROPOSED, 코멘트에 후보값). additive·idempotent·prod-safe.
- **적대 검수 PASS 7/7 → READY_TO_APPLY**(Claude 리뷰어): 기존 11분기 verbatim 보존+2분기 정확추가·allowlist 13키 정합·
  컬럼 선행·미비준 enum lock 없음·$$ 정상·의도 정합.
- **APPLY: owner가 적용함(2026-06-08) — 검증 PASS**: dev problems에 topic_category_code·review_workflow_status
  EXISTS 확인 + content_admin 세션이 확장 `admin_update_problem`으로 두 컬럼 기록(실 actor 감사 diff)→원복. (lifecycle/legal #31/#32는
  여전히 미적용 — 이번엔 120300만 적용.) v13 마이그레이션 파일은 working tree 미커밋(기존 conformance와 동일, 팀이 별도 커밋).

### Phase C 읽기 슬라이스 — 완료·검증·커밋 `ccc05ed` (topik-ai)
- **읽기 메커니즘**: content_admin이 `problems`(question_no 51-54) **직접 SELECT**(RLS 허용, RPC 불필요).
- 신규 `src/features/assessment/api/supabase-assessment-question-bank-service.ts`(problems→AssessmentQuestion 매퍼)+
  분기 `assessment-question-bank-service.loadQuestions`. types에 센티넬 4개 추가(domain 미분류·difficulty 미상·validation 미검증·source 미상, additive·날조방지).
- **정직 매핑**: questionTypeLabel=문항번호로 결정(51빈칸/52연결/53자료/54의견, TOPIK 고정)·difficulty 1-2하/3중/4-5상/null미상·
  reviewStatus(pending검수대기/approved검수완료/rejected수정필요, workflow set시 우선)·operationStatus 미지정(lifecycle 미적용)·content kind별 빈 stub.
- 검증: 타입오류 0(103)·build0·헤드리스 470문항 매핑(번호 51:91/52:77/53:63/54:239·검수완료221/대기249·상353/중26/미상90/하1)·
  브라우저 /assessment/question-bank 실문항 렌더(54번·실프롬프트·미분류·콘솔0).

### Phase C 쓰기 슬라이스 — 완료·검증·커밋 `db3d7b1` (topik-ai, 2026-06-08)
- **구현(내 파일 2개)**: `supabase-assessment-question-bank-service.ts` — `setReviewStatusViaRpc`(검수 액션→
  `admin_update_problem` patch) + `REVIEW_STATUS_WRITE_MAP`(D-C: 검수 완료→review_status `approved`/workflow `done`,
  수정 필요→`rejected`/`revision_requested`, **보류→workflow `on_hold`만**(review_status 보존), 대기/중도 매핑) +
  `loadAssessmentQuestionFromSupabase`(쓰기 후 단일행 재조회, 라이브 반영). `assessment-question-bank-service.ts` —
  `updateReviewStatus`(configured→RPC+재조회)·`updateReviewMemo`(v13 메모 컬럼 없음→로컬 오버레이, **DB 쓰기 없음**·
  explanation 오염 금지·pre-action 메모저장이 실 UUID에서 안 깨지게)·`updateOperationStatus`(lifecycle 미적용→connected면 비활성) 분기.
- **불변식 준수**: 쓰기는 RPC만(직접 테이블 쓰기 0)·unknown 키 서버 무시·anon 클라만(서비스롤 코드 없음)·mock 경로 불변(frozen 앱 안 깨짐)·매핑 PROPOSED(R2). `reason`/memo는 v13 sink 없어 미영속(날조 금지).
- **검증(실 dev Supabase)**: ① 헤드리스(content_admin 로그인)—수정 필요/보류/검수 완료 쓰기 반영 + `admin_audit_logs`에
  **실 content_admin actor**(`admin_user_id` 일치)+diff·**보류는 review_status 보존**·unknown 키 무에러·원복 정확.
  ② 브라우저 스모크(localhost:5174)—로그인→검수 화면→메모→보류→ConfirmAction 모달→**상태 배지 검수 완료→보류**·
  DB on_hold+review_status 보존·콘솔에러 0·원복. ③ tsc 신규오류 0(총 103 불변)·vite build exit0.
  ④ **적대 교차검수 워크플로우**(Claude 4관점: 패턴/매핑/안전/정확성 → 지적별 실코드 대조 검증) **확정 결함 0**.
- 검증 임시 스크립트 2개 삭제·dev 서버(5174) 종료·동시 작업자(5173) 미접촉. v13 마이그레이션/문서는 팀 별도 커밋(이 환경 변경 없음).
- **잔여(정밀화, owner 비준 후)**: publish_status 쓰기(allowlist엔 있으나 UI 없음)·difficulty 쓰기(상→5, 매핑 준비됨·UI 미배선)·
  topic_category_code 코드세트·operationStatus↔lifecycle_status(#31/#32 적용 후)·메모 영속용 additive 컬럼 여부.

## 정밀화 1차 — owner 승인 항목 2·3·4 (2026-06-08)
owner가 AskUserQuestion으로 **항목 2(주제 코드)·3(운영상태 마이그레이션)·4(메모→감사로그)** 승인. 1(발행/난이도)·5(탈퇴)·6(보류도메인)은 권고대로 보류/차단/동결.

### 항목 2 — topic_category_code → 주제 라벨 (D-B 읽기) ✅ 완료·검증·커밋 `bd8c3fd` (topik-ai)
- v13 변경 불필요(컬럼·allowlist 기존). topik-ai `supabase-assessment-question-bank-service.ts`에 `TOPIC_CATEGORY_LABEL`(life→생활…technology→기술·uncategorized→미분류) + `mapDomain` 추가, `domain` 상수 '미분류'→`mapDomain(row.topic_category_code)`. null/unknown→'미분류'(정직 폴백).
- 검증: content_admin이 admin_update_problem로 topic_category_code='economy' 기록(쓰기 능력 증명) → 뱅크 페이지 `?domain=경제` 필터에서 "현재 결과 1문항"·'경제' 라벨·대상 UUID 표시·콘솔0 → null 원복. tsc 0 신규·build0. 주제 배정 UI는 없음(읽기 표시 전용; 쓰기는 RPC 차원에서 이미 가능).

### 항목 4 — 검수 메모/사유 → 감사 로그 payload (v13 마이그레이션 작성·검수 READY_TO_APPLY, **적용 대기**)
- v13 신규 `supabase/migrations/20260608120400_admin_update_problem_audit_note.sql`: `admin_update_problem`을 create-or-replace해 **예약 patch 키 `__note`**(컬럼 아님·allowlist에 없어 무시됨)를 `admin_audit_logs.payload={"review_note":...}`로 저장. **시그니처(uuid,jsonb) 불변** → 기존 호출 영향 0. 노트는 실제 diff와 함께만 기록(빈 diff면 early-return 유지).
- 검수: 함수 본문을 120300(적용본)과 **기계 diff** → 13키 allowlist·타입 분기·content_admin 가드·diff 전부 **verbatim 동일**, 차이는 의도된 v_note/v_payload 선언·payload 빌드·코멘트뿐. additive·idempotent.
- **owner 적용 필요**(이 환경 CLI 없음): 대시보드 SQL Editor에 20260608120400 실행. 적용 후 = topik-ai `setReviewStatusViaRpc`에 `reason`→`__note` 배선 + 헤드리스(payload.review_note 확인)·브라우저 검증 → 커밋.

### 항목 3 — 운영상태 ↔ lifecycle_status (선결+의미결정 필요, **owner 결정 대기**)
- `20260608120100_problems_lifecycle_expiry.sql`(#32) 읽음: `lifecycle_status` = **active/inactive/expired**(가용성 상태) + lifecycle_reason + expires_at. **미적용**(owner 적용 필요).
- **의미 갭(escalate, 날조 금지)**: v13 lifecycle=가용성 *상태*(active/inactive/expired) ↔ topik-ai operationStatus=큐레이션 *후보*(미지정/노출 후보/숨김 후보/운영 제외)로 축이 다름. 특히 v13 `expired`(만료)는 topik-ai에 대응 라벨 없음, "후보(candidate)" 의미도 v13에 없음. 마이그레이션 코멘트도 "align enum THEN(LATER)"로 미룸.
- → **owner 매핑 비준 필요**(읽기 표시 라벨 + 쓰기 매핑). 비준 전 operationStatus 쓰기는 계속 비활성(현 상태 유지). 후보: (A) active↔노출/inactive↔숨김·제외/expired→additive '만료' 센티넬, (B) operationStatus를 lifecycle 표시 전용으로 두고 쓰기 보류.

## 다음(전체)
1. ✅ **Phase C 쓰기 슬라이스 완료**(`db3d7b1`) — overlap(회원/문제/결제) 통합 핵심 잔여 종료.
2. (선택) org_admin 매핑 owner 확정(현재 READ_ONLY) · 결제 갭 정밀화 · 회원 nickname/subscription RPC additive · >100명 서버 페이지네이션.
3. withdraw 의미(D-F)는 계속 **BLOCKED** — owner 확정 전 쓰기 금지.

## topik-ai main 커밋 (2026-06-08)
`73fa63b` Phase A 인증 · `c5f5fcc` Phase B 회원 읽기 · `acfc760` Phase B 회원 쓰기 · `e2f64b3` Phase D 결제 읽기전용 ·
`ccc05ed` Phase C 문제 읽기 · `db3d7b1` **Phase C 문제 쓰기(검수)**.
동시 작업물(dev*.log·docs/README·logs·page-sync·templates·users 페이지/서비스·docs/specs·e2e)은 전 커밋에서 제외·보존.
