# IA Implementation Audit

- Run id: 20260601-120308
- Source commit: 8aa9594ffe760b3f279c0d79f8039524082849d6
- Evidence bundle: d5ba82a8d0232a96

| IA | Screen | Route | Type | Audience | Final label | Top gaps |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 | Sign-up | `/sign-up` | page | public | PARTIAL | none |
| A-02 | Login | `/login` | page | public | PARTIAL | none |
| A-03 | Learning goal setup | `/onboarding/learning-goal` | page | user | PARTIAL | none |
| B-01 | Home dashboard | `/dashboard` | page | user | BLOCKED | Primary CTA matching /(학습\s*시작|쓰기\s*연습|이어하기|시작)/i not visible<br>Seed gap: student@audit.local has no learning_goal row; dashboard page redirects to /onboarding/learning-goal when goal is null (src/app/(workspace)/dashboard/page.tsx:29).<br>No populated-dashboard evidence: KPI cards, '이어 풀 문제' recommendation, RecentFeedback, and Alerts never rendered (requires seeded goal + attempts + feedback rows). |
| C-01 | Problem type recommendations | `/practice/recommendations` | page | user | BLOCKED | Primary CTA matching /(시작|선택|문제\s*풀기)/i not visible |
| C-02 | Problem list | `/practice/problems` | page | user | PARTIAL | none |
| C-03 | Retry modal | `/practice/problems` | user chooses to solve a previously attempted or retry-eligible problem. | user | PARTIAL | none |
| D-01 | Short-answer writing 51 | `/writing/51` | page | user | PARTIAL | none |
| D-02 | Answer writing 52 | `/writing/52` | page | user | PARTIAL | none |
| D-03 | Long-form writing 53 | `/writing/53` | page | user | PARTIAL | none |
| D-04 | Essay writing 54 | `/writing/54` | page | user | PARTIAL | none |
| D-M1 | Submission confirmation | `/writing/51, /writing/52, /writing/53, /writing/54` | user submits a writing answer. | user | BLOCKED | Modal trigger did not fire OR modal never became visible — selectors are heuristic; Phase 5 reviewer must verify against actual UI source.<br>Missing data precondition: no writing_problems row seeded for question 51 (seed-results.json seeded submissions/feedback only). /writing/51 renders <Empty> with no editor and no 제출하기 trigger.<br>Hosted-surface BLOCKED: triggerFired=false, surfaceOpened=false; no focus/keyboard/dup-prevention/failure-retry evidence captured. |
| D-M2 | AI analysis loading | `writing submission flow` | submission accepted and feedback/report generation is pending. | user | BLOCKED | Modal trigger did not fire OR modal never became visible — selectors are heuristic; Phase 5 reviewer must verify against actual UI source. |
| E-01 | Short-answer feedback | `/writing/feedback/short/:id` | page | user | BLOCKED | Primary CTA matching /(다시\s*풀기|저장|next|다음)/i not visible<br>Wrong-owner / owner-:id rows not seeded -> owner-id RLS isolation genuinely unverifiable.<br>Tested :id did not render a complete feedback bundle (pending/empty branch), so score/dimension/CTA content is not confirmed on real render. |
| E-02 | Long-form feedback | `/writing/feedback/long/:id` | page | user | BLOCKED | Primary CTA matching /(다시\s*작성|PDF|비교|next)/i not visible<br>Wrong-owner / owner-:id rows not seeded -> owner-id RLS isolation unverifiable.<br>Tested :id did not render a complete feedback bundle (no H1/CTA captured). |
| R-01 | Comparison report | `/writing/reports/:id/compare` | page | user | BLOCKED | Primary CTA matching /(다음|시작|개선|약점)/i not visible<br>Wrong-owner / owner-:id rows not seeded -> owner-id RLS isolation unverifiable.<br>No retained rendered screenshot for R-01 (section 9 no-PASS). |
| R-02 | Next problem recommendation | `/practice/next` | page | user | PARTIAL | none |
| F-01 | My library | `/library` | page | user | BLOCKED | Heading "내 라이브러리" did not match expected pattern /(서재|library|보관|저장)/i<br>Primary CTA matching /(저장|PDF|상세|export)/i not visible<br>wrong-owner storageState + seeded other-user library row not available — OWNER-CHECK unverified |
| F-M1 | PDF export modal | `/library, /writing/feedback/short/:id, /writing/feedback/long/:id, /writing/reports/:id/compare` | user exports feedback or report content. | user | BLOCKED | Heading "내 라이브러리" did not match expected pattern /(PDF|내보내기|export)/i<br>Modal trigger did not fire OR modal never became visible — selectors are heuristic; Phase 5 reviewer must verify against actual UI source.<br>Hosted modal trigger did not fire from host route; no rendered modal evidence |
| G-01 | Language settings | `/settings/language` | page | user | BLOCKED | Honesty: 'i즉시 반영' copy overclaims immediate UI re-translation while i18n is OOS-7 — should be reworded before PASS.<br>Missing documented unsaved-leave guard.<br>Documented 학습 언어 / 콘텐츠 설정 / 도움말 / 미지원-언어 안내 regions not implemented. |
| H-01 | Admin problem management | `/admin/problems` | page | admin | BLOCKED | Primary CTA matching /(저장|승인|발행|편집)/i not visible<br>Admin RBAC precondition not met: content_admin storageState carries app_role='learner' (build-status.json postSeedNote), elevation SQL not applied → admin-allowed render unverified<br>No rendered admin screenshot evidence on disk for H-01 at any viewport |
| D-M3 | Autosave warning | `/writing/51, /writing/52, /writing/53, /writing/54` | autosave failure, delay, or conflicting save state. | user | BLOCKED | Modal trigger did not fire OR modal never became visible — selectors are heuristic; Phase 5 reviewer must verify against actual UI source. |
| X-01 | Product landing | `/` | page | public | PARTIAL | none |
| X-02 | Growth dashboard | `/growth` | page | user | BLOCKED | Primary CTA matching /(추천|개선|상세|확인|학습)/i not visible |
| X-03 | Paywall | `/paywall` | page | user | BLOCKED | Primary CTA matching /(구독|시작|선택|체험)/i not visible |
| X-04 | Subscription management | `/subscription` | page | user | BLOCKED | Primary CTA matching /(변경|취소|관리|결제)/i not visible |
| X-05 | Profile editing | `/profile` | page | user | BLOCKED | wrong-owner storageState + seeded other-user profile not available — PII OWNER-CHECK unverified<br>OWNER-CHECK / PII cross-user RLS isolation unverified (wrong-owner storageState + other-user profile row not seeded) — security follow-up required before a security-level PASS.<br>Avatar upload (doc §3) not implemented (honest deferred notice). |
| X-06 | Password reset | `/password-reset` | page | public | PARTIAL | none |
| X-07 | Weakness-based recommendations | `/practice/weakness` | page | user | BLOCKED | 렌더 스크린샷 파일(coverage-X-07-360/768/1280.png)이 run 디렉터리에 부재 → 시각/모바일 레이아웃 및 점수 표시 미확인, IA rubric §9에 따라 PASS 차단.<br>human-confirmation 증거 미제출 → PASS 승격 보류. |
| X-08 | Organization admin dashboard | `/admin/org` | page | admin | BLOCKED | 1 console/page errors captured (excluding 0 HMR/dev-mode noise)<br>Primary CTA matching /(생성|발송|다운로드|관리)/i not visible<br>Admin RBAC precondition not met: org_admin storageState carries app_role='learner', elevation SQL not applied → admin-allowed render unverified |
| X-09 | Notification settings | `/settings/notifications` | page | user | BLOCKED | Documented channel tabs (이메일/Zalo), reminder-time inputs (HH:mm), and preview/help regions not implemented — only 3 boolean toggles.<br>Missing documented unsaved-changes leave guard.<br>Transport actually deferred (no delivery infra) — correctly disclosed, but the screen remains feature-incomplete vs the documented spec. |
| X-10 | Admin user management | `/admin/users` | page | admin | BLOCKED | Admin RBAC precondition not met: platform_admin storageState carries app_role='learner', elevation SQL not applied → admin-allowed render (incl. the PASS row) unverified<br>No rendered admin screenshot evidence on disk for X-10 at any viewport<br>Owner-id / wrong-owner RLS fixtures not seeded for X-10 (seed.deferred) |
| X-11 | Auth error | `/auth/error` | page | public | PARTIAL | none |
| X-12 | Auth verify-email | `/auth/verify-email` | page | public | PARTIAL | none |
