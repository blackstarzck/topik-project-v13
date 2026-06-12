# TALKPIK AI 브라우저 중심 QA 실행 계획안

| 항목 | 내용 |
| --- | --- |
| 버전 | rev6 (2026-06-12) |
| 상태 | 확정 — QA 실행 시 이 문서를 따른다 |
| 보고서 저장 위치 | `docs/qa/reports/qa-report-YYYYMMDD-HHMM.html` |
| 증거(스크린샷) 위치 | `docs/qa/reports/qa-report-YYYYMMDD-HHMM-evidence/` |
| 라우트 단일 출처 | [`src/lib/routes.ts`](../../src/lib/routes.ts) |

## 요약

- QA 기본 실행 방식은 **AI가 Playwright와 in-app browser로 실제 화면을 열고
  클릭/입력/전환/스크린샷을 검증하는 방식**으로 한다.
- 자동 테스트는 필수 게이트다. 최종 판정은 "테스트 통과 + 브라우저 직접 조작
  증거 + HTML 보고서"를 함께 본다.
- **증거 판정 규칙: 하이드레이션(클라이언트 코드 실행)이 증명되지 않은 캡처는
  PASS/FAIL 판정 금지, UNVERIFIED로 기록한다. UNVERIFIED는 통과로 집계하지
  않는다.**
- 방법론: ISTQB risk-based testing, Test Pyramid, Agile Testing Quadrants,
  Exploratory Testing, Playwright Trace Viewer, OWASP WSTG, WCAG 2.2,
  Nielsen 10 usability heuristics(휴리스틱 평가).
- 프로젝트 기준: [`docs/spec.md`](../spec.md), [`docs/sitemap.md`](../sitemap.md),
  [`docs/flow/user-flow.md`](../flow/user-flow.md),
  [`docs/Wireframe/README.md`](../Wireframe/README.md),
  [`TESTING.md`](../../TESTING.md).
  **화면별 검증 기준은 각 와이어프레임 폴더의 `description.md`다**
  (실행 단계 3의 매핑 표 참조).

## rev2–rev6에서 보완된 핵심

이 11가지는 실제 저장소 대조와 과거 사고 이력에서 나온 보완이다. 실행 시 생략
금지.

1. **순서 고정**: 자동화 게이트(빌드 포함) 전부 → 서버 기동 → 브라우저 QA.
   dev 서버가 살아있을 때 `pnpm build` 실행 금지(`.next` 오염 → 가짜 500 사고
   이력).
2. **prod 빌드 기본**: 긴 Playwright 실행은 dev 서버를 열화시켜 가짜 타임아웃을
   만든 이력이 있다. e2e와 대량 캡처는 `pnpm build && pnpm start` 기준으로 한다.
3. **UNVERIFIED 규칙**: 헤드리스 캡처가 실화면과 달라 거짓 결함을 보고한 사고
   (2026-06-05)의 재발 방지. 하이드레이션 증명 전에는 판정하지 않는다.
4. **라우트 목록은 `src/lib/routes.ts` 기준**: 문서 간 라우트 표기가 어긋나면
   routes.ts가 이긴다.
5. **trace 미커밋**: `test-results/`와 `tests/e2e/auth-state/`는 gitignore
   대상(인증 토큰 포함). 보고서에는 스크린샷만 복사하고 trace는 로컬 경로만
   기록한다.
6. **Docker 의존 테스트는 skip 전제**: 이 환경에는 Docker/Supabase CLI가 없어
   `pnpm test:supabase:local`은 실행 불가가 기본이다. 환경 제약이지 결함이
   아니다.
7. **화면별 와이어프레임 대조 (rev3 추가)**: 각 화면은
   `docs/Wireframe/<화면 폴더>/description.md`의 영역(Number Map)·제약 조건·
   예외 상태를 기준으로 검증한다. 스모크(뜨는지)만 보고 통과 판정하지 않는다.
8. **UX/사용성 휴리스틱 평가 (rev4 추가)**: 정합·결함 검증과 별개로 "쓰기
   편한가"를 Nielsen 휴리스틱 체크리스트로 본다. 단, 주관 판정 통제 —
   발견 항목은 휴리스틱 번호+증거 스크린샷+개선 제안 세트로만 기록하고,
   근거 없는 "느낌상 불편" 판정은 금지(거짓 보고 사고 재발 방지).
9. **분야별 사용자 시나리오 (rev4 추가)**: 시나리오는 한 줄 요약이 아니라
   **상황(누가·어떤 상태) + 진입 경로(어디서 어떻게) + 기대 결과** 세트로
   정의한다. 직접 URL 진입은 스모크 용도일 뿐이고, 시나리오는 반드시 실제
   사용자 경로로 수행한다 (직접 진입과 실사용 경로가 다르게 동작한 전례).
10. **시나리오 3층 출처 모델 (rev5 추가)**: 기대 결과의 출처를
    **[SPEC] 문서 정의 / [CODE] 코드 구현 확인 / [STD] 표준 사용성(프로젝트가
    미처 고려 못 한 흐름)** 으로 라벨링한다. 어느 층에도 기대 동작이 정의되어
    있지 않으면 결함이 아니라 **스펙 갭(UNDEFINED)**으로 기록하고 문서 게이트로
    에스컬레이션한다 — QA가 제품 동작을 임의로 발명하지 않는다. 코드베이스
    심층 조사 3건(2026-06-12, 쓰기 라이프사이클/데이터 상태/인증·전역)으로
    스펙 갭 10건을 선식별했다(단계 4-C).
11. **기능 단위 실행 상태 검증 (rev6 추가)**: 여정 시나리오와 별개로, 각
    화면 `functional-spec.md`의 "주요 기능" 목록을 인벤토리로 삼아 **기능마다
    시작 전→시작→실행 중→성공/실패 5단계의 인터랙션 관리**(클릭 방지, 진행
    표시, 입력 보존, 잠금 해제)를 검증한다(단계 4-D). 서비스 전역으로는 상태
    관리 5원칙(피드백 없는 상태 금지, 중복 실행 잠금, 실패 시 입력 보존,
    갇힘 금지, 패턴 일관성) 위반을 sweep한다.

## 사전 점검 (Preflight)

- `git status --short`, `node --version`, `pnpm --version` 기록 (Node 24 필요 —
  `package.json` engines 기준).
- **포트 3000 점유 프로세스 확인** — 죽지 않은 테스트 서버가 IPv6
  localhost(`::1`)를 점유해 "무한 로딩"을 일으킨 이력이 있다. 유령 프로세스가
  있으면 종료 후 시작한다.
- `.env.local`에 `SUPABASE_TEST_PASSWORD` 등 필요 키가 **활성 라인**으로
  존재하는지 확인한다. 값은 출력 금지. 주석 라인만 보고 "키 없음"으로 단정하지
  않는다.
