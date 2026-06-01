# Coverage Audit Fix Proposals — Opus 4.7 1차 + Codex 5.5 검증

> **Status**: rev2 — 13/13 합의 완료 (8 AGREE / 3 PROPOSE-BETTER 수용 / 2 ESCALATE 사용자 결정 완료)
>
> **사용자 결정 (2026-05-23)**: Decision 1 = A안 (이메일+비번 + 매직링크 + 표준 재설정), Decision 2 = A안 (LongFormEditor 신설)
>
> **Date**: 2026-05-23 09:00 KST
>
> **Author (1차)**: Claude Code (Opus 4.7, 1M context)
>
> **Reviewer (round 1)**: Codex GPT 5.5 (codex-cli 0.128.0, exec mode)
>
> **Decision delegate (사용자 결정 위임)**: Codex GPT 5.5 (별도 호출, 본 round 후 분기 사항 한정)

본 문서는 Implementation Coverage Audit (2026-05-23) 결과의 P0 5건 + P1 8건 = 13건에 대해 "어떻게 고칠지" Opus 1차 제안과 Codex 검증을 거친 합의를 정리한다.

각 항목 구조:
- **무엇을 고치나** (현 상태 한 줄)
- **Opus 선호 안 + 근거**
- **대안 옵션** (선택지)
- **Trade-off**
- **사용자 결정 필요?** (YES → decision-delegate 위임, NO → Opus/Codex 합의로 종료)
- **Codex 리뷰** (round 1 응답 — 본 문서 작성 후 채워짐)
- **최종 합의** (또는 사용자 결정 후 채워짐)

---

## P0-1 · 인증 UI 4개 통째로 (X-01, A-01, A-02, X-06)

**무엇을 고치나**: 4 public 라우트 모두 placeholder. 사용자가 가입/로그인 자체 불가능. 골든 패스 0단계.

### Opus 선호 안 (A안): 이메일+비번 기본 + 매직링크 옵션 + 비밀번호 재설정 표준 흐름

- **A-01 (sign-up)**:
  - Ant Design `Form` + `Input` + `Input.Password` + `Button` 표준 구성
  - 필드: email, password, password confirm, display_name (optional), terms checkbox
  - Submit → `supabase.auth.signUp({ email, password, options: { emailRedirectTo: '/onboarding/learning-goal' } })`
  - 이메일 확인 안내 화면 (resend 버튼 포함)
- **A-02 (login)**:
  - 이메일+비번 form + "비밀번호 잊으셨나요?" 링크 + "매직링크로 로그인" 토글
  - 매직링크 모드: `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/dashboard' } })`
- **X-06 (password-reset)**:
  - email 입력 form → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/password-reset/confirm' })`
  - 별도 confirm page에서 새 비번 입력 → `supabase.auth.updateUser({ password })`
- **X-01 (landing)**:
  - 히어로 카피 + "지금 가입하기" CTA + "로그인" 보조 CTA + 기능 3카드 (학습 대시보드 / 글쓰기 AI 피드백 / 자료실) + 푸터
  - 마케팅 자료 최소화 — MVP는 학습 도구가 본질

**근거**:
- 가장 표준적이고 사용자에게 익숙
- Supabase Auth가 이메일+비번 + 매직링크 둘 다 표준 지원 → 추가 인프라 불필요
- 비밀번호 재설정은 시험 학습자 대상 (TOPIK 응시자)에게 비번 잊기 잦으므로 필수
- Phase 2 light-spec에서 약속한 흐름과 일치

### 대안

- **B안**: 매직링크만 (비번 없음) — 가장 단순. 단 이메일 전송 인프라(SES/Resend 등) 필요. Tier 2 OOS-9와 충돌.
- **C안**: 이메일+비번만 (매직링크 X) — 가장 빠른 구현. 단 매직링크 옵션이 UX에서 추세.
- **D안**: 소셜 로그인 (Google/Kakao) 우선 — 한국 시장에선 카카오 로그인 영향력 큼. 단 별도 OAuth 설정 + 정책 복잡도.

### Trade-off

