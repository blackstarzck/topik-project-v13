# A2 적대검수 기록 (Claude 새-맥락 에이전트, 임시 게이트) — 2026-06-09

> codex(GPT-5.5) 토큰 만료 → owner 승인으로 **임시 Claude 적대검수**로 대체(같은 계열이라 독립성 낮음, codex 복구 시 GPT-5.5 재검수 권장). 새 맥락 에이전트가 실소스 정독 + ~4,100조합 퍼징.

## 판정: **PASS-WITH-FIXES** · P0(크래시) **0건**
- "이미 방어적, 크래시 경로 없음" 주장 **참**으로 확인. `prompt`는 `text not null`(20260520120200:21)이라 matchAll/split 안전, jsonb는 전부 asRecord/asString/asStringList/Array.isArray 가드. 퍼징 0 throw.

## 반영할 지적
| # | 지적 | 반영 |
|---|---|---|
| P1-1 | 적대 테스트 세트 부족 | chart_a 배열·answer_key 배열·answer_key[label] 비문자열·review.validation 비배열·blanks position 이상 + **실제 52 오탐 안 됨 락** 추가 |
| P1-2 | 배열 rubric 분기 = `getRubricCandidate`가 배열을 버리므로 **그 앞 early `Array.isArray` 분기** 필요. 그리고 criteria만 채우면 **52가 conditions 비어 오탐 차단** → **conditions·criteria 둘 다** 채움. "admin scoringCriteria와 일치" 근거는 이 repo에서 검증 불가(가정으로 표기) | normalizeRubric 최상단 배열 분기, 둘 다 채움 |
| P1-3 | q51(빈칸0)·q53(차트0+과제0) 제출 차단 안 됨(52/54만) — 못 푸는 문제 방치 | **q51 빈칸0·q53 차트0&과제0 → problem_data_incomplete 차단** 추가(사용자 영향=보고서 명시·되돌리기 쉬움) |
| P2-1 | 모양 계약이 코드 read 표면 과소 기술 | 계약에 prompt_text 폴백·context_notes/source_context·scenario focus·answer_key/blank 하위필드 포함 |
| P2-2 | **차트는 top-level `materials.chart_a/chart_b`도 허용**(시드가 실제로 top-level 사용) | 계약에 nested+top-level 둘 다 명시 |
| P2-3 | "prompt=string" 불변식 기록 | 계약에 불변식 명시(+선택적 방어 coercion) |

## (D) 글자수 가드
sound. 53 "200~300"·54 "600~700" = recommendedMin/Max 일치 확인. 기존 51 테스트 GREEN.

## 결론
크래시 위험 없음 → A2는 right-sized(테스트+문서+소보강). P1-1/2/3 반영 시 클린 PASS. 임시 퍼징 파일 전부 삭제됨.
