# 문서 정합성 감사 보고서 (2026-06-16)

## 요약

- 범위: `AGENTS.md`, `docs/**`에서 시작하고, 직접 참조된 `README.md`, `TESTING.md`, `.env.example`, `src/**`, `supabase/**`, `tests/**`는 문서 정합성의 근거로만 확인했다.
- 수정 원칙: 코드/SQL 동작은 바꾸지 않고, active 문서·문서성 주석·안내 문구만 수정했다.
- 멀티에이전트 팀: 링크/참조, route/source, DB/admin, QA/assets를 병렬 조사로 운영하고, 본 보고서에서 최종 severity와 상태를 재판정했다.
- 중요한 결론: Wireframe 기준은 36개 화면이며, 모든 36개가 URL page라는 뜻은 아니다. `/auth/post-auth`, route handler, API route는 화면 수에 포함하지 않는 구현 route다.
- 중요한 결론: billing backing tables는 migration에 이미 있고, 실제 결제 provider checkout/write flow는 deferred다.

## 상태값

| 상태 | 의미 |
| --- | --- |
| `fixed` | active 문서 또는 문서성 주석을 이번 검수에서 수정함 |
| `not-a-bug` | 현재 규칙과 일치하거나 조건부 설명이라 결함 아님 |
| `historical-only` | 과거 보고서/계획/증거라 현재 기준으로 덮어쓰지 않음 |
| `cross-repo-source` | 다른 저장소가 명시된 출처 문서라 로컬 누락으로 보지 않음 |
| `external-reference` | gitignored 산출물, secret 포함 가능 파일 등 repo에 넣으면 안 되는 참조 |
| `needs-owner-decision` | 문서 수정만으로 소유권/운영 기준을 확정할 수 없음 |
| `unverified` | 정적 확인은 했지만 별도 도구/owner 확인이 필요한 후보 |

## Findings