| 안 | 구현 | UX | 인프라 | 한국 시장 fit |
| --- | --- | --- | --- | --- |
| A 권장 | 2-3일 | 표준 | Supabase 기본 (이메일 전송은 dev에서 자동) | OK |
| B 매직링크만 | 1일 | 신선 | SMTP 의존 (OOS-9) | OK |
| C 비번만 | 1-2일 | 표준 | 없음 | OK |
| D 소셜 | 3-5일 | 한국 fit | OAuth + 정책 | 가장 fit |

### 사용자 결정 필요? **YES**

가입 방식(A/B/C/D)은 product 결정. Opus 추천은 A이지만 사용자 시장 판단(D 카카오 우선?)이 필요.

### Codex 리뷰 (round 1)

**ESCALATE-TO-USER** — "Opus marked YES correctly: auth method is product/ops choice, though Supabase Auth is fixed."

### Codex Decision-Delegate (2026-05-23)

권장: A안. 이유: IA가 이메일/비밀번호 + 매직링크 + 소셜 분기를 모두 요구. MVP에서 가장 안전. Supabase Auth 기본 흐름 가장 많이 재사용. 조심: B(매직링크만) 고르면 Tier 2 SMTP 인프라를 Phase 7로 끌고 옴.

### 최종 합의 — 사용자 결정 2026-05-23

**A안 채택** (사용자 + Codex 권장 일치):
- **A-01 sign-up**: Ant Design Form + email/password/confirm/display_name/terms. Submit → `supabase.auth.signUp` + emailRedirectTo='/onboarding/learning-goal'. 이메일 확인 안내 화면 + resend 버튼.
- **A-02 login**: 이메일+비번 form + "비밀번호 잊으셨나요?" 링크 + "매직링크로 로그인" 토글 (`signInWithOtp`).
- **X-06 password-reset**: email 입력 → `resetPasswordForEmail` + redirectTo='/password-reset/confirm'. confirm page에서 새 비번 입력 → `updateUser({ password })`.
- **X-01 landing**: 히어로 + "지금 가입하기" CTA + 보조 "로그인" + 기능 3카드 + 푸터. 마케팅 자료 최소.

작업량: 2-3일.

---

## P0-2 · 글쓰기 51~54 max char 미적용

**무엇을 고치나**: WritingEditor가 MIN_CHARS만 enforce, max 없음. 51(120), 52(160), 53(300), 54(700) 모두 초과 제출 가능.

### Opus 선호 안: questionNo별 maxChars 분기

```ts
// src/lib/writing/types.ts 또는 별도 constants
export const CHAR_LIMITS = {
  51: { min: 10, max: 120 },
  52: { min: 10, max: 160 },
  53: { min: 200, max: 300 },
  54: { min: 600, max: 700 },
} as const;
```

```tsx
// WritingEditor
const limit = CHAR_LIMITS[questionNo];
<Input.TextArea
  maxLength={limit.max}
  showCount={{ formatter: ({ count, maxLength }) =>
    `${count}/${maxLength}자 (최소 ${limit.min}자)` }}
/>
```

- Submit 버튼 disabled 조건: `count < limit.min || count > limit.max`
- 초과 입력 자체를 막음 + 시각적 카운터

**근거**: TOPIK 시험의 핵심 rubric. 본 학습 도구가 시험 환경을 재현해야 하는데 char limit 미적용은 본질 결함.

### 대안

- **soft warn 안**: max 초과해도 제출은 가능, 경고만 — 사용자 자유도 우선. 단 시험 학습 도구 본질과 어긋남.
- **hard block 안 (Opus 선호)**: max 초과 시 입력 자체 막힘 — 시험 재현.

### Trade-off

| 안 | 시험 fit | UX | 구현 |
| --- | --- | --- | --- |
| Hard (권장) | 완벽 | 약간 엄격 | 0.5일 |
| Soft | 70% | 자유 | 0.5일 |

### 사용자 결정 필요? **NO** (Opus + Codex 합의로 진행 가능)

학습 도구 목적이 명확하면 hard block이 합리적. Codex가 다른 안을 제안하면 토론.

### Codex 리뷰 (round 1)

**PROPOSE-BETTER** — "Opus is right to hard-block max, but its `min` values would over-block 53/54 below IA's true minimum."

