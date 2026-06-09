# B1 매핑 명세 — 주제 분류 parent/child 코드셋 + 45라벨(+무라벨) 매핑 (2026-06-09)

> 페이즈 B1 잔여 산출물. 아키텍처 결정: [`B1-arch-decision.md`](B1-arch-decision.md)(관리형 참조 테이블 `problem_topic_categories`, 자식 leaf 저장, FK/RPC 검증, CHECK 없음).
> 이 명세 = **single source of truth**: ① 분류 테이블 seed, ② 백필(materials의 한글 주제 → 자식 leaf 코드), ③ C3 저작기 write 매핑이 모두 재사용.
> **데이터/스키마 변경 없음**(명세 문서). 적용(테이블·seed·백필)은 C-TAX(DB 게이트).

## 0. 규칙
- **문제 행에는 자식(leaf) 코드만 저장.** 부모는 `parent_code` join으로.
- **직접 매칭 broad 라벨**(사회/교육 등)은 부모 밑 `*_general` leaf로 내림(행은 항상 leaf).
- **자동 백필**: confidence high/med. **review queue(보류·자동 백필 안 함)**: confidence low(부모 경계 모호).
- **51번 등 주제 라벨 없음 → `NULL`(=not_applicable).** 강제 분류(uncategorized) 금지.
- **표에 없는 라벨(미래/오타 포함) → review queue.** 절대 조용히 떨어뜨리지 않음.
- 라벨 매칭 전 `trim` + 내부 공백 무시('디지털 생활'='디지털생활').
- 부모 비활성화/삭제 금지(삭제 대신 inactive). 새 write는 active leaf만.

## 1. 부모(상위) 코드 = 9개 (admin 캐노니컬과 동일)
`life(생활) · study(학습) · society(사회) · culture(문화) · economy(경제) · education(교육) · environment(환경) · technology(기술) · uncategorized(미분류)`
- `culture`는 현재 데이터 0건이나 admin 라벨에 있으므로 부모로 유지(자식 없음).
- `uncategorized`는 leaf 부재 시 표시용 폴백(행에는 NULL 사용 권장, 표시 단계에서 미분류).

## 2. 자식(하위) leaf 코드 + 46라벨 매핑 (시드 466 기준, count)

### 부모: life (생활)
| 자식 leaf | 한글 라벨(원본) | count | conf |
|---|---|---|---|
| life_general | 생활 | 16 | high |
| health | 건강 | 9 | high |
| hygiene | 위생 | 5 | high |
| food | 식품, 과일 | 5 | high |
| diet | 식생활 | 2 | high |
| exercise | 운동 | 3 | high |
| psychology | 심리 | 3 | med(life↔society) |
| habits | 습관 | 1 | med |
| rest | 휴식 | 1 | med |
| home | 가정 | 1 | high |
| home_safety | 집안 안전 | 1 | med |
| season | 겨울, 봄철 | 5 | med |
| nature | 식물, 동물 행동 | 3 | med |
| daily_science | 생활 과학 | 2 | med |
| laundry | 세탁 | 1 | med |
| posture | 자세 | 1 | med (부모 내부 모호, 큐 아님) |

### 부모: society (사회)
| 자식 leaf | 한글 라벨 | count | conf |
|---|---|---|---|
| society_general | 사회 | 99 | high |
| work | 직장, 직업 | 16 | high |
| public_admin | 행정, 제도 | 3 | high |
| relations | 관계 | 2 | med |
| safety | 안전 | 3 | med(life↔society) |
| transport | 교통 | 2 | med(life↔society) |
| public_space | 공공장소 | 1 | med |

### 부모: technology (기술)
| 자식 leaf | 한글 라벨 | count | conf |
|---|---|---|---|
| technology_general | 기술 | 34 | high |
| digital | 디지털, 디지털 생활 | 5 | med(life↔technology) |
| media | 미디어 | 1 | med |

### 부모: environment (환경)
| 자식 leaf | 한글 라벨 | count | conf |
|---|---|---|---|
| environment_general | 환경 | 49 | high |
| recycling | 재활용 | 1 | high |
| climate | 기후 | 1 | high |
| resources | 자원 | 1 | med |

### 부모: economy / education / study (직접 매칭만)
| 자식 leaf | 한글 라벨 | count | conf |
|---|---|---|---|
| economy_general | 경제 | 33 | high |
| consumption | 소비 | 1 | med (소비경제, 큐 아님) |
| education_general | 교육 | 59 | high |
| study_general | 학습 | 1 | high |

## 3. Review queue (보류 — 자동 백필 안 함, owner/검토 후 배정)
부모가 **진짜 갈리는(cross-parent)** 저빈도 라벨만:
- **공원**(1) — life(여가) ↔ society(공공장소)
- **공동주택**(1) — life(주거) ↔ society(주거제도)
- **보행**(1) — life(건강) ↔ society(교통안전)
- **환기**(1) — life ↔ environment
- **서비스**(1) — society ↔ economy(서비스 품질) — GPT-5.5 권고로 큐 이동
→ 합 ~5행. 백필 시 이 라벨은 코드 미부여(NULL + review_flag), 나중에 배정.
> (소비→economy/consumption, 자세→life/posture로 자동 배정 — 부모 내부 모호라 큐 불필요, GPT-5.5 R3/R4.)

## 4. 51번 + 무주제
- 51번 90건은 주제 라벨 없음(장르 코드만) → `topic_category_code = NULL`. 미분류로 강제하지 않음.
- 표·queue 어디에도 없는 라벨 → review queue.

## 5. 백필 결과 예측 (시드 466 기준)
- 자동 배정(high/med): 약 **371행**(직접 291 + tail 약 80).
- review queue: 약 **5행**(§3).
- NULL(51 무주제): **90행**.
- 합 = 371 + 5 + 90 = **466** ✓.
- (live 470은 행별 도출이라 +4 자동 처리. **표·큐에 없는 새 라벨 → review queue**, 절대 NULL로 조용히 떨구지 않음.)

## 6. C3 연결
C3 저작기는 admin 한글 8부모 라벨 → 이 표의 부모/자식 코드로 변환해 write. `미분류/NULL` 쓰기 가능 여부는 C3에서 결정(이 명세는 읽기/백필 기준).

## 7. GPT-5.5 검수
**PASS-WITH-FIXES.** 커버리지(45 distinct + 무라벨) 독립 검증·합계 일관(371+5+90=466) 확인. 반영 6건:
①"46"→"45+무라벨" ②옛 `ELSE uncategorized` 지침 무효화(unknown→큐·Q51→NULL) ③서비스→큐 ④자세→life/posture ⑤소비→economy/consumption ⑥C-TAX 마이그/RPC 테스트 고정(unknown→큐·Q51 무라벨→NULL·새 write는 active leaf만).
**미해결 P0/P1 0 → 게이트 통과.** 적용(테이블·시드·백필·FK)은 C-TAX(DB 게이트).
