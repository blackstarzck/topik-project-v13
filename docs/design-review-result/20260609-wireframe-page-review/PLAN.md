# 와이어프레임 기준 전체 페이지 리뷰 — 계획안 (2026-06-09)

> 상태: **승인 대기 (DRAFT)**. 이 문서가 승인되기 전에는 캡처·시드·DB 쓰기·리뷰
> 산출물 작성을 시작하지 않습니다. 현재까지 DB에 쓴 것은 없습니다(현황 점검은
> 읽기 전용, 인증 프로브는 화면 이동만 수행).

---

## 0. 한 줄 요약

`docs/Wireframe/`(SOT, 기준 문서·이미지)를 기준으로 **사용자 화면 35개**를 실제
브라우저로 띄워 캡처하고, **두 개의 독립 레이어**(① SOT 정합 리뷰 ② 멀티 에이전트
독립 분석)로 평가한 뒤, 두 레이어를 합쳐 **우선순위가 매겨진 개선안**을 페이지별로
남깁니다. **개발/구현(제품 코드 변경)은 하지 않습니다.**

---

## 1. 범위 (Scope)

### 1.1 대상 — 사용자 화면 35개

`docs/sitemap.md`의 Target React Route Map 기준. (39개 IA 중 admin 4개 제외 = 35개)

### 1.2 제외 — admin 4개 화면

- **H-01 관리자 문제 관리, X-08 기관 관리자, X-10 사용자 관리, X-15 관리자 인덱스**
- 근거: 사용자 결정(2026-06-09) "v13은 관리 '대상'이므로 admin 화면은 리뷰 제외".
  또한 `CLAUDE.md`·`AGENTS.md`·`docs/admin-scope-boundary.md`가 admin을 **동결된
  별도 영역**으로 못박음.
- 처리: 리뷰 인덱스에 "관리 대상 / 범위 밖(별도 admin 앱 소관)"으로만 표기.

### 1.3 이번 작업에서 확정된 결정 (사용자 답변 반영)

| # | 결정 | 내용 |
| --- | --- | --- |
| D1 | admin 해석 | **B안** — admin 화면 리뷰 제외, 사용자 35개만. (A안=권한 승격 캡처는 폐기) |
| D2 | admin 문서 정리 | **이번 리뷰와 분리** — 동결 문구를 실제로 고치지 않고, "충돌 문서 목록 + 변경 제안서"만 산출. 실제 수정은 별도 승인 후. |
| D3 | 시드 데이터 | dev DB 임시 시드 허용. 단, 가능한 한 **실제 앱 흐름 구동**으로 생성하고, 부족분만 최소 시드 + teardown 제공. |
| D4 | e2e 깊이 | **C안 승인** — 화면 검증(캡처) + 화면별 Playwright 검증 스펙 신규 작성 + 핵심 사용자 플로우 시나리오 e2e. → `tests/e2e/`에 한해 **테스트 코드 작성을 "구현 금지"의 예외로 명시 승인**(제품 코드 `src/`는 여전히 변경 안 함). |

### 1.4 비범위 (Out of scope)

- 제품 코드(`src/`) 변경, 스키마/마이그레이션 변경(DDL), antd 테마 토큰 변경.
  (단, **`tests/e2e/` 테스트 코드는 D4로 예외 승인** — 검증용으로 신규 작성 가능.)
- admin 화면 리뷰, admin 경계 규칙 문서의 실제 수정(제안서까지만).
- 실제 결제/AI 연동(현재 dev는 mock 피드백) 변경.
- 발견된 화면 문제의 **실제 수정(리팩터/버그픽스)** — 리뷰는 개선안 제안까지만.

---

## 2. 산출물 (Deliverables)

위치: `docs/design-review-result/20260609-wireframe-page-review/`

```
20260609-wireframe-page-review/
├── PLAN.md                         ← (이 문서)
├── README.md                       ← 인덱스: 35개 표 + 스코어카드 + 방법론 + 캡처 헬스 + 한계/정직성
├── pages/
│   ├── 01-A-01-sign-up.md          ← 페이지별 리뷰 35개
│   ├── 02-A-02-login.md
│   │   ... (35개)
│   └── 39-X-17-auth-callback-fragment.md
└── admin-boundary-conflict-proposal.md   ← (D2) 충돌 문서 목록 + 변경 제안서. 실제 수정 없음.
```