Codex 권고: `hardMin/hardMax/recommendedMin/recommendedMax` 분리:
- 51: hard 10-120
- 52: hard 10-160
- 53: hard **120-300**, recommended **200-300**
- 54: hard **300-700**, recommended **600-700**

근거: `docs/Wireframe/08~11/description.md` (각 IA가 "분석 가능한 최소"와 "권장 최소"를 구분)

### 최종 합의 (rev1)

**Opus 동의** — Codex 권고 채택. WritingEditor 구현 수정:

```ts
export const CHAR_LIMITS = {
  51: { hardMin: 10, hardMax: 120, recommendedMin: 10, recommendedMax: 120 },
  52: { hardMin: 10, hardMax: 160, recommendedMin: 10, recommendedMax: 160 },
  53: { hardMin: 120, hardMax: 300, recommendedMin: 200, recommendedMax: 300 },
  54: { hardMin: 300, hardMax: 700, recommendedMin: 600, recommendedMax: 700 },
} as const;
```

```tsx
<Input.TextArea maxLength={limit.hardMax} showCount={{
  formatter: ({ count, maxLength }) => {
    const inRecommended = count >= limit.recommendedMin && count <= limit.recommendedMax;
    return `${count}/${maxLength}자 ${inRecommended ? '✓ 권장' : `(권장: ${limit.recommendedMin}-${limit.recommendedMax})`}`;
  },
}} />
// Submit 활성 조건: count >= limit.hardMin && count <= limit.hardMax
// 시각 경고: count >= hardMin but < recommendedMin → "분석 가능하나 권장 미만"
```

작업량: 0.5-1일.

---

## P0-3 · 글쓰기 53번 도입/전개/마무리 탭 + 원고지 UI 없음

**무엇을 고치나**: 53번은 도표 분석 장문 글쓰기. IA spec은 (a) 도표/그래프 자료 표시, (b) 도입/전개/마무리 3-탭 작성, (c) 원고지 미리보기/수정 요구. 현재는 단일 textarea.

### Opus 선호 안: LongFormEditor 컴포넌트 신설 + question_no별 분기

```tsx
// src/components/writing/LongFormEditor.tsx (new)
type Props = { questionNo: 53 | 54; ... };

export function LongFormEditor({ questionNo, ... }) {
  // 53번: 도입/전개/마무리 탭
  // 54번: (P0-4의) 체크리스트 + textarea
  if (questionNo === 53) {
    return (
      <Tabs items={[
        { label: '도입', children: <SectionEditor section='intro' ... /> },
        { label: '전개', children: <SectionEditor section='body' ... /> },
        { label: '마무리', children: <SectionEditor section='conclusion' ... /> },
      ]} />
      <ManuscriptPreview text={combinedText} />
    );
  }
  ...
}
```

- WritingEditor (51/52)와 LongFormEditor (53/54) 분리
- WritingPageContent에서 `isShortAnswer(questionNo) ? <WritingEditor> : <LongFormEditor>`
- 도표 자료는 problem.materials.chart JSON에서 렌더 (이미 problems 스키마에 jsonb materials 컬럼 있음)
- ManuscriptPreview는 200자 × N줄 원고지 layout (CSS grid)
- answer_text를 단일 문자열로 저장하되, sectioned input은 client-only state로 보존 후 combine (서버 스키마 변경 X)

**근거**: 53번은 TOPIK II 글쓰기 최고난도(평가 비중 큼). spec과 실제 시험 환경을 재현해야 학습 도구가 가치 있음.

### 대안

- **B안**: 별도 컴포넌트 안 만들고 WritingEditor 내부에서 questionNo === 53 분기 — 한 파일 비대화. 유지보수 어려움.
- **C안**: 탭/원고지는 별도 Phase 7+ 다음 단계로 분리, 일단 max char만 — 최소 출시 가능하지만 53번 spec 미달이 그대로 남음.

### Trade-off

| 안 | spec fit | 구현 | 컴포넌트 크기 |
| --- | --- | --- | --- |
| A LongFormEditor (권장) | 완벽 | 3-5일 | 새 파일 ~300 lines |
| B WritingEditor 분기 | 완벽 | 2-3일 | WritingEditor 비대화 |
| C 미루기 | 부분 | 0일 | (Phase 7+에 미룸) |

