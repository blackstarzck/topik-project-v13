# B0 실행계획 + 결정 패킷 — 기존 데이터 노출·분류 백필 판정 (2026-06-09)

> **페이즈**: B0 (Track B, owner 결정) · **상위 계획**: [`docs/superpowers/plans/2026-06-09-writing-questionbank-remediation.md`](../../../../superpowers/plans/2026-06-09-writing-questionbank-remediation.md)
>
> **사이클 위치**: ① 실행계획 작성(이 문서) → ② GPT-5.5 리뷰(차단) → ③ **owner 승인** → ④ 실행(필요 시 백필 마이그레이션) → ⑤ 검증 → ⑥ 완료 보고
>
> **이 문서 상태**: 실행계획 + 근거 + 권고까지. **데이터/스키마 변경 없음**(분석·문서만). 실행은 owner 승인 후.

## 0. 목표

쓰기 문제(51–54)의 **현재 노출 상태가 의도된 것인지 판정**하고, 향후 노출 규칙을 명문화한다. 곁가지로
`topic_category_code` NULL 다수의 처분 방침을 B1로 넘긴다. 핵심 질문: **"어떤 문제가, 왜 사용자에게
보이는가?"**

## 1. 근거 (실측, dev 시드 기준)

대상: `supabase/migrations/20260608120200_seed_writing_problem_fixtures.sql` (쓰기 문제 시드, `domain='writing'`).
파서로 466개 row 교차 집계.

| 지표 | 값 |
|---|---|
| 총 row | **466** (51→90, 52→76, 53→62, 54→238) |
| publish_status × visibility | **published/public 217** · **draft/private 249** (그 외 조합 0) |
| review_status | **approved 217** · **pending 249** |
| 상관 | publish/visibility/review_status가 **완벽히 1:1** (approved↔published/public, pending↔draft/private) |
| topic_category_code | **466개 전부 NULL** (시드가 설정 안 함) |
| lifecycle_status | 전부 미설정 → DB 기본값 `active` |

**시드 설계 주석(파일 헤더)**: *"review-passed fixtures are published/public/approved; the rest remain
draft/private/pending."* → 비공개 249개는 **사고가 아니라 "검수 미통과(pending) 상태로 의도적으로 staging"**.

**현재 사용자 노출(RLS `problems_visible_select` + 화면 필터)**: published AND (public OR 소유자) AND
`lifecycle_status='active'` → **217개가 정상 노출**, 249개는 정상적으로 숨김.

## 2. 발견 (분석)

1. **숨김은 의도적·정합적이다.** 노출 3축(publish/visibility) + review_status가 완벽 상관 → "실수로 숨김/공개"
   사례 0. 상위 계획 B0가 우려한 *우발적 비공개*는 이 시드에 **존재하지 않는다**.
2. **그러나 "approved ≠ 자동 노출"이 핵심 함정(G7/F1).** 검수 완료(`review_status=approved`)는
   publish_status/visibility를 **자동으로 바꾸지 않는다**(별개 축). 시드는 두 축을 일치시켜 넣었지만,
   **향후 admin이 검수만 통과시키고 publish/public을 안 켜면 그 문제는 계속 숨겨진다.** → C1(노출 표면)에서
   규칙을 운영화해야 함.
3. **topic_category_code 466 전부 NULL** → 노출과 무관(화면이 요구하지 않음, 저작 메타). 값 백필은 B1 소관.
4. **lifecycle 기본 active** → 만료/비활성 시드 없음. B2 매핑과 충돌 없음.

## 3. owner 결정 사항 (승인 요청)

| # | 질문 | 권고 | 영향 |
|---|---|---|---|
| **D1** | 현재 노출 상태(217 공개 / 249 pending 숨김)를 **그대로 유지**? (249개를 일괄 공개하지 **않음**) | **YES** — 의도된 staging. 일괄 공개 시 미검수 문제가 사용자에 노출되는 사고 | 노출 백필 마이그레이션 **불필요** |
| **D2** | 노출 규칙을 **기술 게이트**와 **프로세스 전제**로 분리해 정식 문서로 고정? — ⓐ **기술 게이트(DB/화면이 실제로 거름)**: `publish_status='published'` + `visibility='public'`(RLS) + `lifecycle_status='active'`(화면). ⓑ **프로세스 전제(관례, RLS/화면이 강제하지 않음)**: `review_status='approved'`(검수 통과해야 공개) | **YES** | C1 UI/문구의 기준. **R1 반영: approved는 기술 게이트 아님** |
| **D3** | "검수 완료(approved)" 시 publish+public을 **자동 전환**할지, **명시적 admin 액션**으로 둘지 | **명시적 액션(C1)** — 자동 공개는 사고 위험. 자동화는 후속 옵션 | C1 설계 분기 |
| **D4** | `topic_category_code` 466 NULL 처분(NULL 유지 vs 'uncategorized' 백필)을 **B1로 위임**? | **YES(B1 위임)** — 노출과 무관. **단 B1은 CHECK 추가 *전에* NULL 백필 또는 NULL 허용을 반드시 결정**(R4) | B1 선행 입력·시퀀싱 |
| **D5** | `lifecycle_status` 전부 active 유지 확인 | **YES** | B2 무영향 |
| **D6** | (R2 신규) approved인데 publish/public/active가 아닌 문제가 **누적 안 되게**, `approved AND NOT(published & public & active)` **관리자 리포트/필터**를 둘지 | **YES** — C1 또는 후속 운영 점검에 포함 | 숨김 고착 방지 |

