# 쓰기 문제 ↔ question-bank 정합 — 보완 계획 및 실행안 (3-Track / Phased)

> **상태**: 계획 산출물(planning artifact only). **이 문서 자체에는 코드/스키마/마이그레이션 변경이 없다.**
> 실제 변경은 각 페이즈에서 `실행계획 → GPT-5.5 리뷰(게이트) → (필요시 owner 승인) → 실행 → 보고`
> 사이클을 거친 뒤에만 일어난다.
>
> **작성일**: 2026-06-09 · **범위 결정(owner)**: 전체 3-Track 상세(C안) + 이 계획안 자체도 GPT-5.5 메타리뷰 후 확정.
>
> **근거 문서**
> - 정합 분석 + 결정: 삭제된 historical reconciliation artifact의 durable conclusion은 이 계획의 체크리스트와 관련 active docs에 흡수한다.
> - 통합 설계서: 삭제된 admin integration planning artifact의 durable conclusion은 migration 설명과 AGENTS의 관리자 범위 경계에 보존한다.
> - 경계: AGENTS의 관리자 범위 경계
> - anchor: `topik-ai/docs/specs/admin-data-contract.md`
>
> **메타리뷰 상태**: ✅ GPT-5.5 메타리뷰 완료 — **SOUND-WITH-FIXES**, TOP5 지적 전부 반영(§8). owner 확정 대기.

---

## 0. 보정대상(Remediation Targets)

정합 분석의 12개 갭 + Codex 교차검증 보정 4건(F1–F4)을 "어디서 고치나(Track)"로 묶는다.

