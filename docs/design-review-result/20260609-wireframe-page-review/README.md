# 와이어프레임 기준 전체 페이지 리뷰 — 인덱스 (2026-06-09)

`docs/Wireframe/`(SOT)를 기준으로 **사용자 화면 35개**를 실제 브라우저로 띄워 캡처하고,
**2레이어**(① SOT 정합 ② 다관점 분석)로 평가한 결과 인덱스입니다. **제품 코드(`src/`)는
변경하지 않았습니다**(리뷰는 개선안 제안까지). e2e 테스트 코드(`tests/e2e/`)만 D4 승인 범위로 신규 작성.

페이지별 상세: [`pages/`](./pages/). 계획: [`PLAN.md`](./PLAN.md). admin 경계: [`admin-boundary-conflict-proposal.md`](./admin-boundary-conflict-proposal.md).

---

## 0. 한 줄 요약

> **2026-06-09 재검증 정정**: 초기 요약의 "쓰기 52·53·54 콘텐츠 전반 결손" 규정은 **철회**합니다. 사용자
> 확인 후 재검증한 결과 q53(46/47)·q54(81/82)·q51은 **실 데이터 완비·화면 정상**입니다(§4 참조).

35개 사용자 화면 중 **33개를 실제 하이드레이션 화면으로 캡처**(C-03·D-M2는 소스+SOT 평가)했고,
**P0(지금 당장) 0건**입니다. 핵심 **P1 3건(서로 다른 원인)**: ① 쓰기 **기본 문제 선택 버그**(`getWritingProblem`이
파라미터 없을 때 정렬 없이 `.limit(1)` → 직접/딥링크 진입 시 빈 시드 예시 로드) + 빈 예시가 published 상태,
② **q52만** 완성 published 문제가 없음(유일 published가 빈 placeholder), ③ **X-16 하이드레이션 버그**.
나머지 화면은 대체로 명세에 잘 부합하고, 약관/개인정보/알림 등은 미구현을 정직하게 고지(workslop 없음)합니다.

---

## 1. 방법론 (정직 고지 포함)

- **캡처**: `scripts/design-review/render-shot.mjs` 로직 기반으로 35라우트를 실제 dev 브라우저로
  띄워 360/768/1280 캡처(public=localhost, authed=127.0.0.1 + 재생성한 storageState). 시드(R-01
  비교리포트·F-01 라이브러리)는 **앱 실제 흐름**으로 생성. 모달은 인터랙션으로 트리거.
- **Layer 1 (SOT 정합)**: 각 화면의 `description.md`/`functional-spec.md`/`screen-data-summary.md`
  (+ 있으면 `wireframe.png`/`hifi.png`) 대비 요소·상태·문구·데이터계약의 있음/없음/벗어남 판정.
- **Layer 2 (다관점)**: UX·IA / 비주얼·디자인시스템 / 접근성 / 반응형 / 콘텐츠·i18n / 상태 커버리지 /
  데이터계약 차원으로 발견 + 심각도(P0/P1/P2/nit). 고심각도는 적대적 반증으로 과장 제거.
- **⚠️ 정직 고지 — 작성 방식**: 당초 멀티 에이전트 `Workflow`로 페이지별 파이프라인을 돌릴
  계획이었으나, 파일럿 실행 중 **세션 토큰 한도**에 도달해(190 에이전트가 떠 한도 소진, 산출 0)
  서브에이전트 실행이 차단됨. 그래서 **본 35개 페이지는 메인 루프에서 직접(단일 리뷰어)** 캡처
  이미지·SOT·렌더 헬스·콘솔 로그를 근거로 작성했습니다. 다관점/적대검증은 차원별 자체 점검으로
  수행했고, "독립 다중 에이전트 교차검증"은 **부분적으로만** 적용됨(한계 §6).

---

## 2. 35개 화면 인덱스

상태: ✅rendered · 🟡rendered(주의/부분) · ⏸DEFERRED(소스+SOT). verdict: 일치/부분일치.
admin(H-01·X-08·X-10·X-15)은 **범위 밖**(별도 admin 앱 소관, [D1/D2](./admin-boundary-conflict-proposal.md)).

