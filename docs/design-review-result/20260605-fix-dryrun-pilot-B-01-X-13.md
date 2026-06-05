# TALKPIK 디자인 수정 — DRY-RUN 파일럿 결과 (B-01 · X-13)

> 생성: 2026-06-05 · 워크플로우 `design-fix-from-review` (Stage 1 dry-run MVP, run `wf_5d5a9270-9c8`)
> 입력: `docs/design-review-result/20260605-design-review.md` · 대상: B-01(dashboard), X-13(terms)
> **쓰기 0건** (wrote=false) — 제안 diff·검토만. 실제 적용(Stage 2)은 별도 승인 필요.
> in-scope findings: 9 · clusters: 2

## 요약

DRY-RUN only — NO files were changed. Two clusters analyzed; both have CLEAN reviews (resolvesFindings && !introducesNewViolation && !dropsSpecContent, confidence=high). However, neither cluster is composed ENTIRELY of exact ready-to-apply swaps: c01 has 2 exact AppCard swaps + 3 judgment proposals; c02 has 1 exact ready item + 2 judgment proposals. Per the goList rule (ALL proposals must be exact ready-to-apply), both clusters route to proposalList for human approval. There are no fully-exact-only clusters, so goList is empty. No stale/out-of-scope items were APPLIED; the only out-of-scope items (c01 secondary-caption fontSize:12 and Statistic fontSize:20) are explicitly DEFERRED, not staged. Both clusters carry apply-order caveats (shared import block / layered hunks on the same line) that require ordering exact swaps before judgment proposals.

## Plan

### go-list (자동 적용 후보 = 클러스터 전체가 정확치환)

_비어 있음 — 두 클러스터 모두 정확치환 + 판단건이 섞여 있어 사람 승인 경로로 분류됨._

### 사람 승인 필요 (proposalList)

| cluster | files | reason |
| --- | --- | --- |
| c01 | src/components/learning/RecentFeedbackCard.tsx, src/components/learning/UpcomingExamCard.tsx, src/components/dashboard/DashboardKpiSummary.tsx | Review is clean and high-confidence, but the cluster mixes 2 exact ready-to-apply AppCard swaps (RecentFeedbackCard, UpcomingExamCard — mechanical CardProps pass-throughs resolving the 2 high-severity theme findings) with 3 JUDGMENT proposals that need human approval: (a) off-scale margins/padding -> SPACING.sm, (b) bare span/strong -> Typography.Text and bare link -> Button type=link, (c) new-user title -> Typography.Title level=5. No new hex, no card-in-card, no dropped spec content (i18n keys, empty state, questionNo Tag, score/date, nav target, and the 28/2-line/5-item description.md constraints preserved). APPLY-ORDER CAVEAT: the two judgment diffs assume their respective AppCard swap is applied FIRST (shared import block) — apply the exact swaps before the judgment proposals. |
| c02 | src/components/legal/TermsContent.tsx | Review is clean and high-confidence, but all three items are judgment calls needing human approval: (1) Title level={2}->level={1} to emit a semantic <h1> (page had zero top-level h1; subsection Titles stay level={4}); (2) six magic-px 8 literals -> SPACING.sm (value-preserving, on-scale, token already imported across sign-up/login/profile); (3) magic-px 20 KEPT as 20 with an ai-check annotation per the sibling /privacy convention (no on-scale token equals 20). No spec content removed (all 4 wireframe sections + t()/t.rich() keys intact); no card-in-card, no new hex. APPLY-ORDER CAVEAT: the h1 diff layers on top of the magic-px diff (both touch L27 marginBottom) — apply/commit the magic-px proposal FIRST, then the h1 substitution (or merge them); in isolation against raw L27 the h1 hunk context must read marginBottom: 8. |

### 보류 (deferred — 적용 안 됨)

| ref | reason |
| --- | --- |
| c01: src/components/learning/RecentFeedbackCard.tsx + UpcomingExamCard.tsx — two secondary-caption fontSize:12 sites | OUT-OF-SCOPE, NOT applied. No typography token/class exists in this repo (the --app-* bridge is color/radius/font-family only; SPACING is spacing-only). The pattern is the established convention across ~40 user surfaces — fixing one site would create inconsistency and require inventing a net-new token. Left in place deliberately. |
| c01: src/components/dashboard/DashboardKpiSummary.tsx — Statistic fontSize:20 | OUT-OF-SCOPE, NOT applied. Same token-absence reason as the fontSize:12 captions — no on-scale typography token exists; introducing one is net-new scope. Left in place. |