추가로 **e2e 테스트 코드**(D4)는 `tests/e2e/` 아래에 둡니다(리뷰 산출물과 별개,
재실행 가능한 회귀 자산):

```
tests/e2e/
├── _setup/auth.setup.ts            ← 로그인→storageState 생성(만료 해결). 다른 프로젝트가 의존.
├── screens/*.spec.ts               ← Tier 2: 화면별 검증(로드/하이드레이션/콘솔에러/핵심요소), 3 뷰포트 자동
└── flows/core-writing-flow.spec.ts ← Tier 3: 로그인→대시보드→문제→작성→제출→피드백→리포트→보관함→PDF 시나리오
```
(`playwright.config.ts`에 setup 프로젝트 + 의존 + storageState 배선을 최소 추가 — D4 승인 범위.)

캡처 증거(이미지)는 **gitignore된** `.design-review-shots/20260609/`에 저장하고
리뷰 문서에서 상대경로로 참조합니다. (인증 화면은 테스트 사용자 데이터·PII를 담을 수
있어 커밋 금지 — `.gitignore`에 이미 `screenshots/`, `.design-review-shots/` 포함.)

### 2.1 페이지별 리뷰 문서 공통 구조

각 `pages/<NN>-<IA>-<slug>.md`는 동일 템플릿:

1. **메타** — IA 코드, 라우트, audience(public/user), 캡처 상태(rendered / partial /
   deferred / UNVERIFIED), 호스트(모달인 경우).
2. **캡처 증거** — 뷰포트별 스크린샷 경로(360/768/1280) + 렌더 헬스(HTTP 상태,
   콘솔 에러 수, 하이드레이션 여부, 에러 오버레이 유무).
3. **Layer 1 — SOT 정합 리뷰** — `wireframe.png`/`hifi.png` + `description.md` +
   `functional-spec.md` + (있으면) `screen-data-summary.md` + `docs/share/...` 대비.
   요소·상태·문구·데이터계약의 **있음/없음/벗어남**을 표로.
4. **Layer 2 — 멀티 에이전트 독립 분석** — 차원별 발견(아래 3.2) + 심각도.
5. **결론 — 개선안** — 두 레이어를 합친 우선순위 개선안 (P0=지금 당장 / P1=이번 주
   안에 / P2=여유 있을 때). 각 항목에 근거(어느 레이어/어느 증거)·영향 범위 표기.

---

## 3. 방법론 — 2레이어 리뷰

### 3.1 Layer 1 — SOT(docs/Wireframe) 정합 리뷰

"화면이 기준 문서/와이어프레임대로 만들어졌는가"를 봅니다.

- **입력(기준)**: 각 화면 폴더의 `wireframe.png`(저화질 배치), `hifi.png`(고화질
  목업), `description.md`, `functional-spec.md`, `screen-data-summary.md`,
  그리고 `docs/Wireframe/functional-spec-index.md`·`data-usage-index.md`,
  `docs/flow/user-flow.md`, `docs/share/database-structure-by-page.md`.
- **비교 대상**: 내가 직접 캡처한 실제 화면 스크린샷.
- **평가 항목**: ① 주요 UI 영역 존재 여부 ② 버튼/CTA·네비게이션 ③ 상태(로딩/빈/
  에러/성공/비활성) ④ 문구·라벨(i18n) ⑤ 데이터 계약(읽는 필드/표시값) ⑥ 흐름 연결.
- **판정**: 일치 / 부분일치 / 불일치 / 문서에 없음(코드가 앞섬) / 캡처 불가(UNVERIFIED).

### 3.2 Layer 2 — 멀티 에이전트 독립 분석

SOT와 별개로, 캡처된 화면 자체를 **독립적인 전문 관점**으로 평가합니다(사용자가 요청한
"별도 멀티 에이전트들의 분석"). 차원:

| 차원 | 보는 것 |
| --- | --- |
| UX / IA | 정보 위계, 흐름, 클릭 경로, 인지 부하, 빈 상태 안내 |
| 비주얼 / 디자인 시스템 | antd 컴포넌트·토큰 일관성, 간격/정렬, 타이포, 시각적 슬롭 |
| 접근성(a11y) | 대비, 포커스, 키보드, 라벨/aria, 터치 타깃 |
| 반응형 | 360/768/1280 레이아웃 붕괴·오버플로·잘림 |
| 콘텐츠 / i18n | 문구 명확성, 한글 카피, 미번역·하드코딩 잔여 |
| 상태 커버리지 | 로딩/빈/에러/성공/비활성 5상태 실제 노출 |
| 데이터 계약 | 표시 데이터가 스키마/문서와 의미 일치하는가 |

