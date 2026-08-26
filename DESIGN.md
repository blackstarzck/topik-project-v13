# TALKPIK Awesomic Design
> Rounded midnight marketplace — a portfolio gallery cut from matte black tiles on a white tablecloth, where large rounded corners and a single custom typeface do all the expressive work.

> Official visual reference for TALKPIK AI's user-facing app: product-level
> visual intent, semantic token meaning, and imported Awesomic token roles.

> Source map:
> - `DESIGN.md`: canonical visual intent and semantic token meaning.
> - `DESIGN/tokens.json`: machine-readable imported token source.
> - `src/theme`: runtime owner that normalizes values and projects them into
>   AntD and Tailwind adapters.
> - `src/styles/global.css`: Tailwind v4 `@theme inline` bridge and approved
>   global runtime styles.

> Runtime policy: one project theme source is projected into two adapters. AntD
> receives values through `ConfigProvider`, `theme.token`, and
> `theme.components`; Tailwind receives the same resolved values through
> `--app-*` bridge variables and Tailwind v4 `@theme inline`. Tailwind must not
> become a second palette, radius scale, shadow scale, or font source.

> Runtime exception: the raw Awesomic reference favors very soft 28-36px
> surfaces, but TALKPIK runtime intentionally reduces app workspace radii to
> 4-8px so study dashboards read as panels instead of bubbles. Keep this
> exception in this document and `src/theme/tokens/awesomic.ts`.

> Do not paste raw CSS custom properties or raw Tailwind `@theme` values from
> this file into app CSS. Normalize selected values through `src/theme`, then
> project them into both the AntD adapter and the Tailwind v4 adapter. New
> `--app-*` bridge variables require a documented source token, a real
> Tailwind/plain-CSS use case, and matching theme contract tests.

**Theme:** light

**Product intent:** TALKPIK is a calm, focused TOPIK study tool. Long Korean
passages must stay readable, each task area should present one clear primary
action, and the UI should avoid loud game-like or generic AI-gradient identity.
Color carries meaning, never decoration; pair every color signal with text or
icon.

## Runtime Theme 소유권

- `src/theme/config.ts`가 active preset을 선택한다. 현재 product preset은 `awesomic`이고 stock Ant Design은 fallback이다.
- `DESIGN/tokens.json`은 가져온 machine-readable source이고 `src/theme/tokens/awesomic.ts`는 이를 정규화한 runtime mapping이다.
- Ant Design은 component adapter다. 전역 값과 component state 값은 `ConfigProvider`, `theme.token`, `theme.components` 또는 scoped provider가 소유한다.
- Tailwind는 layout·responsive adapter다. `src/theme/tailwind-bridge.ts`와 `src/styles/global.css`의 `@theme inline`을 통해 계산된 `--app-*` 값을 사용하며, 별도의 palette, font, radius, shadow scale을 소유하지 않는다.
- 새 `--app-*` 변수에는 source token, 실제 Tailwind/plain-CSS consumer, theme contract test가 모두 필요하다. 계산된 값은 first render에 존재해야 하고 `var(--ant-*)`를 다시 가리키면 안 된다.
- 기존 project wrapper와 AntD props를 우선한다. 프로젝트가 작성한 visual inline style, 광범위한 `.ant-*` override, 생성된 AntD class selector, page-specific global CSS를 추가하지 않는다.

### 전역 CSS 전환 경계

UI contract scanner v5 전환은 `src/styles/foundation.css`와 `src/styles/global.css`의 기존 선언만을 `global-css.declaration-freeze`와 `global-css.selector-freeze` 기준으로 묶는다. 이 전환은 scanner digest `6d2f61a5fccb8f11e2fc9b29f09f346ec3e59e5b879451f3412252eb813bd785`와 baseline approval digest `0f1f52ac099a265802e72a9dae2949d8c8e9a836d42e4ce0537c0cc883006073`가 정확히 일치할 때만 base owner가 사전 승인할 수 있으며, 같은 PR에서 스스로 승인할 수 없다. 두 경로와 두 규칙 밖에는 적용되지 않는 좁은 전환이며 일반 예외가 아니다. Tailwind는 계속 layout·responsive와 제한된 support 용도로만 사용하고 별도 design token source가 되지 않는다.

### 공통 layout과 card 진입점

