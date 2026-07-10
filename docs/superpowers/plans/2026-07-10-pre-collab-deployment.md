# collab 배포 전 필수 작업 실행 계획 (Pre-collab Deployment)

> **For agentic workers:** 이 계획은 `- [ ]` 체크박스 단위로 task-by-task 실행한다. 코드/마이그레이션 변경과 Git 반영은 검증·secret 점검 후 진행하며, `collab` 브랜치는 사용자의 명시적 `collab 배포` 요청 전까지 어떤 경우에도 건드리지 않는다. secret(서비스 롤 키, 테스트 계정 비밀번호 등)은 터미널/로그/문서/커밋에 값으로 남기지 않고 **변수명만** 언급한다.

- worktree: `.claude/worktrees/eloquent-wright-16ca2b`
- branch: `claude/pre-collab-deployment-e717f5`
- 작성일: 2026-07-10

**목표:** 감사 보고서가 지목한 collab 배포 전 필수 작업 5개(consent E2E, profile 전화번호 E2E, Supabase anon 권한 회수, 개인정보 고지 정합, fresh build)와 별도 정리 5항목을 처리해 배포 준비 상태를 만든다. 단, **task4 active SOT 직접 갱신**과 **task3 원격 anon apply**는 사용자 결정/운영 절차 소관이므로 이 계획으로는 미종결로 표기한다.

**전략:** forward-only 마이그레이션, SOT 직접 미수정(제안 경로 유지), 최소 변경. 검증은 워크트리 prod build + 미사용 포트 + `E2E_BASE_URL`로 stale 3000 서버를 회피한다.

**기술 스택:** Next.js App Router, React, Supabase(Postgres/RLS/Auth), Vitest, Playwright, Ant Design.

---

## 사용자 결정 사항 (2026-07-10)

| 항목 | 결정 | 영향 |
| --- | --- | --- |
| task4 active SOT | 제안서까지만, **SOT 직접 갱신 보류** | fallback i18n 코드만 v13에서 수정. SOT 반영은 미종결(사람 결정 대기). 기존 제안서 2건이 이미 대상을 명시하므로 **중복 제안서 생성 금지** |
| task3 원격 anon 회수 | **운영 apply 전까지 미해소로 표기** | 마이그레이션 저작 + dev 검증까지만 v13. 원격 apply는 운영 handoff. 하드 블로커 아님 |
| 별도 정리 5항목 | **전부 포함** | Phase 7로 편입(항목별 거버넌스 주의 적용) |

---

## 에이전트 검토 요약 (multi-lens critic)

1차 초안을 4개 렌즈(E2E / Supabase·보안 / SOT·규칙 / 계획구조)로 병렬 검토하고, 치명 결함 후보 12건을 적대적으로 재검증(총 17개 에이전트)한 결과, 초안의 핵심 전제 일부가 **사실과 반대**로 확인되었다. 아래 정정을 반영한 것이 이 계획이다.

### 뒤집힌 전제 (반드시 반영)

