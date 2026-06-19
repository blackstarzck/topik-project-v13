# 핸드오프 — 박람회 QR 기관 회원 · v13 Phase 2 (가입 배선)

> 작성 2026-06-19. 이 문서는 **v13(talkpik-ai, 사용자 앱)** 에서 진행할 작업 핸드오프입니다.
> 관리자 앱(topik-ai) 쪽 작업은 이미 완료되었고(미커밋), v13가 가입 시 회원에 "유입 코드"를
> 기록해주면 전체 흐름이 연결됩니다.

---

## 0. TL;DR

박람회에서 **QR로 들어온 사용자를 "기관 회원"으로 받고 추적**한다.
v13가 해야 할 일은 단 하나의 개념: **가입할 때 QR이 운반한 "유입 코드"를 `profiles.affiliation_code`에 기록**하는 것.
- 이메일 가입: 가입 메타데이터로 넘기면 트리거가 자동 기록 (마이그레이션에 이미 구현됨).
- 구글 OAuth 가입: 메타데이터를 못 실으므로 **가입 직후 `claim_affiliation_code()` RPC로 보정** (⚠️ 핵심 함정).

콘텐츠 접근 권한은 **건드리지 않는다**(현재 전부 열려 있음). `affiliation_code`가 비어있지 않으면 = 기관 회원, 그게 전부다.

---

## 1. 배경 / 확정된 결정

- **모델 ①**: 박람회/캠페인 1건 = 코드 1행. 기관 내 역할 계층(담당자/학생 등)·권한 차등은 **도입하지 않는다**.
- **두 레포 분담**
  - `topik-ai`(admin): "코드의 의미"(라벨/종류/상태) 소유 — 코드 카탈로그 테이블 + 관리자 화면. **완료**.
  - `v13`(이 레포): 가입이 일어나는 곳 — 회원에 **코드 문자열만** 기록. **이번 작업**.
  - v13는 코드를 **opaque 문자열**로 저장만 한다(카탈로그를 조회·검증하지 않는다 → 레포 경계 유지). 미등록 코드는 admin이 reconcile.
- **콘텐츠 권한**: v13는 결제 미연결 + 콘텐츠 게이팅 없음 → "기관 회원에게 전부 준다"는 추가 코드 불필요. 나중에 유료벽이 생기면 그때 "기관 회원은 통과" 규칙 1줄만 추가.
- **진행 순서(오너 지시)**: 관리자 화면을 모두 끝낸 뒤 v13 착수 → **지금이 그 시점**.

---

## 2. 이미 완료된 것 (topik-ai admin, 미커밋)

참고용. v13 작업에 직접 필요하진 않지만 계약 이해에 도움.

- `institution_codes` 카탈로그 테이블 + admin RPC 3종(목록/생성/수정) + 관리자 화면(`/users/institution-codes`).
- `get_admin_users` RPC 확장 → `affiliation_code` + `affiliation_label`(`profiles.affiliation_code ⋈ institution_codes.label`) 반환.
- 회원 목록에 "기관 소속" 컬럼, 회원 상세에 "기관 소속" 탭.
- **즉 admin은 `profiles.affiliation_code`를 읽기만 한다. v13가 이 값을 채워줘야 데이터가 흐른다.**

---

## 3. v13에서 할 일 (Phase 2)

### 3.1 DB 마이그레이션 적용 — **이미 작성됨, 아직 미적용**

파일: `supabase/migrations/20260619140000_profiles_affiliation_code.sql` (+ `down/` 동일명)

내용:
- `profiles.affiliation_code text` 컬럼 추가(nullable, check `^[A-Za-z0-9_-]{2,64}$`).
- `handle_new_user()` **가산 재정의** — 기존 display_name·nationality 보존 + `affiliation_code`를 `raw_user_meta_data->>'affiliation_code'`에서 복사(이메일 가입 자동 기록).
- `claim_affiliation_code(p_code text)` RPC 신설 — 호출자 본인 `profiles.affiliation_code`가 비어있을 때만 1회 기록(idempotent, SECURITY DEFINER, authenticated).