| ID | Severity | Team | Category | Evidence | Target | 판단 | 조치 | 검증 방법 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DCA-001 | P1 | 링크/참조 | 깨진 내부 링크 | `README.md:235`, `README.md:245`, `README.md:257`, `src/lib/routes.ts:4`, `src/app/auth/sign-out/route.ts:3` | `docs/sitemap.md` | 실제 active sitemap은 `docs/flow/sitemap.md`다. | README 링크와 route 문서성 주석을 `docs/flow/sitemap.md`로 수정. | `rg 'docs/sitemap\.md'` 재실행. historical-only 항목만 남는지 확인. | fixed |
| DCA-002 | P1 | 링크/참조 | 깨진 이미지 링크 | `docs/flow/user-flow.md:16`, `docs/flow/user-flow.md:18` | `docs/flow/2026-06-15-paper-frame-user-flow.png` | `./evidence/...` 경로는 삭제됐고 파일은 `docs/flow/` 루트에 있다. | Markdown 링크와 이미지 경로를 현재 파일 위치로 수정. | `Test-Path docs/flow/2026-06-15-paper-frame-user-flow.png`. | fixed |
| DCA-003 | P1 | QA/assets | 깨진 사이트맵 이미지 | `docs/flow/sitemap.md:18` | `docs/flow/sitemap-diagram.png` | `talkpik-user-flow-sitemap.png`는 없고, `sitemap-diagram.png`와 `refinedd-sitemap-diagram.png`가 있다. | active Markdown은 명확한 canonical 파일명인 `sitemap-diagram.png`로 수정. `refinedd-*`는 보조 산출물로 보존. | `Test-Path docs/flow/sitemap-diagram.png`, 이미지 열람. | fixed |
| DCA-004 | P1 | route/source | 화면 수/route 분류 혼동 | `docs/ia.md:18`, `src/lib/routes.ts:31-53` | `docs/ia.md` | 36개 Wireframe 화면과 system-page/route handler/API route를 같이 세면 안 된다. | IA에 Route/Source 분류표 추가: Wireframe 36개, `/auth/post-auth` system-page, route handler, API route 분리. | `src/lib/routes.ts`, `docs/Wireframe/README.md`, `docs/ia.md` 대조. | fixed |
| DCA-005 | P1 | route/source | 회원가입 flow 불일치 | `src/components/auth/SignUpForm.tsx:142-171`, `docs/flow/user-flow.md:49`, `docs/Wireframe/01-A-01-sign-up/functional-spec.md:18` | A-01, X-12, `/auth/callback` | 이메일 가입은 A-03 직행이 아니라 X-12 인증 메일 안내 후 callback `next=/onboarding/learning-goal`로 이어진다. | user-flow와 A-01 기능명세의 이탈 경로를 이메일/소셜 가입별로 분리. | source와 문서 경로 대조. | fixed |
| DCA-006 | P1 | DB/admin | billing/deferred 표현 충돌 | `docs/Wireframe/25-X-03-paywall/functional-spec.md:39`, `docs/Wireframe/26-X-04-subscription-management/functional-spec.md:39`, `supabase/migrations/INDEX.md:82` | X-03, X-04 | billing tables는 존재하지만 provider checkout/write flow는 deferred다. | X-03/X-04 기능명세를 `subscription_plans`, `subscriptions`, `payment_history` read와 provider write deferred로 분리. | `rg`로 stale "Billing table is deferred" 계열 문구 제거 확인. | fixed |
| DCA-007 | P2 | DB/admin | DB 사용 역색인 누락 | `docs/Wireframe/data-usage-index.md:151`, `supabase/migrations/INDEX.md:82` | `data-usage-index.md` | billing 객체 섹션이 없어 X-03/X-04 화면 요약과 역색인이 어긋났다. | `subscription_plans`, `subscriptions`, `payment_history` 섹션 추가. | data-usage-index와 screen-data-summary/migration 대조. | fixed |
| DCA-008 | P2 | DB/admin | X-01 billing 근거 불균형 | `docs/Wireframe/23-X-01-product-landing/functional-spec.md:41`, `docs/Wireframe/23-X-01-product-landing/screen-data-summary.md:35` | X-01 | landing source의 직접 DB 의존은 낮지만, billing backing schema는 존재한다. | 기능명세에 schema-supported read와 현재 source 한계를 함께 기록. | source `src/app/page.tsx`, screen-data-summary, migration 대조. | fixed |
| DCA-009 | P2 | DB/admin | 알림 migration 근거 누락 | `docs/Wireframe/31-X-09-notification-settings/functional-spec.md:127`, `supabase/migrations/INDEX.md:138-140` | X-09 | email pipeline/defer migration이 기능명세 근거 목록에 없었다. | `20260612190000`, `20260612190100`, `20260612190200` migration을 근거 목록에 추가. | migration index와 기능명세 대조. | fixed |
| DCA-010 | P1 | DB/admin | 알림 운영 schema 소유권 | v13 replay-safe no-op migrations, topik-ai `supabase/migrations-admin/20260723011242_notification_pipeline_ownership_transfer.sql` | notification dispatcher/email pipeline | topik-ai 소유 운영 객체를 v13 migration 함수가 soft reference해 v13 단독 clean replay를 깨뜨렸다. | 2026-07-23 owner 승인으로 v13 과거 파이프라인 migration을 no-op으로 은퇴하고 canonical migration home을 topik-ai `admin_schema_migrations`로 이관했다. | v13 알림 구간 단독 replay + 양 repo 통합 shadow replay + owner/RLS/grants/row-count 대사. 전체 v13 reset의 후속 writing 의존성은 topik-ai gap register에서 blocker로 추적한다. | fixed |
| DCA-011 | P3 | DB/admin | TESTING admin 테스트 안내 | `TESTING.md:65`, `AGENTS.md:101` | `TESTING.md` | `admin-role-matrix.test.ts`는 실제 파일이 없고 active admin UI처럼 오해될 수 있다. | 테스트 목록에서 제거하고 admin UI 부재 및 보존 infra 검증 방식을 설명. | `Test-Path tests/integration/admin-role-matrix.test.ts` false 확인. | fixed |
| DCA-012 | P2 | 링크/참조 | theme 파일명 불일치 | `docs/ant-design/08-theme-architecture.md:151`, `src/theme/create-theme.ts` | `src/theme/antdTheme.ts` | `src/theme/antdTheme.ts`는 없고 `create-theme.ts`가 AntD theme config를 만든다. | theme architecture 문서를 실제 파일 구조에 맞춤. | `rg --files src/theme`, `rg 'src/theme/antdTheme.ts'`. | fixed |
| DCA-013 | P3 | 링크/참조 | App Router 루트 경로 표기 | `docs/ant-design/08-theme-architecture.md:232`, `docs/ant-design/07-review-checklist.md:43` | `src/app/layout.tsx` | repo 경로는 `app/layout.tsx`가 아니라 `src/app/layout.tsx`다. | AntD theme 문서와 checklist의 경로 표기 수정. | `Test-Path src/app/layout.tsx`. | fixed |
| DCA-014 | P3 | 링크/참조 | 사용자 안내 route 예시 | `docs/user-communication-style.md:50`, `src/lib/routes.ts:44` | `/writing/short-answer-writing-51` | `/writing` route는 없고 51~54 하위 route가 있다. | 사용자 설명 예시를 실제 학습 화면 route로 수정. | `rg '/writing/short-answer-writing-51' docs src/lib/routes.ts`. | fixed |
| DCA-015 | P2 | QA/assets | active spec의 삭제 brief 참조 | `docs/Wireframe/19-F-M1-pdf-export-modal/functional-spec.md:46`, `docs/qa/reports/qa-report-20260612-1205.html:114` | F-M1 PDF export | active spec이 삭제된 brief를 직접 근거처럼 참조했다. historical QA report 안 참조는 보존한다. | active spec의 문구를 "owner 지시와 QA report 기록 기준"으로 정리. | stale brief 경로가 active docs에는 없는지 `rg` 확인. | fixed |
| DCA-016 | P2 | QA/assets | 추가 화면 보조자료 우선순위 | `docs/Wireframe/33-X-11-auth-error/screen-data-summary.md:14`, `docs/Wireframe/39-X-17-auth-callback-fragment/screen-data-summary.md:14` | X-11, X-12, X-13, X-14, X-16, X-17 | 일부 추가 화면은 `wireframe.png`가 없고 `browser-screenshot.png`가 있다. | 6개 screen-data-summary의 우선순위를 `browser-screenshot.png(있는 경우)`로 정정. | `rg 'browser-screenshot.png\(있는 경우\)'` 확인. | fixed |
| DCA-017 | P3 | QA/assets | Markdown inline code 깨짐 | `docs/Wireframe/40-X-18-auth-consent/screen-data-summary.md:14` | X-18 screen-data-summary | 표 셀에 중첩 backtick이 있어 Markdown 파싱이 불안정했다. | 해당 셀의 inline code를 정상화. | Markdown 파일 포맷 검사. | fixed |
| DCA-018 | P1 | QA/assets | active QA 계획의 화면 수 | `docs/qa/qa-execution-plan.md:194`, `docs/qa/qa-execution-plan.html:210`, `docs/Wireframe/README.md:83` | QA execution plan | active QA plan은 35화면으로 남아 있었고 현재 Wireframe README는 36개다. | active MD/HTML 계획의 35화면 표현을 36화면으로 수정. | `rg '35화면' docs/qa/qa-execution-plan.*`에서 결과 없음 확인. | fixed |
| DCA-019 | P2 | QA/assets | 과거 QA report 화면 수/brief | `docs/qa/reports/qa-report-20260612-1205.html:58`, `docs/qa/reports/qa-report-20260612-1205.html:427` | historical QA report | 2026-06-12 당시 보고서의 35화면/brief 경로는 과거 판정 기록이다. | 수정하지 않고 historical-only로 보고. | report 파일은 보존, active QA plan은 수정. | historical-only |
| DCA-020 | P3 | 링크/참조 | cross-repo shared schema 문서 | `AGENTS.md:104` | topik-ai `docs/architecture/shared-supabase-schema-ownership.md` | 다른 저장소 문서를 명시한 cross-repo source다. | 로컬 누락으로 실패 처리하지 않음. | `topik-ai` 문맥과 AGENTS 문장 확인. | cross-repo-source |
| DCA-021 | P3 | QA/assets | design-redesign 절대경로 | `docs/design-redesign/2026-06-15/wireframe-ai-concepts/01-A-01-sign-up/default/concept-01/meta.json:4` | generated image metadata | 원본 생성 위치 추적용 historical trace다. repo 내 `image.png`는 존재한다. | 수정하지 않음. | QA/assets 팀 JSON/이미지 검사 결과: JSON parse 476/476, 이미지 decode 377/377. | historical-only |
| DCA-022 | P3 | QA/assets | gitignored auth state path | `docs/qa/reports/full-ui-state-capture-20260615-091636/manifest-20260615-091636.json:7` | `tests/e2e/auth-state/student.json` | 인증 상태 파일은 secret 포함 가능 gitignored 산출물이라 복원/commit 대상이 아니다. | 보고서-only로 분류. | `.gitignore`와 manifest 성격 확인. | external-reference |
| DCA-023 | P3 | QA/assets | design concept issue 상태 | `docs/design-redesign/2026-06-15/wireframe-ai-concepts/manifest.json:2365` | design concept artifacts | 117개 중 2개가 `generated_with_issues`다. 파일은 존재하고 이미지도 유효하다. | 후속 디자인 QA 후보로만 기록. | QA/assets 팀 이미지 구조 검사 PASS. | unverified |
| DCA-024 | P2 | DB/admin | admin 보존 infra | `AGENTS.md:101-104`, `supabase/migrations/20260609130000_remove_v13_admin_island.sql` | `profiles.app_role`, `admin_audit_logs`, `private.is_*_admin` | active admin route/UI가 아니라 보존 infra로 분류된다. | 제거/수정하지 않음. | AGENTS 관리자 경계와 migration 설명 대조. | not-a-bug |

