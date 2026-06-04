# 사용자 화면 디자인 개선 — 파일럿 실행 계획

> - **상태:** 승인됨 · **v4.0 (1차 실행 실패 교훈 반영 — 문서 게이트를 "기계 강제 게이트"로 전환)**
> - **작성일:** 2026-06-02 · **개정:** 2026-06-04 (v4)
> - **결정:** 파일럿 먼저 · Stitch `DESIGN.md`+테마 1:1 바인딩 · 보수적 정리 · 토큰 변경 폭 **최소 위험**
> - **검토:** codex(gpt-5.5) 2라운드 — 1차 16건(설계 보강) → 2차 16건(실행가능성·정합성) 전부 수용. v4 본문 강화는 Claude 독립 리뷰어 4명 적대적 교차검수.
> - **근거(정답지):** 승인된 마스터 플랜 `~/.claude/plans/refactored-knitting-dragonfly.md` §A — 본 v4 보완은 여기서 도출. **A단계 완료 자기검증 기준 문서.**
> - **실행 주체(중요):** 본 문서는 **AI 에이전트 자동검수 실행 문서**다. 에이전트는 §실행 체크리스트를 Step 0 → Phase 2 **자동 완료 게이트**까지 수행한다. **단 "완료"는 에이전트의 보고가 아니라 통합 게이트 명령의 종료코드(+CI)가 잠근다(§강제성 A0).**
> - **읽는 법:** **먼저 §강제성(A0)** — 판정·완료의 원천 — 을 읽고, 의도·근거는 §A–G, **에이전트 작업은 §"실행 체크리스트"를 위→아래로** 따른다.

---

## 강제성 (A0) — 판정은 "내가 적은 문서"가 아니라 "기계가 관찰한 현실"이 내린다