### 권장 적용 순서

`c02` → `c01`

### notes

NO files were changed — this is a DRY-RUN synthesis only. Stage 2 (isolated worktree apply + full per-doc review panel + visual evidence) requires EXPLICIT user approval before any write. goList is empty: although both clusters review clean, neither is composed entirely of exact ready-to-apply swaps, so both require human approval (proposalList). Recommended apply order is lowest-risk-first: c02 first (single file, one exact ready item + tightly-scoped judgment edits, the smallest blast radius), then c01 (3 files, 2 exact AppCard swaps + 3 judgment proposals). Within EACH cluster the exact swaps must be applied before the judgment proposals due to shared-import-block / layered-same-line-hunk ordering caveats: c01 apply AppCard swaps before the Typography/Title/SPACING judgment edits; c02 apply the magic-px (SPACING.sm) proposal before the h1 level substitution, and commit those two together to avoid the L27 marginBottom conflict. The c01 fontSize deferrals are intentionally left in place (no typography token exists) and must NOT be silently fixed in Stage 2 without inventing a token (net-new scope -> separate decision).

## 클러스터 상세 (drift 체크 · 제안 diff · 자체검토)

### c01

파일: `src/components/learning/RecentFeedbackCard.tsx`, `src/components/learning/UpcomingExamCard.tsx`, `src/components/dashboard/DashboardKpiSummary.tsx`

#### drift 체크

| file | line | rule | status | note |
| --- | --- | --- | --- | --- |
| `src/components/learning/RecentFeedbackCard.tsx` | 28 | Use AppCard/AppModal/AppDrawer wrappers, not raw antd Card | fresh | Confirmed: import { Card } from antd at L3; <Card title={t("title")}> at L28, closing </Card> at L81. Rendered directly by DashboardBody L72. Sibling dashboard cards (DashboardAlertsCard, DashboardRecommendations) already use AppCard. |
| `src/components/learning/UpcomingExamCard.tsx` | 20 | Use AppCard/AppModal/AppDrawer wrappers, not raw antd Card | fresh | Confirmed: import { Card } from antd at L3; <Card title={t("title")}> at L20, closing </Card> at L30. Rendered by DashboardBody L63 alongside AppCard-based DashboardAlertsCard. |
| `src/components/learning/RecentFeedbackCard.tsx` | 44, 65 | NO inline magic-number px for fontSize/padding/margin (use SPACING scale / a class) | fresh | L44 padding: "12px 0" present on the Flex row style; L65 <Text type="secondary" style={{ fontSize: 12 }}> present. Row padding can move to SPACING. fontSize:12 has no token/class in this repo (theme bridge vars are color/radius/font-family only; no typography scale). |
| `src/components/dashboard/DashboardKpiSummary.tsx` | 67, 119 | NO inline magic-number px for fontSize/margin | fresh | L67 <Text strong style={{ fontSize: 16 }}> present (new-user title); L119 <Text type="secondary" style={{ fontSize: 12 }}> present (updatedAt caption). Both are font sizes; no typography token exists, only AntD Typography hierarchy elements (Title) are token-backed. |
| `src/components/learning/UpcomingExamCard.tsx` | 23-25 | NO inline magic-number px for fontSize/margin | fresh | L23 styles={{ content: { fontSize: 20 } }} present on Statistic; L25 style={{ marginTop: 8, marginBottom: 0 }} present on Paragraph. marginTop:8 maps to SPACING.sm; fontSize:20 has no token. marginBottom:0 is a reset (zero, not magic). |
| `src/components/learning/RecentFeedbackCard.tsx` | 57-63, 72 | Use antd controls / Typography for actionable text, not bare link/raw span | fresh | L57-64 bare <span> wrapping the score label/value (Typography.Text already imported via const { Text }); L72-76 bare next/link with raw text {t("view")}, no Button type="link" / Typography.Link. |

#### 제안