- **오케스트레이션**: `Workflow`(멀티 에이전트)로 페이지별 파이프라인 — 캡처 증거 입력 →
  Layer1 리뷰 → Layer2 다관점 분석(병렬) → 종합·문서화. (사용자가 멀티 에이전트
  분석을 명시 요청 → 오케스트레이션 opt-in 충족.)
- **적대적 교차검증**: 높은 심각도 발견은 별도 에이전트가 "이 지적이 실제로 맞는가"를
  반증 시도. (메모리 교훈: 자기 산출물 자체 평가는 confirmation bias.) 거짓/과장
  발견은 제거하거나 강도 하향.

### 3.3 종합 — 개선안 도출

- 두 레이어 발견을 페이지별로 합치고 중복 제거 → P0/P1/P2 우선순위.
- 각 개선안은 **제안만**(코드 수정 없음). "무엇을·왜·영향 범위"를 비개발자도 이해할
  수 있게 서술(`docs/user-communication-style.md`).

---

## 4. 캡처 전략 (브라우저 직접 접근)

### 4.1 환경

- **dev 서버 재사용**: 이미 `localhost:3000` 가동 중(HTTP 200). Next 16 단일 dev
  잠금 → 새로 띄우지 않고 재사용. (메모리: 동시 build 금지·127 cross-origin 등 함정 반영)
- **오리진 규칙**: public 화면 → `http://localhost:3000`, 인증 화면 →
  `http://127.0.0.1:3000`(storageState 쿠키 도메인·`allowedDevOrigins` 일치, 하이드레이션 보장).
- **캡처 도구**: 기존 `scripts/design-review/read-only render-shot.mjs`(networkidle +
  settle + 콘솔에러/하이드레이션 헬스 기록). 3 뷰포트 360/768/1280, fullPage.

### 4.2 인증 (만료된 세션 갱신)

- `tests/e2e/auth-state/student.json`은 **2026-06-08 만료** 확정(`/dashboard`가
  `/login`으로 307). → Playwright 로그인으로 재생성.
- 테스트 계정: `student@audit.local` / 비밀번호는 `.env.local`의
  `SUPABASE_TEST_PASSWORD`(스크립트가 직접 읽음, **출력·커밋 금지**).
- 권한은 learner. admin 승격 안 함(D1=B안).

### 4.3 dev DB 현황 (읽기 전용 점검 결과, 2026-06-09)

| 항목 | 현황 |
| --- | --- |
| writing 문제(published) | q51:91, q52:1, q53:47, q54:82 → 쓰기 화면 4종 실제 콘텐츠 렌더 가능 |
| 학생 제출 | **5건(q51/52/53/54 + q51 재시도), 피드백 모두 complete** → E-01/E-02 즉시 캡처 가능 |
| 비교 리포트 | **0건** → R-01용 1건 시드 필요 |
| 라이브러리 항목 | **0건** → F-01/F-M1용 소량 시드 필요 |

### 4.4 시드 전략 (최소·실제흐름 우선·teardown 제공)

- **원칙**: 원시 INSERT보다 **앱의 실제 흐름**을 브라우저로 구동(스키마/제약/트리거를
  앱이 보장, 증거도 더 충실). dev 피드백은 `generateMockFeedback`로 생성되므로
  외부 AI 없이도 흐름이 완결됨.
- **리포트(R-01)**: 피드백 페이지의 "비교 리포트" 버튼 1회 클릭 →
  `create_comparison_report_with_metrics` RPC가 올바른 형태로 생성 → 그 reportId로
  `/writing/reports/<id>/compare` 캡처.
- **라이브러리(F-01/F-M1)**: 피드백 페이지 "보관함 저장" 1~2회 → `library_items` 생성
  → `/library` 캡처 → 라이브러리에서 "PDF로 내보내기" 모달 캡처.
- **teardown**: 새로 만든 리포트/라이브러리 row의 id를 기록하고, 캡처 종료 후 삭제하는
  스크립트를 함께 제공(기존 5개 제출/피드백 시드는 보존 — 내가 만든 것 아님).