- 동시 작업 중인 다른 에이전트의 미커밋 변경이 있는지 `git status` 전체를
  확인한다.

## 실행 방식과 순서 (순서 고정)

1. **자동화 게이트 먼저** — 서버를 띄우지 않은 상태에서, 순차 실행:
   lint → typecheck → format → build → test.
2. **그다음 서버 기동** — e2e와 대량 캡처는 `pnpm build && pnpm start`(prod)
   기본. 탐색적 QA는 `pnpm dev` 허용.
3. **브라우저 QA** — Playwright e2e(scripted regression, trace, viewport) +
   in-app browser(탐색적 QA).

규칙:

- **금지: dev 서버가 살아있는 상태에서 `pnpm build` 실행.**
- `pnpm test:e2e`는 서버를 자동 기동하지 않는다(`playwright.config.ts`에
  webServer 설정 없음). 서버 기동 확인 후 실행한다. base URL은
  `E2E_BASE_URL` 또는 기본값 `http://127.0.0.1:3000`.
- viewport는 playwright.config의 3개 프로젝트와 동일:
  mobile `360x720`, tablet `768x1024`, desktop `1280x800`.
- 실패 시 Playwright trace, screenshot, `test-results/failure-log.json`을
  증거로 수집한다.

## 역할별 QA 매트릭스

| 담당 영역 | AI가 확인할 것 | 통과 기준 |
| --- | --- | --- |
| 기획 | PRD, sitemap, user-flow, 화면별 wireframe `description.md` 대비 실제 route/flow | 문서와 실제 화면 흐름이 충돌하지 않음 |
| 디자인 | Ant Design 사용, responsive, 상태, 접근성 | overflow/겹침 없음, loading/empty/error/disabled 존재. **판정은 하이드레이션 증명된 캡처에서만** |
| UX/사용성 | 핵심 과업 흐름의 마찰, 상태 가시성, 오류 메시지, 폼 사용성, 터치 타깃, 학습자 언어 | 핵심 과업 완료에 막힘 없음. 발견 항목은 휴리스틱 근거+증거와 함께 기록 |
| 개발 | lint, typecheck, build, unit/integration/e2e, auth/RLS/env | 명령 통과, secret 미노출, protected route guard 정상 |
| QA | end-to-end 사용자 시나리오, 회귀, 결함 등급 | P0/P1 0개, 재현 절차와 증거 기록 |
| 콘텐츠/학습 | TOPIK 51~54 문항 맥락, CTA, 피드백 문구 | 학습자가 다음 행동을 이해할 수 있음 |

## 실행 단계

### 1. 자동화 게이트 (순차 실행)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm format`
- `pnpm build`
- `pnpm test`
- `pnpm test:supabase:local` — Docker + Supabase CLI 필요.
  **이 환경에서는 실행 불가가 기본 전제.** 실행 불가 시 보고서에 skip 사유와
  대체 검증(브라우저 기반 anon 차단 확인 등)을 기록한다.
- 서버 기동 후 `pnpm test:e2e`.
  **베이스라인: 95 통과 / 0 실패 / 2 skip** — 이보다 나빠지면 회귀로 간주한다.

### 2. 브라우저 Smoke (`src/lib/routes.ts` 기준 전체 열거)

public (12):

- `/`, `/sign-up`, `/login`, `/password-reset`, `/password-reset/confirm`,
  `/auth/callback`, `/auth/callback-fragment`, `/auth/error`,
  `/auth/verify-email`, `/terms`, `/privacy`
- `/auth/sign-out`은 **세션을 끊으므로 맨 마지막 또는 별도 브라우저
  컨텍스트에서** 확인한다.

protected (22):

- `/auth/post-auth`, `/auth/consent`, `/onboarding/learning-goal`
- `/dashboard`, `/growth`, `/library`, `/profile`
- `/settings/language`, `/settings/notifications`
- `/practice/recommendations`, `/practice/problems`, `/practice/next`,
  `/practice/weakness`
- `/writing/short-answer-writing-51`, `/writing/answer-writing-52`,
  `/writing/long-form-writing-53`, `/writing/essay-writing-54`
- `/writing/feedback/short/:id`, `/writing/feedback/long/:id`,
  `/writing/reports/:id/compare`
- `/subscription`, `/paywall`

규칙:

- feedback/report 라우트는 **실제 제출 id 필요** — 시드가 없으면 해당 화면은
  UNVERIFIED + Deferred 사유를 기록한다 (R-01 compare 전례 있음).
- `/growth`는 무료 플랜이면 잠금이 **정상 동작** — 테스트 계정의 플랜 상태를
  먼저 확인하고 기대 결과를 분기한다. 잠김 자체를 결함으로 판정하지 않는다.
- 비로그인 protected 접근 → `/login` redirect 확인.
- **직접 URL 진입 결과가 막혀 보이면 정상 사용 흐름으로 재진입해 교차 확인**한
  뒤에만 결함으로 판정한다 (기본 선택 로직 때문에 직접 진입과 실사용 흐름이
  다를 수 있음).

### 3. 화면별 와이어프레임 대조 (description.md 기준)

각 화면을 검증하기 전에 해당 와이어프레임 폴더의 `description.md`를 먼저 읽고,
문서에 적힌 내용이 실제 화면에 있는지 대조한다. 필요 시 `functional-spec.md`,
`screen-data-summary.md`(있는 폴더만)도 함께 본다.

대조 항목 (description.md 구조 기준):

1. **영역 존재**: Wireframe Number Map의 각 영역이 실제 화면에 있는가
2. **제약 조건(▣ 제약 조건)**: 자동저장 상태 표시, 글자 수 제한, 비율 유지 등
   영역별 제약이 지켜지는가
3. **예외 상태(▣ 예외)**: 로드 실패/빈 데이터/네트워크 오류 시 재시도·대체
   표시가 있는가 (강제 재현이 어려우면 UNVERIFIED + 사유 기록)

규칙:

- 화면 이동 정보가 `description.md`와 충돌하면
  [`docs/flow/user-flow.md`](../flow/user-flow.md)가 우선한다 (Wireframe README
  규칙).
- 모달 화면(C-03, D-M1, D-M2, D-M3, F-M1)은 라우트가 없으므로 단계 4의
  사용자 시나리오에서 트리거해 확인한다.
- 폴더 번호 21·30·32·37은 admin 화면 제거(2026-06-11)로 결번 — 대조 대상이
  아니며, 존재하면 오히려 admin scope 침범(P0) 신호다.
- 와이어프레임이 없는 라우트(`/auth/callback`, `/auth/sign-out`,
  `/auth/post-auth`, `/auth/consent`)는 redirect/동작만 확인한다.

매핑 표 (35화면, [`docs/Wireframe/README.md`](../Wireframe/README.md) 기준):