- **`src/components/learning/RecentFeedbackCard.tsx`** — Use AppCard/AppModal/AppDrawer wrappers, not raw antd Card · fixType=**exact** · action=**ready-to-apply**
  - rationale: Exact wrapper substitution. Replaces raw antd Card with the shared AppCard (same import path the sibling dashboard cards use), giving the surface the .app-card/.app-surface theme hooks. AppCard is a CardProps pass-through so title and children are unchanged; no behavior or spec content changes.

```diff
--- a/src/components/learning/RecentFeedbackCard.tsx
+++ b/src/components/learning/RecentFeedbackCard.tsx
@@ -1,9 +1,11 @@
 "use client";

-import { Card, Empty, Flex, Tag, Typography } from "antd";
+import { Empty, Flex, Tag, Typography } from "antd";
 import { useTranslations } from "next-intl";
 import Link from "next/link";

+import { AppCard } from "@/components/shared/AppCard";
+
 const { Text } = Typography;

 export type RecentFeedbackItem = {
@@ -25,7 +27,7 @@
 export function RecentFeedbackCard({ items }: Props) {
   const t = useTranslations("dashboard.recentFeedback");
   return (
-    <Card title={t("title")}>
+    <AppCard title={t("title")}>
       {items.length === 0 ? (
         <Empty description={t("empty")} />
       ) : (
@@ -78,6 +80,6 @@
           ))}
         </Flex>
       )}
-    </Card>
+    </AppCard>
   );
 }
```

- **`src/components/learning/UpcomingExamCard.tsx`** — Use AppCard/AppModal/AppDrawer wrappers, not raw antd Card · fixType=**exact** · action=**ready-to-apply**
  - rationale: Exact wrapper substitution matching the dashboard's other AppCard surfaces (this card renders next to the AppCard-based DashboardAlertsCard inside the same Space column). AppCard is a transparent CardProps wrapper; title, Statistic, and Paragraph are untouched.

```diff
--- a/src/components/learning/UpcomingExamCard.tsx
+++ b/src/components/learning/UpcomingExamCard.tsx
@@ -1,9 +1,11 @@
 "use client";

-import { Card, Statistic, Typography } from "antd";
+import { Statistic, Typography } from "antd";
 import dayjs from "dayjs";
 import { useTranslations } from "next-intl";

+import { AppCard } from "@/components/shared/AppCard";
+
 const { Paragraph } = Typography;

 type Props = {
@@ -17,7 +19,7 @@
   const daysLeft = exam.diff(dayjs().startOf("day"), "day");
   if (daysLeft < 0) return null;
   return (
-    <Card title={t("title")}>
+    <AppCard title={t("title")}>
       <Statistic
         value={exam.format("YYYY-MM-DD")}
         styles={{ content: { fontSize: 20 } }}
@@ -27,6 +29,6 @@
           ? t("daysLeftToday")
           : t("daysLeft", { days: daysLeft })}
       </Paragraph>
-    </Card>
+    </AppCard>
   );
 }
```

- **`src/components/learning/UpcomingExamCard.tsx`** — NO inline magic-number px for fontSize/margin · fixType=**judgment** · action=**proposal**
  - rationale: Moves the magic margin (marginTop: 8) onto the named SPACING.sm token (=8, M4 inline-style gate exempts identifier values); marginBottom: 0 stays (a zero reset, not a magic value). The Statistic content fontSize: 20 is intentionally LEFT as-is: there is no typography size token in this repo (the --app-* bridge is color/radius/font-family only, SPACING is spacing-only) and Statistic has no Typography-hierarchy equivalent, so introducing a new token would be net-new scope. Diff assumes the AppCard swap above is applied first (same import block).

```diff
--- a/src/components/learning/UpcomingExamCard.tsx
+++ b/src/components/learning/UpcomingExamCard.tsx
@@ -1,9 +1,11 @@
 "use client";

 import { Statistic, Typography } from "antd";
 import dayjs from "dayjs";
 import { useTranslations } from "next-intl";

 import { AppCard } from "@/components/shared/AppCard";
+import { SPACING } from "@/theme/spacing";

 const { Paragraph } = Typography;

@@ -22,7 +24,7 @@
       <Statistic
         value={exam.format("YYYY-MM-DD")}
         styles={{ content: { fontSize: 20 } }}
       />
-      <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
+      <Paragraph type="secondary" style={{ marginTop: SPACING.sm, marginBottom: 0 }}>
         {daysLeft === 0
           ? t("daysLeftToday")
           : t("daysLeft", { days: daysLeft })}
       </Paragraph>
```