- **가드**: `SUPABASE_ENV_LABEL`이 prod면 거부. 서비스롤 키 미출력·미커밋.
- **스키마 게이트 영향 없음**: 데이터 row 시드는 스키마 구조 변경이 아니므로
  CLAUDE.md의 Supabase Schema Documentation Gate 대상 아님.

### 4.5 모달/동적 상태 캡처 (인터랙션, best-effort)

| IA | 모달/상태 | 호스트 | 트리거 | 난이도 |
| --- | --- | --- | --- | --- |
| C-03 | 다시 풀기 모달 | /practice/problems | 기존 시도 문제 선택 | 중 |
| D-M1 | 제출 확인 모달 | 쓰기 화면 | 답안 입력 후 제출 클릭 → 모달 캡처 → 취소 | 중 |
| D-M2 | AI 분석 로딩 | 쓰기 제출 흐름 | 제출 확정 직후 전환 로딩(transient) | 높음(짧음) |
| D-M3 | 자동저장 경고 | 쓰기 화면 | 자동저장 실패/충돌 상태 강제 | 높음 |
| F-M1 | PDF 내보내기 모달 | /library | 항목 선택 후 내보내기 클릭 | 중 |

- 각 모달은 **개별 try/catch**로 격리 — 하나 실패해도 나머지 진행. 트리거 불가 상태는
  정직하게 `deferred` 또는 `UNVERIFIED-LIVE`로 표기하고, 컴포넌트 소스 + SOT로만 평가.

### 4.6 캡처 신뢰성 가드 (메모리 교훈 반영)

- 헤드리스 캡처가 실제 하이드레이션 화면과 다를 수 있음 → 각 샷마다 ① HTTP 상태
  ② 콘솔/페이지 에러 ③ body 텍스트 길이 ④ 에러 오버레이 ⑤ /login 리다이렉트 여부를
  기록. 하이드레이션 미확인 샷은 **PASS/FAIL 단정 금지 → UNVERIFIED**로.
- dev 서버 열화 방지: 캡처는 **직렬**(병렬 브라우저 자제), 긴 run은 분할.

---

## 5. 화면 × 라우트 × 캡처 계획 매트릭스 (35)

origin: P=localhost(public), A=127.0.0.1(authed). 방법: shot=render-shot, act=인터랙션.

| # | IA | 화면 | 라우트 | origin | 방법 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| 23 | X-01 | 제품 랜딩 | `/` | P | shot | |
| 35 | X-13 | 이용약관 | `/terms` | P | shot | |
| 36 | X-14 | 개인정보처리방침 | `/privacy` | P | shot | |
| 01 | A-01 | 회원가입 | `/sign-up` | P | shot | |
| 02 | A-02 | 로그인 | `/login` | P | shot | reason 변형 1개 추가 |
| 28 | X-06 | 비밀번호 재설정 | `/password-reset` | P | shot | |
| 38 | X-16 | 새 비밀번호 설정 | `/password-reset/confirm` | P | shot | 토큰 없는 기본 상태 |
| 33 | X-11 | 인증 에러 | `/auth/error?reason=otp_expired` | P | shot | rate-limit 변형 1개 추가 |
| 34 | X-12 | 인증 메일 확인 | `/auth/verify-email` | P | shot | |
| 39 | X-17 | 콜백 fragment | `/auth/callback-fragment` | P | shot | transient fallback, best-effort |
| 03 | A-03 | 학습 목표 설정 | `/onboarding/learning-goal` | A | shot | |
| 04 | B-01 | 홈 대시보드 | `/dashboard` | A | shot | |
| 05 | C-01 | 문제 유형 추천 | `/practice/recommendations` | A | shot | |
| 06 | C-02 | 문제 목록 | `/practice/problems` | A | shot | |
| 07 | C-03 | 다시 풀기 모달 | (host C-02) | A | act | |
| 08 | D-01 | 51 단답 작성 | `/writing/short-answer-writing-51` | A | shot | |
| 09 | D-02 | 52 답안 작성 | `/writing/answer-writing-52` | A | shot | |
| 10 | D-03 | 53 장문 작성 | `/writing/long-form-writing-53` | A | shot | |
| 11 | D-04 | 54 에세이 작성 | `/writing/essay-writing-54` | A | shot | |
| 12 | D-M1 | 제출 확인 모달 | (host 쓰기) | A | act | |
| 13 | D-M2 | AI 분석 로딩 | (host 쓰기 제출) | A | act | transient, best-effort |
| 22 | D-M3 | 자동저장 경고 | (host 쓰기) | A | act | best-effort |
| 14 | E-01 | 단답 피드백 | `/writing/feedback/short/<id>` | A | shot | 기존 제출 ...051 |
| 15 | E-02 | 장문 피드백 | `/writing/feedback/long/<id>` | A | shot | 기존 제출 ...053 |
| 16 | R-01 | 비교 리포트 | `/writing/reports/<id>/compare` | A | shot | 리포트 1건 시드 |
| 17 | R-02 | 다음 문제 추천 | `/practice/next` | A | shot | |
| 18 | F-01 | 내 서재 | `/library` | A | shot | library_items 시드 |
| 19 | F-M1 | PDF 내보내기 모달 | (host /library) | A | act | |
| 20 | G-01 | 언어 설정 | `/settings/language` | A | shot | |
| 24 | X-02 | 성장 대시보드 | `/growth` | A | shot | |
| 25 | X-03 | 페이월 | `/paywall` | A | shot | |
| 26 | X-04 | 구독 관리 | `/subscription` | A | shot | |
| 27 | X-05 | 프로필 편집 | `/profile` | A | shot | |
| 29 | X-07 | 약점 기반 추천 | `/practice/weakness` | A | shot | |
| 31 | X-09 | 알림 설정 | `/settings/notifications` | A | shot | |