| Target | 출처 갭 | 한 줄 | Track | 비고/Codex보정 |
|---|---|---|---|---|
| T-A1 | G12 | 생성 타입 `types.ts` STALE(3건 누락) 재생성 | **A (v13)** | — |
| T-A2 | G2·G9·G11 | 정식 데이터 형태 확정(rubric OBJECT·#54 materials·validation) + normalizer 견고화 | **A (v13)** | **F3**(서버 무검증 → 읽기측 방어) |
| T-A3 | G8 | 글자수 타입상수 ↔ 프롬프트 내장 범위 일치 QA | **A (v13)** | — |
| T-B1 | G6 | `topic_category_code` ASCII 코드셋 + 건강/행정 라벨 매핑 확정 | **B (owner→v13)** | 승인 후 CHECK 마이그레이션 |
| T-B2 | G5 | `lifecycle_status`↔`operationStatus` 값매핑 + `expires_at` 기준 확정 | **B (owner)** | — |
| T-B3 | G10 | 52번 권위 정답셋 보유 여부(채점 정책) 확정 | **B (owner)** | — |
| T-C1 | G7 | 노출 관리 표면(publish_status + visibility) | **C (topik-ai)** | **F1**(visibility 기본 private·3축 게이트) |
| T-C2 | G4 | 검수 메모/사유 영속(`__note`) | **C (topik-ai)** | **F2**(memo-only 유실 → 단서/조건부 escalate) |
| T-C3 | G1·G3 | 타입별 콘텐츠 저작/편집 표면(materials/answer_key/rubric, #54 조건 포함) | **C (topik-ai)** | **F3**(저작기 클라이언트 shape 검증 필수) |
| T-B0 | 신규(메타리뷰) | 기존 데이터 노출·분류 백필 판정(시드 217공개/249비공개) | **B (owner→v13)** | **F1**(visibility 기본 private) |
| T-B4 | 신규(메타리뷰) | `review_workflow_status` enum 확정 + CHECK | **B (owner→v13)** | PROPOSED→CHECK |
| T-C0 | 신규(메타리뷰) | Track C 검증용 실 데이터 준비(타입별 known-good row) | **A/C (v13 dev)** | — |

**Track 정의**
- **Track A (v13 저장소, 지금 실행 가능)**: user 화면을 스키마에 맞추는 정리. owner 승인 불필요(단 GPT-5.5 게이트는 거침).
- **Track B (owner 결정)**: 사람이 정해야 하는 enum/정책. v13은 결정 패킷 작성 + 승인 후 (해당 시) 마이그레이션.
- **Track C (topik-ai 저장소, owner 승인 게이트)**: admin 콘텐츠/노출/메모 표면. **구현은 topik-ai에서**, 각 페이즈마다 owner 승인. `AGENTS.md의 관리자 범위 경계` 준수.

---

## 1. 페이즈 공통 거버넌스 사이클 (모든 페이즈 동일)

각 페이즈는 아래 6단계를 **순서대로** 밟는다. GPT-5.5 리뷰는 **차단 게이트(blocking)** 다 — PASS 전엔 실행 금지.

```
(1) 실행계획 작성  →  (2) GPT-5.5 리뷰 게이트  →  (3) owner 승인(B·C만)
        →  (4) 실행  →  (5) 검증  →  (6) 완료 보고문서
```

1. **실행계획 작성** — `<phase>-plan.md`. 필수 항목:
   목표 · 변경 대상(저장소/파일) · 선행조건 · 수용기준(acceptance) · 테스트 계획 ·
   **갱신할 문서(스키마 변경 시 §스키마 게이트)** · 롤백 · 리스크 · Docs consulted.
2. **GPT-5.5 리뷰 게이트** — `<phase>-gpt55-review.md`.
   - 입력은 **영문 ASCII 패킷**(한글 mojibake 회피, [[reference-codex-config-service-tier-windows]]).
   - 임시 `CODEX_HOME` + `-m gpt-5.5 -s read-only`로 실행, 양쪽 저장소 실소스 대조.
   - 출력: 페이즈 계획의 사실오류·누락 단계·의존성 오류·게이트 구멍·경계 리스크.
   - **PASS 기준**: REFUTE 0 + 미해결 P0/P1 지적 0. 지적은 계획에 반영 후 재검 또는 명시적 수용.
   - **리뷰 깊이 우측 조정(메타리뷰 반영)**: 모든 페이즈를 리뷰하되, **차단(blocking)** 은 스키마/RPC/RLS 변경·사용자 노출 행동 변화·교차 저장소 계약·C3 쓰기 경로에 적용. A1 같은 순수 기계적(타입 재생성) 페이즈는 **경량(lightweight) 리뷰**로 낮춘다.
3. **owner 승인(Track B·C 전용)** — 결정 패킷/구현 계획을 owner가 승인해야 (4)로 진행. Track A는 생략.
4. **실행** — 해당 저장소에서. v13=이 저장소, topik-ai=별도 저장소. 한 페이즈=한 관심사(섞임 금지, [[feedback-concurrent-agent-worktree]]).
5. **검증** — v13 코드 변경: **`pnpm test:e2e`** 통과(E2E Verification Gate). 스키마 변경: **스키마 문서 게이트**(아래).
   topik-ai 변경: 해당 저장소 typecheck/test/build + 실화면 확인. UI 변경은 dev 부팅 후 실제 렌더 확인([[feedback-ui-completion-requires-dev-server]]).
6. **완료 보고문서** — `<phase>-report.md`(§7 템플릿). 변경 요약·증거(스샷/로그)·테스트 결과·잔여 리스크·다음.

**게이트 종류**
- **교차/적대 리뷰 게이트**: 모든 페이즈(P0 포함). 기본 = GPT-5.5(cross-family). **2026-06-09 codex 토큰 만료 → 임시로 "새 맥락 Claude 적대검수 에이전트"로 대체**(같은 계열이라 독립성 낮음 — codex 복구 시 GPT-5.5로 재검수 권장). owner 승인으로 전환.
- **owner 승인 게이트**: Track B(결정), Track C(구현 페이즈마다).
- **스키마 문서 게이트**(신규 CLAUDE.md): DB 구조(table/column/enum/constraint/index/RPC/RLS/storage/migration) 변경 시 보고 전 갱신:
  `supabase/migrations/INDEX.md` · `docs/Wireframe/data-usage-index.md` · `supabase/migrations/INDEX.md` ·
  `docs/Wireframe/data-usage-index.md`(특히 `database-structure-by-page.md`). → **적용 대상(메타리뷰 반영)**: B0(백필 마이그레이션)·B1(topic_category_code CHECK)·B2(lifecycle enum/CHECK·만료 트리거 추가 시)·B4(review_workflow_status CHECK)·C2(메모 컬럼 신설 시)·C3(서버 검증 RPC/제약 추가 시) 및 모든 seed/backfill 마이그레이션.
- **E2E 게이트**: v13 개발성 변경 전부 `pnpm test:e2e`.

**산출물 위치 규약**
- 마스터 계획(이 문서): `docs/superpowers/plans/2026-06-09-writing-questionbank-remediation.md`
- 페이즈별 plan/review/report: 이 계획 문서의 체크리스트와 관련 active docs의 Decision/History 섹션에 흡수한다. 원문 run artifact는 2026-06-16 문서 정리로 제거한다.
- Track C(topik-ai) 산출물은 topik-ai 저장소의 동등 위치 + v13에 handoff 패킷 사본.

---

## 2. 페이즈 분해 · 의존성 · 순서

> **메타리뷰(§8) 반영**: 신규 **B0**(기존 데이터 노출·분류 백필 판정)·**B4**(review_workflow_status CHECK)·**C0**(검증 데이터 준비) 추가, **C3을 C3a/C3b/C3c로 분할 + publish guard**, **A1→A2 직렬화**, **C1을 B2·B0 이후로**.

| Phase | Target | 저장소 | 선행조건 | owner게이트 | 스키마게이트 |
|---|---|---|---|---|---|
| **P0** 계획 확정 | 이 문서 | v13(docs) | — | (계획 자체 승인) | — |
| **A1** 타입 동기화 | T-A1/G12 | v13 | P0 | ✗ | 조건부(드리프트 발견 시) |
| **A2** 형태 확정+normalizer 견고화 | T-A2/G2·G9·G11 | v13 | **A1** | ✗ | ✗(문서/코드만) |
| **A3** 글자수 QA | T-A3/G8 | v13 | P0 | ✗ | ✗ |
| **B0** 기존 데이터 노출·분류 백필 판정 | (신규/F1·G6) | owner→v13 | P0 | ✔ | ✔(백필 마이그레이션 시) |
| **B1** 주제코드셋(+NULL 백필+CHECK) | T-B1/G6 | owner→v13 | **B0** | ✔ | ✔(CHECK 추가 시) |
| **B2** lifecycle 값매핑(+만료기준) | T-B2/G5 | owner | P0 | ✔ | 조건부(enum/CHECK·트리거 시) |
| **B3** 52 정답정책 | T-B3/G10 | owner | P0 | ✔ | ✗ |
| **B4** review_workflow_status CHECK | (신규/PROPOSED확정) | owner→v13 | P0 | ✔ | ✔(CHECK 추가) |
| **C0** 검증 데이터 준비 | (신규) | v13(dev seed) | A1·A2 | ✗ | 조건부(seed 추가 시) |
| **C1** 노출 표면 | T-C1/G7 | topik-ai | **B2 · B0** | ✔ | ✗(기존 컬럼/RPC) |
| **C2** 검수 메모 | T-C2/G4 | topik-ai | (메모컬럼 결정 시 owner) | ✔ | 조건부(메모컬럼 시) |
| **C3a** 콘텐츠 읽기·투영 | T-C3/G1 | topik-ai | A2 · B1 · C0 | ✔ | ✗ |
| **C3b** 타입별 editor + 클라 검증 | T-C3/G1·G3 | topik-ai | C3a · B3 · F3 | ✔ | ✗ |
| **C3c** 저장·RPC·감사 + published guard + 서버검증 결정 | T-C3/G1·F3 | topik-ai | C3b · **C1** | ✔ | 조건부(서버검증 RPC 시) |

**의존성 그래프(요지)**
- **A1 → A2**(직렬). A3·B0·B2·B3·B4는 P0 후 병렬 가능(Track B는 owner 결정 대기).
- **B0 → B1**(노출/백필 판정이 코드셋·NULL 처분의 전제).
- **C1은 B2(3축 lifecycle 매핑) + B0(어떤 row를 공개) 이후**. 공개 제어 없이 콘텐츠 쓰기를 먼저 열면 published/public row를 깨뜨릴 위험.
- **C3은 분할**: C3a(A2·B1·C0) → C3b(B3·F3 클라 검증) → C3c(**C1 publish guard** + 서버검증 결정). raw JSON 덮어쓰기가 live 문제를 깨므로 published row 보호 기준 필수.

**권장 실행 순서**
```
P0
 → A1 → A2          (∥ A3)
 → {B0 → B1, B2, B3, B4}   (owner 결정)
 → C0
 → C1 (+C2)
 → C3a → C3b → C3c
```

---

## 3. 트랙별 페이즈 상세

### Track A — v13 정리 (지금 실행 가능, GPT-5.5 게이트만)

**A1 · 생성 타입 동기화 (G12)**
- 목표: live dev DB에서 Supabase TS 타입 재생성 → `topic_category_code`·`review_workflow_status`·`admin_update_problem` 3건이 `src/lib/supabase/types.ts`에 나타남.
- 변경: `src/lib/supabase/types.ts`(생성물). 수동 편집 금지, 생성기 사용.
- 수용기준: 3건 grep 적중 + `lifecycle_*`/`expires_at` 기존 타입 보존 + typecheck 통과.
- 검증: `pnpm test:e2e`. 드리프트 발견 시 스키마 문서 게이트.
- GPT-5.5 포커스: 재생성 후 타입과 마이그레이션 일치, RPC 시그니처 정확성.
- 리스크: 생성기가 Docker/DB 필요 → 환경 의존([[project-conformance-9-decisions-finalized]] 적용 대기와 동일 제약).

**A2 · 정식 데이터 형태 확정 + normalizer 견고화 (G2·G9·G11, F3 읽기측)**
- 선행: **A1**(생성 타입 최신화 후 진행 — v13 컴파일/typecheck 기준 안정).
- 목표: (a) "문제 콘텐츠 형태 계약"을 문서로 공표 — rubric=OBJECT `{conditions,criteria}`, #54 materials 정식형(풍부형) + 평면형 레거시 폴백, `materials.review.validation` 형태. (b) normalizer가 malformed blob에 대해 안전 폴백/명시적 사유로 떨어지게 견고화(F3 읽기측 방어).
- 변경: `docs/`(형태 계약 문서) + `src/lib/writing/problem-normalizer.ts`(방어 강화, 동작 보존). `docs/Wireframe/data-usage-index.md` 갱신 고려.
- 수용기준: 형태 계약 문서화 + 잘못된 blob에도 화면이 크래시 대신 명시적 `problem_data_incomplete`로 처리 + 단위 테스트 추가.
- 검증: 단위 테스트 + `pnpm test:e2e`.
- GPT-5.5 포커스: 정식형 선택이 양쪽(화면·admin 저작기)과 모순 없는지, 폴백이 의미를 바꾸지 않는지.

**A3 · 글자수 정책 QA (G8)**
- 목표: `CHAR_LIMITS`(constants.ts) ↔ 53/54 프롬프트 내장 범위(200~300/600~700) 일치 검증, 타입상수 정책 문서화.
- 변경: 문서 + (불일치 시) 테스트/가드. 컬럼 신설 없음.
- 수용기준: 불일치 0 확인 또는 적발 후 보고. 정책(타입상수 유지) 명문화.
- GPT-5.5 포커스: 문제별 오버라이드가 정말 불필요한지(있다면 B로 승격 escalate).

### Track B — owner 결정 (결정 패킷 → 승인 → (해당 시) 마이그레이션)

**B0 · 기존 데이터 노출·분류 백필 판정 (신규, 메타리뷰 발굴 / F1·G6)**
- 배경(실측): 시드 466건 중 **published+public 217건만 사용자 노출**, **draft+private 249건은 비노출**(`20260608120200_seed_writing_problem_fixtures.sql`). `visibility` 기본 `private`·`publish_status` 기본 `draft`라, 향후 admin이 만든 문제도 명시 설정 없으면 안 보임.
- 산출: 결정 패킷 — 249건(및 향후 신규)의 **노출 처분**(의도적 비공개 vs 노출 대상), `topic_category_code` NULL 다수의 백필 방침(어떤 값으로/언제).
- owner 승인 후: (해당 시) 노출/분류 **백필 마이그레이션**(additive·idempotent) + 스키마 문서 게이트.
- 수용기준: "어떤 row가 왜 사용자에게 보이는가"가 명문화 + 의도치 않은 비공개/공개 0.
- GPT-5.5 포커스: 백필이 RLS `published AND public` 의미와 정합, 대량 공개 사고 방지.

**B1 · 주제분류 코드셋 + NULL 백필 + CHECK (G6)**
- 선행: **B0**(노출/백필 방침 확정).
- 산출: 결정 패킷 — 후보 ASCII 코드셋(life/study/society/culture/economy/education/environment/technology + 미분류), **화면 샘플 라벨 건강/행정의 매핑 처분**(신규코드 vs 기존편입), **기존 NULL row 백필 방침**(NULL 유지 허용 vs 'uncategorized'로 채움), 마이그레이션 초안.
- owner 승인 후: 기존 NULL 백필 → `topic_category_code` CHECK 제약 마이그레이션 + admin 쓰기 enable + **스키마 문서 게이트**(4개 문서) + `docs/Wireframe/data-usage-index.md`.
- 검증: 마이그레이션 적대검수 + `pnpm test:e2e`.
- GPT-5.5 포커스: 코드셋 완전성(모든 화면 라벨 커버), CHECK가 기존 데이터(NULL 포함)와 충돌 없는지, NULL 정책.

**B2 · lifecycle 값매핑 (G5)**
- 산출: 결정 패킷 — `operationStatus`(노출후보/숨김후보/운영제외/미지정) ↔ `lifecycle_status`(active/inactive/expired) **값-대-값 표**, `expires_at` 만료 기준(자동/수동), '운영 제외'=inactive vs expired 판단.
- owner 승인 후: (구현은 C1) admin 쓰기 매핑 확정. 스키마 변경 없음(컬럼 존재).
- GPT-5.5 포커스: 매핑의 단사/전사성, expired의 사용자 노출 의미(화면 lifecycle 필터와 정합).

**B3 · 52 정답셋 정책 (G10)**
- 산출: 결정 패킷 — 52번이 권위 정답셋 보유(→`answer_key` jsonb, 51과 동일 경로) vs 피드백 채점 전용. 채점 파이프라인 영향.
- owner 승인 후: (구현은 C3b의 52 에디터) 방향 확정. 스키마 변경 없음.
- GPT-5.5 포커스: 채점 일관성, 52 제출 게이트(`problem_data_incomplete`)와의 관계.

**B4 · review_workflow_status enum 확정 + CHECK (신규, 메타리뷰 발굴)**
- 배경: `review_workflow_status`도 `topic_category_code`처럼 **NULLABLE·CHECK 없음(PROPOSED)**. admin C검수가 이미 5단계를 쓰지만 제약은 미확정.
- 산출: 결정 패킷 — 확정 enum(not_started/in_progress/on_hold/done/revision_requested) + NULL 정책 + CHECK 마이그레이션 초안.
- owner 승인 후: CHECK 제약 마이그레이션 + 스키마 문서 게이트.
- GPT-5.5 포커스: 기존 데이터/admin 쓰기와 충돌 없는지, review_status(최종)와의 분리 유지([[project-admin-overlap-integration-phases-complete]] D-C).

### Track C — topik-ai admin (별도 저장소, 페이즈마다 owner 승인)

> 공통: 구현은 **topik-ai 저장소**. v13 스키마/RPC는 그대로(새 admin 전용 스키마 금지). 각 페이즈 owner 승인 게이트.

**C0 · 검증 데이터 준비 (신규, 메타리뷰 발굴)**
- 목표: Track C를 **실제 row로 end-to-end 검증**할 수 있게, dev에 51/52/53/54 각 타입의 known-good 샘플 + 백필 케이스 row를 보장(시드 466건 활용/보강).
- 변경: (필요 시) v13 dev seed 보강(additive). prod 무영향.
- 선행: A1·A2. 수용기준: 각 타입 최소 1건씩 저작/수정 검증 가능한 dev row 존재.
- GPT-5.5 포커스: 검증 데이터가 published/draft·public/private·NULL 분류를 모두 커버하는지.

**C1 · 노출 관리 표면 (G7, F1)**
- 목표: admin이 **publish_status + visibility** 둘 다 관리. 노출 3축(게시·공개범위·운영) UI/문서화.
- **F1 핵심**: `visibility` 기본값 `private` → "게시" 버튼만으론 사용자에게 안 보임. 저작 완료 시 publish=published **AND** visibility=public 둘 다 세팅해야 노출. RLS `problems_visible_select` 의미를 UI 카피로 명시.
- 사용 RPC: `admin_toggle_problem_publish`(publish) + `admin_update_problem`(visibility, allowlist 포함). 권한 `is_content_admin`.
- **선행: B2(lifecycle 3축 매핑) + B0(노출/백필 판정)** — 메타리뷰 반영(권장→필수). 공개 제어 확정 후 publish UI 오픈.
- 수용기준: published+public 전환 시 사용자 화면 실노출 확인(실데이터), '검수완료≠게시≠공개' 카피 노출, public 전환 전 경고.
- GPT-5.5 포커스: 세 축을 혼동 없이 노출하는지, visibility 기본 private 함정 처리, 대량 공개 사고 방지.

**C2 · 검수 메모/사유 영속 (G4, F2)**
- 목표: 검수 액션 시 `reviewMemo`/`reason`을 `admin_update_problem` patch의 `__note`로 동봉 → `admin_audit_logs.payload.review_note` 영속.
- **F2 핵심**: `__note`는 실 컬럼 변경(review_status/review_workflow_status)과 **함께일 때만** 남음(empty diff면 early-return으로 유실). 검수 액션은 항상 상태를 바꾸므로 OK.
- 분기: **독립·조회형 메모**(상태변경 없이 메모만, 또는 문제별 메모 목록 조회)가 요구되면 → **owner 결정**(작은 additive 컬럼 vs audit-log 조회). 스키마 변경 시 스키마 문서 게이트.
- 수용기준: 검수 후 audit log에 review_note 영속 확인. memo-only 시나리오 처리(차단 or 컬럼).
- GPT-5.5 포커스: memo-only 유실 경로가 UI에서 실제로 발생 가능한지, 누락 없는지.

**C3 · 타입별 콘텐츠 저작/편집 표면 (G1·G3, F3)** — *최대 페이즈, P0급. 메타리뷰 반영하여 3분할.*
- 공통 목표: admin이 `problems.materials/answer_key/rubric`를 **읽어 타입별로 투영**하고 **되쓰기**(`admin_update_problem`). 생성 폼 포함.
- **F3 핵심**: `admin_update_problem`은 jsonb를 **서버 무검증·raw overwrite** 저장 → 잘못된 blob이 live 문제를 깨뜨릴 수 있음.

**C3a · 콘텐츠 읽기·투영**
- 목표: 타입별 canonical shape(A2)대로 `materials/answer_key/rubric`를 읽어 admin content 객체로 표시(현재 빈 placeholder 대체). 쓰기 없음.
- 선행: **A2**(정식 형태) · **B1**(주제코드) · **C0**(검증 데이터).
- 수용기준: 51/52/53/54 실 row를 admin에서 정확히 표시(읽기 전용).

**C3b · 타입별 editor + 클라이언트 검증**
- 목표: 타입별 편집 UI(51 빈칸/정답·52 연결표현·53 차트/맥락·54 주제/필수3문항/조건=G3) + **A2 형태 계약을 검증 스키마로 클라이언트 검증**(저장 전 차단).
- 선행: **C3a · B3**(52 정답 처분) · **F3**(검증 요구).
- 수용기준: 잘못된 입력은 저장 시도 전 차단, 52/54 제출 게이트 조건 충족 입력 강제.

**C3c · 저장·RPC·감사 + published guard + 서버검증 결정**
- 목표: 검증 통과분을 `admin_update_problem`로 되쓰기 + 감사 로깅. **published/public row 보호 가드**(저장 전 재검증, 필요 시 draft/private로 내림). **서버측 검증 필요성 결정**(RPC에 shape 검증 추가할지 = owner/스키마 게이트 escalate).
- 선행: **C3b · C1**(publish guard 위해 노출 제어 선행).
- 수용기준: 저작/수정 후 사용자 화면 정상 렌더 + 제출 게이트 통과(실데이터), published row 무사고, 서버검증 결정 기록.
- GPT-5.5 포커스: 되쓰기 후 normalizer 가정과 1:1, published row 회귀, 권한·감사, 클라 검증만으로 충분한지 vs 서버검증.

---

## 4. 게이트·승인 매트릭스

| Phase | GPT-5.5 리뷰 | owner 승인 | 스키마 문서 게이트 | E2E(`pnpm test:e2e`) | 실화면 확인 |
|---|---|---|---|---|---|
| P0 | ✔ (메타) | ✔(계획) | — | — | — |
| A1 | 경량 | ✗ | 조건부 | ✔ | — |
| A2 | ✔ | ✗ | ✗ | ✔ | — |
| A3 | ✔ | ✗ | ✗ | ✔ | — |
| B0 | ✔ | ✔ | ✔(백필 시) | ✔(백필 후) | — |
| B1 | ✔ | ✔ | ✔(NULL백필+CHECK) | ✔(마이그레이션 후) | — |
| B2 | ✔ | ✔ | 조건부(enum/CHECK·트리거) | — | — |
| B3 | ✔ | ✔ | ✗ | — | — |
| B4 | ✔ | ✔ | ✔(CHECK) | ✔(마이그레이션 후) | — |
| C0 | ✔ | ✗ | 조건부(seed 추가) | ✔ | — |
| C1 | ✔ | ✔ | ✗ | (topik-ai 검증) | ✔ |
| C2 | ✔ | ✔ | 조건부(메모컬럼) | (topik-ai 검증) | ✔ |
| C3a | ✔ | ✔ | ✗ | (topik-ai 검증) | ✔ |
| C3b | ✔ | ✔ | ✗ | (topik-ai 검증) | ✔ |
| C3c | ✔ | ✔ | 조건부(서버검증 RPC) | (topik-ai 검증) | ✔ |

---

## 5. 보고문서 규약 + 템플릿

**위치**: 이 계획 문서의 진행 체크리스트와 관련 active docs의 Decision/History 섹션.
Track C는 topik-ai 동등 위치 + v13에 handoff 사본.

**완료 보고 템플릿(`<phase>-report.md`)**
```markdown
# <Phase> 완료 보고 — <제목> (YYYY-MM-DD)
## 1. 한 줄 요약 (비개발자용)
## 2. 한 일 / 변경 (저장소·파일 목록)
## 3. 수용기준 충족 증거 (테스트 로그·스크린샷·grep 결과)
## 4. 게이트 결과 (GPT-5.5 리뷰 PASS / owner 승인 / 스키마문서 / E2E)
## 5. 잔여 리스크 · 후속
## 6. Docs consulted
```

---

## 6. 전체 리스크 · 롤백

- **admin 경계**: Track C는 v13에서 구현 금지. topik-ai 저장소에서, 페이즈별 owner 승인. v13 스키마/RPC 불변.
- **교차 저장소 동시작업**: Claude+Codex 한 트리 병렬 가능 → 커밋 전 `git status` 전체 훑기, 관심사별 커밋([[feedback-concurrent-agent-worktree]]).
- **스키마 변경(B1·조건부 C2)**: additive·idempotent only, prod 영향 없음, 스키마 문서 게이트 필수. 롤백=마이그레이션 되돌림 + 타입 재생성.
- **서버 무검증 blob(F3)**: C3 전까지 admin이 본문을 쓰지 않으므로 현 위험 낮음. C3에서 클라이언트 검증으로 차단.
- **환경 제약**: 마이그레이션 적용/타입 재생성은 Docker/DB 필요(이 환경 CLI 없음) → 적용은 환경 확보 후.

---

## 7. 진행 체크리스트

- [x] P0 — 계획 GPT-5.5 메타리뷰(§8) 반영·owner 확정(3-Track C안)
- [x] **B0 — 노출·분류 백필 판정 완료(2026-06-09)**: D1 현상유지·D3 명시적 공개·D2/D4/D5/D6 채택. 백필 마이그레이션 불필요. 후속: C1(D3·D6), B1(D4 NULL백필→CHECK), live DB 재확인(deferred).
- [x] **A1 — 타입 동기화 완료(2026-06-09, 검증된 수기 보정)**: types.ts에 review_workflow_status·topic_category_code(Row/Insert/Update)·admin_update_problem(Functions) 추가, lifecycle 보존. typecheck✓·단위✓(3/3)·E2E 스모크✓(3 passed). gen types는 환경상 불가+live regen이 lifecycle 유실시켜 수기 보정 채택(owner 승인). 픽스처 AdminProblemPublishToggle.test.tsx 2줄 보정.
- [ ] **A1-pre(신규·미완) — live 스키마 ↔ 마이그레이션 정합**: service role 읽기로 발견 — **live는 lifecycle 마이그(20260608120100) 미적용**(lifecycle_* 컬럼 없음)인데 topic/review_workflow(20260608120300)는 적용됨(양방향 드리프트). pending 마이그 적용(최소 lifecycle) → live==migrations → 추후 정식 gen types로 수기 보정 대체. DB/Docker 접근 게이트(cf. [[project-conformance-9-decisions-finalized]]). 적용 시 스키마 문서 게이트.
- [x] **A3 — 글자수 정책 QA 완료(2026-06-09, GPT-5.5 PASS)**: 상수↔프롬프트 일치(불일치 0), 타입별 상수 유지. 코드 변경 0. 정합문서 §10.
- [x] **A2 완료(2026-06-09, 임시 Claude 적대검수 PASS-WITH-FIXES)** — 형태 계약 문서(`docs/writing-problem-content-shape-contract.md`) + normalizer 견고화(배열 rubric 양쪽 흡수·**q51 빈칸0·q53 차트0&과제0 제출차단** 신규) + 적대 테스트 40 + 글자수 드리프트 가드. 퍼징상 P0 크래시 0. typecheck✓·단위 97✓·E2E 쓰기플로우✓. 51·53 차단=사용자 영향(owner veto 가능). codex 복구 시 GPT-5.5 재검수 권장.
- [x] **B1 — 주제 코드셋 완료(2026-06-09)**: 아키텍처 결정(GPT-5.5 위임 → 관리형 참조 테이블 `problem_topic_categories`, 자식 leaf 저장, FK/RPC 검증, CHECK 없음) + **매핑 명세 완료**(45 distinct 라벨+무라벨 → parent/child leaf, GPT-5.5 PASS-WITH-FIXES: 소비→economy·자세→life·서비스→큐, unknown→큐·Q51→NULL·active-leaf-only). 부모 9 + 자식 leaf ~30. 백필 예측 371 auto/5 큐/90 NULL. **코드/스키마 변경 0.** 실행(테이블·시드·FK·백필)=C-TAX(DB 게이트).
- [ ] **C-TAX(신규) — Managed Subject Taxonomy** (Track C, owner 게이트·DB 게이트): ① `problem_topic_categories` 마이그 ② parent/child seed ③ `problems.topic_category_code` FK/검증(CHECK 아님) ④ topik-ai `TOPIC_CATEGORY_LABEL` hardcode 제거→lookup ⑤ `/system/metadata`를 이 테이블 read/write facade로(+`item.parent_code` 확장) ⑥ 매핑 확정 후 backfill. /system/metadata는 현재 in-memory mock → DB 테이블 먼저 SoR. 선행: B1 매핑 명세.
- [x] **B2 완료(2026-06-09, Opus 4.8 에이전트 위임)** — operationStatus=권고레이어→미지정 write안함·노출후보→active·숨김후보→inactive·**운영제외→inactive**(expired는 만료전용). expires_at=수동/저장만(자동만료 없음). 선행=A1-pre+admin_update_problem allowlist에 lifecycle키 추가(현재 없어 silent no-op). G5 RESOLVED. 적용=DB+topik-ai 게이트.
- [x] **B3 완료(2026-06-09, Opus 4.8 에이전트 위임)** — #52=**피드백/루브릭 채점 전용**(채점기 answer_key 미사용). answer_key=complete_paragraph(model_answer+힌트) 유지, 정답배열 비저작. 완성도=프롬프트마커+rubric. 적발: admin buildContent('52') 객관식 오모델→C3b 수정. G10 RESOLVED. 코드 변경 0.
- [x] **B4 완료(2026-06-09, Opus 4.8 에이전트 위임)** — review_workflow_status = **고정 CHECK**(관리형 아님): 값 not_started/in_progress/on_hold/done/revision_requested, **NULL 허용**(470행 NULL, 백필 안 함). review_status와 분리 유지(보류=on_hold는 review_status 보존), 교차필드 규칙은 admin 쓰기 로직(DB CHECK/트리거 아님). admin 단일 writer가 닫힌 5라벨 union이라 거부 위험 0. CHECK 적용=DB 게이트. **Track B 전체 종료.**
- [ ] C0 (검증 데이터) → C1 / C2 → C3a → C3b → C3c (각: 구현계획 → GPT5.5 → owner 승인 → topik-ai 실행 → report) — C1은 B0의 D3·D6 적용. **C3는 C-TAX의 taxonomy 매핑을 write에 재사용**(GPT-5.5 R5).

---

## 8. GPT-5.5 메타리뷰 결과 (2026-06-09)

입력=영문 ASCII 패킷(양쪽 저장소 실소스 대조), 모델=gpt-5.5(read-only). **판정: SOUND-WITH-FIXES**
("경계는 유지되나, seed/backfill·공개제어·raw overwrite에서 재작업 위험 큼"). TOP 5 지적 전부 반영 완료.

### 8.1 반영한 변경 (지적 → 계획 수정)

| # | GPT-5.5 지적 | 직접 재확인 | 반영 |
|---|---|---|---|
| M1 | **백필 누락** — 시드가 전부 공개가 아님 | 실측: published+public **217** vs draft+private **249**(`20260608120200`); `visibility` 기본 private·`publish_status` 기본 draft | **신규 B0**(노출·분류 백필 판정), C1 선행에 B0 추가, §6 리스크 |
| M2 | **A1→A2 직렬화** — stale 타입이 컴파일 기준 흔듦 | `types.ts` 3건 누락(기확인) | A2 선행=A1, §2 그래프·체크리스트 |
| M3 | **C1을 B2 이후로** — 3축 게이트에 lifecycle 포함 | server.ts publish+lifecycle 필터, RLS publish+public | C1 선행=B2·B0(권장→필수) |
| M4 | **C3 분할 + publish guard** — raw overwrite가 live 깨뜨림 | RPC가 jsonb raw 저장·무검증(`20260608120400:79-89`) | **C3a/C3b/C3c** 분할, C3c에 published guard + 서버검증 결정, C3c 선행=C1 |
| M5 | **게이트 확대** — CHECK/백필/seed도 schema-doc | `review_workflow_status`·`topic_category_code` NULLABLE·CHECK 없음(PROPOSED) | **신규 B4**(review_workflow_status CHECK), 스키마 게이트 대상 B0/B1/B2/B4/C2/C3로 확대, A1 경량리뷰 |

### 8.2 부가 반영
- **C0 신규**(검증용 실 데이터 준비) — Track C를 실 row로 end-to-end 검증.
- **B1에 NULL `topic_category_code` 백필 방침** 추가(NULL 유지 vs 'uncategorized').
- **C2 분기 강화** — 독립·조회형 메모 필요 시 audit-note vs 메모컬럼 결정 분리.
- **GPT-5.5 게이트 깊이 우측 조정** — A1 등 기계적 페이즈는 경량, 스키마/RPC/RLS·사용자 노출·교차 저장소·C3 쓰기는 차단.

### 8.3 경계 재확인(메타리뷰 결론)
- Track C(visibility/publish 관리, materials 쓰기)는 **v13 변경 불필요** — allowlist에 `visibility/publish_status/materials/answer_key/rubric` 이미 포함, 쓰기 브랜치·`admin_toggle_problem_publish` 존재, 권한 `is_content_admin`. **boundary leakage 없음**.
- RLS 우려는 "권한 우회"가 아니라 **"대량 공개 사고"** — 기본 draft/private에서 공개 전환 시 검증·경고 필요(C1·B0에 반영).

> **확정 조건**: 위 반영으로 P0의 GPT-5.5 메타리뷰 게이트 충족. owner가 이 계획(특히 B0 노출 판정이 선행이라는 점)을 승인하면 실행 단계 진입.