- **`src/components/learning/RecentFeedbackCard.tsx`** — NO inline magic-number px for fontSize/padding/margin (use SPACING scale / a class); Use antd Typography/controls for actionable text, not bare link/raw span · fixType=**judgment** · action=**proposal**
  - rationale: Three judgment fixes in one row body: (1) padding "12px 0" -> `${SPACING.sm}px 0` (12 was off-scale; SPACING.sm=8 is the nearest named token and keeps the row rhythm consistent with the 8-based scale — this is a deliberate value change, hence proposal not exact). (2) bare <span>/<strong> -> Typography.Text / Text strong so the score label/value inherits theme typography tokens. (3) bare next/link raw text -> next/link wrapping Button type="link" (the same actionable-link idiom DashboardAlertsCard uses) with padding:0 so it sits inline without adding button chrome. The secondary-date Text fontSize:12 is intentionally untouched (see notes / out-of-scope deferral). Diff assumes the AppCard swap is applied first.

```diff
--- a/src/components/learning/RecentFeedbackCard.tsx
+++ b/src/components/learning/RecentFeedbackCard.tsx
@@ -1,11 +1,13 @@
 "use client";

-import { Empty, Flex, Tag, Typography } from "antd";
+import { Button, Empty, Flex, Tag, Typography } from "antd";
 import { useTranslations } from "next-intl";
 import Link from "next/link";

 import { AppCard } from "@/components/shared/AppCard";
+import { SPACING } from "@/theme/spacing";

 const { Text } = Typography;
@@ -41,7 +43,7 @@
               gap="middle"
               wrap
               style={{
-                padding: "12px 0",
+                padding: `${SPACING.sm}px 0`,
                 borderBottom:
                   idx < arr.length - 1
                     ? "1px solid var(--app-color-border)"
                     : undefined,
               }}
             >
@@ -54,13 +56,13 @@
                     ? t("questionNo", { no: item.questionNo })
                     : "—"}
                 </Tag>
-                <span>
-                  {t("scoreLabel")}{" "}
-                  <strong>
+                <Text>
+                  {t("scoreLabel")}{" "}
+                  <Text strong>
                     {item.scoreTotal != null
                       ? t("scoreValue", { score: Math.round(item.scoreTotal) })
                       : t("scorePending")}
-                  </strong>
-                </span>
+                  </Text>
+                </Text>
                 <Text type="secondary" style={{ fontSize: 12 }}>
                   {/* Pin tz so SSR/client render the same date string (no React #418). */}
                   {new Date(item.generatedAt).toLocaleDateString("ko-KR", {
@@ -69,11 +71,11 @@
                   })}
                 </Text>
               </Flex>
-              <Link
-                href={`/writing/feedback/long/${item.submissionId}` as never}
-              >
-                {t("view")}
-              </Link>
+              <Link
+                href={`/writing/feedback/long/${item.submissionId}` as never}
+              >
+                <Button type="link" style={{ padding: 0 }}>{t("view")}</Button>
+              </Link>
             </Flex>
           ))}
         </Flex>
       )}
     </AppCard>
   );
 }
```

- **`src/components/learning/RecentFeedbackCard.tsx`** — NO inline magic-number px for fontSize (secondary caption fontSize: 12) · fixType=**judgment** · action=**deferred-out-of-scope**
  - rationale: L65 <Text type="secondary" style={{ fontSize: 12 }}> is the repo-wide caption convention (~40 occurrences across growth/practice/reports/feedback/library/writing user surfaces). No typography size token or caption CSS class exists to replace it (the --app-* bridge is color/radius/font-family only; SPACING is spacing-only). Changing it here alone would diverge from every other surface and require inventing a new token — net-new scope. Defer until a project-wide typography-scale campaign exists.