### 사용자 결정 필요? **YES**

53번 spec을 다 채울지 (A or B), 일단 부분만 갈지 (C). product 우선순위 결정.

### Codex 리뷰 (round 1)

**ESCALATE-TO-USER** — "Opus marked YES correctly only for 'full now vs defer'; A vs B implementation shape should be delegated after user confirms scope."

### Codex Decision-Delegate (2026-05-23)

권장: A안. 이유: 53번은 51/52와 성격이 다름. 별도 컴포넌트로 빼야 54번 장문 확장까지 덜 꼬임. 조심: C(다음 phase로 미룸)는 "0일"이라 좋아 보이지만 핵심 학습 화면 30%짜리 출시.

### 최종 합의 — 사용자 결정 2026-05-23

**A안 채택** (사용자 + Codex 권장 일치): LongFormEditor 컴포넌트 신설 + 3 탭(도입/전개/마무리) + 원고지 미리보기 + 도표 자료 영역. WritingEditor (51/52)와 LongFormEditor (53/54) 분리. 작업량: 3-5일.

---

## P0-4 · 글쓰기 54번 essay 체크리스트 6항목 없음

**무엇을 고치나**: 54번은 600-700자 essay. IA spec은 우측에 6항목 체크리스트 (서론/본론/결론/근거/연결어/주제 일치) 요구. 코드에는 없음.

### Opus 선호 안: EssayChecklist 컴포넌트 + LongFormEditor에 통합

```tsx
// src/components/writing/EssayChecklist.tsx (new)
const CHECKLIST_ITEMS = [
  { key: 'intro', label: '서론 — 주제 소개 + 자기 입장' },
  { key: 'body', label: '본론 — 근거 + 사례' },
  { key: 'conclusion', label: '결론 — 본인 입장 재정리' },
  { key: 'evidence', label: '근거 — 통계/사례/경험' },
  { key: 'connectors', label: '연결어 — 그러나/따라서/또한 등' },
  { key: 'topic_fit', label: '주제 일치 — 출제 의도와 맞는지' },
];

export function EssayChecklist({ checked, onChange }) {
  return (
    <Card title="작성 체크리스트">
      {CHECKLIST_ITEMS.map(item => (
        <Checkbox checked={checked[item.key]} onChange={...}>{item.label}</Checkbox>
      ))}
    </Card>
  );
}
```

- LongFormEditor가 questionNo === 54일 때 우측 영역에 EssayChecklist 렌더
- 체크 상태는 client-only (DB 저장 안 함 — student 작성 가이드일 뿐)
- 모든 체크박스 표시되어야 제출 버튼 활성? → 아니, 강제하지 말고 visual cue만 (학습 보조)

**근거**: 54번 essay는 구조가 채점 핵심. 체크리스트가 학생의 self-check 도구.

### 대안

- **B안**: 체크리스트 대신 placeholder 텍스트 ("서론 / 본론 / 결론을 포함하세요") — 시각 가이드 약함
- **C안**: AI가 자동 체크 (LLM 호출해 채점 미리보기) — Tier 2 OOS-1 의존, 본 phase 안 됨

### Trade-off

| 안 | spec fit | 구현 |
| --- | --- | --- |
| A Checklist (권장) | 완벽 | 1-2일 |
| B placeholder | 50% | 0.5일 |
| C AI 자동 체크 | 100%+ | OOS |

### 사용자 결정 필요? **NO** (Opus + Codex 합의 가능)

A안이 단순하고 spec과 정확히 일치.

### Codex 리뷰 (round 1)

**PROPOSE-BETTER** — "A checklist is correct, but boolean checkboxes miss the IA-required item state model."

Codex 권고: per-item status를 `complete / warning / unchecked` 3-state로. 단순 boolean 안 됨.

근거: `docs/Wireframe/11-D-04-essay-writing-54/description.md:50`

### 최종 합의 (rev1)

**Opus 동의** — Codex 권고 채택:

```tsx
type ChecklistItemStatus = 'complete' | 'warning' | 'unchecked';

const CHECKLIST_ITEMS = [
  { key: 'intro', label: '서론 — 주제 소개 + 자기 입장' },
  { key: 'body', label: '본론 — 근거 + 사례' },
  { key: 'conclusion', label: '결론 — 본인 입장 재정리' },
  { key: 'evidence', label: '근거 — 통계/사례/경험' },
  { key: 'connectors', label: '연결어 — 그러나/따라서/또한 등' },
  { key: 'topic_fit', label: '주제 일치 — 출제 의도와 맞는지' },
];

export function EssayChecklist({ status, onChange }: { status: Record<string, ChecklistItemStatus>; ... }) {
  return (
    <Card title="작성 체크리스트">
      {CHECKLIST_ITEMS.map(item => (
        <ChecklistRow
          item={item}
          status={status[item.key] ?? 'unchecked'}
          onChange={(next) => onChange(item.key, next)}
        />
      ))}
    </Card>
  );
}

// ChecklistRow: 3-state segmented control (Ant Design Segmented or 3-icon button group)
// unchecked → ⚪ "아직 안 함"
// warning → 🟡 "부분 작성" (사용자 self-judgment)
// complete → 🟢 "완료"
```

학습자가 self-evaluation할 수 있어 spec에 더 부합.

작업량: 1-2일.

---

## P1-0 · supabase env https-only (Codex post-audit downgrade from P0-5)