**적용**: dev DB에 적용한다.
> ⚠️ **적용 순서**: topik-ai의 `get_admin_users` 확장과 `institution_codes.member_count`가 이 컬럼을 참조한다. **v13 컬럼을 먼저 적용**해야 admin 쪽이 동작한다.

### 3.2 QR → 가입 화면으로 "유입 코드" 전달

- QR URL 형식(파라미터명 최종 확정 필요): 예) `https://<app>/sign-up?aff=EXPO2026-BOOTH-A`
- 진입 시 코드를 캡처해서 **클라이언트에 보관**(localStorage 권장). **OAuth 왕복·이메일 인증 왕복·새로고침에도 살아남아야** 한다.
- 코드 형식 검증: `^[A-Za-z0-9_-]{2,64}$` (어긋나면 무시).
- (권장) 작은 헬퍼 추가: 진입 시 `set`, 가입/claim 성공 후 `clear`. 키 예: `talkpik:affiliation-code`. 만료(예: 24h) 고려.

### 3.3 이메일 가입 경로

파일: `src/components/auth/SignUpForm.tsx` → `handleSignUp()`

현재:
```ts
await supabase.auth.signUp({
  email, password,
  options: {
    data: { display_name, nationality_country_code },
    emailRedirectTo: buildAuthRedirectUrl('/auth/callback?next=/onboarding/learning-goal')
  }
});
```
할 일: `options.data`에 **`affiliation_code: <보관된 코드>`** 추가(있을 때만). → `raw_user_meta_data`로 들어가 `handle_new_user` 트리거가 `profiles`에 기록(display_name/nationality와 완전히 동일한 경로 = 안전·검증됨).

### 3.4 구글 OAuth 가입 경로 — ⚠️ **핵심 함정**

파일: `src/lib/auth/oauth.ts` → `startGoogleOAuth()` → `supabase.auth.signInWithOAuth(...)`

`signInWithOAuth`는 **`options.data`를 못 싣는다**(구글이 신원 제공). 그냥 두면 **구글로 가입한 박람회 손님은 유입 코드가 통째로 누락**된다.

해결:
1. QR 진입 시 코드를 클라이언트에 보관(3.2).
2. OAuth 왕복 **완료 후**(세션 수립 시점) 보관된 코드로 RPC 호출:
   ```ts
   await supabase.rpc('claim_affiliation_code', { p_code: storedCode });
   // 성공 후 보관 코드 clear
   ```
3. `claim_affiliation_code`는 본인 행이 비어있을 때만 1회 기록하므로, 중복 호출/이미-기록 케이스에 안전.

**호출 위치 찾기**: OAuth 콜백 경로는 `oauth.ts`의 `buildClientAuthCallbackUrl(buildPostAuthPath(intent))` = `/auth/callback?next=/auth/post-auth?intent=sign-up`. → `/auth/callback` 처리 후 `/auth/post-auth` 또는 온보딩 진입 시점에 세션이 있으므로 그곳에서 claim 호출. (이메일 가입도 동일 콜백을 타지만 이메일은 메타데이터로 이미 기록되어 claim은 no-op.)

---

## 4. 계약 (topik-ai와 합의된 값 — 반드시 일치시킬 것)

| 항목 | 값 |
|---|---|
| 컬럼 | `public.profiles.affiliation_code text` (nullable), check `^[A-Za-z0-9_-]{2,64}$` |
| 가입 메타데이터 키 | `affiliation_code` (이메일 가입 `options.data`) |
| 보정 RPC | `public.claim_affiliation_code(p_code text) returns text` — authenticated, 본인 행만, 비어있을 때만 |
| 코드 의미 | topik-ai `institution_codes`가 소유. v13는 **검증/조회하지 않음**, 문자열만 저장 |
| "기관 회원" 정의 | `affiliation_code`가 비어있지 않음 (별도 플래그 없음) |

