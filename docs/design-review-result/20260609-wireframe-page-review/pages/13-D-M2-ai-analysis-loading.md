# 13-D-M2 AI 분석 로딩 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: D-M2 / (host: 쓰기 제출 → 피드백 전환)
- **audience**: user
- **캡처 상태**: **DEFERRED (transient)** — mock 피드백이 1초 미만에 완료되어 live 캡처 불가. 컴포넌트 소스 + SOT 기반 평가
- **host**: 제출 직후 전환 로딩(`AnalysisLoadingModal` / `FeedbackPendingPanel`)

## 2. 캡처 증거 / DEFERRED 사유
- 실시간 캡처 실패: dev는 `generateMockFeedback`로 분석이 즉시 완료 → "pending/analyzing" 상태가 sub-second라 화면으로 잡기 어려움. (Tier-3 flow 테스트는 제출→피드백 전환을 통과하나 로딩 단계는 단언하지 않음)
- 평가 근거: `src/components/feedback/AnalysisLoadingModal.tsx`(소스) + SOT description.

## 3. Layer 1 — SOT 정합 리뷰 (소스 기준)

| 항목 | 요소/상태 | 판정(소스) | 근거 |
| --- | --- | --- | --- |
| 배경 답안 화면(#1) | 읽기 전용 + dim, 뒤로가기 시 중단 경고 | 일치 | `handleCancel` → `window.confirm(cancelConfirm)` (분석 중단 경고) |
| AI 분석 캐릭터(#2) | 핵심 루프 1개, 모션 비활성 시 정적 | 일치 | `AnalysisCharacter` + `useReducedMotion`(prefers-reduced-motion 존중) → 정적 처리 |
| 분석 진행 단계(#3) | 4개 이하, 현재 단계 강조, 예상 시간 | 일치 | `Steps` 4단계(문법→구성→표현→점수 산출), 1.6s 자동 전진(마지막서 멈춤) |
| 상태/안내(#4) | 60자/2줄, 10초+ 지연 시 갱신, 실패 시 고객지원 | 일치 | `autoMoveNote` + 10초 후 `slow` 경고(재시도 시점 안내) + `failed` 시 오류+고객지원(stub)+재시도 |

**종합 verdict: 일치 (소스 기준) + live UNVERIFIED** — 모든 영역이 명세대로 구현. 단 transient라 실화면 미검증.

## 4. Layer 2 — 멀티 에이전트 독립 분석 (소스 기준)

- **상태 커버리지 (우수, 소스)**: pending/analyzing(단계 진행) / complete(성공+자동 이동) / failed(오류+고객지원+재시도) 3분기 모두 처리. 주석상 **"가짜 성공을 만들지 않는다(failed면 정직하게 실패 표시)"** — 정직한 seam(좋음).
- **접근성 (우수, 소스)**: `prefers-reduced-motion` 존중(시스템 설정 + explicit prop), 모션 비활성 시 마지막 단계 정적 고정 → 애니메이션 민감 사용자 배려.
- **UX/IA (양호, 소스)**: 10초 이상 지연 시 "재시도 가능 시점" 안내로 무한 대기 불안 완화. 중단(뒤로가기) 시 confirm.
- **콘텐츠/i18n (양호)**: 단계/메시지 모두 i18n 카탈로그(`feedback.analysis.*`).
- **반응형/비주얼**: 중앙 정렬 카드(max 480) — 실측 불가(UNVERIFIED-LIVE).
- **적대적 검증**: "transient라 미검증"은 mock 특성으로 확정(빈 비판 아님). 소스 구현 품질은 높음(과소평가 금지). live 실측만 미달.

## 5. 결론 — 개선안

### P0 / P1
- 없음 (소스 구현이 명세에 충실하고 정직한 실패 처리 포함).

### 검증 보강 (P2)
- **느린 분석 경로 실측**: 실제 LLM 워커(외부 leg) 연동 또는 분석 지연을 인위적으로 발생시켜 단계 진행·10초 지연 안내·실패/재시도 UI를 실화면으로 한 번 확인. (현재 mock 즉시 완료로 transient)

> 참고: live 캡처 불가로 소스+SOT 기준 평가. 코드 미수정.