- 인증 workspace의 전역 chrome은 `src/components/app/WorkspaceShell.tsx`가 소유하고, 안쪽 content 폭은 `src/components/app/WorkspaceBody.tsx`의 실제 `size` 값(`form`, `task`, `workspace`, `wide`, `full`)으로 정한다. `src/components/shared/PageContainer.tsx`는 `narrow`, `default`, `wide` 폭과 단일 `<main>` landmark가 필요한 일반 page용이므로 다른 `<main>` 안에 중첩하지 않는다.
- `src/components/shared/AppCard.tsx`는 AntD `CardProps`를 그대로 전달하며 별도의 project card header/footer component는 없다. 전체 card의 title·status는 AntD `title`·`extra`, card 단위의 반복 action은 `actions`를 사용하고, 화면 구조상 다른 위치가 더 자연스러우면 억지로 footer를 만들지 않는다.

## UI 검토 체크리스트

- [ ] 대상 route가 `WorkspaceShell` chrome 안에 있는지 숨김 route인지 확인하고, content 폭에는 `WorkspaceBody` 또는 단일-main `PageContainer` 중 실제 구조에 맞는 primitive를 사용했다.
- [ ] `AppCard`의 전체 title·status와 card 단위 action에 AntD `title`·`extra`·`actions` 계약을 일관되게 적용했다.
- [ ] AntD hover, active, selected, disabled, border, radius state는 Tailwind로 다시 만들지 않고 props 또는 token으로 제어했다.
- [ ] color, typography, spacing, responsive layout은 shared theme에서 가져오며, hardcoded visual value가 있다면 이유를 기록했다.
- [ ] loading, empty, success, error, disabled state가 같은 page 구조를 유지하고 다음 action을 분명하게 제공한다.
- [ ] form에는 label이 있고 icon-only control에는 accessible name이 있으며, focus가 보이고 color만으로 의미를 전달하지 않는다.
- [ ] desktop과 mobile에서 겹침이나 horizontal overflow가 없고, 긴 한국어 text가 읽기 좋은 폭과 line height를 유지한다.
- [ ] 관련 test, `pnpm check:ui-contract`, Playwright CLI, Playwright MCP 직접 browser 검증이 변경한 UI 범위에서 통과했다.

Awesomic operates on a white-and-near-black canvas with maximum roundness — 36px cards and pill-shaped containers dominate every surface, creating a soft, approachable tension against the very dark #09090b fills used for primary actions. The neutral scale is dense and graduated (gray-50 through gray-950), but only 3-4 steps appear in any single view, keeping contrast high without complexity. The single custom typeface, Cosmica, spans the entire system from 10px badge labels to 64px display headlines — its weight range (300–700) does all tonal work that color doesn't. Accent color is almost entirely absent from the UI layer: vivid orange (#ff5a00) surfaces only on YC badge labels, and the vivid pink (#fe45e2) is a single decorative card wash — the system's restraint makes these moments land harder.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Obsidian | `#09090b` | `--color-obsidian` | Primary filled button backgrounds, display heading text on white surfaces — the system's anchor dark, nearly true black |
| Ink | `#18181b` | `--color-ink` | Body text, nav text, badge text on light surfaces — one shade lighter than Obsidian, used for reading-weight text |
| Graphite | `#3f3f46` | `--color-graphite` | Button borders, badge backgrounds (dark variant), border strokes across components — the dominant UI border tone |
| Slate | `#52525b` | `--color-slate` | Mid-dark card backgrounds in dark sections, subtle icon fills |
| Steel | `#71717a` | `--color-steel` | Muted body copy, helper text labels such as stat captions |
| Ash | `#a1a1aa` | `--color-ash` | Subdued heading variants, placeholder text, decorative rule strokes |
| Pebble | `#d4d4d8` | `--color-pebble` | Hairline dividers, inactive link backgrounds, lightest visible border on white cards |
| Fog | `#ececee` | `--color-fog` | Card backgrounds (mid variant), badge borders, section dividers — the second surface step above the canvas |
| Mist | `#f4f4f5` | `--color-mist` | Page canvas, light card backgrounds, tag/link hover surface — the dominant background tone |
| Snow | `#ffffff` | `--color-snow` | White card surfaces, input backgrounds, button fill for outlined variant — the brightest surface in the stack |
| Ember | `#ff5a00` | `--color-ember` | YC batch badge backgrounds — vivid orange signals startup-ecosystem provenance, appears only on badge-sized labels |
| Orchid Flash | `#fe45e2` | `--color-orchid-flash` | Decorative card wash accent — single-use vivid pink on a large card background to punctuate the portfolio grid |