- **`src/components/dashboard/DashboardKpiSummary.tsx`** — NO inline magic-number px for fontSize/margin · fixType=**judgment** · action=**proposal**
  - rationale: Replaces the magic-number title (Text strong fontSize: 16) with a token-backed Typography.Title level={5} — AntD's heading tokens drive the size, removing the literal. margin:0 keeps the centered Space layout tight (Title defaults to a bottom margin). This is the semantically correct heading element for a new-user prompt title and matches DESIGN.md's 'use Typography hierarchy' intent. The L119 updatedAt caption (Text type="secondary" fontSize: 12) is intentionally left as-is — same repo-wide caption convention with no token to swap to (see the separate deferral).

```diff
--- a/src/components/dashboard/DashboardKpiSummary.tsx
+++ b/src/components/dashboard/DashboardKpiSummary.tsx
@@ -1,9 +1,9 @@
 "use client";

-import { Button, Col, Row, Space, Statistic, Typography } from "antd";
+import { Button, Col, Row, Space, Statistic, Typography } from "antd";
 import { useTranslations } from "next-intl";
 import Link from "next/link";

 import { AppCard } from "@/components/shared/AppCard";

-const { Text } = Typography;
+const { Text, Title } = Typography;
@@ -64,9 +64,9 @@
           style={{ width: "100%", textAlign: "center" }}
         >
-          <Text strong style={{ fontSize: 16 }}>
+          <Title level={5} style={{ margin: 0 }}>
             {t("newUserTitle")}
-          </Text>
+          </Title>
           <Text type="secondary">{t("newUserBody")}</Text>
```

- **`src/components/dashboard/DashboardKpiSummary.tsx`** — NO inline magic-number px for fontSize (secondary caption fontSize: 12) · fixType=**judgment** · action=**deferred-out-of-scope**
  - rationale: L119 <Text type="secondary" style={{ fontSize: 12 }}> (the updatedAt timestamp caption) is the same repo-wide caption idiom (~40 sites). No typography token / caption class exists to replace it. Deferring to a future project-wide typography-scale campaign rather than diverging this single surface or inventing a token (net-new scope).
#### 자체검토 (combined, dry-run)

- resolvesFindings: **true** · introducesNewViolation: **false** · dropsSpecContent: **false** · confidence: **high**
- notes: Two exact AppCard swaps (RecentFeedbackCard, UpcomingExamCard) are mechanical CardProps pass-throughs that resolve the two high-severity theme findings and bring both cards in line with the sibling AppCard surfaces (DashboardAlertsCard, DashboardRecommendations) verified via DashboardBody. Judgment proposals: SPACING.sm for the off-scale margins/padding (M4 gate exempts identifier values), bare span/strong -> Typography.Text, bare link -> Button type="link" (matching the DashboardAlertsCard link idiom), and the new-user title -> token-backed Typography.Title level=5. No new hex, no card-in-card (AppCard wraps the existing single card; the score row stays a Flex, not a nested card), no removed spec content (all i18n keys, the empty state, the questionNo Tag, score/date display, navigation target, and the 28/2-line/5-item card constraints from description.md are preserved). The two remaining fontSize:12 secondary captions are deferred-out-of-scope, NOT applied, because no typography token/class exists in this repo (the --app-* bridge is color/radius/font-family only; SPACING is spacing-only) and the pattern is the established convention across ~40 user surfaces — fixing one site would create inconsistency and require inventing a token (net-new scope). The Statistic fontSize:20 is likewise left in place for the same token-absence reason. Diffs for UpcomingExamCard and RecentFeedbackCard judgment proposals assume their respective AppCard swap is applied first (shared import block); apply exact swaps before the judgment proposals.

### c02

파일: `src/components/legal/TermsContent.tsx`

#### drift 체크

| file | line | rule | status | note |
| --- | --- | --- | --- | --- |
| `src/components/legal/TermsContent.tsx` | 41 | No inline magic-number px for padding/margin (use SPACING scale / --app-radius / a class) | fresh | L41 still reads <ul style={{ margin: 0, paddingLeft: 20 }}>. The literal 20 (off the 4/8/16/24/32 scale) on paddingLeft is present. margin:0 is exempt (zero is not a magic number). |
| `src/components/legal/TermsContent.tsx` | 27 | public page must have exactly one top-level <h1> | fresh | L27 renders the page title as <Title level={2}> (an <h2>). It is the only Title at heading-1 candidacy on the page; the other Titles are level={4}. So /terms emits zero <h1>, unlike sibling /privacy which uses a real <h1> at L36 of src/app/privacy/page.tsx. |
| `src/components/legal/TermsContent.tsx` | 27, 31, 38, 42, 43, 55 | no inline magic-number px for margin/padding; use SPACING scale or ai-check: allow-inline-number | fresh | Raw literal 8 on a margin property at L27 (marginBottom:8), L31 (marginTop:8), L38 (marginBottom:8), L42 (marginBottom:8), L43 (marginBottom:8), L55 (marginBottom:8). All six match. SPACING.sm===8, so substitution is value-preserving. (L31 marginBottom:0 and the various marginBottom:0 are zeros — exempt.) |