| IA 코드 | 라우트 / 트리거 | 와이어프레임 폴더 (`docs/Wireframe/`) |
| --- | --- | --- |
| A-01 | `/sign-up` | `01-A-01-sign-up` |
| A-02 | `/login` | `02-A-02-login` |
| A-03 | `/onboarding/learning-goal` | `03-A-03-learning-goal-setup` |
| B-01 | `/dashboard` | `04-B-01-home-dashboard` |
| C-01 | `/practice/recommendations` | `05-C-01-problem-type-recommendations` |
| C-02 | `/practice/problems` | `06-C-02-problem-list` |
| C-03 | 모달 — 문제 목록에서 "다시 풀기" | `07-C-03-retry-modal` |
| D-01 | `/writing/short-answer-writing-51` | `08-D-01-short-answer-writing-51` |
| D-02 | `/writing/answer-writing-52` | `09-D-02-answer-writing-52` |
| D-03 | `/writing/long-form-writing-53` | `10-D-03-long-form-writing-53` |
| D-04 | `/writing/essay-writing-54` | `11-D-04-essay-writing-54` |
| D-M1 | 모달 — 작성 화면에서 제출 | `12-D-M1-submission-confirmation-modal` |
| D-M2 | 모달 — 제출 후 AI 분석 로딩 | `13-D-M2-ai-analysis-loading` |
| D-M3 | 모달 — 작성 중 이탈/자동저장 경고 | `22-D-M3-autosave-warning` |
| E-01 | `/writing/feedback/short/:id` | `14-E-01-short-answer-feedback` |
| E-02 | `/writing/feedback/long/:id` | `15-E-02-long-form-feedback` |
| R-01 | `/writing/reports/:id/compare` | `16-R-01-comparison-report` |
| R-02 | `/practice/next` | `17-R-02-next-problem-recommendation` |
| F-01 | `/library` | `18-F-01-my-library` |
| F-M1 | 모달 — 내 서재에서 PDF 내보내기 | `19-F-M1-pdf-export-modal` |
| G-01 | `/settings/language` | `20-G-01-language-settings` |
| X-01 | `/` | `23-X-01-product-landing` |
| X-02 | `/growth` | `24-X-02-growth-dashboard` |
| X-03 | `/paywall` | `25-X-03-paywall` |
| X-04 | `/subscription` | `26-X-04-subscription-management` |
| X-05 | `/profile` | `27-X-05-profile-editing` |
| X-06 | `/password-reset` | `28-X-06-password-reset` |
| X-07 | `/practice/weakness` | `29-X-07-weakness-based-recommendations` |
| X-09 | `/settings/notifications` | `31-X-09-notification-settings` |
| X-11 | `/auth/error` | `33-X-11-auth-error` |
| X-12 | `/auth/verify-email` | `34-X-12-auth-verify-email` |
| X-13 | `/terms` | `35-X-13-terms` |
| X-14 | `/privacy` | `36-X-14-privacy-policy` |
| X-16 | `/password-reset/confirm` | `38-X-16-password-reset-confirm` |
| X-17 | `/auth/callback-fragment` | `39-X-17-auth-callback-fragment` |

### 4. 테스트 시나리오 카탈로그 (3층 출처 모델)

시나리오는 "어떤 사용자가, 어떤 상황에서, 어떤 경로로 들어왔는지"를 명시하고
**그 경로 그대로 수행**한다. 직접 URL 진입은 단계 2 스모크에서 이미 확인하므로
이 단계에서는 금지 — 직접 진입과 실사용 경로가 다르게 동작한 전례가 있다.
각 시나리오는 ID로 defect log와 연결한다.

기대 결과의 출처 라벨:

- **[SPEC]** — `user-flow.md`/`description.md`가 정의한 동작
- **[CODE]** — 코드 조사로 확인한 구현 동작 (2026-06-12 조사 3건)
- **[STD]** — 표준 사용성 기준 (프로젝트 문서/코드가 미처 고려하지 않은 흐름)
- **[갭검증]** — 기대 동작이 어디에도 정의 안 됨 → 동작을 관찰·기록하고
  스펙 갭으로 보고 (결함 판정 금지, 단계 4-C 참조)

#### 4-A. 분야별 핵심 경로

**인증/공개 (AUTH)**

- **AUTH-S1 첫 방문 가입** — 처음 온 예비 학습자.
  경로: `/`(X-01) → 가입 CTA → `/sign-up`(A-01) → 가입 → 메일 인증
  안내(X-12).
  기대: 입력 검증 인라인 표시. X-12에 가입 이메일 표시 + 재전송 버튼(60초
  cooldown, 새로고침에도 유지) + 웹메일 바로가기. [CODE]
- **AUTH-S2 재방문 로그인 (post-auth 분기)** — 기존 학습자.
  경로: `/login`(A-02) → 로그인 → post-auth.
  기대(결정 트리): 필수 약관 미동의 → `/auth/consent`(동의 전 진행 불가,
  미체크 제출 시 경고 후 같은 화면), 학습 목표 없음 → A-03, 둘 다 충족 →
  `/dashboard`. [CODE+SPEC 일치]
- **AUTH-S3 비밀번호 분실** — 경로: `/login` → 재설정 링크 → X-06 → 메일
  링크 → 새 비밀번호 설정(X-16) → 성공 시 `/login` 복귀.
  기대: X-16은 만료 ~1시간 안내 표시, 만료 후 저장 시도는 실패 알림 + 재발송
  안내. 비밀번호 8–64자 + 강도 미터 + 확인 일치 검증. [CODE]
- **AUTH-S4 세션 만료 복귀** — 세션이 끊긴 채 protected 접근.
  기대: `/login?reason=session_expired`로 이동, 경고 alert 표시. 원래 위치는
  보존되지 않음(현재 구현 — 복귀 경로 부재는 UX 개선 후보 P2로 기록). [CODE]
- **AUTH-S5 Google OAuth** — 경로: `/login`·`/sign-up`의 Google 버튼 →
  `/auth/callback?code=...` → post-auth 분기.
  기대: 실패 시 `/auth/error?reason=코드`(11종 매핑: otp_expired,
  user_not_found, rate limit 카운트다운 등 — user-flow.md 6시나리오 표 기준).
  [CODE+SPEC]
- **AUTH-S6 로그아웃** — 경로: 앱 UI에서 로그아웃 진입점 탐색 → 로그아웃.
  기대: POST `/auth/sign-out` → `/login` 복귀(GET은 405). **UI 진입점은 코드
  조사에서 발견 못 함 — 로그아웃 버튼이 실제 화면 어디에 있는지 확인이 이
  시나리오의 1차 목적. 없으면 스펙 갭 G6.** [CODE+갭검증]

**온보딩 (ONB)**

