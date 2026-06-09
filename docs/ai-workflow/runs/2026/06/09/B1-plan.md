# B1 실행계획 + 결정 패킷 — 주제 분류 코드셋 + NULL 백필 + CHECK (G6) (2026-06-09)

> 페이즈 B1 (Track B, owner 결정) · 상위: [`2026-06-09-writing-questionbank-remediation.md`](../../../../superpowers/plans/2026-06-09-writing-questionbank-remediation.md)
> 선행: **B0**(노출/백필 방침). 사이클: 실행계획(이 문서) → GPT-5.5 리뷰 → **owner 승인** → 실행(백필+CHECK 마이그, DB 게이트) → 검증 → 보고.
> **이 문서 상태**: 결정 패킷(분석·권고). **데이터/스키마 변경 없음.**
>
> ⚠️ **부분 SUPERSEDE (2026-06-09)**: owner가 저장/관리 결정을 GPT-5.5에 위임 + "topik-ai `/system/metadata`에서 분류 관리" 제안 → GPT-5.5가 **관리형 참조 테이블(Option M, phased)** 로 결정. §2~§4의 *9코드 CHECK + 폴드*는 **§10 + [`B1-arch-decision.md`](B1-arch-decision.md)로 대체**(아래 §1~§3의 라벨 분포·코드셋 근거는 유효, 매핑은 parent/child leaf 명세로 재구성).

## 0. 목표
`problems.topic_category_code`(SUBJECT 축, skill 축 `domain`과 별개)의 **캐노니컬 코드셋 확정**, 화면/데이터의 한글 주제 라벨을 코드로 **매핑**, 기존 NULL **백필 방침**, 그리고 **CHECK 제약** 도입(B0 D4: CHECK 전에 NULL 처분 먼저).

## 1. 근거 (실측)

**(a) 캐노니컬 코드셋** — admin(topik-ai)이 *이미 구현*한 9코드(`supabase-assessment-question-bank-service.ts:84-94`) = 마이그 `20260608120300` 제안과 동일:
`life→생활 · study→학습 · society→사회 · culture→문화 · economy→경제 · education→교육 · environment→환경 · technology→기술 · uncategorized→미분류`. (admin은 null/unknown도 미분류로 표시.)

**(b) live DB**: `topic_category_code`는 **470건 전부 NULL**(코드 컬럼엔 아직 미투영). 실제 주제 라벨은 `materials.taxonomy.subject_domain`(jsonb)에 한글로 존재.

**(c) 데이터 주제 라벨 분포** (시드 466, `materials.taxonomy.subject_domain`): **자유 텍스트성 46개 라벨의 롱테일.**
- 9코드에 **직접 매칭(291건)**: 사회99→society · 교육59→education · 환경49→environment · 기술34→technology · 경제33→economy · 생활16→life · 학습1→study. (문화: 0건)
- **51 전체(90건)**: subject_domain **없음**(51은 장르코드 taxonomy.category만).
- **나머지 롱테일(85건, ~38라벨, 코드셋에 없음)**: 직장15·건강9·위생5·식품4·겨울4·디지털 생활4·심리3·운동3·안전3·생활과학2·교통2·식물2·식생활2·행정2·관계2 + 싱글톤 다수(재활용·세탁·기후·미디어·직업·서비스·제도·공공장소·…).

→ **핵심 문제**: 데이터 어휘(46) ≫ 목표 코드(9). 매핑은 **다대일·일부 판단 개입(lossy)**. 특히 **건강(9)·행정(2)** 등은 9코드에 직접 대응 코드가 없음.

## 2. owner 결정 사항 (승인 요청)

| # | 질문 | 권고 |
|---|---|---|
| **DB1.1** | CHECK 도메인 = 위 **9코드(+NULL 허용)** 채택? | **YES** — admin이 이미 그 9코드를 매핑 중. 새 코드 추가는 admin enum(8 고정)까지 바꿔야 해 범위 확대. |
| **DB1.2** | 롱테일(85) 처리 = **A. 의미 기반 폴드**(§3 매핑표로 9코드에 흡수) vs **C. 보수적**(롱테일→uncategorized) | **A(폴드)** — C로 가면 미분류가 ~175/470(37%)로 과다. A는 건강→life·직장→society 등으로 분류 보존(폴드는 판단 개입, owner가 표 검토). |
| **DB1.3** | 51(90 무라벨) + 미매핑 = **'uncategorized' 명시** vs **NULL 유지** | **'uncategorized' 명시** — admin은 null/uncategorized 둘 다 미분류로 표시(동일). CHECK는 `NULL OR in(9코드)`로 두어 안전. |
| **DB1.4** | 백필은 **`materials.taxonomy.subject_domain`에서 코드 도출 → CHECK는 그 다음**(B0 D4) 순서 확정 | **YES** — 빈 컬럼에 먼저 채우고 CHECK. 실행은 DB 게이트. |

## 3. 제안 매핑표 (Option A, DB1.2=A일 때)

**직접(7코드)**: 사회→society · 교육→education · 환경→environment · 기술→technology · 경제→economy · 생활→life · 학습→study.
**폴드**:
- → **life(생활)**: 건강·위생·식품·운동·심리·식생활·과일·습관·자세·휴식·식물·겨울·봄철·세탁·가정·소비·생활과학·동물행동·공원·환기 (일상/건강/식생활)
- → **society(사회)**: 직장·직업·서비스·행정·제도·관계·공공장소·공동주택·교통·안전·집안안전·보행 (사회/공공/직업/안전·제도)
- → **technology(기술)**: 디지털 생활·디지털·미디어
- → **environment(환경)**: 재활용·자원·기후
- → **uncategorized(미분류)**: 51 무라벨(90) + 위로 분류 불가한 잔여
> ⚠️ 교통/안전/보행(life↔society), 직장(society↔life)은 경계 사례 — owner 재배정 가능. 표는 출발점.