#### 제안

- **`src/components/legal/TermsContent.tsx`** — public page must have exactly one top-level <h1> · fixType=**exact** · action=**ready-to-apply**
  - rationale: The page-title Title is the document's only heading-1 candidate, so it must render the top-level <h1>. antd Typography.Title with level={1} emits a semantic <h1>, satisfying the rule (zero -> one <h1>) while keeping the file's antd Typography styling pattern. I chose level={1} over a raw <h1> (the literal sibling-match in suggestedFix) because TermsContent is a fully antd-Typography client component inside AppCard; injecting a bare <h1> would orphan it from antd's heading rhythm/tokens, whereas /privacy is a non-antd server component where a raw <h1> is the house style. The level={4} subsection Titles (L38/L55) are correctly left below the new h1. Diff shown layered on the magic-px change (marginBottom: SPACING.sm) since both edits touch L27; apply the magic-px proposal first.

```diff
--- a/src/components/legal/TermsContent.tsx
+++ b/src/components/legal/TermsContent.tsx
@@ -24,9 +24,9 @@ export function TermsContent() {
       <Space orientation="vertical" size="large" style={{ width: "100%" }}>
         {/* §1 법적 고지 페이지 (제목 + 임시 약관 안내) */}
         <div>
-          <Title level={2} style={{ marginBottom: SPACING.sm }}>
+          <Title level={1} style={{ marginBottom: SPACING.sm }}>
             {t("heading")}
           </Title>

```

- **`src/components/legal/TermsContent.tsx`** — no inline magic-number px for margin/padding; use SPACING scale or ai-check: allow-inline-number · fixType=**judgment** · action=**proposal**
  - rationale: All six raw 8 literals sit on margin properties and SPACING.sm === 8, so swapping to the named token is value-preserving (zero visual change) and clears the M4/magic-px gate exactly the way the existing sign-up/login/profile client components already import SPACING. This is the on-scale token route the rule prefers over an ai-check annotation. The marginBottom:0 / marginTop pairing on L31 keeps its 0 (zeros are exempt) and only the 8 becomes SPACING.sm. Import added alphabetically after the AppCard import, matching project convention.

```diff
--- a/src/components/legal/TermsContent.tsx
+++ b/src/components/legal/TermsContent.tsx
@@ -13,6 +13,7 @@
 import { Space, Typography } from "antd";
 import { useTranslations } from "next-intl";

 import { AppCard } from "@/components/shared/AppCard";
+import { SPACING } from "@/theme/spacing";

 const { Title, Paragraph, Text } = Typography;
@@ -24,21 +25,21 @@ export function TermsContent() {
       <Space orientation="vertical" size="large" style={{ width: "100%" }}>
         {/* §1 법적 고지 페이지 (제목 + 임시 약관 안내) */}
         <div>
-          <Title level={2} style={{ marginBottom: 8 }}>
+          <Title level={2} style={{ marginBottom: SPACING.sm }}>
             {t("heading")}
           </Title>
           <Paragraph style={{ marginBottom: 0 }}>{t("intro")}</Paragraph>
-          <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
+          <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: SPACING.sm }}>
             {t("placeholderNotice")}
           </Paragraph>
         </div>

         {/* §2 임시 약관 요약 */}
         <div>
-          <Title level={4} style={{ marginBottom: 8 }}>
+          <Title level={4} style={{ marginBottom: SPACING.sm }}>
             {t("summaryTitle")}
           </Title>
           <ul style={{ margin: 0, paddingLeft: 20 }}>
-            <li style={{ marginBottom: 8 }}>{t("summaryTool")}</li>
-            <li style={{ marginBottom: 8 }}>{t("summaryDataUse")}</li>
-            <li style={{ marginBottom: 8 }}>
+            <li style={{ marginBottom: SPACING.sm }}>{t("summaryTool")}</li>
+            <li style={{ marginBottom: SPACING.sm }}>{t("summaryDataUse")}</li>
+            <li style={{ marginBottom: SPACING.sm }}>
               {t.rich("summaryPrivacy", {
                 privacyLink: (chunks) => <Link href="/privacy">{chunks}</Link>,
               })}
@@ -52,7 +53,7 @@ export function TermsContent() {
         {/* §3 운영 문의 안내 — 존재하지 않는 채널을 꾸며내지 않는다 */}
         <div>
-          <Title level={4} style={{ marginBottom: 8 }}>
+          <Title level={4} style={{ marginBottom: SPACING.sm }}>
             {t("contactTitle")}
           </Title>

```