- **ONB-S1 학습 목표 설정** — 가입 직후.
  경로: consent → A-03 → 저장 → 대시보드.
  기대: TOPIK 급수/목표 등급/시험일(미래만)/주간 목표/약점 영역 저장,
  대시보드 KPI·추천에 반영, 재진입 시 기존 값 표시. [CODE]
- **ONB-S2 건너뛰기 동작** — A-03에서 "건너뛰기" 시도.
  **문서(user-flow.md)는 건너뛰기 → 대시보드를 정의하는데, 코드는 대시보드가
  학습 목표 없으면 A-03로 강제 redirect — 충돌. 실제 동작(무한 루프 여부)을
  관찰·기록하고 스펙 갭 G7로 보고.** [갭검증]

**문제 선택 (PRAC)**

- **PRAC-S1 추천 따라 문제 도달** — 경로: `/dashboard`(B-01) → 유형
  추천(C-01, `?type=` 탭) → 문제 목록(C-02) → 문제 선택 → 작성 화면.
  기대: C-02 필터(유형/난이도 1–5/풀이 상태/검색/정렬/페이지) 동작, 행마다
  풀이 상태 배지(미풀이/진행 중/완료), 필터 결과 0건이면 Empty + 초기화 CTA.
  [CODE]
- **PRAC-S2 다시 풀기** — C-02에서 푼 문제 클릭 → 다시 풀기 모달(C-03).
  기대: 모달 옵션 = 새로 시작 / 이어서(진행 draft 있을 때) / 결과
  보기(제출 있을 때). 만료된 추천 항목은 만료 알림만 표시(시작 옵션 없음).
  [CODE]
- **PRAC-S3 약점 보완 (유료)** — 사이드바 → 약점 기반 추천(X-07).
  기대: 무료 사용자는 잠금 카드 + 업그레이드 링크(콘텐츠 미노출). 유료는
  차원별 탭(표본 부족 차원은 "준비 중" 비활성). [CODE]
- **PRAC-S4 다음 문제 추천 폴백** — R-02 진입.
  기대: 4단계 폴백 — ①활성 추천 ②최근 유형의 미시도 문제 ③아무 미시도
  문제 ④없으면 "자유롭게 고르세요" CTA. 무료는 대안 카드 첫 1개만 잠금
  해제. 신규 사용자도 빈 화면이 아니어야 한다. [CODE]

**쓰기 (WRIT)**

- **WRIT-S1 정상 작성·제출 (51/52/53/54 각각)** — 경로: 문제 목록 경유 →
  작성 → 제출 확인 모달(D-M1) → 확인 → 피드백 이동.
  기대: autosave 2초 디바운스, 배지 5상태(clean/dirty/syncing/failed/
  superseded) + 마지막 저장 시각. D-M1은 글자수 hardMin 미만이거나 동의
  체크 전엔 제출 비활성. 글자수 하드 리밋: 51=10–120, 52=10–160,
  53=120–300, 54=300–700. 제출 성공 → 피드백 페이지로 즉시 이동. [CODE]
- **WRIT-S2 작성 중 이탈** — ①새로고침/탭 닫기 ②사이드바로 앱 내 이동.
  기대: ①은 브라우저 경고(beforeunload). **②는 경고 미배선(코드 확인) —
  user-flow.md의 "이탈 시 D-M3"와 충돌. 동작 관찰 후 스펙 갭 G1로 보고.**
  [CODE+갭검증]
- **WRIT-S3 제출 취소/실패** — D-M1에서 취소 / 제출 중 오류.
  기대: 취소 → 작성 화면 복귀·입력 유지. 실패 → 모달 유지 + 오류 표시 +
  입력 보존 + 재시도 버튼. [CODE]
- **WRIT-S4 새로고침 복원** — 작성 중 F5 → 재진입.
  기대: draft 복원(user×problem 키). `?fresh=1` 진입이면 빈 화면. [CODE]
- **WRIT-S5 제출한 문제 재진입** — 제출 완료한 문제를 목록에서 다시 열기.
  **기대 동작 미정의 — 현재 코드는 안내 없이 편집 모드(재제출 가능), "이미
  제출함/피드백 보기" 분기 없음. 동작 관찰 후 스펙 갭 G2로 보고.** [갭검증]

**피드백/리포트 (FB)**

- **FB-S1 피드백 열람 (분석 대기 포함)** — 제출 직후.
  기대: 분석 중이면 대기 패널(5초×12회 폴링), 10초 초과 시 지연 안내, 분석
  실패 시 실패 패널 + 재시도. **60초 폴링 소진 후에도 분석 중이면 타임아웃
  안내 없음 — 스펙 갭 G4 관찰 대상.** 완료 시 점수·코멘트·다음 행동 CTA.
  [CODE]
- **FB-S2 성장 확인** — 피드백 → 비교 리포트(R-01) → 다음 문제 추천(R-02).
  기대: R-01은 같은 문제 2회 이상 제출 시 생성. 1회만 제출한 사용자에게
  비교 리포트 진입점이 어떻게 보이는지 관찰(404 노출은 안 됨). [CODE+갭검증]
- **FB-S3 과거 기록 재열람** — 내 서재(F-01) → 과거 제출물 → 피드백 재진입.
  [SPEC]

**보관함 (LIB)**

- **LIB-S1 서재 탐색·PDF 내보내기** — 사이드바 → F-01(제출물/리포트/문제/
  내보내기 4탭) → 항목 선택(≤6) → PDF 모달(F-M1).
  기대: 파일명 검증(비어있음/60자), **내보내기 = 브라우저 인쇄
  대화상자(window.print) — 서버 파일 다운로드가 아님**(테스트도 인쇄
  대화상자 호출까지 확인). 신규 사용자 통계 패널은 "아직 저장한 항목이
  없어요" + 문제 목록 링크. [CODE]

**설정/프로필 (SET)**

- **SET-S1 프로필 수정** — 사이드바 → 프로필(X-05) → 수정 → 저장.
  기대: display_name 2–30자, nickname 2–20자, bio ≤160자, 아바타 5MB
  jpg/png. 이메일은 읽기 전용. 변경값 없으면 저장 비활성, 저장 중 중복
  클릭 차단. [CODE+SPEC]
- **SET-S2 언어 변경** — 설정 → 언어(G-01) → 변경 → 저장.
  기대: 저장 즉시 쿠키 + router.refresh로 화면 전환. 미이전 페이지가 원문
  유지될 수 있다는 안내(coverageNote) 노출 확인. 번역 키 노출(`missing
  key`) 없음. [CODE]
- **SET-S3 알림 설정** — 설정 → 알림(X-09) → 변경 → 저장.
  기대: 불린 3종(주간 요약/피드백 완료/학습 리마인더) + 채널(이메일,
  Zalo는 "미연동" 태그) + 리마인더 시간(5분 단위)/요일. 변경 전 저장
  비활성, 성공/실패 토스트. 실제 발송은 스텁(검증 범위 아님). [CODE]