**무엇을 고치나**: `src/lib/supabase/env.ts:7`의 zod refine이 `value.startsWith("https://")`만 허용. 로컬 Supabase(http://127.0.0.1:54321) 연결 불가능.

### Opus 선호 안: NODE_ENV 분기

```ts
.refine(
  (value) => {
    if (value.startsWith("https://")) return true;
    if (process.env.NODE_ENV === "development") {
      return value.startsWith("http://127.0.0.1") ||
             value.startsWith("http://localhost");
    }
    return false;
  },
  { message: "NEXT_PUBLIC_SUPABASE_URL must use https (or http://127.0.0.1 in development)" }
)
```

**근거**: production에선 https 강제 유지 (보안), development에선 로컬 supabase 허용. 30분 작업.

### 대안

- **B안**: 별도 env 변수 (`SUPABASE_ALLOW_INSECURE=1`) — 더 explicit하지만 추가 환경 변수
- **C안**: refine 자체를 NODE_ENV로 swap — 가장 단순

### Trade-off

| 안 | 명확성 | 보안 | 구현 |
| --- | --- | --- | --- |
| A NODE_ENV 분기 (권장) | 좋음 | production 보호 | 30분 |
| B 별도 env | 매우 명확 | production 보호 | 1시간 + docs 갱신 |
| C swap | 단순 | production 보호 | 20분 |

### 사용자 결정 필요? **NO**

A안이 표준.

### Codex 리뷰 (round 1)

**AGREE** — "NODE_ENV-gated localhost HTTP preserves production HTTPS while unblocking local Supabase."

### 최종 합의

A안 채택. 30분 작업.

---

## P1-1 · C-03 Retry Modal orphan

**무엇을 고치나**: `RetryModal.tsx`는 완성, but `ProblemRow`/`ProblemListView`에서 import + state wiring 없음.

### Opus 선호 안: ProblemListView에 state + ProblemRow에 onClick

```tsx
// src/components/practice/ProblemListView.tsx
const [retryTarget, setRetryTarget] = useState<Problem | null>(null);

<ProblemRow
  problem={p}
  onRetryClick={() => setRetryTarget(p)}
/>

<RetryModal
  open={retryTarget !== null}
  problem={retryTarget}
  onClose={() => setRetryTarget(null)}
/>
```

- ProblemRow에 onRetryClick prop 추가 (이미 풀어본 문제만 표시)
- 시간: 반나절

**근거**: 가장 직접적인 wiring. RetryModal API가 깨끗하면 trivially.

### 대안

- **B안**: ProblemRow에 retry 버튼 대신 row 클릭 시 modal — UX 약간 차이
- **C안**: 별도 route `/practice/problems/[id]/retry` — modal보단 page. SPA flow 깨짐.

### Trade-off

A안이 spec 부합 + 가장 단순.

### 사용자 결정 필요? **NO**

### Codex 리뷰 (round 1)

**AGREE** — "Wiring existing RetryModal through ProblemListView is the smallest durable fix for the orphan modal."

### 최종 합의

A안 채택. 반나절.

---

## P1-2 · R-02 NextProblemView ~25%만 구현

**무엇을 고치나**: spec은 (a) 성과 요약 카드 행 (b) 3 대안 카드 행 (c) 단일 다음 문제 카드 셋. 현재는 (c)만.

### Opus 선호 안: 컴포넌트 분리 + RPC 확장

- `SummaryCardRow.tsx` (new) — 최근 풀이 N건, 점수 추이, 약점 dimension 3개
- `AlternativeCardsGrid.tsx` (new) — 3 alternative problem 추천
- `getNextProblem` RPC를 `getNextProblemBundle`로 확장 — {primary, summary, alternatives[3]} 반환
- `NextProblemView` 재배치

**근거**: spec과 정확히 일치. 1일 작업.

### 대안

- **B안**: summary는 dashboard로 위임, R-02는 primary + alternatives만 — IA가 R-02를 다른 화면으로 정의했으므로 부합 X

### 사용자 결정 필요? **NO**

### Codex 리뷰 (round 1)

**AGREE** — "Summary cards plus three alternatives match R-02's missing IA areas without pulling in Tier 2."

### 최종 합의

A안 채택. 1일.

---

## P1-3 · X-07 WeaknessView 4 dimension tabs + diagnostic card 없음

**무엇을 고치나**: spec은 (a) 4 dimension Tabs (문법/어휘/구성/주제적합성) (b) diagnostic card (주요 약점 + 근거 + 분석 일자). 현재는 progress bar만.

### Opus 선호 안: Tabs + DiagnosticCard

- `DimensionTabs.tsx` (new) — Ant Design Tabs 4개. 각 tab은 해당 dimension의 progress + 최근 점수 추이 + 관련 문제 목록 (`/practice/problems?dimension=grammar` 링크)
- `DiagnosticCard.tsx` (new) — feedback_dimension_scores 기반 가장 weakness_level 높은 dimension + AI 코멘트 + 마지막 갱신일

**근거**: spec 완전 일치. 1-1.5일.

### 대안

- **B안**: 6 dimensions 모두 노출 (스키마는 6개 — grammar/vocab/structure/content/expression/topic_fit). spec은 4개라 그대로 따름.

### 사용자 결정 필요? **NO**

### Codex 리뷰 (round 1)

**AGREE** — "Four tabs plus diagnostic card directly cover the audited X-07 gaps and can use existing dimension-score data."

### 최종 합의

A안 채택. 1-1.5일.

---

## P1-4 · D-M2 AI Analysis Loading spec 시각화

**무엇을 고치나**: spec은 캐릭터/단계 진행/메시지. 현재 `FeedbackPendingPanel.tsx`는 `<Spin>` + `<Alert>`만.

### Opus 선호 안: AnalysisLoadingModal + Steps

```tsx
// src/components/feedback/AnalysisLoadingModal.tsx (new)
<Modal open={loading} closable={false}>
  <div className="character"><AnalysisCharacter /></div>
  <Steps current={currentStep} items={[
    { title: '제출 접수' },
    { title: '문법 분석' },
    { title: '구조 분석' },
    { title: '점수 산출' },
  ]} />
  <p>{currentMessage}</p>
</Modal>
```

- LLM 분석은 Tier 2 OOS-1이므로 캐릭터/단계는 시뮬레이션 (300ms 마다 다음 step) — fixture 환경
- 실제 LLM이 들어오면 SSE/polling으로 진짜 진행 상태 push 가능

**근거**: spec 일치 + 사용자 wait 경험 개선

### 대안

- **B안**: Spin + 상세 메시지만 (캐릭터 없음) — 간단
- **C안**: 완전 spec 구현 + 실제 LLM 진행 push — Tier 2 OOS-1 풀린 후

### Trade-off

A안이 LLM OOS 상태에서 가능한 최선.

### 사용자 결정 필요? **NO**

### Codex 리뷰 (round 1)

**AGREE** — "Fixture/timer-based steps satisfy the loading UI spec while avoiding real LLM progress, which stays OOS."

### 최종 합의

A안 채택. 반나절~1일.

---

## P1-5 · D-M3 Autosave Warning Modal 없음

**무엇을 고치나**: `AutosaveBadge.tsx`는 Tag 배지만. autosave가 실패해도 사용자에게 데이터 소실 위험 알림 없음.

### Opus 선호 안: AutosaveWarningModal + status='error' trigger

```tsx
// src/components/writing/AutosaveWarningModal.tsx (new)
<Modal
  open={autosaveStatus === 'error'}
  title="⚠ 자동 저장 실패"
  closable={false}
  footer={[
    <Button onClick={onRetry}>다시 시도</Button>,
    <Button onClick={onDismiss}>닫기 (위험)</Button>,
  ]}
>
  <p>마지막 저장: {lastSavedAt} ({elapsed} 전)</p>
  <p>현재 작성 중인 답안이 저장되지 않을 수 있습니다. 다시 시도하거나, 답안을 복사해두는 것을 권장합니다.</p>
</Modal>
```

- WritingEditor의 autosave mutation `onError`에서 status='error' set
- Modal은 status가 error일 때만 open
- 사용자가 닫기 누르면 다시 안 뜸 (저장 성공할 때까지 silent — 또는 1분 후 재경고)

**근거**: 데이터 소실 보호는 핵심 UX. 반나절.

### 사용자 결정 필요? **NO**

### Codex 리뷰 (round 1)

**PROPOSE-BETTER** — "Error-only modal is too narrow because D-M3 covers autosave disabled, save failure, and exit/loss risk."

Codex 권고: trigger를 3 가지로 확장:
1. `autosaveStatus === 'failed'`
2. 사용자가 autosave 비활성화 시도
3. 더티/실패 draft 상태로 페이지 이탈 시

Actions: keep autosave / retry+save now / proceed-with-risk 3가지.

근거: `docs/Wireframe/22-D-M3-autosave-warning/description.md:12, 13, 61, 73`

### 최종 합의 (rev1)

**Opus 동의** — Codex 권고 채택. 트리거 3개 + 액션 3개 구조:

```tsx
// Trigger union
type WarningTrigger = 'save_failure' | 'disable_attempt' | 'exit_with_dirty';

<AutosaveWarningModal
  trigger={trigger}
  onKeepAutosave={() => ...}
  onRetryNow={() => ...}
  onProceedWithRisk={() => ...}
/>

// 트리거별 메시지:
// 'save_failure': "마지막 저장: {lastSavedAt} ({elapsed} 전). 현재 답안이 저장되지 않을 수 있습니다."
// 'disable_attempt': "자동 저장을 끄면 작성 중인 답안이 새로 고침 시 사라질 수 있습니다."
// 'exit_with_dirty': "저장되지 않은 변경 사항이 있습니다. 페이지를 나가면 작성 내용이 사라집니다."

// 액션: 모든 트리거에 3가지 모두 제공 (적절하지 않은 액션은 disabled)
```

또 hook for exit detection: `useBeforeUnload` 또는 Next.js router events. 작업량: 1일.

---

## P1-6 · X-05 Profile 다수 필드 누락 (Codex FN-3 expand)

**무엇을 고치나**: spec은 (a) bio 160자 (b) 목표 시험 정보 (c) 상태/도움 카드 모두 요구. 코드는 display_name/nickname만.

### Opus 선호 안: profiles 스키마 확장 + ProfileForm 재구성

- 마이그레이션:
  ```sql
  alter table public.profiles
    add column if not exists bio text check (char_length(bio) <= 160),
    add column if not exists exam_info jsonb;  -- {target_level, target_grade, exam_date} mirroring learning_goals
  ```
  단 exam_info는 이미 learning_goals와 중복 가능 → exam_info 안 만들고 learning_goals 조회로 대체
- `ProfileForm`:
  - 기본 정보 카드 (display_name, nickname, bio textarea — 160자 maxLength)
  - 목표 시험 카드 (learning_goals 데이터 표시 + "변경하기" 링크 → /onboarding/learning-goal)
  - 상태/도움 카드 (계정 상태, 가입일, 도움말 링크, 회원 탈퇴 CTA)

**근거**: spec 일치 + DB 중복 없음.

### 대안

- **B안**: bio만 추가, 목표 시험/상태 카드는 다음 phase — minimal
- **C안**: 모두 추가 — spec 완전 일치

### Trade-off

| 안 | spec fit | 구현 | 마이그레이션 |
| --- | --- | --- | --- |
| A (권장) | 100% | 1-2일 | bio 컬럼만 |
| B | 30% | 0.5일 | bio |
| C | 100% | 1-2일 | bio (exam_info는 learning_goals 재사용) |

A=C 본질적으로 같음. 권장 동일.

### 사용자 결정 필요? **NO**

### Codex 리뷰 (round 1)

**AGREE** — "Bio should be durable schema, while target exam info should reuse learning_goals, avoiding duplicated profile state."

### 최종 합의

A안 채택 (bio만 새 컬럼, exam info는 learning_goals 재사용). 1-2일.

---

## P1-7 · B-01 대시보드 최근 피드백 + 알림 누락 (Codex FN-1)

**무엇을 고치나**: IA spec은 KPI + 추천 + 시험일 + 최근 피드백 + 알림. 현재는 KPI + 추천 1개 + 시험일.

### Opus 선호 안: DashboardContent에 RecentFeedbackCard + AlertsCard 추가

- `RecentFeedbackCard.tsx` (new) — writing_feedback table에서 최근 3건 (제목 + 점수 + 날짜 + 상세 링크)
- `AlertsCard.tsx` (new) — 시험까지 D-day 카운트다운 + 새 추천 알림 + 미완 답안 (writing_drafts.autosave_status='dirty' 1개)
- DashboardContent에 두 컴포넌트 추가 (2-column grid 또는 1-column)

**근거**: spec 일치 + 데이터 이미 DB에 있음 (추가 쿼리만).

### 대안

- **B안**: RecentFeedbackCard만 (알림 카드는 Tier 2 알림 transport 풀린 후) — partial

### 사용자 결정 필요? **NO**

A 추천 (알림은 transport 없이도 in-app banner 가능).

### Codex 리뷰 (round 1)

**AGREE** — "Recent feedback plus in-app alerts cover B-01 without notification transport, so it stays Tier 1."

### 최종 합의

A안 채택. 1일.

---

## P1-8 · C-02 문제 리스트 필터 누락 (Codex FN-2)

**무엇을 고치나**: spec은 4 필터 (번호, 난이도, 추천 여부, 풀이 상태). 코드는 (번호, 난이도, 검색, 정렬)만 — 추천/풀이 상태 누락.

### Opus 선호 안: ProblemListControls 확장 + getProblems RPC 확장

- `ProblemListControls.tsx`:
  - 기존: questionType / difficulty / search / sort
  - 추가: **추천 toggle** (recommendation_items.status='active'와 join), **풀이 상태 Select** (전체 / 안 풀음 / 풀었음 / 부분 풀이 — writing_submissions 또는 problem_attempts와 join)
- `listAdminProblems`와 별도로 `listUserProblems` RPC 확장 (user-facing 한정)

**근거**: spec 일치 + UX 핵심.

### 사용자 결정 필요? **NO**

### Codex 리뷰 (round 1)

**AGREE** — "Recommendation and solve-status filters are exactly the missing C-02 controls and should be durable user-facing query state."

### 최종 합의

A안 채택. 0.5-1일.

---

## 사용자 결정 항목 요약 (decision-delegate 위임 후보)

13건 중 사용자 결정이 필요한 항목 2개:

1. **P0-1 인증 UI**: A안(이메일+비번 + 매직링크) / B안(매직링크만) / C안(비번만) / D안(소셜 카카오 우선) 중 어느 것?
2. **P0-3 53번 글쓰기 UI**: A안(LongFormEditor 신설 spec 완전 구현) / B안(WritingEditor 분기) / C안(다음 phase로 미룸) 중 어느 것?

나머지 11건은 Opus + Codex 합의로 진행 가능 예정.

---

## 변경 로그

- 2026-05-23 09:00 KST: Opus 1차 작성
- (예정) 2026-05-23 09:30 KST: Codex round 1 review
- (예정) 2026-05-23 10:00 KST: 사용자 결정 위임 → 결과 통합