| # | 초안 주장 | 실제(검증됨) | 근거 |
| --- | --- | --- | --- |
| 1 | task3 6-arg `complete_auth_gate(text,text,text,boolean,text,text)`는 로컬에 없는 "고아" | auto-locale 마이그레이션이 만든 **superseded overload**(drop 누락). anon 원인은 4-arg와 같은 **명시적 anon grant 드리프트** | `20260625113000_auto_locale_detection.sql:81,130-131`; `20260709165000:125-126`(phantom만 drop) |
| 2 | forward migration은 6-arg에 `drop if exists` + `revoke from anon` 둘 다, "전부 idempotent" | **결정적 실패.** Postgres `REVOKE ON FUNCTION`엔 `IF EXISTS` 없음 → drop 성공 뒤 revoke가 `42883` | [PostgreSQL REVOKE](https://www.postgresql.org/docs/current/sql-revoke.html) |
| 3 | Phase1은 `selectGender` 클릭만 고치면 됨 | test1은 radio를 `toBeVisible`로 **단언만**(`:333-334`) → 클릭 수정과 무관하게 실패 잔존. flows는 **3뷰포트** | `consent-completion.spec.ts:333-334,391`; `playwright.config.ts:73-102` |
| 4 | (초안에 없던 발견) | `build-preflight`가 `supabase/.temp`/`SUPABASE_ACCESS_TOKEN` 존재 시 `exit 3`으로 build 하드 차단(`--force` 불가). **Phase3 dev 검증이 Phase5를 막을 수 있음** | `scripts/build-preflight.mjs:55-83,174-181` |
| 5 | task4 fallback "코드 확인 후 별도 판단" | fallback은 SOT가 아니라 **i18n 소스**(`messages/{ko,en,vi}.json:2713`)라 v13에서 수정 가능. phone/gender 수집을 누락 고지 중 | `messages/ko.json:2713`; `20260709153000` |
| 6 | task2 phone 테스트 "뷰포트 병렬 경합" 위험 | 병렬 실행 없음(`fullyParallel:false, workers:1`). 진짜 위험은 **공유 계정 오염** + 임시 유저가 workspace 게이트에 튕겨 `/profile` 진입 불가 | `playwright.config.ts:47-48`; `(workspace)/layout.tsx:34-39` |

---

## 변경 대상 파일

**Modify**
- `tests/e2e/flows/consent-completion.spec.ts` (selectGender 로케이터, test1 가시성 단언)
- `tests/e2e/screens/profile-editing.spec.ts` 또는 신규 spec (전화번호 저장/삭제)
- `messages/ko.json`, `messages/en.json`, `messages/vi.json` (`summaryCollect` fallback)
- `supabase/migrations/INDEX.md` (113000 6-arg backfill + 신규 마이그레이션 기록)
- (필요 시, test-only 최소) `src/components/shared/GenderRadioGroup.tsx` (Radio.Button `data-testid`)

**Create**
- `supabase/migrations/<UTC타임스탬프>_revoke_anon_superseded_auth_gate.sql` (task3 forward-only)
- `docs/sot-change-proposals/2026-07-10-country-code-iso-validation.md` (ZZ 검증 강화 implementation brief)
- (선택) `docs/qa/reports/pre-collab-deployment/` 증거(스크린샷/로그)

**절대 수정 금지**
- active SOT: `docs/Wireframe/data-usage-index.md`, `docs/Wireframe/36-X-14-privacy-policy/`, 개인정보 처리 SOT 문서 (사용자 결정으로 보류)
- 기존 마이그레이션 파일(forward-only 원칙)
- `scripts/build-preflight.mjs` (git-tracked 게이트)
- `collab` 관련 어떤 것도

---

## Phase 0 — 준비 및 런타임 게이트 프리플라이트

- [ ] `pwd` / `git branch --show-current` / `git status --short --branch`로 worktree·branch 일치 확인
- [ ] `.env.local` 존재 확인(현재 부재, `.env.example`만 있음). E2E 러너에 필요한 변수 프로비저닝 (값 미출력, 변수명만 보고):
  - consent spec: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ENV_LABEL`(비-prod)
  - profile spec(setup 의존): 추가로 `E2E_STUDENT_EMAIL`, `SUPABASE_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [ ] `supabase/.temp` 부재 + `SUPABASE_ACCESS_TOKEN` 미설정 확인(Phase5 기준선)
- [ ] stale 3000 회피 전략 확정: 워크트리 `pnpm build` → 미사용 포트로 prod 서버 → `E2E_BASE_URL` 지정
- [ ] 각 task DoD를 "에이전트 완결 / 사람 게이트" 2갈래로 확정

**DoD:** 위치·branch 일치, env 준비(boolean만 확인), supabase 경계 clean, task DoD 문서화.

```powershell
# 값은 절대 출력하지 않는다. 존재 여부(boolean)만 확인.
Test-Path .env.local
Test-Path supabase/.temp
```

## Phase 1 — consent E2E 재현·원인분류·수정 (task 1)

- [ ] **수정 전 재현.** 실 env로 `legal_documents`의 현재 published 필수 문서를 조회해 stale `E2E Terms/Privacy`(version `e2e-auth-gate-*`) 존재 여부 확인. 존재 시 정리를 **blocking 선행**으로 승격(`getCurrentRequiredDocuments`가 throw하면 4개 test가 setup에서 전부 죽음 — `consent-completion.spec.ts:101-135,164`)
- [ ] 재현 실행으로 test·뷰포트별 실제 Playwright 에러/trace/screenshot 확보. 매핑: test1(`:306`, `toBeVisible :333-334`, selectGender 미사용) / test2(`:366`, selectGender `:391` + phone `:392` + DB assert `:275-290`) / test3·4(`:420`/`:461`, gender·phone UI 없음)
- [ ] `selectGender`(`:234-236`)를 라벨 래퍼 텍스트 필터 클릭으로 교체 — Radio.Button 2개(`GenderRadioGroup.tsx:58-74`)라 strict-mode 회피에 텍스트 필터 필수:
  - `page.locator('.ant-radio-button-wrapper').filter({ hasText: label }).click()`
- [ ] test1 `:333-334` 가시성 단언은 **실제 실패 시** 동일 전략(래퍼 `toBeVisible`) 또는 radio는 `toBeAttached()`/`toBeChecked()`로 교체(0×0 native input은 `toBeVisible` 실패)
- [ ] phone 컬럼 미적용이면 migration `20260709153000` 적용 확인(`skipIfOptionalProfileColumnsMissing`는 gender만 검사 — `:150-156`)
- [ ] (선택) antd 내부 클래스 의존이 과하면 GenderRadioGroup Radio.Button에 `data-testid` 부여(SignUpForm 등 다른 Radio 사용처·전화 모달 회귀 확인 후)

**DoD:** 4개 test가 mobile-360/tablet-768/desktop-1280 각각 pass(근거 없는 skip 없음), `expectAuthGateSaved`로 gender=female·phone_country_code=KR·phone_number 저장 확인, trace/screenshot 첨부. "4→pass"는 실제 실행 로그로 선언.

```powershell
# 실 env + prod build + E2E_BASE_URL 전제. skipped==0 확인 필수.
pnpm exec playwright test consent-completion
```

## Phase 2 — /profile 전화번호 저장/삭제 E2E 추가 (task 2)

- [ ] 임시 유저 시드(service role): `profiles.display_name` + `nationality_country_code=KR`(pending-auth-completion 해소) + 현재 필수 `legal_documents`에 `user_consents` row 삽입(pending-consent 해소). `getCurrentRequiredDocuments`/consent 기록 패턴 재사용. learning-goal은 workspace 게이트 대상 아님(불필요)
- [ ] 공유 `STUDENT_STATE` 오염 방지: 신규 test는 별도 spec 또는 스코프된 `test.use({ storageState: { cookies: [], origins: [] } })` + in-test 로그인으로 오버라이드(기존 X-05 `profile-editing.spec.ts:22` 회귀 방지)
- [ ] `/profile` 진입 → `#phoneNumber`(`profile-editing.spec.ts:46-48`) 입력 + `phone-country-code-select` → 저장 → DB 재조회 + 재접속 확인 → 빈 값 저장(삭제) → `phone_number` null 확인
- [ ] 유저 생성 직후부터 `try/finally`로 `deleteUser` 보장. `skipIfRequiredDocumentsMissing`/`skipIfOptionalProfileColumnsMissing` 가드 포함. 3뷰포트×`retries:1` 반복 실행 대비 각 실행 자기완결

**DoD:** 3뷰포트에서 저장/삭제 pass, DB에서 저장·null 확인, 임시 유저 누수 0, 기존 X-05 회귀 없음.

```powershell
pnpm exec playwright test profile-editing
```

## Phase 3 — anon EXECUTE 회수 forward migration + dev 검증 (task 3)

- [ ] **전제 정정 반영.** 6-arg `complete_auth_gate(text,text,text,boolean,text,text)`는 고아가 아니라 `20260625113000:81` 생성·`:131` authenticated grant된 superseded overload. 원격 anon 원인은 명시적 anon grant 드리프트(`20260625001257:9-11`이 4-arg에만 적용)
- [ ] 작성 전 dev linked에서 `\df public.complete_auth_gate`로 현존 오버로드 **실측**(추정 열거 금지)
- [ ] forward migration 작성 — **객체별 분리, 한 시그니처에 drop+revoke 동시 금지**:
  - `drop function if exists public.complete_auth_gate(text, text, text, boolean, text, text);` (DROP만; 앱은 named-param으로 7/9-arg만 호출 — `src/app/auth/consent/actions.ts:214-238` — 6-arg 미사용. DROP 시 anon grant도 함께 제거)
  - `revoke execute on function public.list_user_library_problem_items() from anon;` (실사용 함수, DROP 금지, 권한 미보유 revoke는 무해 no-op → idempotent)
- [ ] `INDEX.md` 갱신: 113000이 6-arg를 authenticated grant로 도입한 사실 backfill + 신규 마이그레이션이 superseded 6-arg를 drop해 anon 드리프트 창을 닫음 기록("고아/PUBLIC 기본권한" 서술 금지)
- [ ] dev 검증 한계 명시: dev clean replay엔 anon grant가 애초 없어 no-op일 수 있음 → "무결/idempotency만 확인, 실제 원격 anon 제거는 운영 apply에서만 관측"으로 보고. 운영자용 검증 쿼리(`has_function_privilege('anon', ...)`, `pg_proc`) handoff
- [ ] **teardown:** `SUPABASE_ACCESS_TOKEN` unset + `supabase/.temp` 제거(대상은 **dev 프로젝트만**, collab/prod 절대 미대상)

**DoD:** forward-only·idempotent 파일 + INDEX 갱신, dev 재적용 무결, post-apply 검증 쿼리로 anon EXECUTE 부재 확인(dev), teardown 완료, 운영 handoff 문서 포함. **원격 apply는 미완료로 명시.**

## Phase 4 — 개인정보 fallback 소스 수정 (task 4, 코드분만)

- [ ] `messages/ko.json`·`en.json`·`vi.json`의 `summaryCollect`(`:2713`)에 전화번호(선택)·성별(선택) 수집 고지 추가. `functional-spec:33` "구현된 범위만 진술" 준수, 보관기간/제3자 등 미확정 정책 단정 금지
- [ ] 근거 확인: `20260709153000`이 phone/gender 실제 수집. `src/app/privacy/page.tsx:36-59`가 published 비-placeholder 문서 부재 시 이 fallback을 렌더(`src/lib/legal/documents.ts:99-128`)
- [ ] **SOT 직접 갱신은 하지 않음(사용자 보류 결정).** 기존 제안서 2건이 이미 갱신 대상을 명시하므로 중복 제안서 생성 금지. "active SOT 반영"은 미종결로 표기

**DoD:** ko/en/vi fallback이 phone/gender 수집을 고지(코드 반영), SOT 직접 갱신은 사람 결정 대기로 명시.

```powershell
# 문구 assert 회귀 확인 (관련 privacy 스냅샷/e2e)
pnpm exec playwright test privacy
```

## Phase 5 — fresh production build (task 5)

- [ ] build 직전 사전 probe: 3000/3001/3002/3003/3100 dev server 미실행(`build-preflight` exit 2 회피), `supabase/.temp` 부재 + `SUPABASE_ACCESS_TOKEN` 미설정(exit 3, `--force` 불가)
- [ ] `pnpm typecheck` → `pnpm lint`를 build 이전에 실행(test 파일 타입오류는 `next build`가 못 잡으므로 typecheck 별도 필수)
- [ ] `pnpm build` 실행, 성공 로그 확인. 실패 시 `.next` 삭제 후 재빌드(`build-preflight.mjs:32-36`)

**DoD:** typecheck/lint pass, prebuild 게이트 통과, `pnpm build` 성공 로그. **의존:** Phase 1·2·3(teardown)·4 완료 후.

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

## Phase 6 — 통합 검증 및 배포 준비 보고

- [ ] 영향 vitest/영향 e2e 재확인, Phase1-5 결과 집계
- [ ] 최종 SOT 체크 4필드: `읽은 SOT / 확인한 요구사항 / 충돌 여부 / 갱신 필요 문서`
- [ ] 2단계 보고: (a) 에이전트 완결 (b) 사람 게이트 미종결(task4 SOT, task3 원격 apply, ZZ 브리프) 분리 명시
- [ ] `collab` 미배포 확인, secret 미노출 확인

## Phase 7 — 별도 정리 5항목 (전부 포함)

- [ ] **stale E2E 법적문서 2개** — Phase1 선행에서 탐지 + 잔여 정리. 비-prod 테스트 데이터 한정, `SUPABASE_ENV_LABEL=prod`면 fail-closed 중단
- [ ] **임시 유저 8개** — E2E 임시 유저 패턴 매칭분만 service role로 삭제. 비-prod 한정, 삭제 전 대상 목록 확인, 임의 유저 삭제 금지
- [ ] **ZZ 국가코드 검증 강화** — net-new data rule → 먼저 `docs/sot-change-proposals/2026-07-10-country-code-iso-validation.md`에 implementation brief 작성 → **승인 후** DB CHECK/앱 검증 구현(승인 전 구현 금지)
- [ ] **독립 브랜치 5개** — `claude/c01-rule-recommendations`, `claude/pdf-quota-verify`, `codex/account-delete-spacing`, `codex/auto-locale-detection`, `codex/institution-invitation-ux`의 ahead/behind·commit 분석 → 채택/폐기 **권고안** 제시. 실제 merge/삭제는 건별 확인 후, `collab` 미대상
- [ ] **EOF 빈 줄 경고** — 이번 작업이 건드리는 파일 안에서만 정리(전역 일괄은 별도)

**DoD:** 각 항목 처리 결과 또는 권고안/브리프 산출, 원격 데이터 정리는 비-prod 확인 로그 포함.

---

## 배포 준비 완료 정의 (2단계)

- **에이전트 완결(이 계획으로 종료):** task1 consent E2E, task2 profile E2E, task3 마이그레이션 저작+dev 검증, task4 fallback 코드, task5 build, Phase7 정리(권고·브리프·테스트데이터).
- **미종결(collab 완전 준비까지 남음):**
  1. task4 **active SOT 직접 갱신** — 사용자 보류 결정
  2. task3 **원격 anon apply** — 운영 이관
  3. ZZ 검증 강화 — 브리프 승인 대기

> 이 계획을 다 끝내도 위 1·2·3은 남는다. collab 배포 결정 시 이 목록을 근거로 함께 판단한다.

## Risk Controls / 비협상 경계

- `collab` merge/push/PR target/force-push 금지. 명시적 `collab 배포` 요청 + 재확인 전까지 fail-closed.
- active SOT 직접 수정 금지(사용자 보류). SOT 변경은 제안 경로만.
- 기존 마이그레이션 수정 금지(forward-only). 한 함수 시그니처에 `drop`+`revoke` 동시 사용 금지.
- 원격 Supabase schema/data **apply** 금지(v13 범위 밖). dev 검증은 임시 트랜잭션(롤백), 대상은 dev 프로젝트로 명시.
- `build-preflight.mjs` 수정 금지. Phase3 teardown으로 `supabase/.temp`·토큰 정리 후 build.
- secret 값 출력/로그/커밋 금지, 변수명만 보고.
- admin 기능 신규/확장 금지(user-facing app 경계).
- 원격 데이터 정리(임시 유저/문서)는 비-prod 확인 후에만, prod면 중단.

## 참고 (웹 팩트체크)

- Postgres `REVOKE ... ON FUNCTION`은 `IF EXISTS` 미지원(`DROP FUNCTION`만 지원). → task3 "6-arg는 DROP만" 근거. [REVOKE](https://www.postgresql.org/docs/current/sql-revoke.html) · [DROP FUNCTION](https://www.postgresql.org/docs/current/sql-dropfunction.html)
- Playwright `toBeVisible()`는 zero-size(width/height 0)를 not-visible로 판정하나 `opacity:0`은 visible로 봄. → AntD Radio.Button input 실패 원인은 0×0 크기. [Actionability](https://playwright.dev/docs/actionability)