## 수정 파일 요약

- 링크/경로: `README.md`, `.env.example`, `src/lib/routes.ts`, `src/app/auth/sign-out/route.ts`, `docs/flow/user-flow.md`, `docs/flow/sitemap.md`
- route/source: `docs/ia.md`, `docs/Wireframe/01-A-01-sign-up/functional-spec.md`
- DB/admin: `docs/Wireframe/23-X-01-product-landing/functional-spec.md`, `docs/Wireframe/25-X-03-paywall/functional-spec.md`, `docs/Wireframe/26-X-04-subscription-management/functional-spec.md`, `docs/Wireframe/data-usage-index.md`, `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`, `TESTING.md`
- QA/assets: `docs/Wireframe/19-F-M1-pdf-export-modal/functional-spec.md`, `docs/Wireframe/33-X-11-auth-error/screen-data-summary.md`, `docs/Wireframe/34-X-12-auth-verify-email/screen-data-summary.md`, `docs/Wireframe/35-X-13-terms/screen-data-summary.md`, `docs/Wireframe/36-X-14-privacy-policy/screen-data-summary.md`, `docs/Wireframe/38-X-16-password-reset-confirm/screen-data-summary.md`, `docs/Wireframe/39-X-17-auth-callback-fragment/screen-data-summary.md`, `docs/Wireframe/40-X-18-auth-consent/screen-data-summary.md`, `docs/qa/qa-execution-plan.md`, `docs/qa/qa-execution-plan.html`
- UI 문서: `docs/ant-design/07-review-checklist.md`, `docs/ant-design/08-theme-architecture.md`, `docs/user-communication-style.md`

## 검증 메모

- 최종 검증은 본 보고서 작성 후 `rg`, JSON parse, Markdown/HTML 포맷 검사로 재실행한다.
- 코드/SQL/e2e 동작 변경은 이번 범위 밖이다. 코드 파일 변경은 route 주석 두 곳뿐이며 런타임 동작은 바꾸지 않았다.
- 현재 worktree에는 작업 시작 전부터 광범위한 삭제/수정/신규 파일이 있었다. 본 감사는 그 변경을 되돌리지 않고, 문서 정합성 범위에서 필요한 최소 수정만 더했다.