| IA | 화면 | 라우트 | 캡처 | verdict | P1 | P2/nit |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 | 회원가입 | `/sign-up` | ✅ | 일치(강) | – | CTA 비활성 정책 |
| A-02 | 로그인 | `/login` | ✅ | 부분일치 | – | 소셜 미노출·CTA 정책 |
| A-03 | 학습 목표 설정 | `/onboarding/learning-goal` | ✅ | 일치(강) | – | 마스코트 정렬 |
| B-01 | 홈 대시보드 | `/dashboard` | ✅ | 일치(강) | – | 52 추천 막다른 길* |
| C-01 | 문제 유형 추천 | `/practice/recommendations` | 🟡 | 부분일치 | 추천이 차단 52 지향* | 보완포인트 코드 라벨 |
| C-02 | 문제 목록 | `/practice/problems` | 🟡 | 부분일치 | solve_state 미반영* | 1페이지 단조 |
| C-03 | 다시 풀기 모달 | (host C-02) | ⏸ | 부분일치(소스) | 도달 불가(solve_state)* | CTA 개수·만료 배선 |
| D-01 | 51 단답 작성 | `/writing/short-answer-writing-51` | ✅ | 일치(강) | – | – |
| **D-02** | **52 답안 작성** | `/writing/answer-writing-52` | 🟡 | 부분일치 | **q52 완성 문제 부재**(데이터)\* | 제목 중복·antd 폐기 |
| D-03 | 53 장문 작성 | `/writing/long-form-writing-53` | ✅ | 일치(실 문제) | 기본 진입만 빈 예시(코드/시드)\* | 제목 중복(예시) |
| D-04 | 54 에세이 작성 | `/writing/essay-writing-54` | ✅ | 일치(실 문제) | 기본 진입만 빈 예시(코드/시드)\* | antd 폐기·제목 중복(예시) |
| D-M1 | 제출 확인 모달 | (host 쓰기) | ✅ | 일치(강) | – | – |
| D-M2 | AI 분석 로딩 | (host 쓰기 제출) | ⏸ | 일치(소스) | – | transient 실측 보강 |
| D-M3 | 자동저장 경고 | (host 쓰기) | ✅ | 일치(강) | – | 다른 트리거 보강 |
| E-01 | 단답 피드백 | `/writing/feedback/short/<id>` | ✅ | 부분일치 | – | CTA 5개(>4) |
| E-02 | 장문 피드백 | `/writing/feedback/long/<id>` | ✅ | 부분일치 | 문장첨삭 미검증 | CTA 5개(>4) |
| R-01 | 비교 리포트 | `/writing/reports/<id>/compare` | ✅ | 일치(강) | – | 전후비교 실측 보강 |
| R-02 | 다음 문제 추천 | `/practice/next` | 🟡 | 부분일치 | 추천이 차단 52 지향* | – |
| F-01 | 내 서재 | `/library` | ✅ | 부분일치(경미) | – | 항목 UUID 라벨 |
| F-M1 | PDF 내보내기 모달 | (host /library) | ✅ | 부분일치(경미) | – | 미리보기 UUID |
| G-01 | 언어 설정 | `/settings/language` | ✅ | 일치(강) | – | – |
| X-01 | 제품 랜딩 | `/` | ✅ | 일치(강) | – | – |
| X-02 | 성장 대시보드 | `/growth` | ✅ | 부분일치 | – | "기본 지표" 카피↔실제 |
| X-03 | 페이월 | `/paywall` | 🟡 | 부분일치(경미) | – | IA코드 "X-03" 노출·할인율 |
| X-04 | 구독 관리 | `/subscription` | 🟡 | 부분일치(경미) | – | IA코드 "X-04" 노출 |
| X-05 | 프로필 편집 | `/profile` | ✅ | 일치(강) | – | – |
| X-06 | 비밀번호 재설정 | `/password-reset` | ✅ | 일치(경미) | – | 마스코트 정렬 |
| X-07 | 약점 기반 추천 | `/practice/weakness` | ✅ | 일치(예외) | – | 유료 본문 미검증 |
| X-09 | 알림 설정 | `/settings/notifications` | ✅ | 일치 | – | 발송 연동 후 보강 |
| **X-16** | **새 비밀번호 설정** | `/password-reset/confirm` | 🟡 | 부분일치 | **하이드레이션 불일치** | – |
| X-11 | 인증 에러 | `/auth/error` | ✅ | 일치(강) | – | legacyBehavior 경고 |
| X-12 | 인증 메일 확인 | `/auth/verify-email` | ✅ | 일치(강) | – | – |
| X-13 | 이용약관 | `/terms` | ✅ | 일치(강,모범) | – | – |
| X-14 | 개인정보처리방침 | `/privacy` | ✅ | 일치(강,모범) | – | – |
| X-17 | 콜백 fragment | `/auth/callback-fragment` | ⏸ | 일치(예외) | – | 정상 경로 실측 보강 |

