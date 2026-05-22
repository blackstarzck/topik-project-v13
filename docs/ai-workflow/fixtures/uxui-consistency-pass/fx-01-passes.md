# Fixture — fx-01 PASS (full 4-line evidence)

이 fixture는 정상적인 UX/UI Consistency Pass 통과 케이스.
변경 파일이 UI 패턴(`src/app/foo.tsx`)에 매치되고, ledger의 부모 + 4개 하위 필드 모두 채워짐.

- UX/UI Consistency Pass: passed
  - Tokens: passed — checked against docs/ant-design/02-global-styles.md, no hardcoded colors
  - Components: passed — reused existing Card pattern from 03-patterns-and-components.md
  - A11y: passed — keyboard reachable, focus visible, semantic labels, 4.5:1 contrast verified
  - Responsive: passed — 360/768/1280 breakpoints all rendered without breakage