**결제/구독 (PAY)**

- **PAY-S1 잠긴 기능 → 페이월** — 무료 플랜 사용자.
  경로: 사이드바 잠금 아이콘(Growth) 확인 → `/growth` 열기 → 잠금 UI +
  업그레이드 CTA → 페이월(X-03).
  기대: 페이월은 실제 플랜 데이터(가격/혜택/추천 배지) 표시, 선택 CTA는
  정직한 스텁 안내("연동 예정") — 구독 행이 생기면 안 됨. **실제 결제는
  수행하지 않는다.** [CODE]
- **PAY-S2 구독 관리** — 사이드바/프로필 → 구독 관리(X-04).
  기대: 구독 없으면 "구독 없음" + 페이월 링크. 변경/결제수단/해지는 정책
  모달 + 스텁 안내. 결제 이력 테이블(10건/페이지) 표시. [CODE]

#### 4-B. 횡단 시나리오 (상태·경로 변형)

**NAV — 뒤로가기/새로고침/히스토리**

- **NAV-S1 로그인 직후 뒤로가기 / 오래된 콜백 재방문** — 히스토리의
  `/auth/callback?code=사용됨` 재방문.
  기대: 에러 없이 `/dashboard` 복귀(세션 감지 후 안전 redirect, e2e 존재).
  [CODE]
- **NAV-S2 로그아웃 후 뒤로가기** — 로그아웃 직후 브라우저 뒤로가기.
  기대: protected 화면이 캐시(bfcache)로 보이면 안 되고 `/login`으로
  가야 한다. [STD — 구현 미확인, 관찰·기록]
- **NAV-S3 분석 로딩 중 이탈** — D-M2에서 "뒤로" 버튼.
  기대: 확인 모달 후 이전 화면 복귀(router.back). [CODE]
- **NAV-S4 제출 직후 뒤로가기** — 피드백 도착 후 브라우저 뒤로가기로 작성
  화면 복귀 → 재제출 시도.
  기대 미정의 — **서버 측 이중 제출 방지 없음(버튼 비활성뿐). 중복 제출이
  생기는지 관찰, 스펙 갭 G3.** [갭검증]
- **NAV-S5 모달 위에서 뒤로가기** — D-M1/C-03/F-M1 열린 상태에서 브라우저
  뒤로가기. 기대 미정의(모달만 닫힘? 페이지 이동?) — 관찰·기록. [STD+갭검증]

**ACC — 접근 제어 × 세션 상태 매트릭스** (다이렉트 URL은 이 카테고리만 허용)

상태 5종: ①비로그인 ②로그인+온보딩 미완료 ③로그인 무료 ④로그인 유료
⑤세션 만료.

- **ACC-S1** ① × protected 22개 → 전부 `/login` redirect. [CODE]
- **ACC-S2** ② × `/dashboard` → A-03로 redirect. [CODE]
  **② × `/practice/problems` 등 다른 protected → 게이트 없음(코드 확인) —
  온보딩 우회 가능 여부 관찰, 스펙 갭 G8.** [갭검증]
- **ACC-S3** ③④ × `/login`·`/sign-up` 직접 접근 → **가드 없음, 페이지
  렌더(코드 확인). 의도인지 미정의 — 스펙 갭 G5.** [갭검증]
- **ACC-S4** ③ × `/growth`·`/practice/weakness` → redirect 아닌 잠금 UI
  렌더 + 페이월 CTA. ④는 전체 콘텐츠. [CODE]
- **ACC-S5** ③ × 타인의 feedback/report id → 404(AppNotFound). 빈 화면/
  500/데이터 누출 금지. [CODE]
- **ACC-S6** ⑤ × 작성 중 자동저장/제출 → `/login?reason=session_expired`
  경고. **이때 작성 내용 손실 여부를 반드시 관찰**(자동저장 실패 경로),
  손실되면 P0 후보. [CODE+갭검증]

**PERS — 개인 설정 지속성** (이탈 후 재접근 시 동적 반영)

- **PERS-S1** 언어 변경 → 로그아웃 → 재로그인 → 언어 유지.
  [CODE: `profiles.ui_locale` DB 우선]
- **PERS-S2** 언어 변경 → **쿠키 없는 새 브라우저/기기에서 로그인** → 저장된
  언어가 따라와야 한다(DB가 쿠키보다 우선). [CODE]
- **PERS-S3** 학습 목표/알림 설정 재방문 시 저장값 유지, 대시보드
  KPI·추천에 반영. [CODE]
- **PERS-S4** 인증 메일 재전송 cooldown이 새로고침 후에도 유지(localStorage).
  [CODE]
- **PERS-S5** 작성 draft가 로그아웃/재로그인 후에도 유지(DB 저장이므로).
  [CODE — 관찰로 확정]

**VAL — 입력 검증/중복 체크**

- **VAL-S1** 이미 가입된 이메일로 재가입 → 이메일 필드 하단 인라인 중복
  오류, 수정 시 오류 해제. 조용한 성공/무반응 금지. [CODE]
- **VAL-S2** 닉네임 중복 저장 — 다른 계정이 쓰는 닉네임(대소문자만 바꾼
  변형 포함)으로 저장 시도.
  기대: DB 유니크 제약(case-insensitive)이 거부 — **거부가 필드 하단
  오류로 표시되는지 검증(X-05 문서 요구). 클라이언트 사전 체크는 없음(코드
  확인) — 원시 DB 오류가 그대로 노출되면 P2.** [SPEC+CODE]
- **VAL-S3** 글자수 경계값 — 각 유형의 hardMin−1/hardMin/hardMax/hardMax+1
  에서 제출 가능 여부와 blur 시 부족/초과 메시지. [CODE]
- **VAL-S4** 아바타 — 5MB 초과/비허용 형식(gif 등) 업로드 → 즉시 오류 +
  재선택. [SPEC]
- **VAL-S5** 비밀번호 — 8자 미만/65자/불일치 확인 입력. 가입과 재설정이
  같은 규칙인지 확인. [CODE]

**STATE — 데이터 상태 변형**

- **STATE-S1 신규 사용자(제출 0)** — 온보딩 완료 직후 한 바퀴: 대시보드
  (KPI 0/—, 추천은 폴백으로 존재해야 함), 서재(빈 상태 안내), C-01/R-02
  (폴백 추천). **"시작해보세요" 류 안내 부재는 스펙 갭 G9로 기록.**
  [CODE+갭검증]
- **STATE-S2 추천 만료 상태** — 만료된 recommendation_runs만 있는 사용자 →
  C-01 폴백 패널, C-03 만료 알림. [CODE]