\* 표시는 쓰기 데이터/기본선택 관련(§4 핵심 발견 #1·#2). D-03·D-04 화면·콘텐츠는 **정상**이며, 표식은
"파라미터 없는 기본 진입 시 빈 예시 로드" 이슈를 가리킵니다(화면 결함 아님). q52만 완성 문제 부재.

> admin 4개(H-01 관리자 문제 관리, X-08 기관 관리자, X-10 사용자 관리, X-15 관리자 인덱스): **관리
> 대상 / 범위 밖**(별도 admin 앱 소관) — 캡처·리뷰하지 않음.

---

## 3. 스코어카드 (종합)

- **P0 (지금 당장): 0건.** 완전히 깨져 못 쓰는 사용자 화면은 없음.
- **P1 (이번 주 안에): 서로 다른 3건 (재검증 반영)**
  1. **쓰기 기본 문제 선택 버그 + 빈 시드 예시 published** — `getWritingProblem`이 `?problem=` 없을 때
     `ORDER BY` 없이 `.limit(1)`로 골라, 직접/딥링크 진입 시 빈 시드 예시(`2222/3333/4444`)가 로드돼 차단 표시.
     **실제 문제로 진입하면 정상**(q53 46/47·q54 81/82 완비). 조치: 기본 선택 정렬 + 빈 예시 unpublish.
  2. **q52 완성 문제 부재** — q52는 published가 1개뿐이고 그게 빈 placeholder라, 추천/딥링크 어디로 들어와도
     실제 작성 불가. 대시보드·C-01·R-02가 권하는 "52번"이 막다른 길. 조치: 완성된 q52 1개 이상 공개.
  3. **X-16 하이드레이션 불일치** — 만료 시각 문자열을 SSR에서 렌더해 서버/클라 불일치(자기 SOT 규칙 위반). e2e가 잡음.
- **P2: 일관성/폴리시** — 제목 이중 접두사(52/53/54), antd `Alert message` 폐기, IA코드 노출(X-03/04),
  항목 UUID 라벨(F-01/F-M1), CTA 개수 초과(E-01/02), legacyBehavior(X-11), CTA 비활성 정책(A-01/02) 등.
- **정직성 모범**: X-13·X-14(약관/개인정보 placeholder + 외부 LLM 전송 고지), A-01·X-09·X-03(미구현
  "준비 중" 정직 표기), X-05(회원 탈퇴 미지원 고지), D-M2(가짜 성공 안 만듦).

---

## 4. 핵심 발견 (cross-cutting)

1. **쓰기 기본 진입이 빈 예시를 로드 (P1, 코드+시드 — 재검증 정정)**: `getWritingProblem`이 `?problem=`
   없을 때 `ORDER BY` 없이 `.limit(1)`로 골라, 직접 URL/딥링크 진입 시 빈 "(예시)" placeholder
   (`2222/3333/4444`)가 로드됨 → "조건 불러오지 못함 → 차단". **실측 확인: q53 47개 중 46개,
   q54 82개 중 81개가 rubric·answer_key·materials 완비**이며, 실제 문제 id로 진입하면 화면 정상 렌더.
   즉 "콘텐츠 전반 결손"이 아니라 **(a) 정렬 없는 기본 선택 + (b) 빈 시드 예시가 published 상태**가 원인.
   조치: 기본 선택에 정렬 추가 + 빈 예시 unpublish. **단 q52는 예외** — 완성 published 문제가 0개라
   별도 조치(콘텐츠 1건 공개)가 필요(관리자 저작; 메모리 writing-questionbank-reconciliation).
2. **X-16 하이드레이션 불일치 (P1)**: "약 60분 후(HH:mm쯤) 만료" 시각을 SSR에서 계산해 mismatch.
   SOT가 이미 "SSR에서 만료 시각 계산 금지(마운트 후 표시)"라고 규정 → 구현이 자기 규칙 위반. e2e가 잡음.
3. **C-02/C-03 풀이 상태 미반영 (P1)**: `problem_attempts` 비어 있어 제출이 있어도 "시작하기"만 표시 →
   "다시 풀기"·C-03 모달 도달 불가(시드 데이터 갭일 가능성 — attempts 있는 환경 재확인 권장).
4. **일관성/폴리시 (P2)**: 제목 이중 접두사, IA코드 노출, UUID 라벨, antd 폐기 경고, CTA 개수 등 —
   대부분 공통 헬퍼/헤더 한 곳 수정으로 일괄 해결 가능.
5. **스키마-문서 격차(관찰)**: `problems.lifecycle_status` 컬럼이 dev DB에 미적용(마이그레이션 #31/#32
   대기). UI는 `?? "active"` 폴백으로 정상 렌더. 리뷰는 읽기전용 — 스키마 변경 안 함.

---

## 5. 캡처 헬스 & e2e 결과

- **캡처**: 106 PNG(35라벨×주로 3뷰포트 + 변형). 헬스 JSON: `.design-review-shots/20260609/_health*.json`(gitignore).
  - 콘솔 에러 발생: X-16(하이드레이션 pageerror), D-02·D-04(antd Alert message 폐기), X-11-otp(legacyBehavior). 나머지 0.
  - 휴리스틱 오탐 보정: `/login`의 "LOGIN-REDIRECT"는 자기참조 오탐(실제 정상). 한글 짧은 bodyLen은 thin 아님.
- **e2e (`pnpm test:e2e`, D4)**: **92 passed / 3 failed / 2 skipped.**
  - 3 failed = **X-16 하이드레이션**(3뷰포트, 실버그를 의도적으로 노출 — `tests/e2e/screens/screens-public.spec.ts`).
  - flow(로그인→작성→제출→피드백→비교→보관함→PDF) 통과 + 생성 row afterAll 자동 정리.
  - 신규: `tests/e2e/_setup/auth.setup.ts`, `screens/*.spec.ts`, `flows/core-writing-flow.spec.ts` + `playwright.config.ts` setup/storageState 배선.

---

## 6. 한계 / 정직성 (UNVERIFIED 포함)

- **작성 방식 한계**: 멀티 에이전트 워크플로우가 세션 한도로 실패 → 메인 루프 단일 리뷰어 작성.
  "독립 다중 에이전트 교차검증"은 부분 적용. 고심각도(P1) 발견은 캡처+SOT+콘솔+e2e 다중 근거로 교차 확인했으나,
  저심각도/정상 화면 판정의 적대적 교차검증은 제한적.
- **UNVERIFIED-LIVE(데이터/transient로 실측 못함)**: 정상 52/53/54 작성(콘텐츠 확보 후), E-02 문장 첨삭(시드
  없음), R-01 전후 비교(이전 제출 없이 시드), X-02/X-07 유료 본문(free 계정), X-17 정상 fragment 경로,
  D-M2 로딩 단계, 각종 실패/cooldown 상태.
- **DEFERRED(트리거 불가)**: C-03(solve_state 미반영), D-M2(transient) — 소스+SOT로 평가.
- **SOT 정독 범위**: 35개 화면의 `description.md`는 거의 모두 정독. 일부(X-09)는 화면+기능 기준으로 판정(문서 region 매핑 보강 권장).
- **환경**: dev + mock 피드백 기준. 실 운영 데이터·실 AI 출력·실 결제와는 다를 수 있음.

---

## 7. Docs consulted

- `docs/Wireframe/<각 화면>/{description,functional-spec,screen-data-summary}.md` + (있으면) `wireframe/hifi.png`
- `docs/sitemap.md`, `docs/admin-scope-boundary.md`, `CLAUDE.md`, `AGENTS.md`
- 코드: `src/components/{auth,writing,feedback,practice,library,shared}/*`, `src/lib/writing/*`, `src/app/(workspace)/**`
- 도구: `scripts/design-review/render-shot.mjs`, `playwright.config.ts`, `.scratch/review-2026-06-09/*`(캡처/시드/findings)
