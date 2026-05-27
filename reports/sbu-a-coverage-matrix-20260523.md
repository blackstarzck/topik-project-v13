# SBU-A Coverage Matrix — Tier 1 Active 32 Routes

Generated: 2026-05-23 (Implementation Coverage Audit, Plan rev4 — SBU-A)
Source authorities: docs/sitemap.md (lines 23-58), docs/IA/{NN}/description.md × 32, src/app/**/page.tsx
Method: static read only (no browser, no Supabase, no component depth analysis)

## One-line conclusion
Tier 1 MVP는 20/32 GREEN-PROVISIONAL + 4 RED + 1 YELLOW + 2 OOS-SHELL + 5 DOC-AMBIGUOUS(모달, 의도된 hosted) — **골든 패스는 X-01 (랜딩) ~ X-06 (비밀번호 재설정) 4개 public 라우트 placeholder 때문에 첫 진입조차 못 함**. 인증 통과 후 인증 경로(20개)는 정적으로는 살아 있어 보임. SBU-B+C 브라우저 검증 대기.

## 32-Route Matrix

| # | IA ID | Screen | React route | sitemap.md line | src/app page.tsx path | Placeholder? | Placeholder snippet (file:line) | IA description.md ref | 1st-pass grade |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | X-01 | Product landing | / | 27 | src/app/page.tsx | YES | "학습 워크스페이스 준비 중" (src/app/page.tsx:6) | docs/IA/23-X-01-product-landing/description.md | 🔴 RED |
| 2 | A-01 | Sign-up | /sign-up | 28 | src/app/sign-up/page.tsx | YES | "회원가입 폼은 다음 단계에서 제공됩니다" (src/app/sign-up/page.tsx:9) | docs/IA/01-A-01-sign-up/description.md | 🔴 RED |
| 3 | A-02 | Login | /login | 29 | src/app/login/page.tsx | YES | "다음 단계(Phase 3)에서 제공됩니다" (src/app/login/page.tsx:11) | docs/IA/02-A-02-login/description.md | 🔴 RED |
| 4 | X-06 | Password reset | /password-reset | 30 | src/app/password-reset/page.tsx | YES | "다음 단계에서 제공됩니다" (src/app/password-reset/page.tsx:9) | docs/IA/28-X-06-password-reset/description.md | 🔴 RED |
| 5 | A-03 | Learning goal setup | /onboarding/learning-goal | 31 | src/app/(workspace)/onboarding/learning-goal/page.tsx | NO | N/A | docs/IA/03-A-03-learning-goal-setup/description.md | 🟢 GREEN-PROVISIONAL |
| 6 | B-01 | Home dashboard | /dashboard | 32 | src/app/(workspace)/dashboard/page.tsx | NO | N/A (imports DashboardContent, getDashboardKpi) | docs/IA/04-B-01-home-dashboard/description.md | 🟢 GREEN-PROVISIONAL |
| 7 | C-01 | Problem type recommendations | /practice/recommendations | 33 | src/app/(workspace)/practice/recommendations/page.tsx | NO | N/A (imports RecommendationsView) | docs/IA/05-C-01-problem-type-recommendations/description.md | 🟢 GREEN-PROVISIONAL |
| 8 | C-02 | Problem list | /practice/problems | 34 | src/app/(workspace)/practice/problems/page.tsx | NO | N/A (imports ProblemListView) | docs/IA/06-C-02-problem-list/description.md | 🟢 GREEN-PROVISIONAL |
| 9 | C-03 | Retry modal | hosted by /practice/problems | 35 | (modal, no page.tsx) | N/A | N/A | docs/IA/07-C-03-retry-modal/description.md | 📄 DOC-AMBIGUOUS |
| 10 | D-01 | Short-answer writing 51 | /writing/51 | 36 | src/app/(workspace)/writing/[questionId]/page.tsx | NO | N/A (imports WritingPageContent, getActiveDraft) | docs/IA/08-D-01-short-answer-writing-51/description.md | 🟢 GREEN-PROVISIONAL |
| 11 | D-02 | Answer writing 52 | /writing/52 | 37 | src/app/(workspace)/writing/[questionId]/page.tsx | NO | N/A (same route) | docs/IA/09-D-02-answer-writing-52/description.md | 🟢 GREEN-PROVISIONAL |
| 12 | D-03 | Long-form writing 53 | /writing/53 | 38 | src/app/(workspace)/writing/[questionId]/page.tsx | NO | N/A (same route) | docs/IA/10-D-03-long-form-writing-53/description.md | 🟢 GREEN-PROVISIONAL |
| 13 | D-04 | Essay writing 54 | /writing/54 | 39 | src/app/(workspace)/writing/[questionId]/page.tsx | NO | N/A (same route) | docs/IA/11-D-04-essay-writing-54/description.md | 🟢 GREEN-PROVISIONAL |
| 14 | D-M1 | Submission confirmation | hosted by /writing/51-54 | 40 | (modal, no page.tsx) | N/A | N/A | docs/IA/12-D-M1-submission-confirmation-modal/description.md | 📄 DOC-AMBIGUOUS |
| 15 | D-M2 | AI analysis loading | hosted by writing submission | 41 | (modal/state, no page.tsx) | N/A | N/A | docs/IA/13-D-M2-ai-analysis-loading/description.md | 📄 DOC-AMBIGUOUS |
| 16 | D-M3 | Autosave warning | hosted by /writing/51-54 | 42 | (modal/toast, no page.tsx) | N/A | N/A | docs/IA/22-D-M3-autosave-warning/description.md | 📄 DOC-AMBIGUOUS |
| 17 | E-01 | Short-answer feedback | /writing/feedback/short/:id | 43 | src/app/(workspace)/writing/feedback/short/[id]/page.tsx | NO | N/A (imports FeedbackPageContent, getFeedbackBundle) | docs/IA/14-E-01-short-answer-feedback/description.md | 🟢 GREEN-PROVISIONAL |
| 18 | E-02 | Long-form feedback | /writing/feedback/long/:id | 44 | src/app/(workspace)/writing/feedback/long/[id]/page.tsx | NO | N/A (imports FeedbackPageContent) | docs/IA/15-E-02-long-form-feedback/description.md | 🟢 GREEN-PROVISIONAL |
| 19 | R-01 | Comparison report | /writing/reports/:id/compare | 45 | src/app/(workspace)/writing/reports/[id]/compare/page.tsx | NO | N/A (imports ComparisonReportView) | docs/IA/16-R-01-comparison-report/description.md | 🟢 GREEN-PROVISIONAL |
| 20 | R-02 | Next problem recommendation | /practice/next | 46 | src/app/(workspace)/practice/next/page.tsx | NO | N/A (imports NextProblemView, getNextProblem) | docs/IA/17-R-02-next-problem-recommendation/description.md | 🟢 GREEN-PROVISIONAL |
| 21 | F-01 | My library | /library | 47 | src/app/(workspace)/library/page.tsx | NO | N/A (imports LibraryTabs, listLibraryItems) | docs/IA/18-F-01-my-library/description.md | 🟢 GREEN-PROVISIONAL |
| 22 | F-M1 | PDF export modal | hosted by /library, feedback, reports | 48 | (modal, no page.tsx) | N/A | N/A | docs/IA/19-F-M1-pdf-export-modal/description.md | 📄 DOC-AMBIGUOUS |
| 23 | G-01 | Language settings | /settings/language | 49 | src/app/(workspace)/settings/language/page.tsx | NO | N/A (imports LanguageForm, getProfileSettings) | docs/IA/20-G-01-language-settings/description.md | 🟢 GREEN-PROVISIONAL |
| 24 | H-01 | Admin problem management | /admin/problems | 50 | src/app/(workspace)/admin/problems/page.tsx | NO | N/A (imports AdminProblemTable, listAdminProblems) | docs/IA/21-H-01-admin-problem-management/description.md | 🟢 GREEN-PROVISIONAL |
| 25 | X-02 | Growth dashboard | /growth | 51 | src/app/(workspace)/growth/page.tsx | YES | PlaceholderPage with iaCode="X-02" (src/app/(workspace)/growth/page.tsx:6-12) | docs/IA/24-X-02-growth-dashboard/description.md | 🟡 YELLOW |
| 26 | X-03 | Paywall | /paywall | 52 | src/app/(workspace)/paywall/page.tsx | YES | PlaceholderPage with iaCode="X-03" (src/app/(workspace)/paywall/page.tsx:6-12) | docs/IA/25-X-03-paywall/description.md | ⚪ OOS-SHELL |
| 27 | X-04 | Subscription management | /subscription | 53 | src/app/(workspace)/subscription/page.tsx | YES | PlaceholderPage with iaCode="X-04" (src/app/(workspace)/subscription/page.tsx:6-12) | docs/IA/26-X-04-subscription-management/description.md | ⚪ OOS-SHELL |
| 28 | X-05 | Profile editing | /profile | 54 | src/app/(workspace)/profile/page.tsx | NO | N/A (imports ProfileForm, getProfileSettings) | docs/IA/27-X-05-profile-editing/description.md | 🟢 GREEN-PROVISIONAL |
| 29 | X-07 | Weakness-based recommendations | /practice/weakness | 55 | src/app/(workspace)/practice/weakness/page.tsx | NO | N/A (imports WeaknessView, getWeakDimensions) | docs/IA/29-X-07-weakness-based-recommendations/description.md | 🟢 GREEN-PROVISIONAL |
| 30 | X-08 | Organization admin dashboard | /admin/org | 56 | src/app/(workspace)/admin/org/page.tsx | NO | N/A (imports AdminOrgKpiCards, supabase.rpc) | docs/IA/30-X-08-organization-admin-dashboard/description.md | 🟢 GREEN-PROVISIONAL |
| 31 | X-09 | Notification settings | /settings/notifications | 57 | src/app/(workspace)/settings/notifications/page.tsx | NO | N/A (imports NotificationPrefsForm, getProfileSettings) | docs/IA/31-X-09-notification-settings/description.md | 🟢 GREEN-PROVISIONAL |
| 32 | X-10 | Admin user management | /admin/users | 58 | src/app/(workspace)/admin/users/page.tsx | NO | N/A (imports AdminUserTable, listAdminUsers) | docs/IA/32-X-10-admin-user-management/description.md | 🟢 GREEN-PROVISIONAL |