- **STATE-S3 잘못된 문제 id** — `?problem=존재하지않는id` →
  빈 상태 + 재시도/문제 목록 링크(앱 크래시 금지). [CODE]
- **STATE-S4 존재하지 않는 라우트** — `/nonexistent` → 전용 404(AppNotFound).
  [CODE]
- **STATE-S5 분석 진행 중 재방문** — 분석이 끝나기 전 다른 화면 갔다가
  피드백 URL 재진입 → 대기 패널이 다시 폴링. 탭을 비활성화했다 돌아오면
  폴링이 멈춰 있던 상태가 갱신되는지(refetch 백그라운드 꺼짐 확인됨).
  [CODE+갭검증]

**FAIL — 실패/복구**

- **FAIL-S1** 자동저장 실패(네트워크 차단으로 재현) → failed 배지 + 경고
  모달(재시도/계속), 재시도로 복구. [CODE]
- **FAIL-S2** 제출 실패 → 입력 보존 + 모달 내 오류 + 재시도. [CODE]
- **FAIL-S3** 분석 실패 → 실패 패널 + 재시도 버튼. 60초 초과 분석 중 →
  **타임아웃 안내 없음(갭 G4) — 사용자가 빠져나올 수 있는지 관찰.**
  [CODE+갭검증]
- **FAIL-S4** 오프라인 상태에서 작성 계속/제출 시도 → 동작 미정의. 관찰·
  기록(데이터 손실 여부가 핵심). [STD+갭검증]

**STD — 표준 사용성 (프로젝트 미고려 흐름)**

- **STD-S1 멀티탭 동시 작성** — 같은 문제를 두 탭에서 열고 양쪽에서 수정 —
  자동저장이 (user, problem) 단일 draft라 마지막 저장이 덮어씀 예상.
  데이터 손실 인지 가능성 관찰. [STD+갭검증]
- **STD-S2 메일 보안 스캐너 링크 선소비** — 인증/재설정 링크가 이미 한 번
  열린 상태(만료 코드) 가정 → X-11 에러 흐름으로 안내되는지(user-flow의
  6시나리오 표와 대조). [SPEC]
- **STD-S3 한글 IME 조합 중 글자수** — 조합 중 문자가 글자수 카운트/디바운스
  에 비정상 반영되는지 (53/54 경계값 근처에서). [STD]
- **STD-S4 긴 텍스트 붙여넣기** — hardMax 초과 텍스트 붙여넣기 → 카운트
  표시와 제출 차단 동작. [STD]
- **STD-S5 브라우저 자동완성/비밀번호 관리자** — 가입/로그인/재설정 폼에서
  자동완성이 동작하고 필드를 깨뜨리지 않는지. [STD]
- **STD-S6 이중 클릭/연타** — 제출·저장 버튼 연타(서버 멱등성 없음, UI
  가드만 — G3와 연계). [STD+갭검증]
- **STD-S7 200% 확대 + 긴 콘텐츠** — 200% 줌, 20자 닉네임, 긴 문제 제목
  에서 오버플로/겹침. [STD/WCAG]

#### 4-C. 스펙 갭 레지스터 (조사로 선식별, 2026-06-12)

아래 항목은 **결함으로 판정하지 않는다.** QA에서 실제 동작을 관찰·기록하고,
보고서의 Spec gaps 섹션에 모아 문서 게이트(docs 업데이트 제안 또는 owner
승인 브리프)로 에스컬레이션한다.

| ID | 내용 | 관련 시나리오 |
| --- | --- | --- |
| G1 | 앱 내 이동 시 자동저장 경고 미배선 (user-flow.md와 충돌) | WRIT-S2 |
| G2 | 제출한 문제 재진입 시 "이미 제출함" 안내 없음 | WRIT-S5 |
| G3 | 서버 측 이중 제출 방지 없음 (UI 버튼 비활성뿐) | NAV-S4, STD-S6 |
| G4 | 분석 폴링 60초 소진 후 타임아웃 안내 없음 | FB-S1, FAIL-S3 |
| G5 | 로그인 상태에서 `/login`·`/sign-up` 접근 가드 없음 | ACC-S3 |
| G6 | 로그아웃 UI 진입점 미발견 (라우트만 존재) | AUTH-S6 |
| G7 | 학습 목표 건너뛰기: 문서(허용) vs 코드(강제 회귀) 충돌 | ONB-S2 |
| G8 | dashboard 외 protected 페이지의 온보딩 게이트 부재 | ACC-S2 |
| G9 | 신규 사용자 대시보드에 시작 안내 부재 | STATE-S1 |
| G10 | 멀티탭/오프라인/모달 뒤로가기 등 동작 미정의 | STD-S1, FAIL-S4, NAV-S5 |

#### 4-D. 기능 단위 실행 상태 검증 (FUNC)

여정(4-A/4-B)이 "흐름이 이어지는가"를 본다면, 이 층은 **페이지 안의 개별
기능이 무엇을 하고, 화면에 어떤 영향을 주고, 실행 상태마다 사용자
인터랙션을 어떻게 관리하는가**를 본다.

- 기능 인벤토리 출처: 각 화면 폴더 `functional-spec.md`의 **"주요 기능" +
  "상태/오류" 목록** (인덱스:
  [`functional-spec-index.md`](../Wireframe/functional-spec-index.md)).
  화면 검증 시 해당 명세를 먼저 읽고, 사용자가 실행할 수 있는 기능마다 아래
  템플릿을 적용한다.
- ID 체계: `FUNC-<IA코드>-<기능명>` (예: `FUNC-D01-자동저장`).
- **중복 규칙**: 4-A/4-B 시나리오가 이미 그 기능의 수명주기를 커버하면 FUNC
  항목은 해당 시나리오 ID만 참조하고 재실행하지 않는다(보고서에 참조로 기록).

**실행 상태 수명주기 템플릿 (모든 비동기 기능에 적용):**

| 상태 | 확인 항목 |
| --- | --- |
| ① 시작 전 (Idle) | 실행 조건 미충족 시 비활성/숨김인가, **왜 안 되는지** 보이는가 (예: 글자수 부족 시 제출 비활성 + 부족 표시) |
| ② 시작 (Trigger) | 클릭 즉시 반응이 보이는가, 시작과 동시에 **중복 실행이 잠기는가**(연타/더블클릭) |
| ③ 실행 중 (In-flight) | 진행 표시(스피너/로딩바/배지/스켈레톤)가 있는가, **잠금 범위가 적절한가**(필요한 것만 — 화면 전체 동결 금지), 취소가 가능하면 취소 동작이 안전한가 |
| ④ 성공 | 결과가 화면에 반영되는가(전환/데이터 갱신/토스트/배지), 잠금이 풀리는가, 재실행 가능한 상태로 복귀하는가 |
| ⑤ 실패 | **무엇이 왜 실패했고 어떻게 해야 하는지** 보이는가, 입력이 보존되는가, 재시도 경로가 있는가, 잠금이 풀리는가 |