## Tokens — Difficulty Scale

Semantic color scale for TOPIK writing difficulty (`problems.difficulty`, 1–5).
A low-saturation warm gradient (easy = green → hard = brick), kept deliberately
muted so it never reads as "vivid" and does not break the system's calm,
largely-achromatic identity. This is the only chromatic scale allowed in the UI
layer beyond the reserved Ember/Orchid accents, and it exists solely to encode
difficulty.

| Level | Label key (`practice.common`) | Value | Role |
|-------|-------------------------------|-------|------|
| 1 · 쉬움 (very easy) | `difficultyVeryEasy` | `#5e9e6f` | Calm green — easiest |
| 2 · 조금 쉬움 (easy) | `difficultyEasy` | `#8aa04e` | Olive |
| 3 · 보통 (normal) | `difficultyNormal` | `#cca63a` | Gold / mustard |
| 4 · 조금 어려움 (hardish) | `difficultyHardish` | `#cf833f` | Soft orange |
| 5 · 어려움 (hard) | `difficultyHard` | `#c75d4f` | Brick red — hardest |

**Rules**

- Tint the difficulty **icon only** (e.g. the lucide
  `ChartNoAxesColumnIncreasing` stroke). Keep the text label achromatic
  (`text-secondary`) so contrast/legibility holds — color is a supplementary
  signal and the text label always carries the meaning, per "color carries
  meaning, never decoration; pair every color signal with text or icon."
- Default to a single tinted icon, not a multi-bar meter, for the difficulty
  indicator.
- Single source: the level→color and level→label-key mapping is defined only in
  `src/components/practice/DifficultyMeter.tsx` (`difficultyFillColor(level)`,
  `difficultyLabelKey(level)`) — same single-source rule as
  `reason-tag-colors.ts`.
- These five colors are difficulty-only. Do not reuse them for CTAs, buttons,
  states, hover, or any other UI (the achromatic-CTA rule stands).
- They currently live as fixed hex in the component helper. If they ever need to
  be consumed via Tailwind utilities or AntD tokens, promote them through
  `src/theme` into `--app-*` and update the theme contract tests (per the
  runtime policy above).

## Tokens — Typography

### Cosmica — The sole typeface across the entire system — every badge, button, nav link, heading, and body copy uses Cosmica. Its wide weight range means all typographic hierarchy is weight-driven rather than family-switching. At 56–64px the light-to-medium weights feel assertive without shouting; at 10–14px the medium-to-semibold weights keep small labels legible at compact density. · `--font-cosmica`
- **Substitute:** DM Sans, Plus Jakarta Sans
- **Weights:** 300, 400, 500, 600, 700
- **Sizes:** 10px, 12px, 13px, 14px, 15px, 16px, 18px, 20px, 32px, 40px, 56px, 64px
- **Line height:** 1.0–1.8 (tighter at display sizes ~1.0–1.12, looser at body sizes ~1.45–1.68)
- **Letter spacing:** normal across all sizes — no tracked-out headlines or tight-tracked display text
- **Role:** The sole typeface across the entire system — every badge, button, nav link, heading, and body copy uses Cosmica. Its wide weight range means all typographic hierarchy is weight-driven rather than family-switching. At 56–64px the light-to-medium weights feel assertive without shouting; at 10–14px the medium-to-semibold weights keep small labels legible at compact density.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 10px | 1.8 | — | `--text-caption` |
| body | 14px | 1.56 | — | `--text-body` |
| body-lg | 16px | 1.5 | — | `--text-body-lg` |
| subheading | 18px | 1.45 | — | `--text-subheading` |
| heading-sm | 20px | 1.35 | — | `--text-heading-sm` |
| heading | 32px | 1.28 | — | `--text-heading` |
| heading-lg | 40px | 1.25 | — | `--text-heading-lg` |
| display-sm | 56px | 1.12 | — | `--text-display-sm` |
| display | 64px | 1 | — | `--text-display` |

### Runtime UI Hierarchy Contract

아래 표는 현재 공통 컴포넌트의 runtime anchor와 앞으로 새 UI가 따라야 할 계약을 함께 정리한다. 기존 화면의 불일치는 Phase 5 remediation 대상으로 다루며, 새 화면에서 다시 복제하지 않는다.