## 4. 실행 결과물 (승인 후)

- **D1=YES**일 경우(권고): **노출 백필 마이그레이션 없음.** 대신 §3의 규칙을 정합 문서에 명문화
  (`docs/writing-questionbank-reconciliation.md` 또는 노출 규칙 절). **스키마 변경 없음 → 스키마 문서 게이트 미발동.**
- 만약 owner가 일부 row의 공개/비공개를 바꾸기로 하면 → **additive·idempotent 백필 마이그레이션** 작성
  (publish_status/visibility만, review_status는 검수 결과 보존), 적대검수 + 스키마 문서 게이트 + 타입 영향 없음.

## 5. 수용 기준 (Acceptance)

- "어떤 문제가 왜 보이는가"가 문서로 단정됨(노출 규칙 D2).
- 의도치 않은 공개/비공개 0 확인(현 상태 217/249가 review_status와 1:1임을 근거로).
- D3/D4 방향이 각각 C1/B1의 선행 입력으로 기록됨.
- (백필 발생 시) 마이그레이션이 additive·idempotent·prod 영향 없음 + 적대검수 PASS.

## 6. 검증 계획

- 결정만(백필 없음): 문서 정합성 리뷰. v13 코드/스키마 무변경 → E2E 불요(단, 노출 규칙 문서 변경은 코드 무관).
- 백필 발생 시: 마이그레이션 후 `pnpm test:e2e` + 노출 수 재집계(공개 row 수 변화 확인) + 스키마 문서 4종 갱신.
- **DB 실측 재확인(수용 기준, R3 반영)**: 이 분석은 dev **시드** 기준. live DB엔 시드 외 admin-created row가 있을 수 있고 기본값이 `draft/private/pending`이라 자동 숨김. DB 접속 가능 시(Docker 필요) 아래 쿼리로 1회 재확인 후 B0 종결:
  - `select publish_status, visibility, review_status, count(*) from problems where domain='writing' group by 1,2,3;` (시드와 동일한 1:1 상관인지)
  - `select count(*) from problems where domain='writing' and review_status='approved' and not (publish_status='published' and visibility='public' and lifecycle_status='active');` (= D6 누수 건수, 0 기대)
  - `select count(*) from problems where domain='writing' and topic_category_code is null;` (B1 백필 규모)
  - `select lifecycle_status, count(*) from problems where domain='writing' group by 1;` (inactive/expired 존재 여부)
- **`list_user_problems_writing_state` 누수 확인(R5)**: 이 RPC는 `publish_status='published'`만 직접 필터(visibility는 RLS 보완). `lifecycle_status` inactive/expired가 목록에 섞이는지 별도 확인(섞이면 RPC 필터 보강 escalate).

## 7. 롤백

- 결정만: 문서 되돌림.
- 백필 마이그레이션: 역마이그레이션(원 publish_status/visibility 복원) — 변경 전 값 스냅샷 보관.

## 8. 리스크

- **대량 공개 사고**: 249개 일괄 공개는 미검수 노출. D1로 차단.
- **숨김 고착**: D3에서 자동전환을 택하지 않으면, 향후 검수 통과분이 publish/public 미설정으로 숨겨질 수 있음 → C1에서 "검수 완료 후 공개" 동선·경고로 완화.
- **시드 vs live 괴리**: §6 재확인으로 완화.

## 9. Docs consulted

- `docs/superpowers/plans/2026-06-09-writing-questionbank-remediation.md` (B0 정의)
- `docs/writing-questionbank-reconciliation.md` (G7/F1 노출 3축, §8 Codex)
- `supabase/migrations/20260608120200_seed_writing_problem_fixtures.sql` (시드·설계 주석)
- `supabase/migrations/20260520121100_rls_policies.sql` (RLS 노출 조건)
- `src/lib/writing/server.ts` (화면 필터)

## 10. GPT-5.5 리뷰 결과

**판정: PASS-WITH-FIXES** (기록: [`B0-gpt55-review.md`](B0-gpt55-review.md)). 증거 독립 재확인됨(삼중 조합 반례 0).
반영: R1(D2 기술게이트/프로세스전제 분리) · R2(D6 reconciliation 리포트 신설) · R3(§6 live 검증 쿼리 수용기준화) ·
R4(D4 B1 시퀀싱 명시) · R5(§6 list_user_problems lifecycle 누수 확인). → **게이트 통과, owner 승인 단계로 진행.**