## Audit notes

### Routes flagged DOC-AMBIGUOUS
- **C-03, D-M1, D-M2, D-M3, F-M1**: All modal/state surfaces (5 rows). Sitemap line 35-42, 48 explicitly note these are "hosted by" parent routes, not independent pages. No page.tsx needed per spec (docs/sitemap.md §Coverage Rules line 170: "Modal IA codes should stay hosted by their parent routes unless there is a product or implementation reason to deep-link them"). Classified as DOC-AMBIGUOUS because their integration into parent pages cannot be verified in static read-only mode. SBU-B+C (browser) will confirm modal trigger and render.

### Routes that need browser confirmation (GREEN-PROVISIONAL → final TBD)
- **B-01 (Dashboard), C-01 (Recommendations), C-02 (Problems), D-01/02/03/04 (Writing 51-54), E-01/02 (Feedback), R-01 (Report), R-02 (Next), F-01 (Library), G-01 (Language), H-01 (Admin Problems), X-05 (Profile), X-07 (Weakness), X-08 (Org Admin), X-09 (Notifications), A-03 (Learning Goal)**: 15 routes. Each imports domain components from src/components/{domain}/ and reasonable feature depth (40+ lines or complex sub-trees). Marked GREEN-PROVISIONAL pending SBU-B (runtime validation) and SBU-C (RLS/Supabase integration proof).