| Role | Contract |
| --- | --- |
| Page title | `PageHeader` 또는 report 계열 `ReportPageHeader`를 재사용한다. route의 주 제목은 의미상 `h1` 하나이며, 현재 공통 title의 24px / 1.35 / 600을 시각 anchor로 삼는다. 기존 wrapper의 heading semantics가 다르면 별도 remediation에서 고친다. |
| Section title | 한 section에는 한 가지 목적만 두고 18px / 1.45 / 600을 기본 목표로 한다. page title과 경쟁하는 크기나 별도 display heading을 만들지 않는다. |
| Card title | 카드 전체를 설명하는 title과 status/count는 `AppCard`의 `title` / `extra`를 사용한다. body 안에 같은 역할의 header row를 다시 만들지 않는다. |
| Korean reading | 연속된 한국어 읽기 본문은 16px 이상, 약 1.7 line-height, 약 760px 읽기 폭을 목표로 한다. 새 `max-w-[...]` 임의값 대신 승인된 reading recipe 또는 semantic layout source를 사용한다. |
| Helper/status | 현재 14px / 약 1.57 anchor와 semantic secondary token을 사용한다. 색만으로 의미나 상태를 전달하지 않는다. |

한 task area에는 primary action을 하나만 둔다. Desktop에서는 공간이 허용될 때 title과 actions를 같은 header axis에 두고, mobile에서는 actions를 아래로 감싸되 title의 크기와 위계를 줄이지 않는다.

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** compact

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 36 | 36px | `--spacing-36` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 64 | 64px | `--spacing-64` |
| 68 | 68px | `--spacing-68` |
| 80 | 80px | `--spacing-80` |
| 120 | 120px | `--spacing-120` |

### Border Radius

| Element | Value |
|---------|-------|
| hero | 48px |
| pill | 10000px |
| cards | 36px (primary) or 28px (compact) |
| icons | 40px |
| badges | 12px |
| inputs | 14px |
| buttons | 36px (pill) or 14-16px (rounded rect) |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `rgba(255, 255, 255, 0.5) 0px 0.5px 0px 0px inset, rgba(11...` | `--shadow-subtle` |
| subtle-2 | `rgb(228, 228, 231) 0px 1px 0px 0px inset` | `--shadow-subtle-2` |
| subtle-3 | `rgb(255, 255, 255) 0px 0.5px 0px 0px inset` | `--shadow-subtle-3` |
| subtle-4 | `rgb(255, 255, 255) 0px -0.5px 0px 0px` | `--shadow-subtle-4` |
| subtle-5 | `rgb(228, 228, 231) 0px -1px 0px 0px` | `--shadow-subtle-5` |
| md | `rgba(0, 0, 0, 0.04) 0px 4px 12px 0px` | `--shadow-md` |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 80px
- **Card padding:** 24-28px
- **Element gap:** 8px

## Components

### Primary Pill Button
**Role:** Main page CTA — Book demo, Get started, View all projects

Background #09090b, white text, Cosmica 14–16px weight 500, border-radius 36px, padding 12px 16px, 1.5px ring at rgb(44,46,52) with layered inset highlight and soft drop shadow. The multi-layer shadow gives the black pill a pressed-glass tactile quality unique to this system.

### Outlined White Button
**Role:** Secondary actions, nav-adjacent controls

Background #ffffff, text #3f3f46, border 1px solid #3f3f46, border-radius 36px, padding 20px. Same pill silhouette as primary but inverted — white fill against the dark border reads as a ghost on light backgrounds.

### Rounded Dark Button
**Role:** In-context actions within dark card panels

Background #09090b, white text, border 1px solid rgba(255,255,255,0.2), border-radius 14–16px, padding 12–14px 16–18px. The softer radius (not pill) distinguishes panel-embedded actions from page-level CTAs.

### Light Surface Card
**Role:** Stat blocks, feature sections, testimonials on white canvas

Background #ffffff, border-radius 36px, padding 28px horizontal and vertical, no box-shadow (flat). The extreme 36px radius makes white rectangles read as bubbles rather than panels.

### Card Footer Actions
**Role:** Card-level CTAs and navigation actions in TALKPIK app surfaces

Use Ant Design `Card.actions` for card-level buttons instead of placing those buttons inside the card body. The body should hold content only; the footer/actions area owns the card's primary or secondary CTA. In TALKPIK runtime, keep this footer visually borderless by default: no top divider, no extra outline, and no nested mini-card treatment. Use one action group per card and keep the button aligned with the card content.

