# Fixture — fx-05 PASS (auto-exempt: changed files are test-only)

변경 파일이 `src/app/foo.test.tsx`처럼 test-only 패턴에만 매치되면
needsUxuiConsistencyPass(files)가 false를 반환해야 함 → 게이트 자동 면제.
ledger 자체에 UX/UI Consistency Pass 필드가 없어도 PASS.

- Cross-model review: passed
- Architecture Pass: passed

(no UX/UI Consistency Pass field — auto-exempt because changed files are only test files)
