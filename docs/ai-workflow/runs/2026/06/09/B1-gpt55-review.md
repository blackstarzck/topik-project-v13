# B1 GPT-5.5 리뷰 기록 (차단 게이트) — 2026-06-09

> 입력 `b1review.txt`(영문 ASCII) · gpt-5.5(read-only, 양 저장소 대조) · 대상 `B1-plan.md`

## 판정: **PASS-WITH-FIXES**
근거 검증됨: 9코드 map은 topik-ai `supabase-assessment-question-bank-service.ts:80-97`, admin enum 8+미분류(`assessment-question-bank-schema.ts:54-62`), 마이그 컬럼 nullable·CHECK 없음(`20260608120300:28-35`). 시드 subject_domain 결측 90(=466-376)·직접매칭 수치 일치. DB1.1(9코드 고정) sound, culture 0행이어도 유지 타당. 폴드 전반 허용(원칙 명시 조건). 사용자 화면 영향 없음(런타임 미사용). CHECK가 실 서버 가드(RPC가 raw patch 수용).

## 지적 → 반영 (5건)
| # | 지적 | 반영 |
|---|---|---|
| R1 | 시드에 **공백 포함 라벨**(디지털 생활/생활 과학/동물 행동/집안 안전) 실재 → CASE exact match면 누락 | §4: 백필 전 **trim+공백 정규화**(공백 유무 alias 모두 매칭) |
| R2 | unmapped는 **deterministic `ELSE 'uncategorized'`** 필요(NULL로 남기지 말 것) | §4 마이그 수용기준에 ELSE uncategorized 필수 |
| R3 | 백필 **scope=`domain='writing'`** 명시(CHECK는 table-wide nullable이라 non-writing NULL 통과) | §4 scope 명시 |
| R4 | **버킷팅 원칙** 문장 필요 | §3에 원칙 추가 |
| R5 | C3가 같은 매핑을 write에 재사용 + **미분류 writable 여부** 결정 | §3 C3 연결 + 신규 owner 질문(DB1.5) |

## PASS 조건
미해결 P0/P1 0(R1~R5 반영) · refutation 0 → owner 승인 단계로 진행.