### Card Header Title + Extra
**Role:** Card titles, right-aligned status chips, and count metadata in TALKPIK app surfaces

Use Ant Design `Card` `title` for the card title and `extra` for card-level status or count metadata. Do not hand-build a title/status row inside the card body when sibling cards should share alignment. The card body should start with the card's actual content, not a repeated header row.

### Muted Surface Card
**Role:** Secondary content blocks and social proof rows

Background #ececee, border-radius 28px, padding 24px all sides, no shadow. Slightly smaller radius and darker fill than white cards creates a quiet depth step without elevation.

### Dark Problem Panel
**Role:** Contrast section listing bottleneck points (e.g. 'We solve the bottlenecks' section)

Background #09090b or #222222, border-radius 28–36px, white and #a1a1aa text. Keyword phrases use Cosmica weight 600–700 while lead-in words use weight 300–400, creating inline weight contrast within single lines.

### Portfolio Tile Card
**Role:** Work showcase grid — full-bleed image with category badges overlaid

Background is the full-bleed project image or a vivid accent fill (#fe45e2 for decorative tiles). Border-radius 36px clipping the image. Badge labels float over the image at bottom-left, using the transparent dark badge variant.

### Dark Overlay Badge
**Role:** Category/skill tags on dark or image backgrounds

Background transparent, text #ffffff, border 1px solid rgba(255,255,255,0.3–0.5), border-radius 12px, padding 4px 8px, Cosmica 12px weight 500.

### Dark Filled Badge
**Role:** Skill/service tags on light backgrounds

Background #3f3f46, text #fafafa, border-radius 12px, padding 4px 8px, Cosmica 12px weight 500.

### Ember Badge (YC Marker)
**Role:** Y Combinator batch identifier on project cards and testimonials

Background #ff5a00, text #ffffff, border-radius 12px, padding 4px 8px, Cosmica 12px weight 600. Its use is exclusive to YC affiliation labels — never repurpose for generic status.

### Email Input + CTA Row
**Role:** Hero email capture form

Input: background #ffffff, text #333333, border transparent, border-radius 14px, padding 12px 12px 12px 16px, Cosmica 14px weight 400, placeholder text in #a1a1aa. Paired inline with a Primary Pill Button (Book demo) in a flex row.

### Announcement Banner
**Role:** Full-width notification strip above the nav

Background #222222 or near-black, rounded-rect pill shape at border-radius 48px, text white Cosmica 14px, with a ghost inline CTA link on the right. Uses backdrop-filter blur for a frosted dark treatment.

### Stat Number Block
**Role:** Key metric highlights (20 000+, 4 000+, 70%, 40%, 60%)

Large numeral at 40–56px Cosmica weight 700 in #09090b or #18181b. Descriptor label below at 12–14px weight 400 in #71717a. No card border — sits directly on section background for raw typographic emphasis.

## Do's and Don'ts

### Do
- Put card titles and right-side status/count metadata in Ant Design `Card` `title` and `extra` when the information describes the whole card.
- Put card-level CTA buttons in the Ant Design `Card.actions` footer area, not in the card body. Keep the footer action area borderless by default.
- Treat 28-36px radii as raw Awesomic reference values for marketing/reference surfaces; use the documented TALKPIK runtime radius exception (4-8px workspace cards/panels) for study dashboards and operational UI.
- Use Ant Design components and tokens first; treat Tailwind as a layout utility and `--app-*` bridge consumer.
- Keep one clear primary action per task area, and pair every color signal with text or icon.
- Encode difficulty (1–5) with the muted Difficulty Scale by tinting the difficulty icon only; keep the label text achromatic and source colors from `difficultyFillColor`/`difficultyLabelKey` (see Tokens — Difficulty Scale).
- Apply the multi-layer button shadow (rgba(255,255,255,0.5) inset + rgba(117,123,133,0.4) inset + rgb(44,46,52) 1.5px ring + rgba(0,0,0,0.14) drop) only on the primary #09090b pill button — it defines the CTA's physicality.
- Reserve Ember (#ff5a00) exclusively for YC batch badges and Orchid Flash (#fe45e2) exclusively for single decorative card washes — these vivid colors derive their impact from appearing nowhere else.
- Use Cosmica weight 300–400 for lead-in words and weight 600–700 for the key noun/verb in the same line to create inline tonal contrast without changing size.
- Maintain a 4-step neutral surface stack (Mist → Snow → Fog → Obsidian) per page — don't introduce more than four background tones in a single section view.
- Apply border-radius 12px to all badge and tag components regardless of content length — pill tags use 10000px only for navigation-level controls.
- Use backdrop-filter blur (5–17px range) on overlaid panels and the announcement banner to create depth without hard shadows on light surfaces.

### Don't
- Don't create custom card header rows inside the card body for whole-card title/status alignment.
- Don't place card-level CTA buttons inside card body content unless the action is inline with a form field or a sentence-level control.
- Don't use any color other than #09090b/#222222 for filled button backgrounds — the system has no chromatic CTA color; dark filled + white text is the only primary action pattern.
- Don't apply the raw 28-36px Awesomic radius scale to TALKPIK workspace cards when the runtime contract specifies the smaller app radius.
- Don't paste raw Tailwind export values into app CSS; normalize through `src/theme` and expose only approved `@theme inline` aliases.
- Don't create a separate Tailwind palette, radius scale, shadow scale, or font source.
- Don't introduce new typefaces — Cosmica's weight range handles all hierarchy; adding a second family destroys the single-voice typographic system.
- Don't apply drop shadows to cards — card depth is expressed through background color steps (#ffffff vs #ececee vs #09090b), not elevation shadows.
- Don't use #ff5a00 or #fe45e2 for UI states, hover effects, or repeated interface elements — their power is scarcity; repeated use collapses their impact.
- Don't reuse the Difficulty Scale colors (#5e9e6f / #8aa04e / #cca63a / #cf833f / #c75d4f) for any non-difficulty UI (buttons, states, hover) — like Ember/Orchid, they are scoped to one purpose.
- Don't use letter-spacing overrides on headlines — Cosmica's normal tracking at large sizes is a deliberate choice; tracked-out display text would clash with the type system.
- Don't place text directly on the vivid Orchid Flash (#fe45e2) card background at body size — it is a decorative wash only; any overlaid text must use display weight white.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Canvas | `#f4f4f5` | Page background and default section fill |
| 2 | Card White | `#ffffff` | Primary card surface on the canvas |
| 3 | Card Muted | `#ececee` | Secondary card or tag surface, slightly elevated feel against white |
| 4 | Dark Surface | `#09090b` | Dark card sections, filled button backgrounds, problem-statement panels |

## Elevation

- **Primary Action Button:** `rgba(255,255,255,0.5) 0px 0.5px 0px 0px inset, rgba(117,123,133,0.4) 0px 9px 14px -5px inset, rgb(44,46,52) 0px 0px 0px 1.5px, rgba(0,0,0,0.14) 0px 4px 6px 0px`
- **Card (inset bottom border):** `rgb(228,228,231) 0px 1px 0px 0px inset`
- **Card (subtle drop shadow):** `rgba(0,0,0,0.04) 0px 4px 12px 0px`

## Imagery

Awesomic uses full-bleed product and motion screenshots as portfolio tile fills — the work IS the image, with no lifestyle photography or human-context staging. Tiles are clipped to 36px rounded rectangles, giving raw screen captures a contained, curated feel. Video production tiles use dark cinematic stills (moody red neon on black) cropped tight to the 36px rounded container. Illustration and graphic-design work tiles show vibrant multi-color client deliverables framed inside the same tile shape, creating a gallery-wall effect. Icons throughout the UI are minimal, monochrome, single-stroke or flat fills at ~20px, never decorative. The system is imagery-dependent for the portfolio section but typography-dominant for all informational and conversion sections — roughly 60% text, 40% imagery across the full page.

## Layout

Max-width approximately 1200px, centered on the canvas (#f4f4f5). The hero is a 2-column split: large display headline left (weight 700, 56–64px) with an accented cycling word in a lighter tonal color, and a compact right column with subtext, email input, and CTA. Below the hero, a horizontal logo-strip scrolls client logos at full bleed. Subsequent sections alternate: white-canvas text+card layouts, then a full-width dark panel (#09090b) for problem-statement copy, back to a light canvas for social proof and stat blocks. The portfolio grid is a horizontal scroll row of tall rounded tiles rather than a static grid. Feature/benefit cards use a 2-3 column grid at 36px-radius white cards on the Mist canvas. Section vertical gaps are 80px; internal card padding 24–28px. Navigation is a sticky top bar at ~40px height with inline text links and a black pill 'Book demo' button at the right edge.

## Agent Prompt Guide

**Quick Color Reference**
- text (primary): #09090b / #18181b
- text (muted): #71717a
- background (canvas): #f4f4f5
- card surface: #ffffff
- border / divider: #ececee / #3f3f46
- accent (badge only): #ff5a00 (YC), #fe45e2 (decorative card)
- primary action: #09090b (filled action)
- difficulty (1–5, icon tint only): #5e9e6f → #8aa04e → #cca63a → #cf833f → #c75d4f (see Tokens — Difficulty Scale)

**Example Component Prompts**

1. **Hero Headline Section**: White or Mist (#f4f4f5) background. Left column: display headline at 56px Cosmica weight 700, color #09090b, normal letter-spacing, line-height 1.12. One word in the headline renders in #a1a1aa at the same size/weight to create cycling accent. Right column: body text at 16px Cosmica weight 400, color #18181b; email input (background #ffffff, border transparent, radius 14px, padding 12px 16px, placeholder #a1a1aa) paired with a pill button (background #09090b, text #ffffff, radius 36px, padding 12px 16px, Cosmica 14px weight 500).

2. **Portfolio Tile**: 36px border-radius container clipping a full-bleed project screenshot. Overlay at bottom-left: project title in Cosmica 20px weight 600 white; category badges below (transparent background, white text, border rgba(255,255,255,0.3), radius 12px, padding 4px 8px, Cosmica 12px weight 500). One tile per grid row may use #fe45e2 as a solid card background instead of an image.

3. **Dark Problem Panel**: Background #09090b, border-radius 36px, padding 28px. Bullet rows in Cosmica 18px, line-height 1.45: lead-in word (e.g. 'Forget about') in #a1a1aa weight 400, followed by key phrase in #ffffff weight 600. Each row preceded by a circle icon in #3f3f46.

4. **Stat Block Row**: On Mist (#f4f4f5) background, no card border. Stat numeral at 40px Cosmica weight 700 color #09090b. Descriptor label at 13px Cosmica weight 400 color #71717a, line-height 1.56, placed directly beneath the numeral with 4px gap.

5. **Skill/Service Badge (dark variant)**: Background #3f3f46, text #fafafa, border-radius 12px, padding 4px 8px, Cosmica 12px weight 500. For YC labels substitute background #ff5a00, text #ffffff.

## Motion Philosophy

Awesomic uses animation expressively but purposefully. Three named scrolling loops (reverseloop, scroll-text, scroll-text-cta) drive the horizontal logo ticker and portfolio scroll strips at a slow 8–50s linear duration — continuous motion implies an always-on, high-volume output. UI micro-interactions (hover states, accordion expand) use 0.2–0.35s ease transitions on transform and opacity only. The one expressive easing (cubic-bezier 0.175, 0.885, 0.32, 1.275 — a mild overshoot spring) is reserved for entrance animations. Never animate color or background-color — only positional and opacity transforms.

## Similar Brands

- **Designjoy** — Same subscription-design-service model with dark filled pill buttons and portfolio-tile-as-hero grid layout
- **Superside** — Full-bleed portfolio tiles, single-typeface system, and dark/light alternating section bands for a design marketplace
- **Arc.dev** — Near-black primary action buttons on white canvas with a graduated gray neutral scale and rounded card containers
- **Contra** — Talent marketplace with portfolio card grids using extreme rounded corners and minimal accent color against achromatic surfaces
- **Framer** — Custom typeface used at all sizes for full system consistency, large rounded cards, and dark filled CTA buttons on a light page

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-obsidian: #09090b;
  --color-ink: #18181b;
  --color-graphite: #3f3f46;
  --color-slate: #52525b;
  --color-steel: #71717a;
  --color-ash: #a1a1aa;
  --color-pebble: #d4d4d8;
  --color-fog: #ececee;
  --color-mist: #f4f4f5;
  --color-snow: #ffffff;
  --color-ember: #ff5a00;
  --color-orchid-flash: #fe45e2;

  /* Typography — Font Families */
  --font-cosmica: 'Cosmica', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.8;
  --text-body: 14px;
  --leading-body: 1.56;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.45;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.35;
  --text-heading: 32px;
  --leading-heading: 1.28;
  --text-heading-lg: 40px;
  --leading-heading-lg: 1.25;
  --text-display-sm: 56px;
  --leading-display-sm: 1.12;
  --text-display: 64px;
  --leading-display: 1;

  /* Typography — Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-68: 68px;
  --spacing-80: 80px;
  --spacing-120: 120px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 80px;
  --card-padding: 24-28px;
  --element-gap: 8px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;
  --radius-3xl-2: 28px;
  --radius-3xl-3: 36px;
  --radius-3xl-4: 40px;
  --radius-full: 48px;
  --radius-full-2: 56px;
  --radius-full-3: 64px;
  --radius-full-4: 80px;
  --radius-full-5: 1000px;
  --radius-full-6: 10000px;

  /* Named Radii */
  --radius-hero: 48px;
  --radius-pill: 10000px;
  --radius-cards: 36px (primary) or 28px (compact);
  --radius-icons: 40px;
  --radius-badges: 12px;
  --radius-inputs: 14px;
  --radius-buttons: 36px (pill) or 14-16px (rounded rect);

  /* Shadows */
  --shadow-subtle: rgba(255, 255, 255, 0.5) 0px 0.5px 0px 0px inset, rgba(117, 123, 133, 0.4) 0px 9px 14px -5px inset, rgb(44, 46, 52) 0px 0px 0px 1.5px, rgba(0, 0, 0, 0.14) 0px 4px 6px 0px;
  --shadow-subtle-2: rgb(228, 228, 231) 0px 1px 0px 0px inset;
  --shadow-subtle-3: rgb(255, 255, 255) 0px 0.5px 0px 0px inset;
  --shadow-subtle-4: rgb(255, 255, 255) 0px -0.5px 0px 0px;
  --shadow-subtle-5: rgb(228, 228, 231) 0px -1px 0px 0px;
  --shadow-md: rgba(0, 0, 0, 0.04) 0px 4px 12px 0px;

  /* Surfaces */
  --surface-canvas: #f4f4f5;
  --surface-card-white: #ffffff;
  --surface-card-muted: #ececee;
  --surface-dark-surface: #09090b;
}
```

### Tailwind v4 — Raw Export Reference Only

The block below shows the raw exported Tailwind token shape. In the TALKPIK app,
equivalent Tailwind utilities must be produced from `src/theme` through
`@theme inline` aliases that read resolved `--app-*` variables. If a token below
is promoted into the app bridge, update `src/theme/tokens/*`,
`src/theme/tailwind-bridge.ts`, `src/styles/global.css`, and `tests/theme/*`
together.

```css
@theme {
  /* Colors */
  --color-obsidian: #09090b;
  --color-ink: #18181b;
  --color-graphite: #3f3f46;
  --color-slate: #52525b;
  --color-steel: #71717a;
  --color-ash: #a1a1aa;
  --color-pebble: #d4d4d8;
  --color-fog: #ececee;
  --color-mist: #f4f4f5;
  --color-snow: #ffffff;
  --color-ember: #ff5a00;
  --color-orchid-flash: #fe45e2;

  /* Typography */
  --font-cosmica: 'Cosmica', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.8;
  --text-body: 14px;
  --leading-body: 1.56;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.45;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.35;
  --text-heading: 32px;
  --leading-heading: 1.28;
  --text-heading-lg: 40px;
  --leading-heading-lg: 1.25;
  --text-display-sm: 56px;
  --leading-display-sm: 1.12;
  --text-display: 64px;
  --leading-display: 1;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-68: 68px;
  --spacing-80: 80px;
  --spacing-120: 120px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;
  --radius-3xl-2: 28px;
  --radius-3xl-3: 36px;
  --radius-3xl-4: 40px;
  --radius-full: 48px;
  --radius-full-2: 56px;
  --radius-full-3: 64px;
  --radius-full-4: 80px;
  --radius-full-5: 1000px;
  --radius-full-6: 10000px;

  /* Shadows */
  --shadow-subtle: rgba(255, 255, 255, 0.5) 0px 0.5px 0px 0px inset, rgba(117, 123, 133, 0.4) 0px 9px 14px -5px inset, rgb(44, 46, 52) 0px 0px 0px 1.5px, rgba(0, 0, 0, 0.14) 0px 4px 6px 0px;
  --shadow-subtle-2: rgb(228, 228, 231) 0px 1px 0px 0px inset;
  --shadow-subtle-3: rgb(255, 255, 255) 0px 0.5px 0px 0px inset;
  --shadow-subtle-4: rgb(255, 255, 255) 0px -0.5px 0px 0px;
  --shadow-subtle-5: rgb(228, 228, 231) 0px -1px 0px 0px;
  --shadow-md: rgba(0, 0, 0, 0.04) 0px 4px 12px 0px;
}
```