(SOT 이미지 보유: `wireframe.png` 32개·`hifi.png` 29개. 이미지 없는 화면 — 대부분
33~39 코드기반 추가분 — 은 `description.md`/`functional-spec.md` 텍스트로만 Layer 1 평가.)

---

## 6. 단계별 실행 체크리스트

- [ ] **Phase 0 — 준비**: 인증 갱신(`_setup/auth.setup.ts`로 storageState 생성), 캡처
      매트릭스 확정, 증거 폴더 생성.
- [ ] **Phase 1 — 캡처(Tier 1 화면검증)**: ① 페이지 shot(35 라우트 × 3 뷰포트, 직렬)
      ② 리포트·라이브러리 최소 시드(실제 흐름) ③ 모달 5종 인터랙션 ④ 샷별 헬스 JSON
      기록 → 화면별 PASS/FAIL/UNVERIFIED.
- [ ] **Phase 1e — e2e 스펙 작성·실행(Tier 2·3, D4)**: `tests/e2e/screens/*` 화면별
      검증 스펙 + `tests/e2e/flows/core-writing-flow.spec.ts` 시나리오 + config 배선 →
      `pnpm test:e2e` 실행, 결과 정직 보고.
- [ ] **Phase 2/3 — 2레이어 리뷰(Workflow)**: 페이지별 Layer1(SOT) + Layer2(다관점 병렬)
      + 적대적 교차검증.
- [ ] **Phase 4 — 산출물**: `pages/*` 35개 + `README.md` 인덱스/스코어카드 +
      `admin-boundary-conflict-proposal.md`.
- [ ] **Phase 5 — 검증·정리·보고**: 캡처 헬스 + e2e 결과 요약, 시드 teardown 실행,
      한계·UNVERIFIED 정직 보고.

---

## 7. 리스크 & 완화 (메모리 교훈 반영)

| 리스크 | 완화 |
| --- | --- |
| 헤드리스 캡처 ≠ 실제 하이드레이션 | 샷별 헬스 신호 + UNVERIFIED 라벨, 의심 시 실브라우저 spot-check |
| dev 서버 열화로 후반 타임아웃 | 직렬 캡처·run 분할·기존 dev 재사용 |
| 모달/transient 상태 트리거 실패 | 개별 try/catch, 실패 시 deferred 정직 표기 |
| GitBash가 `/route` 경로 변형 | 캡처 env 주입은 **PowerShell**로 |
| 시드가 dev DB에 잔존 | id 기록 + teardown 스크립트, 내가 만든 것만 삭제 |
| 비밀키/PII 노출 | 키 미출력·미커밋, 증거 이미지 gitignore 유지 |
| 자기평가 confirmation bias | Layer2 적대적 교차검증, 거짓 발견 제거 |
| admin 경계 규칙과 충돌 | admin 리뷰 제외(D1=B), 문서 수정은 제안서까지만(D2) |

---

## 8. 검증 기준 — 화면 검증(e2e) 3계층 (D4 = C안)