**기능 인벤토리 시드 (코드 조사로 상태 관리가 이미 확인된 기능):**

| 화면 | 기능 | 실행 중 관리 (코드 확인) | 연계 시나리오 |
| --- | --- | --- | --- |
| D-01~04 | 자동저장 | 배지 5상태 + 저장 시각, 실패 시 경고 모달(재시도/계속) | FAIL-S1 |
| D-M1 | 제출 | isPending 중 버튼 비활성, 실패 시 모달 유지 + 입력 보존 | WRIT-S1/S3 |
| D-M2 | 분석 대기 | 5초×12 폴링, 10초 지연 안내, "뒤로"는 확인 모달 | FB-S1, G4 |
| X-12 | 인증 메일 재전송 | 60초 cooldown(새로고침 유지), 전송 중 비활성 | AUTH-S1 |
| G-01 | 언어 저장 | 저장 즉시 쿠키 + 화면 갱신(refresh) | SET-S2, PERS-S1 |
| X-09 | 알림 저장 | 변경 전 저장 비활성(dirty 게이팅), 저장 중 비활성, 성공/실패 토스트 | SET-S3 |
| X-05 | 프로필 저장 | 변경 없으면 비활성, 저장 중 중복 클릭 차단 | SET-S1, VAL-S2 |
| X-05 | 아바타 업로드 | 실패 시 즉시 오류 + 재선택 | VAL-S4 |
| F-M1 | PDF 내보내기 | 파일명 검증 → 브라우저 인쇄 호출 | LIB-S1 |
| R-02 | 추천 시작 | 이벤트 기록 + 추천 소비 후 작성 화면 라우팅 | PRAC-S4 |
| X-03/X-04 | 결제/변경 CTA | 짧은 로딩 → 스텁 안내("연동 예정"), 데이터 변경 없음 | PAY-S1/S2 |
| C-02 | 필터/검색/페이지 | 로딩 Spin, 오류 Alert+재시도, 0건 Empty+초기화 | PRAC-S1 |
| A-01/A-02 | 가입/로그인 제출 | 제출 중 상태, 오류 인라인 표시 | AUTH-S1/S2, VAL-S1 |

이 표는 시드일 뿐이다 — **전체 인벤토리는 35개 화면의 `functional-spec.md`
"주요 기능" 목록에서 가져오고**, 시드에 없는 기능(랜딩 CTA, 피드백 화면의
저장/다음 행동 버튼, 성장 차트 필터, 약점 탭 전환 등)도 같은 템플릿으로
검증한다. 명세에 있는데 화면에 없는 기능(또는 그 반대)은 단계 3의 와이어프레임
대조 결과로 기록한다.

**서비스 전역 상태 관리 5원칙 (광역 sweep 규칙):**

모든 화면에서 `functional-spec.md`의 "상태/오류" 목록과 대조하며 아래 원칙
위반을 찾는다. 위반은 기본 P2(단계 5 UX 휴리스틱과 연계), **갇힘·입력 손실은
P1/P0**.

1. **피드백 없는 상태 금지** — 동작이 진행되는 동안 무슨 일이 일어나는지
   항상 화면에 보인다.
2. **중복 실행 잠금** — 실행 중에는 같은 동작이 다시 실행되지 않는다.
3. **실패해도 입력 보존** — 실패가 사용자의 입력/진행 상황을 지우지 않는다.
4. **갇힘 금지** — 어떤 상태에서도 탈출 경로가 있다 (G4 무한 로딩이 위반
   사례).
5. **패턴 일관성** — 같은 종류의 동작(저장/제출/내보내기)은 화면이 달라도
   같은 상태 관리 패턴을 쓴다.

### 5. UX/사용성 평가 (휴리스틱 기반)

정합(문서와 같은가)·결함(깨지는가)과 별개로 **"쓰기 편한가"**를 본다. 단계 4의
시나리오 카탈로그를 수행하면서 함께 기록한다 (별도 재방문 불필요).

체크리스트 (Nielsen 10 휴리스틱 + WCAG 2.2 적용):

1. **시스템 상태 가시성**: 저장/제출/분석 진행 상태가 항상 보이는가
   (autosave 배지, 로딩 표시, 분석 진행 단계)
2. **사용자 통제와 복구**: 제출 취소 가능, 작성 중 이탈 시 경고, 복귀 후
   입력 보존
3. **오류 예방과 복구**: 폼 검증이 제출 전에 인라인으로 보이는가, 오류
   메시지가 "무엇이 왜 잘못됐고 어떻게 고치는지"를 알려주는가
4. **현재 위치 인지**: 사이드바 활성 상태, 페이지 제목, 단계 표시가 실제
   위치와 일치하는가
5. **일관성**: 같은 동작(저장/제출/내보내기/취소)이 화면마다 같은 위치·
   라벨·패턴인가 (Ant Design 패턴 기준)
6. **과업 효율**: 핵심 과업(문제 선택→작성→제출→피드백)의 클릭/단계 수가
   `user-flow.md` 대비 불필요하게 늘지 않았는가
7. **모바일 인체공학**: 터치 타깃 최소 24×24px(WCAG 2.2), 모바일 키보드가
   입력 필드·CTA를 가리지 않는가
8. **학습자 언어 배려**: TOPIK 학습자(한국어 비원어민)가 이해할 수 있는
   문구인가, UI 언어 설정이 안내·오류 문구까지 반영되는가

판정 규칙 (주관 판단 통제 — 거짓 보고 재발 방지):

- 발견 항목은 반드시 **휴리스틱 번호 + 화면 + 증거 스크린샷 + 개선 제안**
  세트로 기록한다. 근거 없는 "느낌상 불편" 판정은 금지.
- 등급은 기본 P2/P3. **핵심 과업을 완료할 수 없게 막을 때만 P1.**
- UX 발견 항목은 ship-blocker가 아니라 개선 백로그로 defer할 수 있다
  (defer 시 사유/owner 명시 — 완료 기준의 P2 규칙과 동일).

### 6. 탐색적 QA 세션

- Session A: auth 실패/복구, expired/reset link, session expired
- Session B: writing 입력 손실, autosave, 제출 취소/확인
- Session C: feedback/report/library/export 연결
- Session D: mobile overflow, keyboard focus, modal/drawer close, 긴 텍스트

### 7. 보안/데이터 QA

- anon protected access 차단 (브라우저로 확인).
- user-A/user-B row isolation: 원래 `tests/integration/rls-smoke.test.ts`
  담당(Docker 게이트). **테스트 계정 2개가 있으면 브라우저로 확인, 1개뿐이면
  Deferred + 사유 기록.**