---

## 5. 함정 / 주의사항

- **구글 OAuth 누락**(3.4) — 가장 흔한 사고. 반드시 claim 경로 구현.
- 이메일 인증 메일 클릭 후 복귀·새로고침에도 보관 코드 유지.
- `protect_profile_columns` 트리거(`supabase/migrations/20260520121400_profiles_protected_columns.sql`)는 `app_role/plan_label/status`만 막는다 → `affiliation_code`는 본인이 쓸 수 있음(claim RPC·트리거 모두 OK).
- v13 harness 체크 실행: `pnpm typecheck`, `pnpm lint`, 그리고 `check:admin-boundary` 등. `affiliation_code`는 **사용자-facing 가입 데이터**라 admin-boundary 위반이 아님(가입 경로 소유는 v13).
- 프리뷰: v13 dev 서버는 strictPort/포트 불일치·Supabase 모드 등 friction이 있을 수 있음.
- 한글 파일 편집 후 mojibake 검사(Codex 사용 시 특히).

---

## 6. 적용 / 검증 순서

1. **v13 마이그레이션 적용**(dev DB) — `20260619140000_profiles_affiliation_code.sql`.
2. **이메일 가입 배선** → 테스트 가입(`?aff=EXPO2026-BOOTH-A`) → `select affiliation_code from profiles where id=...` 기록 확인.
3. **구글 가입 배선** → 테스트 가입 → claim 후 `affiliation_code` 기록 확인.
4. **topik-ai 마이그레이션 적용**(`institution_codes`, `get_admin_users` 확장) → 관리자 회원 목록 "기관 소속" 컬럼 / 회원 상세 "기관 소속" 탭에 **실데이터** 노출 확인.
5. **커밋**(양 레포). ⚠️ 아래 공유 파일은 외과적 스테이징.

---

## 7. 커밋 시 주의 — 동시 세션 공유 파일

topik-ai 쪽에서 다음 파일들이 **소셜 로그인 동시 세션의 미커밋 변경과 공유**될 수 있음(이 기능 외 변경이 섞임). 커밋 시 **이 기능의 hunk만 외과적으로 스테이징**:
`src/features/users/model/types.ts`, `.../api/mock-users.ts`, `.../api/supabase-users-service.ts`, `.../pages/user-detail-page.tsx`, `.../pages/users-page.tsx`.
(기법: `.codex-artifacts/stage_mine.py` 클린 체크아웃 방식 — git diff 훅 필터로 patch 생성 후 적용.)

---

## 8. 미정 / 후속 결정

- **QR 파라미터명** 최종 확정(`aff` vs `src` vs `code`) — 본 문서는 `aff` 가정.
- **콘텐츠 권한 차등**: 후속(유료벽 생기는 시점). 지금은 전부 열림.
- 박람회 손님이 소속되는 "기관" 정의는 **모델 ①(박람회 자체를 코드 1건으로)** 로 확정.
- QR 코드 발급/인쇄/디자인은 운영 영역.

---

## 9. 참고 — topik-ai(admin) 쪽 관련 파일

- 마이그레이션: `supabase/migrations-admin/20260619140000_institution_codes.sql`, `.../20260619150000_admin_users_affiliation.sql` (+ 각 `down/`)
- 화면: `src/features/users/pages/institution-codes-page.tsx`(코드 관리), `.../users-page.tsx`(목록 컬럼), `.../pages/user-detail-page.tsx`(상세 탭)
- 서비스/모델: `src/features/users/api/{institution-codes-service,supabase-institution-codes-service,...}.ts`, `model/institution-codes-types.ts`
- 권한키: `users.institution-codes.manage` (`src/features/system/model/permission-types.ts`)