### Surprising findings worth flagging now
1. **Public entry points broken (X-01, A-01, A-02, X-06)**: All 4 public-facing routes are placeholders. The app is unopenable to new/returning users. This is the critical blocker for go-live readiness.
2. **Modal classification decision**: 5 modals (C-03, D-M1, D-M2, D-M3, F-M1) are intentionally not routable pages per spec (sitemap.md lines 74-85). They are hosted by parent routes. SBU-A cannot verify their presence in the code without component inspection (beyond scope). This is correct per design but requires SBU-B to confirm integration.
3. **OOS-SHELL pattern adopted**: X-03 (Paywall) and X-04 (Subscription) use PlaceholderPage with explicit deferred billing note per Phase 6 ledger (line 226 decision). Classified OOS-SHELL (not RED) because the placeholder is intentional and documented. Tier 2 scope.
4. **X-02 (Growth dashboard) is YELLOW not RED**: Uses PlaceholderPage but imports the helper component and parametrizes with iaCode/phaseHint. Not a raw hardcoded HTML stub like public routes. Real page structure, so YELLOW (obviously incomplete but real page exists) rather than RED.
5. **Admin routes all real**: H-01 (problems), X-08 (org), X-10 (users) all import admin components and call domain functions (listAdminProblems, requireContentAdmin, etc.). Phase 6 admin hardening is actively present, not deferred.

### Routes that could not be classified and why (rev — 32 row direct count)
None. All 32 rows from sitemap.md lines 27-58 accounted for:
- 🔴 RED (4): X-01, A-01, A-02, X-06 — public entry placeholders
- 🟡 YELLOW (1): X-02 Growth dashboard — uses PlaceholderPage helper but legit page structure
- 🟢 GREEN-PROVISIONAL (20): A-03, B-01, C-01, C-02, D-01, D-02, D-03, D-04, E-01, E-02, R-01, R-02, F-01, G-01, H-01, X-05, X-07, X-08, X-09, X-10
- ⚪ OOS-SHELL (2): X-03 Paywall, X-04 Subscription — billing intentionally deferred per Phase 6 ledger
- 📄 DOC-AMBIGUOUS (5): C-03, D-M1, D-M2, D-M3, F-M1 — all are modals hosted by parent routes per sitemap §Coverage Rules; static read cannot verify integration

**Sum check**: 4 + 1 + 20 + 2 + 5 = 32 ✓

**Note**: `/admin` (`src/app/(workspace)/admin/page.tsx`, AdminIndexPage) is a parent navigation page not listed in sitemap.md table (lines 23-58). Excluded from the 32-count per sitemap spec. Worth flagging to SBU-B for completeness.

---

**Golden path break point**: User attempting `/` (X-01 landing) encounters a 7-line stub saying "학습 워크스페이스 준비 중". No hero, no feature cards, no sign-up CTA per IA description (docs/IA/23-X-01-product-landing/description.md). Cannot click to sign-up or log in. Flow terminates. Next blocker: implement X-01, A-01, A-02, X-06 public routes to unblock end-to-end flow.