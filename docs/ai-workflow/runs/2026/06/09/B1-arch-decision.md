# B1 아키텍처 결정 — 주제 분류는 "관리형 참조 테이블"(위임: GPT-5.5) (2026-06-09)

> owner가 **저장/관리 방식 결정을 GPT-5.5에 위임** + "topik-ai `/system/metadata`에서 라벨/카테고리 관리" 제안.
> GPT-5.5(high reasoning, 양 저장소 실소스 대조)가 결정. 입력 `b1arch.txt`. 이 문서는 결정 기록.

## DECISION
**Option M(관리형 분류) 채택 — 단, generic `/system/metadata` 전체 영속화가 아니라 `problems`용 공유 taxonomy 테이블부터 만드는 phased M. J(CHECK+jsonb)·K(신규컬럼)는 안 한다.**

## 왜
- 주제 분류는 46개 한글 자유텍스트 롱테일 + 운영 변경을 감당해야 함 → **owner 관리 참조 데이터**가 맞다.
- 9코드 CHECK(J/K)는 지금 빨라 보여도 건강/식생활/행정/업무 등 tail을 넣을 때마다 **마이그레이션 필요** → owner가 말한 "관리 가능한 분류"와 충돌.
- 단 `/system/metadata`는 현재 **in-memory mock**(sleep+Zustand) → 지금 SoR로 삼으면 안 됨. **DB 테이블을 먼저 SoR**로, 메타데이터 페이지는 나중에 그 테이블의 **admin facade**로 연결.

## 구조 (확정)
- **신규 공유 참조 테이블** `public.problem_topic_categories`:
  - `code text primary key` · `parent_code text null references problem_topic_categories(code)`(자기참조, 부모/자식) · `label_ko text` · `label_en text null` · `status`(active/inactive) · `sort_order int` · audit(timestamps/actor).
- **`problems.topic_category_code` = 자식(leaf) 코드 저장**(예 'health'). 부모는 `parent_code` join으로(예 health→life). **행에 부모 중복 저장 안 함.**
- **CHECK 두지 않음.** **FK + 쓰기 RPC 검증**: 새 write는 **active leaf만** 허용, 과거 참조된 inactive row는 유지, **삭제 금지(inactive만)**.
- 경계: 이 테이블은 금지된 "admin 전용 스키마"가 **아니라 정당한 공유 참조 스키마**(problems가 이미 공유 overlap 엔티티고, 이 테이블이 그 컬럼의 기준 데이터). **쓰기 = `is_content_admin`/platform admin 통과 audited RPC만**, v13 user app은 직접 관리 안 함. **읽기 = 양쪽 개방**(reference data).

## `/system/metadata` 모델링 (확정)
- **그룹 1개 + `item.parent_code`** (트리 렌더). group-per-parent는 부모 이동/정렬/비활성화가 지저분해 비채택.
- group: `writing_subject_taxonomy`, `managerType='codeTable'`, `ownerModule='Content'`. parent item=`parent_code:null`, child item=`parent_code:'life'` 등.
- 현 `SystemMetadataItem`엔 `parent_code` 없음 → **persistence phase에서 type/API 확장** 대상. mock seed에 추가해도 SoR 아니라 remediation으로 치지 않음.

## B1 재정의 (이 결정으로 변경)
- B1 = **"코드셋(parent/child) 확정 + 백필 매핑 명세"**. 9코드 CHECK·폴드(기존 §2~§4)는 **부분 supersede**.
- 매핑 명세: **45개 distinct source label + 1 무라벨(Q51) 케이스** → `source_label → parent_code → child_code → confidence` (상세 [`B1-mapping-spec.md`](B1-mapping-spec.md)).
  - 직접 parent 라벨(사회/교육 등)은 `society_general`/`education_general` 같은 **leaf**로 내림(문제 행은 항상 leaf 저장).
  - **저신뢰 라벨은 백필하지 않고 review queue**로 남김.
  - **Q51(무주제 90건)은 강제 uncategorized 금지** → NULL 유지 또는 `not_applicable` 별도 결정.

## 신규 phase: **Track C — Managed Subject Taxonomy** (remediation 추가)
1. `problem_topic_categories` 마이그레이션 작성
2. parent/child seed 작성
3. `problems.topic_category_code` FK/검증 추가(CHECK 아님)
4. topik-ai hardcoded `TOPIC_CATEGORY_LABEL` 제거 → lookup 기반 parent/child label 표시
5. `/system/metadata`를 이 테이블 read/write facade로 연결(+`item.parent_code` 확장)
6. 매핑 확정 후 backfill 실행
- **DB/env 게이트**: 마이그 적용·백필은 DB 접근 시. 지금 가능 = 결정/명세/매핑 문서화까지.

## Top Risks (de-risk)
1. mock을 SoR로 오인 → DB 테이블 먼저 SoR, 페이지는 facade 후속.
2. 롱테일 매핑 오류 → 저신뢰는 backfill 말고 review queue.
3. 카테고리 삭제로 과거 FK 깨짐 → 삭제 금지·inactive만·새 write만 active leaf.
4. topik-ai 8-label hardcode ↔ leaf code 불일치 → Track C에서 lookup으로 교체, parent label은 join 표시.
5. frozen CHECK 재도입 금지 → 확장성은 FK/RPC 검증으로.