> **1차 실행 실패의 뿌리:** 실행 문서를 선택적으로 읽고 일부만 따랐다. (예: §공통 규칙 `"use client"`(#14)가
> **이미** 있었는데 `loading.tsx`에 미적용 → 런타임 #5; "인라인 매직넘버 → 토큰" 줄도 **이미** 있었는데 건너뜀.)
> "체크리스트에 증거를 적어라"는 여전히 내가 ledger를 쓰는 **자기보고**라 부풀릴 여지가 남는다.
>
> **핵심 전환:** "에이전트가 읽게" 강제하지 않는다. **안 읽으면 그 결과가 실제 코드·런타임에서 기계적으로
> FAIL나게** 만든다. (#14를 안 읽으면 코드에 버그가 남고 → M2가 실제 코드를 파싱해 FAIL. 읽음 여부 자체가 무의미.)

- **(1) 판정 원천 = 현실 관찰:** 각 요구의 합/불은 **실제 diff·소스·실행 런타임을 기계가 직접 검사**한 결과로
  결정한다. M1은 실제 앱을 `pnpm dev`로 띄워 실제 콘솔/런타임을 읽고, M2/M4는 실제 diff/소스를 파싱하며,
  커버리지는 실제 `git diff`에서 도출한다. **에이전트의 주장·서술은 판정에 개입할 수 없다.**
- **(2) 완료를 종료코드로 잠금:** 통합 게이트 명령이 로컬 + **CI(`.github/workflows/`)** 에서 통과해야만 완료다.
  에이전트의 "됐다"는 **권한 없음** — 완료/머지는 기계 게이트가 막는다(에이전트를 신뢰 경로에서 제거).
- **(3) 보고서 = 게이트 출력 자동 생성:** ledger 검증 섹션은 손으로 쓰지 않고 게이트 출력을 그대로 박는다(M3).
  손으로 쓴 "검증함/통과" 금지. (ledger는 증거의 *원천*이 아니라 게이트 결과의 *사본*.)
- **(4) 자동관찰 불가 요구 = fail-closed:** 기계가 관찰 못 하는 요구(예: 주관적 시각 품질)는 통과 처리하지 않고
  **차단** + 독립(gpt-5.5/사람) 사인오프를 요구한다. 이 집합을 **최소화**하는 게 설계 목표.
- **(5) validate-the-validator:** 각 게이트는 신뢰받기 전에 **실제 결함을 잡는지 먼저 증명**한다(M2가 현
  `loading.tsx`의 `Skeleton.Button`을 FAIL로 적발 → B1 후 GREEN; M3가 `/dashboard` 빠진 산출물을 FAIL로 적발).
- **한계(정직):** 모든 요구를 기계가 관찰하진 못한다 → (4)로 막되, 100% 자동 강제는 불가하다는 점을 과장하지 않는다.

### 명세 결함 수정 — 프로즈 규칙을 현실-관찰 게이트로 (1차 실패 7건)

| # | 1차 PLAN.md의 약점 | 보완(어떻게) | 게이트 |
|---|---|---|---|
| 1 | Phase 2 검증이 **prod `next start` + `/dev-preview/dashboard`·`/login`** 뿐 | **개발 모드(`pnpm dev`) + 변경이 닿는 실제 라우트**(`/`, 인증 `/dashboard`(그 `loading.tsx` 포함), `/login`)로 교체. prod는 dev 경고를 숨기고 dev-preview는 실제 대시보드가 아님 — 최대 결함 | M1 |
| 2 | 검증 라우트를 **손으로 선택** | 필요 라우트를 **diff에서 기계 도출**(특수파일+공유컴포넌트 역참조). 완료 보고는 스모크 산출물에서 **자동 생성**, 부분 커버리지면 **FAIL**, 손으로 쓴 "검증함" 금지 | C1+M3 |
| 3 | `loading.tsx` 스켈레톤 지시에 **복합 antd `"use client"` 경고 없음**(#14는 있으나 미적용) | 스켈레톤/복합 antd(`Skeleton.Button` 등)는 **`"use client"` 필수** 명시 + 서버 파일의 복합 하위 렌더를 기계 적발 | M2 |
| 4 | "인라인 매직넘버 → 토큰"에 **DoD·검사 없음** → 조용히 건너뜀 | DoD 항목화 + 신규 인라인 숫자 리터럴 **기계 검사**(탈출구·토큰면제) | M4 |
| 5 | "dev 중 build 금지"가 **Hard Rule 글**로만 존재 → 위반됨 | 사전점검(preflight)으로 강제 + "build→`.next` 삭제→dev" 복구 명문화 | M5 |
| 6 | 게이트가 **"코드가 도는가"** 만 봄 | 각 게이트는 **실제 결함을 잡는지 먼저 증명** | validate-the-validator |
| 7 | TDD가 **jsdom 통과=완료**로 읽힘 | jsdom 단위테스트는 RSC 경계 버그를 못 잡으니 **실제 라우트 dev 렌더로 보완** 명시 | M1 |

### 기계 게이트 (M1–M6, C1) — 싸고-바인딩 먼저

| 게이트 | 무엇을 관찰 | 구현 위치 | 상태 |
|---|---|---|---|
| **M2** RSC 복합렌더 가드 | 서버(RSC) 라우트 특수파일에서 antd 복합 하위(`Skeleton.Button` 등) JSX 렌더 적발. 훅(`.useX`)·`import type`·plain `<Antd/>`·`"use client"` 파일 제외 | `scripts/ai-workflow-check.mjs` `checkRscCompoundRender()` (스코프 `RSC_ENTRY_PATTERN`) | **구현·증명됨** |
| **M5** 빌드 위생 사전점검 | `pnpm dev` 살아있을 때 `pnpm build` 거부/경고(포트 프로브; `--force`/`AI_BUILD_PREFLIGHT_FORCE=1` 탈출구) | `scripts/build-preflight.mjs` + `package.json` `prebuild` 배선 | **구현·증명됨** |
| **M1** 개발-모드 스모크 | 기존 dev 재사용 또는 부팅 + 도출/명시 라우트(인증 세션 storageState) 콘솔·런타임(#5 시그니처)·스크린샷 → 아티팩트(`requiredRoutes/testedRoutes/perRouteResult`) | `scripts/dev-route-smoke.mjs` (`--routes`/`--base`/`--viewports`) | **구현·증명됨** (실제 인증 `/dashboard` #5 재검증 ✅) |
| **M3** 보고=증거 | M1 아티팩트 검증: `testedRoutes ⊊ requiredRoutes`·미부팅·**stale(headSha≠HEAD)** → FAIL | `scripts/ai-workflow-check.mjs` `checkSmokeCoverage()` + `--check-smoke` | **구현·증명됨** |
| **C1** 라우트 도출 | `git diff`→필요 라우트(특수파일+임포트그래프 역참조); admin/동적은 사유와 함께 제외 | `scripts/derive-smoke-routes.mjs` (`--base`) | **구현·증명됨** |
| **M4** 인라인-스타일 델타 가드 | 터치 파일 **신규** 인라인 숫자(`width/height/padding*/margin*/gap/borderRadius/inset`); `src/` 한정·델타(추가줄+신규파일)·토큰/상수·`opacity/zIndex/flex*` 면제·`// ai-check: allow-inline-number <사유>` 탈출구 | `scripts/ai-workflow-check.mjs` `checkInlineStyleNumbers()` + `--check-inline-styles` | **구현·증명됨** |
| **M6** antd deprecation 가드 | 터치 파일 **신규** antd 폐기 문법(`<Space direction>`→`orientation`·`bodyStyle/headStyle`→`styles.*`·`Tabs.TabPane`→`items`·`dropdownClassName`); **user-facing `src/` 한정(admin 동결 제외)**·델타(추가줄+신규파일)·`// ai-check: allow-antd-deprecated <사유>` 탈출구. **prop형만**(런타임/컨텍스트형 정적 `message`/`Modal.confirm`은 M1 콘솔 캡처가 담당). 버전핀 antd 6.4.3, 보수적 denylist | `scripts/ai-workflow-check.mjs` `checkAntdDeprecations()` + `--check-antd-deprecations` | **구현·증명됨** (실제 `<Space direction>` 적발→orientation는 무적발) |

> **통합 게이트(완료 잠금)** = `pnpm test`·`lint`·`typecheck`·(clean)`build` + `node scripts/ai-workflow-check.mjs --repo . --check-inline-styles --check-antd-deprecations`
> + **C1 도출 → 개발-모드 스모크(M1)** + admin diff 빈 출력. 이 명령의 **종료코드**가 완료를 잠근다(A0-(2)).
>
> ✅ **전 게이트(M2·M5·C1·M1·M3·M4·M6) 구현·증명 완료** (B단계, 위상순 M5→M2→C1→M1→M3→M4; M6은 C단계 추가). 통합 게이트의
> "완료 잠금"이 실제로 작동한다. 게이트 단위테스트 GREEN(M6 +6) + 각 게이트 validate-the-validator 증명.
> - **남은 격차(정직):** (a) **CI 배선은 D단계** — 그 전까지 A0-(2)의 강제는 로컬 통합 게이트 종료코드로만 성립.
>   (b) M3는 **신선도**를 강제하므로 코드 변경(커밋)으로 HEAD가 바뀌면 M1 스모크를 **재실행**해야 통과(설계대로).
>   (c) M4가 적발한 **신규 인라인 5건**(login·loading·dev-preview)은 **B3 토큰화(C단계)** 백로그.
>   (d) M6은 **신규 prop형 deprecation만** 델타로 막는다 — **기존** user-facing 폐기 문법(정적 `message`/`Modal.confirm`·`Descriptions bordered`·`Spin tip`·기존 `<Space direction>` 다수)은 **클러스터 확장 시 청산 백로그**(admin 제외). 런타임/컨텍스트형은 M1 콘솔 캡처(이제 antd deprecation warn도 수집)가 보조.
> - **validate-the-validator(전 게이트 증명):** M2=현 `loading.tsx` `Skeleton.Button` 적발; M5=리스너 포트 BLOCK(exit 2);
>   C1=공유컴포넌트→역참조 라우트; M1=#5 시그니처 FATAL + 실제 `/dashboard` 무에러 렌더; M3=라우트누락·stale FAIL;
>   M4=신규 인라인 적발·면제/JSX-attr/탈출구 비적발; **M6=신규 파일 `<Space direction>` 적발(exit 1)·`orientation`/Steps direction/주석/탈출구 비적발**.

---

## Context (왜)

화면이 밋밋한 핵심 원인은 **AntD+Tailwind near-stock**. 5가지: (1) 브랜드 정체성 없음(기본 파랑;
테마 비움 규칙), (2) 공통 레이아웃 반쪽(로그인후 셸만 있고 공개화면 제각각, `PageContainer`/`PageHeader`
부재), (3) `AppCard/AppModal/AppDrawer` 래퍼 문서엔 있고 코드엔 없음 + 119개 컴포넌트 100% 인라인
`style={{}}`, (4) **숨은 다크모드 버그**: 셸·헤더·랜딩이 **비승인 var `--app-bg`/`--app-border`** 사용
→ `#fff` 폴백, (5) 디자인 단일 기준 없음. Wireframe은 구조O 비주얼X. → 비주얼 기준을 DESIGN.md로 신설.

## Locked decisions

파일럿(로그인+대시보드) → 통과 시 클러스터 확장. Stitch DESIGN.md + `src/theme` 1:1. 보수적 정리 +
**최소 위험**(핵심 9개 글로벌 토큰은 AntD 기본 유지; 정리는 일관성·토큰화 + 셸 버그 + 컴포넌트 토큰 + 간격).

## Scope (admin 동결 — 정합성 보강 #6)

- **In:** user-facing 클러스터.
- **Out(절대):** admin **소스 파일** 편집 금지(`src/components/admin/**`, `src/app/(workspace)/admin/**`).
  글로벌 테마 파일(`app/layout.tsx`, `styles/global.css`, `src/theme/**`)이 admin **렌더에 영향**을 줄 수는
  있음 — 이는 **허용**(admin remediation 아님). 신규 DB 스키마 금지.
- **가드 명령(DoD):** `git diff --name-only -- src/components/admin "src/app/(workspace)/admin"` → **빈 출력**.

---

## 핵심 설계 결정 (근거·규칙)

### A. 토큰 불일치 방지 — 두 분기 명확화 (#2·#3)
- **분기 1 (최소위험 = 파일럿 기본):** brand-tokens manifest **없음**. `tailwind-bridge.ts`의 하드코딩
  `LIGHT/DARK_BRIDGE_VARS` **그대로 유지**. **parity 테스트**가 회귀 가드.
- **분기 2 (글로벌 토큰을 실제로 바꿀 때만 = 추후 (B) 승격 시):** `src/theme/tokens/brand-tokens.ts` 생성 →
  `presets/default.ts`와 `tailwind-bridge.ts`가 **둘 다 import** → parity = bridge↔manifest↔resolved.
- **parity 테스트 정의(#2, 실행 가능하게):** `tests/theme/theme-bridge-parity.test.ts`(신규).
  `BRIDGE_TOKEN_MAP`으로 9개 var ↔ AntD 토큰 매핑 후, 각 appearance에 대해
  `theme.getDesignToken(getAppTheme("default", appearance).antd)`의 **resolved 값**과 bridge 값을 대조
  (radius는 `px` 포맷). `getDesignToken`이 테스트 env에서 막히면 **문서화된 AntD v6.4.3 기본값 정적 맵**으로
  대조(현 하드코딩 값과 동일해야 함).
  ```
  BRIDGE_TOKEN_MAP:
    --app-color-primary        ↔ colorPrimary
    --app-color-bg-layout      ↔ colorBgLayout
    --app-color-bg-container   ↔ colorBgContainer
    --app-color-text           ↔ colorText
    --app-color-text-secondary ↔ colorTextSecondary
    --app-color-border         ↔ colorBorder
    --app-radius               ↔ borderRadius (→ `${n}px`)
    --app-font-family          ↔ fontFamily
    --app-shadow-elevated      ↔ boxShadowSecondary
  ```

### B. 토큰 분류 — Stitch YAML 순수, 바인딩 메타는 동반 표
YAML은 Stitch 표준 키만. 분류 태그(`antd.global`/`antd.component`/`layout-primitive`/`bridge`/`doc-only`)와
antdPath/sourceFile/bridge는 **부록 B 동반 표**에. `bridge`는 승인 9개만.

### C. 브랜드 토큰 위치
`global/shared-seed.ts`=불변값(fontFamily)만. 글로벌 override는 `presets/default.ts`에 토큰별 사유와 함께
(분기 2에서만). 08 stale 문구는 **Step 0에서** 먼저 정정.

### D. (위 Scope로 통합)

### E. Stitch DESIGN.md — 포맷·작성방식 충실 (★)
공식(`github.com/google-labs-code/design.md`, `designmd.ai`) 그대로.
- **YAML 키(이것만):** `version`(=`alpha`)·`name`·`description`·`colors`·`typography`·`rounded`·`spacing`·`components`.
- **토큰 타입:** Color(hex/`rgb()`/`oklch()`/named)·Dimension(`px`/`em`/`rem`)·Typography 객체
  (`fontFamily`/`fontSize`/`fontWeight`/`lineHeight`/`letterSpacing`/`fontFeature`/`fontVariation`)·참조 `{path.to.token}`(미해결=에러).
- **컴포넌트 속성(이것만):** `backgroundColor`·`textColor`·`typography`·`rounded`·`padding`·`size`·`height`·`width`. 변형=별도 항목(`button-primary-hover`).
- **섹션 순서(`##`, 생략 가능·순서 유지):** Overview→Colors→Typography→Layout→Elevation & Depth→Shapes→Components→Do's and Don'ts.
- **작성법:** YAML=정확한 값(기계), 마크다운=왜·어떻게(설명), 토큰 괄호 참조.
- **light/dark:** light를 Stitch 형식으로, dark는 **AntD darkAlgorithm 파생** 명시(비표준 키 금지).
- 골격은 **부록 B**.

### F. 08-theme-architecture.md 준수 (★, Step 0에서 강제)
모든 테마/스타일 작업 **전에 08 정독**(Reading Gate). AntD-first·Global vs Component·CSS 변수 계약 4규칙
(`--app-*`는 html/`:root`만·resolved 실제값·`@theme inline`·`cssVar.prefix`)·승인 브릿지 9개·Overlay Surface
규칙·08 Review Checklist의 자동 확인 가능 항목을 그대로 따른다. 포털 색 확인은 Playwright 스크린샷과 `<html style>` assert로 증거화한다. 테마 설정은 개발 내내 일관.

### G. 모션·로딩 UX — 절제 (#10·#11, `05` + ux-ui-pro-max §7)
- **모션:** `transform`/`opacity`만, 150~300ms, 1~2요소, **글쓰기/시험 콘텐츠 모션 금지**, 모션 토큰 AntD 기본 유지.
- **reduced-motion(#11, 정확 구현):** `src/styles/global.css`에 아래 블록 1회.
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important; animation-iteration-count: 1 !important;
      transition-duration: .01ms !important; scroll-behavior: auto !important;
    }
  }
  ```
  수용기준: OS '동작 줄이기' ON에서 전환/애니메이션이 사실상 정지.
- **로딩 역할 분리(#10):** `AppLoading`=**일반 단기 폴백(스피너)** 그대로. **레이아웃 맞춤 스켈레톤 = 세그먼트
  `loading.tsx`**, 첫 적용 = `dashboard/loading.tsx`(antd `Skeleton`, 공간 예약 CLS<0.1). ~300ms+에만 스켈레톤.
- **lazy(확장기):** 차트/무거운 컴포넌트(growth/reports/writing 에디터)는 `next/dynamic` + 스켈레톤 fallback.

### 공통 규칙
- **Overlay 부채(#9):** 래퍼(AppCard/AppDrawer/AppModal) 강제는 **터치한 allowlist 파일만**. 미터치 기존
  user-facing Card/Modal/Drawer = **추적 부채**(확장기 클러스터별 이전). AppModal은 첫 모달 클러스터(practice RetryModal)에서 도입.
- **"use client" 규칙(#14):** 상호작용/복합 AntD(예: `const {Title}=Typography`, Form/Modal/Drawer,
  `Skeleton.Button` 등 **복합 하위**)를 import·렌더하는 컴포넌트는 `"use client"` 필수. 서버 `page.tsx`는 서버로
  두고 클라 자식에 위임. **라우트 특수파일(`loading.tsx`/`error.tsx`/`template.tsx`)도 복합 antd를 렌더하면
  `"use client"` 필수** — 빠지면 RSC에서 복합 하위가 `undefined`라 런타임 "Element type is invalid"(=#5).
  **M2 가드가 누락을 기계 적발**(prod-only React #130도 같은 규칙으로 방지).
- **비승인 var 체커(#7·#8):** `scripts/ai-workflow-check.mjs`에 "`--app-*`는 승인 9개 이름만" allowlist 검사
  추가. 보조 확인 명령: `rg -o "--app-[a-z-]+" src | Sort-Object -Unique` ⊆ 승인 9개. **현재 위반 전부 교체**
  (확인된: `WorkspaceShell.tsx`, `AppHeader.tsx`, `LandingHeader.tsx` — 체커가 더 찾으면 그것도) → **repo 전체 0**.
- **빌드 위생(Hard Rule, #5):** `pnpm dev`가 살아있는 동안 `pnpm build` 금지 — `.next`가 오염돼 "(stale)"
  가짜 런타임 에러가 난다. **M5 사전점검**이 dev 실행 중 build를 거부/경고한다. 오염 시 복구:
  **dev 정지 → `.next` 삭제 → `pnpm dev` 재시작**.

---

## 실행 체크리스트 — 에이전트 자동 실행 (Step 0 → Phase 2 자동 완료 게이트) — #4

> **이 섹션은 AI 에이전트의 실행 범위다.** 에이전트가 위→아래로, 각 단계는 앞 단계 DoD 통과 후 진행하며,
> **Phase 2의 "자동 완료 게이트"가 이 문서의 종료점**이다.
> 모든 단계는 해당 실행일 ledger(`docs/ai-workflow/runs/YYYY/MM/DD/`)에 기록(1차 `…/06/02/`, v4 강화·재실행 `…/06/04/`).

### Step 0 — 선행 게이트 (코드 손대기 전, #5)
- [ ] `docs/ant-design/08-theme-architecture.md` 정독 + `02/03/05/07` 훑기 → ledger "Docs consulted" 기록.
- [ ] `08`의 stale 문구("`src/` 없음", "default preset 비움") 먼저 정정 + DESIGN.md 링크 자리 확보(설계 C·F).
- [ ] python preflight: `python --version` 확인 후 `python .codex/skills/ui-ux-pro-max/scripts/search.py "education korean test-prep calm focused professional" --design-system -f markdown` → 출력은 **권고 후보**로만.
- **DoD:** ledger에 docs consulted·08 핵심 규칙 요약 기록, preflight 결과 첨부.

### Phase 0 — 디자인 토대
- [ ] **RED:** `tests/theme/theme-bridge-parity.test.ts` 작성(설계 A의 `BRIDGE_TOKEN_MAP` + `theme.getDesignToken`). 실패 확인.
- [ ] **DESIGN.md(루트)** 작성 — Stitch 포맷·작성법 충실(설계 E), 바인딩 메타는 부록 표(설계 B). light=Stitch / dark=darkAlgorithm 파생.
- [ ] **분기 1(최소위험):** `src/theme` 글로벌 9토큰 **변경 없음**. 컴포넌트 토큰만 절제 조정 → `components/shared.ts`. `shared-seed.ts`=폰트만. (글로벌 변경 필요 시에만 분기 2 + brand-tokens.ts.)
- [ ] typography: AntD 기본 fontSize **14 유지**(#16, 전역 16 금지).
- [ ] **GREEN:** parity 테스트 통과(하드코딩 bridge === resolved AntD 기본값). `tests/theme/theme-contract.test.ts` 동기화(같은 커밋).
- [ ] `node scripts/ai-workflow-check.mjs` 통과.
- **DoD:** DESIGN.md 존재 + Stitch 키 검증 통과, parity·contract 테스트 GREEN, ai-workflow-check GREEN, 9 글로벌 토큰 미변경(diff 확인).

### Phase 1 — 공통 레이아웃 / surface
- [ ] **비승인 var 체커(#8)**: `ai-workflow-check.mjs`에 allowlist 검사 추가(RED: 현재 위반 적발).
- [ ] **셸·랜딩 var 정리(#7, 다크모드 버그)**: `WorkspaceShell.tsx`·`AppHeader.tsx`·`LandingHeader.tsx`(및 체커 적발분)의 `--app-bg`/`--app-border` → 승인 9-var 또는 AntD 토큰. **repo 전체 grep-0**.
- [ ] **reduced-motion(#11)**: `global.css`에 §G 블록 1회.
- [ ] **신규 공통 부품**(RED→GREEN, TDD 계약): `AppCard.tsx`(`.app-card/.app-surface`), `AppDrawer.tsx`(`.app-drawer`; **WorkspaceShell 모바일 메뉴로 실검증** = overlay 센티넬), `PageContainer.tsx`(`main` 랜드마크+sizing), `PageHeader.tsx`(카피 없음), **`PublicShell.tsx`(공유 컴포넌트, #12 확정)**.
- [ ] **AppModal은 생성 안 함**(첫 모달 클러스터로 연기, §공통 규칙).
- [ ] TDD 계약(#12·#15 a11y): prop 전달·클래스 훅·접근명·Drawer esc/overlay 닫기·`main` 랜드마크·**컴포넌트 `style`에 `--app-*` 선언 없음** assert·포커스 복귀/키보드 닫기/focus-visible. `renderWithIntl` 재사용, **role/key 기반(한글 리터럴 금지)**.
  - **jsdom GREEN ≠ 완료(#7):** jsdom 단위테스트는 RSC 서버/클라 경계 버그(#5 류)를 **못 잡는다**. 라우트 특수파일·서버 컴포넌트는 **실제 라우트 dev 렌더(M1)** 로 반드시 보완한다.
- **DoD:** 신규 부품 테스트 GREEN, 비승인 var repo 0(체커 GREEN), reduced-motion 블록 존재, AppModal 미생성 확인, admin diff 빈 출력.

### Phase 2 — 파일럿 화면 + 검증
- [ ] **allowlist 외 파일 변경 금지**: 로그인(`app/login/page.tsx`, `components/auth/LoginForm.tsx`, PublicShell), 대시보드(`components/dashboard/*`), 셸(Phase 1). admin diff 빈 출력 재확인.
- [ ] 인라인 매직넘버 → 토큰/공통부품. 직접 `Card`/`Drawer` → `AppCard`/`AppDrawer`(터치 파일만). 로딩/빈/에러/성공/비활성 상태. `"use client"` 규칙(§공통). 구조=Wireframe, 비주얼=DESIGN.md.
  - **DoD(M4):** 터치한 파일에 **신규 인라인 숫자 리터럴**(`width/height/padding*/margin*/gap/borderRadius/inset`) 0. 토큰/상수 사용·`opacity/zIndex/flex*` 면제·`// ai-check: allow-inline-number <사유>` 탈출구. **M4가 diff를 파싱해 기계 적발**(손으로 "정리함" 금지).
  - **DoD(M6):** 터치한 user-facing 파일(admin 제외)에 **신규 antd 폐기 문법** 0(`<Space direction>`·`bodyStyle/headStyle`·`Tabs.TabPane`·`dropdownClassName`). 6.x 대체(`orientation`/`styles.*`/`items`/`popupClassName`) 사용·`// ai-check: allow-antd-deprecated <사유>` 탈출구. **M6가 diff를 파싱해 기계 적발**(손으로 "마이그레이션함" 금지).
- [ ] **대시보드 스켈레톤**: `src/app/(workspace)/dashboard/loading.tsx`(레이아웃 맞춤 antd `Skeleton`, CLS 예약). **복합 antd(`Skeleton.Button` 등)를 렌더하므로 맨 위 `"use client"` 필수**(§공통 #14) — **M2 가드가 누락 시 FAIL**.
- [ ] **QA 픽스처(#13 확정)**: dev 프리뷰 라우트 `src/app/dev-preview/dashboard/page.tsx` — 대시보드 표현 컴포넌트를 **픽스처 props·무인증**으로 렌더(실데이터/Supabase 불필요). 파일럿 스캐폴딩(네비 미연결, 확장 전 제거/플래그). **단, 이것은 보조 픽스처일 뿐 검증 대상이 아니다 — 검증은 아래 실제 라우트 스모크(M1)로 한다.**
- [ ] **(자동 완료 게이트, #1·A0):** **M5 사전점검(dev 미실행 확인) →** focused `pnpm vitest run` → `pnpm lint` → `pnpm typecheck` → **(clean) `pnpm build`** → `node scripts/ai-workflow-check.mjs --repo . --check-inline-styles --check-antd-deprecations`(**M2(--repo)·M4·M6 arm 작동**; M3는 `--check-smoke`로 합류 — §강제성 게이트 표) → parity 테스트, 전부 GREEN. 그 후 **C1으로 변경분에서 라우트 도출 → 개발 모드(`pnpm dev`) 스모크(M1)** — prod·dev-preview가 아니라 도출된 **실제 라우트**(C1 미구현 시 하드 폴백 `/`·`/login`·`/dashboard`):
  - 대상 라우트: `/`, `/login`, **인증 `/dashboard`(그 `loading.tsx` 포함)** — 인증은 storage-state 세션 시드. (prod는 dev 경고를 숨기므로 금지; dev-preview는 실제 대시보드가 아님.)
  - 각 라우트 360/768/1280: **콘솔 에러 0, 런타임 오버레이 없음**, 가로 스크롤 없음, `loading.tsx` 정상 렌더(undefined-element 크래시 없음)
  - `theme-appearance` 쿠키로 light/dark, `<html style>`에 기대 bridge 값 assert; 느린 네비 시 스켈레톤 요소 존재, reduced-motion 매체 존중
  - 스크린샷 {light,dark}×{360,768,1280} 저장 → `docs/ui-redesign/pilot-shots/`
  - **산출물 저장**(`{baseSha,headSha,changedFiles,requiredRoutes,testedRoutes,perRouteResult}`) → **`testedRoutes ⊊ requiredRoutes`면 게이트 FAIL**(M3).
  - **M1 종료 시 dev 서버 teardown**(살린 채 종료 금지) — 게이트 재진입 시 (clean) build가 M5에 막히지 않도록. build↔dev 상호배제는 **M5 preflight가 build 직전**에 보장.
- **DoD(에이전트):** 위 통합 게이트 명령의 **종료코드 0** + M1 스모크 GREEN + 스크린샷 산출 + **ledger 검증 섹션은 게이트 출력에서 자동 생성(M3)**. **"완료"는 종료코드(+CI)가 잠근다 — 에이전트의 보고가 아니다(A0).** ← **이 문서의 실행은 여기서 끝.**

---

## Critical files (must / conditional / read-only) — #15

| 파일 | 구분 | 조건/메모 |
|---|---|---|
| `DESIGN.md`(루트) | must (new) | Phase 0 |
| `tests/theme/theme-bridge-parity.test.ts` | must (new) | Phase 0 |
| `tests/theme/theme-contract.test.ts` | must (edit) | 값 변경 시 동기화 |
| `src/theme/components/shared.ts` | must (edit) | 컴포넌트 토큰 절제 조정 |
| `scripts/ai-workflow-check.mjs` | must (edit) | 비승인 var allowlist 검사 추가 |
| `src/styles/global.css` | must (edit) | reduced-motion 블록 |
| `src/components/app/WorkspaceShell.tsx`·`AppHeader.tsx` | must (edit) | var 정리 + AppDrawer |
| `src/components/landing/LandingHeader.tsx` | must (edit) | var 정리(이름 교체만) |
| `src/components/shared/{AppCard,AppDrawer,PageContainer,PageHeader,PublicShell}.tsx` | must (new) | Phase 1 |
| `src/app/(workspace)/dashboard/loading.tsx` | must (new) | Phase 2 스켈레톤 |
| `src/app/dev-preview/dashboard/page.tsx` | **conditional** (scaffold·검증 비대상) | QA 픽스처 — 네비 미연결, 확장 전 제거/플래그 |
| 로그인/대시보드 화면·컴포넌트 | must (edit) | Phase 2 allowlist |
| `src/theme/presets/default.ts` | **conditional** | 글로벌 변경(분기 2) 시에만 |
| `src/theme/tokens/brand-tokens.ts` | **conditional (new)** | 분기 2 시에만 |
| `src/theme/tailwind-bridge.ts` | **conditional** | 분기 2 시에만(분기 1은 그대로) |
| `src/app/layout.tsx` | **read/verify** | 분기 1에선 미변경(주입 흐름 확인만) |
| `docs/ant-design/08-theme-architecture.md` | must (edit) | Step 0 stale 정정 |

---

## 확장 로드맵 (파일럿 통과 후)

클러스터마다 [토큰 적용 → 공통부품 교체(allowlist) → 상태 점검 → Windows-safe QA → UX/UI Consistency Pass].
AppModal은 첫 모달 클러스터 도입. 차트/무거운 컴포넌트는 `next/dynamic` lazy + 스켈레톤. 데이터 화면은 세그먼트
`loading.tsx`. 미터치 overlay 부채를 클러스터별 청산. 순서: auth/onboarding 나머지 → practice(RetryModal=AppModal)
→ writing → feedback/reports → library → growth → settings/profile/notifications → paywall/subscription. (admin 제외)

## Gates 요약 (체크리스트가 본체; 여기선 목록만)

Context ledger(1515 후속, 본 2라운드 codex 검토 기록) · Plan-Review PASS(=본 검토) · 코드 변경마다 cross-model
review(**한글 카피는 Claude 리뷰어**) · TDD · CSS Variable Scoping Gate(ai-workflow-check) · UX/UI Consistency Pass ·
Architecture Pass · 08 Review Checklist · **기계 게이트 M1–M5/C1**(§강제성 A0) · **자동 완료 게이트**(§실행 체크리스트, 자동).

## Risks

- 토큰 불일치 → 분기 1 하드코딩 유지 + parity(resolved 대조)로 가드.
- admin 침범 → 소스 0편집 + `git diff` 빈 출력. 글로벌 렌더 영향은 허용.
- 변화 미미 → 컴포넌트 토큰·간격·셸 버그 + 전/후 스크린샷; 약하면 분기 2(절제된 정제)로 승격.
- prod-only React #130 → "use client" 규칙 + prod build.
- i18n/한글 assert → 구조부품 카피 없음 + role/key 테스트.
- dev-preview 라우트 누수 → 네비 미연결 + 확장 전 제거/플래그.

## 타이브레이크 결정 (확정)

토큰 변경 폭 = **(A) 최소 위험**(9 글로벌 AntD 기본 유지). codex 2라운드와 합의, 미해결 이견 없음.
자동검수 산출물(검사 결과 + 스크린샷)이 변화 부족을 보여주면, 별도 후속 계획에서 분기 2 승격을 검토한다.

---

## 부록 A — codex 교차검토 이력

- **1차(설계):** 16건(P0 1) → 15 수용·1 보강. 핵심: 토큰 manifest·parity, 브랜드 위치, overlay 센티넬, admin 가드, 셸 var 버그, QA 인증의존, Windows-safe QA.
- **2차(실행가능성·정합성):** 16건(P0 3) → **전부 수용**. 핵심: 완료 범위 명확화(#1), parity 구조 수정(#2), manifest 분기(#3), **단일 실행 체크리스트+DoD(#4)**, 08 Step0 강제(#5), admin 명령(#6), LandingHeader 누락(#7), var 체커 정의(#8), overlay 부채(#9), 로딩 모순(#10), reduced-motion 구현(#11), PublicShell 확정(#12), QA 픽스처 확정(#13), use-client 규칙(#14), Critical files 표(#15), 부록 표 출처(#16).
- **판정:** 1·2차 모두 NEEDS_REVISION → (반영 후) 실행 준비 완료.
- **v3.3:** 본 문서를 **AI 자동검수 전용 실행 문서**로 고정하고, 실행 범위·완료 조건·Gates 요약·타이브레이크 문구를 자동 완료 기준에 맞춰 정리함.
- **v4.0(1차 실행 실패 교훈):** 1차 파일럿이 "74/74 검증완료"로 보고됐으나 실제 `pnpm dev`에서 결함 발견(`loading.tsx` RSC 런타임 #5, antd v6 deprecation, 인라인 미정리; 검증을 prod·jsdom·dev-preview로만 함). 근본 원인 = **선택적 읽기/이행 + 그걸 잡을 기계 게이트 부재**. 보완: **§강제성(A0)** 신설(판정=기계 현실관찰·완료=게이트 종료코드/CI·보고=게이트 출력 사본) + 명세 결함 7건을 현실-관찰 게이트(M1 개발-모드 스모크·M2 RSC 가드·M3 보고=증거·M4 인라인 델타·M5 빌드 위생·C1 라우트 도출)로 전환 + validate-the-validator. gpt-5.5(codex) 적대적 렌즈 3 + 합의 1로 검증된 마스터 플랜 반영. **게이트 전환은 설계 완료**이고 구현은 **M2만 완료·증명**(M1·M3·M4·M5·C1은 §강제성 게이트 표 순서대로 구현 예정). 의도적 정정·보강 2건 기록: 결함 #2 귀속을 마스터의 **M1→C1**(라우트 도출 책임=C1)로 정정, M1 스모크 뷰포트를 **360/1280→360/768/1280**(태블릿 보강). v4 본문 강화는 Claude 독립 리뷰어 4명(결함커버리지·내부정합성·충실성·완전성)의 적대적 교차검수로 P1 7건·P2 일부 반영.
- **v4.1(B단계 — 게이트 구현 완료):** 설계만 있던 게이트를 실제 코드로 구현(전부 TDD RED→GREEN + validate-the-validator). 신규: `scripts/build-preflight.mjs`(M5, `prebuild` 배선), `scripts/derive-smoke-routes.mjs`(C1), `scripts/dev-route-smoke.mjs`(M1); 확장: `scripts/ai-workflow-check.mjs`에 `checkSmokeCoverage`(M3, `--check-smoke`)·`checkInlineStyleNumbers`(M4, `--check-inline-styles`). 단위테스트 68 GREEN. **M1이 실제 인증 `/dashboard`를 dev로 렌더해 #5 무재발 확정**(핸드오프가 미완이라던 검증). M4가 신규 인라인 5건 적발 = B3(C단계) 백로그. 잔여: CI 배선(D), B2/B3(C).
- **v4.2(B단계 — 게이트 적대적 교차검수 + 보강):** Claude 독립 리뷰어 4명이 게이트 코드를 적대 검수 → **22건(P0 1·P1 11·P2 10)**. 자기 단위테스트는 통과했지만 실제 목적에 구멍 발견 → 리뷰어 repro를 테스트로 박아 TDD로 수정(단위테스트 **90 GREEN**). 수정: **M5** 단일포트 3000→다중포트(3000-3003·3100)+IPv4/IPv6+포트검증/크래시가드(P0/P1); **C1** 사이드이펙트 `import "x"`(global.css 등)·`.css` 해석→CSS-only 변경 진공통과 제거(P1)+중첩레이아웃 서브트리 스코프(P2); **M1** dev 에러 오버레이(200 위장) DOM 탐지→fatal(P1)+React #130 시그니처+Fast Refresh 정밀화+0-visit fail-closed; **M3** 빈/누락 requiredRoutes·headSha 누락·HEAD 미상·실패 perRoute 전부 fail-closed+슬래시 정규화(P1×4); **M4** 삼항/표현식 값 적발+주석/문자열 false-positive 제거+staged(HEAD 대비) 포함(P1×3). **의도적 미수정(정직):** CI 배선(D단계), M3의 독립 재유도 교차검증(좁은 `--routes` under-declare 방어는 부분만)·M1 재사용 서버 buildId 검증·M5 비-dev 리스너 구분은 후속 hardening으로 기록.
- **v4.3(C단계 — antd deprecation 게이트 M6 신설 + M1 보강):** 사용자 보고로 /dashboard 콘솔 에러 = `<Space direction>` (antd 6.4.3 폐기, `node_modules/antd/es/space/index.js`의 `[['direction','orientation'],...]`에서 확인) 적발. 1차 실패 3대 결함(RSC #5·**antd deprecation**·인라인) 중 **deprecation만 전용 게이트가 없던** 격차를 메움. **즉시 수정**: `dashboard/page.tsx`의 `direction`→`orientation`(loading.tsx·DashboardBody는 이미 마이그레이션됨, page.tsx만 누락; 커밋 `2b8b6c3`). **게이트 M6 신설**(TDD RED→GREEN, 게이트 단위테스트 +6): `checkAntdDeprecations()`(버전핀 보수적 denylist, prop형만) + `--check-antd-deprecations` arm(user-facing src 델타, admin 제외, 탈출구). validate-the-validator: 신규 파일 `<Space direction>` FAIL(exit 1)·`orientation`/Steps direction/주석/탈출구 비적발(라이브 + 단위). **M1 보강**: `dev-route-smoke.mjs`가 antd deprecation `console.warn`도 수집(default는 console.error지만 non-strict WarningContext 경로 대비; `[antd…deprecat` 필터로 React 잡음 배제) — M1이 `error`만 보던 구멍 메움. **의도적 미수정(정직):** 기존 user-facing 폐기 문법 **전체 sweep**(정적 message/Modal.confirm·Descriptions bordered·Spin tip·기존 Space direction 다수)은 클러스터 확장 백로그(M6은 신규만 델타로 차단); M6 denylist는 수동·버전핀이라 antd 업글 시 갱신 필요; CI 배선(D)·게이트 코드 적대적 cross-review는 후속. cross-model review = degraded(단일 세션 구현, validate-the-validator로 대체 증거; 한글 카피 mojibake로 codex 부적격, 후속 Claude 리뷰어 권고).

## 부록 B — DESIGN.md Stitch 골격 (이 형태 그대로 작성)

```markdown
---
version: alpha
name: TALKPIK
description: Calm, focused Korean(TOPIK) study tool — quiet surfaces, one clear action
colors:
  primary: "#1677ff"        # AntD 기본 유지(최소 위험)
  text: "rgba(0,0,0,0.88)"
  text-secondary: "rgba(0,0,0,0.65)"
  border: "#d9d9d9"
  bg-layout: "#f5f5f5"
  bg-container: "#ffffff"
typography:
  body-md: { fontFamily: system-ui, fontSize: 14px, lineHeight: 1.5715 }   # AntD 기본 14
  title-lg: { fontFamily: system-ui, fontSize: 20px, fontWeight: 600 }
rounded:
  md: 6px
spacing: { sm: 8px, md: 16px, lg: 24px }
components:
  card:    { backgroundColor: "{colors.bg-container}", rounded: "{rounded.md}", padding: "{spacing.md}" }
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.bg-container}", rounded: "{rounded.md}" }
---

## Overview
무엇을 기억시킬지 + 톤(차분·집중), 왜 화려하지 않은지.
## Colors
각 색의 역할 한 줄. 예: 주 강조 primary (`{colors.primary}`).
## Typography
본문/제목 위계·한국어 가독성.
## Layout
8 기반 간격 리듬(sm/md/lg)·페이지 여백.
## Elevation & Depth
표면 분리 그림자 — 과한 그림자 금지.
## Shapes
모서리(rounded.md) 적용 범위.
## Components
card/button 토큰 상속 + 변형(button-primary-hover).
## Do's and Don'ts
- Do: AntD 토큰/컴포넌트 우선, 한 화면 한 주 액션, 로딩 300ms+엔 레이아웃 맞춤 스켈레톤, 모션 transform/opacity 150~300ms, reduced-motion 존중.
- Don't: 인라인 매직넘버, 색만으로 의미, 카드 안 카드, 글쓰기/시험 모션, 큰 페이지 전환.
```

### 동반 표 — Token ↔ AntD 바인딩 (#16: 미변경 기본값 출처 = AntD 기본)

| DESIGN.md 토큰 | class | antdPath | sourceFile | bridge var |
|---|---|---|---|---|
| `colors.primary` | antd.global | `theme.token.colorPrimary` | **AntD v6.4.3 기본**(미변경) | `--app-color-primary` |
| `colors.bg-container` | antd.global | `theme.token.colorBgContainer` | AntD 기본/algorithm | `--app-color-bg-container` |
| `colors.text` | antd.global | `theme.token.colorText` | AntD 기본/algorithm | `--app-color-text` |
| `rounded.md` | antd.global | `theme.token.borderRadius` | AntD 기본(미변경) | `--app-radius` |
| `typography.body-md` | antd.global | `theme.token.fontSize`/`fontFamily` | `shared-seed.ts`(font만) | `--app-font-family` |
| (shadow) | antd.global | `theme.token.boxShadowSecondary` | AntD 기본/algorithm | `--app-shadow-elevated` |
| `components.card` | antd.component | `theme.components.Card` | `components/shared.ts`(변경 시) | — |
| `spacing.*` | layout-primitive | (Tailwind/레이아웃) | — | — |

> 규칙: `bridge`=승인 9개만. **미변경 기본값의 출처는 "AntD 기본/darkAlgorithm"**, 실제 override만 repo 파일 명시.
> 모든 값은 `src/theme`와 일치해야 하며 parity 테스트로 가드(설계 A).