- **`src/components/legal/TermsContent.tsx`** — No inline magic-number px for padding/margin (use SPACING scale / --app-radius / a class) · fixType=**judgment** · action=**proposal**
  - rationale: paddingLeft: 20 is off the 4/8/16/24/32 SPACING ladder. Forcing it on-scale would mean 16 (tighter, may clip bullet glyphs) or 24 (wider) — a visual change to list indentation that the spec does not ask for. The sibling /privacy page documents exactly this situation with `// ai-check: allow-inline-number` (src/app/privacy/page.tsx L25 for its off-scale 12px). I follow that house convention and annotate the intentional 20px list indent rather than shifting the layout. margin:0 needs no change (zero is exempt). This is a judgment call — if the reviewer prefers strict on-scale, SPACING.lg (24) is the nearest token, but that alters the indent.

```diff
--- a/src/components/legal/TermsContent.tsx
+++ b/src/components/legal/TermsContent.tsx
@@ -41,1 +41,1 @@ export function TermsContent() {
-          <ul style={{ margin: 0, paddingLeft: 20 }}>
+          <ul style={{ margin: 0, paddingLeft: 20 }}> {/* ai-check: allow-inline-number preserve intentional 20px list indent (off 8-scale) */}

```

#### 자체검토 (combined, dry-run)

- resolvesFindings: **true** · introducesNewViolation: **false** · dropsSpecContent: **false** · confidence: **high**
- notes: All three findings drift-checked FRESH at the cited lines. (1) h1 — level={2}→level={1} makes antd Typography.Title emit a semantic <h1>, giving the page exactly one top-level <h1> (was zero), matching /privacy's intent while keeping the antd styling the rest of TermsContent uses; subsection Titles stay level={4} below it. No new heading-order violation. (2) magic-px 8 — six literals → SPACING.sm (===8) is value-preserving, on-scale, and uses the existing @/theme/spacing token already imported across sign-up/login/profile; no new theme/layout violation. (3) magic-px 20 — kept as 20 with an ai-check annotation per the sibling /privacy convention because no on-scale token equals 20 and shifting the list indent is an unrequested visual change. No spec content removed: all 4 wireframe sections (title+notice, summary list w/ privacy link, contact, escape links) and all t()/t.rich() keys are untouched; no card-in-card, no new hex, no magic px introduced. CAVEAT: the h1 diff is layered on top of the magic-px diff (both touch L27 marginBottom), so apply the magic-px proposal first, then the h1 substitution — or merge them; applied in isolation against the original L27 the h1 hunk context (marginBottom: SPACING.sm) will not match. The magic-px and h1 edits should be committed together to avoid the conflict. As-is (raw 8), the h1 hunk's context line should read `marginBottom: 8` if applied before the magic-px change.

## 재실행 / 다음 단계

- 전체(143건) dry-run: "design-fix-from-review 돌려줘" (args 없이 — 전체)
- 파일럿: args `{ "only": ["B-01","X-13"] }`
- **Stage 2 (실제 적용)**: 격리 worktree + 문서당 per-doc 패널 + 시각 증거 + 소유 hunk 역패치 — 미구현, 명시 승인 후 별도 빌드.
- 정의: `.claude/workflows/design-fix-from-review.js` (Stage 1) · `design-fix-from-review.brief.md` (설계문서)