**버킷팅 원칙(R4)**: admin 캐노니컬 8라벨에 맞춘다 — *일상·개인 주제(건강/식생활/습관 포함)=life · 제도/직업/공공 인프라=society · 디지털·매체=technology · 자원/기후=environment · 학술 도메인은 직접 매칭*. 매핑 불가는 uncategorized.
**C3 연결(R5)**: 이 라벨↔코드 매핑은 **C3 콘텐츠 저작기의 write 경로가 재사용할 single source of truth**. C3에서 admin 한글 8라벨 → ASCII 코드 변환에 동일 표 사용. (DB1.5: 미분류/uncategorized를 admin이 *쓰기 가능* 값으로 둘지 vs null/unknown 표시 전용인지 결정 — C3 입력.)

## 4. 실행 (승인 후, DB 게이트)
- **백필 마이그(additive·idempotent), scope `where domain='writing'`(R3)**: 각 row의 `materials.taxonomy.subject_domain`을 §3 표로 코드 변환해 `topic_category_code`에 기록. review_status 등 불변.
  - **라벨 정규화(R1)**: 매칭 전 `trim` + 내부 공백 정규화(예 '디지털 생활'='디지털생활', '집안 안전'='집안안전') — 공백 유무 alias 모두 매칭.
  - **결정적 폴백(R2)**: ~~매핑/결측은 반드시 `ELSE 'uncategorized'`~~ — ⚠️ **SUPERSEDED**: 관리형 테이블 전환(§10) + 매핑 명세 기준으로 **unknown 라벨 → review queue, Q51 무라벨 → NULL**(강제 uncategorized 금지). [`B1-mapping-spec.md`](B1-mapping-spec.md) 규칙을 따른다.
- **CHECK 마이그(table-wide, nullable)**: `topic_category_code is null OR topic_category_code in ('life','study','society','culture','economy','education','environment','technology','uncategorized')`. **백필 완료 후** 적용. non-writing 행은 NULL이라 통과(향후 reading/listening도 동일 9코드 subject set만 허용).
- **스키마 문서 게이트**: database-schema.md·supabase-table-inventory.md·migrations/INDEX.md·docs/share/ 갱신.
- **실행 차단**: 마이그 적용은 DB/Docker 접근 필요(현 환경 불가, [[project-conformance-9-decisions-finalized]]) → 마이그는 작성(READY)하고 적용은 환경 확보 후. (live의 +4행 포함 데이터 기반 도출이라 행수 고정 아님.)

## 5. 수용 기준
- 9코드 CHECK 도메인 확정 + 매핑표(또는 C) owner 승인.
- 백필 후 `topic_category_code` NULL/미분류 비율과 코드 분포가 의도대로(예: A면 미분류 ≈ 90+잔여).
- CHECK가 백필된 모든 값과 충돌 0(적대검수).

## 6. 검증
- 결정만: 문서 정합성. 마이그 작성 시 적대검수 + (적용 시) `pnpm test:e2e` + 백필 분포 재집계.
- live 재확인: service role 읽기로 백필 전/후 `topic_category_code` 분포 대조(현재 470 전부 NULL).

## 7. 리스크
- **폴드 임의성**(A): 경계 라벨 오분류 → owner 표 검토로 완화, 잔여는 uncategorized.
- **CHECK가 기존 값과 충돌**: 백필을 CHECK보다 먼저(DB1.4)로 차단.
- **admin enum 고정(8)**: 새 코드(health/work 등) 추가 시 topik-ai도 변경 → 범위 확대라 비권고(DB1.1).

## 8. Docs consulted
`20260608120300` 마이그, topik-ai `supabase-assessment-question-bank-service.ts`(TOPIC_CATEGORY_LABEL)·`assessment-question-bank-types.ts`, `20260608120200` 시드(subject_domain), B0 보고, 상위 계획.

## 9. GPT-5.5 리뷰 결과 (원안: 9코드 CHECK+폴드)
**PASS-WITH-FIXES** (기록 [`B1-gpt55-review.md`](B1-gpt55-review.md)). 근거 검증됨. 5건 반영: R1 라벨 공백 정규화 · R2 ELSE uncategorized 강제 · R3 백필 scope=writing · R4 버킷팅 원칙 · R5 C3 매핑 재사용+DB1.5.
**→ 단, 이후 owner 위임으로 아키텍처가 §10으로 전환됨(원안 CHECK는 미채택).**

## 10. 개정 방향 — 관리형 참조 테이블 (GPT-5.5 위임 결정, [`B1-arch-decision.md`](B1-arch-decision.md))
- **CHECK 미도입.** 신규 공유 참조 테이블 `public.problem_topic_categories`(code PK · parent_code 자기참조 FK · label_ko/en · status · sort_order · audit)가 SoR.
- `problems.topic_category_code` = **자식 leaf 코드** 저장(부모는 join). **FK + 쓰기 RPC 검증**(active leaf만, 삭제 금지·inactive만).
- B1의 본 deliverable = **코드셋(parent/child) + 백필 매핑 명세**(`source_label → parent_code → child_code → confidence`). §3 직접매칭은 leaf로 내림(society_general 등). 저신뢰는 review queue. **Q51 무주제 → NULL/not_applicable**(강제 uncategorized 금지).
- 테이블/시드/FK/hardcode 제거/`/system/metadata` facade/백필 = **신규 phase "Track C: Managed Subject Taxonomy"**(상위 계획). 적용은 DB 게이트.
- `/system/metadata`는 현재 in-memory mock → DB 테이블 먼저 SoR, 페이지는 후속 facade(+`item.parent_code` 확장).