- browser-visible env에 secret/service role key 미노출.
- admin route/UI/schema 신규 추가 여부 확인 — **침범은 P0.** 단
  `profiles.app_role`, `admin_audit_logs`, `private.is_*_admin`은 보존
  대상이며 존재 자체는 결함이 아니다
  ([`docs/admin-scope-boundary.md`](../admin-scope-boundary.md) 참고).

## HTML 보고서

- 최종 산출물은 HTML로 만든다.
- 저장 위치: `docs/qa/reports/qa-report-YYYYMMDD-HHMM.html`
- 스크린샷 증거: `docs/qa/reports/qa-report-YYYYMMDD-HHMM-evidence/`에 복사해
  보고서에서 상대 경로로 링크한다.
- 보고서 구성:
  - Executive summary: 전체 판정, P0/P1/P2/P3 수, ship-readiness
  - Environment: branch/worktree, Node/pnpm, base URL, 실행 시각
  - Command results: lint/typecheck/format/build/test/e2e 결과
  - Browser evidence: route별 screenshot, viewport, trace 로컬 경로
  - **Screen checklist: 35화면 × description.md 대조 결과
    (PASS/FAIL/UNVERIFIED, 영역·제약·예외 단위)**
  - **Scenario results: 시나리오 ID(AUTH-S1 등) × 결과 × 출처
    라벨([SPEC]/[CODE]/[STD]) × 수행한 진입 경로 기록**
  - **Spec gaps: 4-C 레지스터(G1~G10) + 신규 발견 갭의 관찰 결과 —
    결함 집계와 분리하고, 문서 게이트 에스컬레이션 대상으로 표기**
  - **Function lifecycle results: FUNC-<IA>-<기능> × 5단계(시작 전/시작/
    실행 중/성공/실패) 결과 — 중복 커버는 시나리오 ID 참조로 기록, 상태 관리
    5원칙 위반 목록 포함**
  - **UX findings: 휴리스틱 번호·화면·증거·개선 제안·등급 단위의 사용성
    발견 목록**
  - Role matrix: 기획/디자인/개발/QA/UX/콘텐츠별 pass/fail
  - Defect log: severity, route, 재현 절차, 기대/실제 결과, 증거, owner, status
  - **UNVERIFIED 목록: 항목별 사유와 재검증 방법**
  - **Docs consulted: 이번 QA에서 참조한 문서 목록** (CLAUDE.md 요구사항)
  - Remaining risks: 미실행 항목, 환경 제약, deferred scope
- 증거 보안 규칙: **trace와 `tests/e2e/auth-state/`, `test-results/`는
  gitignore 대상(인증 토큰 포함)이므로 로컬 경로만 기록하고 절대 복사/커밋하지
  않는다.** 스크린샷에 토큰·이메일 등 민감정보가 노출되면 마스킹 후 첨부한다.
- 보고서는 한국어 요약을 포함한다(필요 시 `-ko` 쉬운 버전 별도 생성 — 기존
  산출물 관례).

## 결함 등급과 완료 기준

- P0: 데이터 노출, auth bypass, route guard 실패, app crash, writing 제출 손실,
  admin scope 침범
- P1: 핵심 학습 흐름 중단, feedback/report/library 주요 기능 실패, 모바일 사용
  불가
- P2: 상태 메시지 오류, 부분 기능 실패, 접근성/반응형 문제
- P3: copy, spacing, cosmetic issue
- 판정 보강: **UNVERIFIED는 PASS도 FAIL도 아니다.** 하이드레이션 증명 없는
  시각적 문제 제보는 결함이 아니라 UNVERIFIED로 남기고 재검증 경로를 기록한다.
- **스펙 갭(4-C)은 P0~P3 결함 집계에 넣지 않는다.** 관찰 결과와 함께 Spec
  gaps 섹션에 따로 모아 문서 게이트로 보낸다. 단, 갭 검증 중 데이터
  손실/노출이 실제로 발생하면 그것은 갭이 아니라 결함(P0/P1)으로 등급을
  매긴다.
- 완료 기준:
  - P0/P1 0개
  - P2는 수정 완료 또는 defer 사유/owner 명시
  - 자동화 명령 결과와 브라우저 증거가 HTML 보고서에 포함
  - 실패가 있었던 테스트는 재현 명령과 재검증 결과 포함
  - **UNVERIFIED 항목은 전부 사유·재검증 방법 명시**

## 가정

- QA는 현재 로컬 repository와 active docs 기준으로 수행한다.
- 테스트 계정과 필요한 env는 준비되어 있다고 가정하되, secret 값은 출력하지
  않는다.
- 이 계획은 QA 실행 계획이며 public API, route, DB schema, 타입 변경을 포함하지
  않는다.
- **이 환경에는 Docker/Supabase CLI가 없으므로 로컬 스택 의존 테스트는 기본
  skip이며, 이는 환경 제약이지 결함이 아니다.**

## Docs consulted (rev2 작성 시 대조한 파일)

- [`package.json`](../../package.json) — 스크립트/엔진 확인
- [`playwright.config.ts`](../../playwright.config.ts) — webServer 부재,
  viewport 3종, base URL, trace 설정
- [`src/lib/routes.ts`](../../src/lib/routes.ts) — public 12 / protected 22
  라우트, `/growth` 플랜 잠금
- [`TESTING.md`](../../TESTING.md) — Supabase 로컬 스택 게이트 구조
- `.gitignore` — `test-results/`, `tests/e2e/auth-state/` 제외 확인
- [`docs/Wireframe/README.md`](../Wireframe/README.md) — 35화면 목록·결번
  21·30·32·37·user-flow 우선 규칙 확인 (rev3)
- `docs/Wireframe/<화면 폴더>/description.md` — 화면별 영역(Number Map)·제약
  조건·예외 상태 구조 확인 (rev3)
- [`docs/flow/user-flow.md`](../flow/user-flow.md) — 인증 콜백/에러 6시나리오
  표, post-auth 분기, 유료 잠금 진입점, D-M3 이탈 흐름 (rev5)
- [`docs/Wireframe/functional-spec-index.md`](../Wireframe/functional-spec-index.md)
  및 화면별 `functional-spec.md` — 기능 인벤토리("주요 기능"/"상태/오류"),
  4-D 기능 단위 검증의 출처 (rev6)
- 코드베이스 심층 조사 3건 (2026-06-12, rev5): ①쓰기/제출 라이프사이클
  (autosave·D-M1·폴링·검증) ②학습/피드백/데이터 상태(RLS 404·폴백·빈
  상태·404) ③인증/온보딩/전역(post-auth 트리·OAuth·X-12/X-16·sign-out·
  모바일 드로어·언어 전파·알림·페이월 스텁) — 스펙 갭 G1~G10의 출처