화면 검증을 **이 작업의 1급 단계**로 둡니다. 세 계층으로 중첩 검증합니다.

### Tier 1 — 화면 검증 캡처 패스 (전 35화면)
- 35 라우트 × 3 뷰포트 실브라우저 네비게이션. 화면별 판정 기준:
  HTTP 200(또는 **의도된** 리다이렉트) + 콘솔/페이지 에러 0 + 하이드레이션 확인
  (핵심 client 요소 노출) + 에러 오버레이 없음.
- 미충족 시 완료로 보지 않고 **UNVERIFIED**로 표기(메모리: 헤드리스≠실화면).

### Tier 2 — 화면별 Playwright 검증 스펙 (`tests/e2e/screens/*.spec.ts`, 신규)
- 각 화면: 라우트 로드(상태/리다이렉트 의도대로), 하이드레이션(핵심 요소 `toBeVisible`),
  콘솔/page 에러 0, 핵심 랜드마크(heading·주요 CTA) 존재 assert.
- `playwright.config.ts`의 3 뷰포트 프로젝트로 **반응형 자동 검증**. authed 화면은
  setup 프로젝트가 만든 storageState 사용.

### Tier 3 — 핵심 사용자 플로우 시나리오 (`tests/e2e/flows/core-writing-flow.spec.ts`, 신규)
- 로그인 → `/dashboard` → 문제 선택(`/practice/*`) → 쓰기 51 입력 → 제출(D-M1) →
  분석 로딩(D-M2) → 피드백(E-01) → 비교 리포트(R-01) → 보관함 저장 → `/library`(F-01)
  → PDF 내보내기 모달(F-M1). 단계별 assert로 흐름이 끊기지 않는지 검증.

### 실행 / 보고
- `pnpm test:e2e`로 Tier 2·3 실행. **통과/실패/스킵 수와 실패 상세를 정직 보고**.
  실패 시 사유·재현 명령·잔여 위험 명시. 실행 불가도 그대로 보고.
- 부트 응답 재확인은 기존 스모크 스크립트로 병행 가능.
- 산출물은 근거(스크린샷·테스트 결과·문서 출처) 없는 "완료/문제 없음" 단정 금지(workslop 방지).

---

## 9. 별도 처리 — admin 경계 제안서 (D2)

`admin-boundary-conflict-proposal.md`에 다음만 정리(실제 파일 수정 없음):

- "v13이 관리 대상이 되게 admin 동결 영역을 정리"하려면 **고쳐야 할 문서·라인 목록**:
  `CLAUDE.md`(Scope Boundary 절), `AGENTS.md`(비협상 규칙·필수 문서 지도),
  `docs/admin-scope-boundary.md`, `docs/Wireframe/README.md`(admin 주석),
  `docs/sitemap.md`(admin 라우트/ audience) 등.
- 변경 방향 제안 + 영향/리스크 + 권장 순서. **승인 후 별도 작업**으로 진행.

---

## 10. Docs consulted

- `docs/Wireframe/README.md`, 각 화면 폴더 `description.md`/`functional-spec.md`/
  `screen-data-summary.md`/`wireframe.png`/`hifi.png`
- `docs/sitemap.md`(라우트 권위), `docs/flow/user-flow.md`
- `docs/Wireframe/functional-spec-index.md`, `docs/Wireframe/data-usage-index.md`
- `docs/share/database-structure-by-page.md`, `docs/admin-scope-boundary.md`
- `CLAUDE.md`, `AGENTS.md`, `docs/design-review-result/DESIGN-WORKFLOWS-RUNBOOK.md`
- 코드: `src/components/auth/LoginForm.tsx`, `src/lib/writing/server.ts`·
  `server-actions.ts`·`mutations.ts`, `src/components/feedback/*`,
  `src/app/(workspace)/library/page.tsx`, `src/lib/library/mutations.ts`
- 도구: `scripts/design-review/render-shot.mjs`, `playwright.config.ts`

---

## 부록 A. 가정 (Assumptions)

- 캡처는 dev 환경 + mock 피드백 기준. 실제 운영 데이터/실 AI 출력과는 다를 수 있음.
- `student.json` 갱신은 learner 권한. 권한 분기(공유 보기전용 등) 일부 상태는 미캡처.
- 시드는 "임시"로 간주하고 teardown 제공. 기존 5개 제출/피드백 시드는 보존.
