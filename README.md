# TALKPIK AI

TALKPIK AI는 TOPIK 학습자가 목표를 세우고, 추천 문제와 쓰기 51~54번을 연습하며, 피드백과 복습을 통해 실력을 높이는 사용자 앱입니다.

## 기술 구성

- Next.js App Router, React, TypeScript
- Ant Design과 Tailwind CSS
- Supabase Auth, Postgres, Storage
- Vitest, Testing Library, Playwright
- pnpm, Vercel

## 문서 지도

| 알고 싶은 것 | 기준 |
| --- | --- |
| AI 작업 방식과 안전 경계 | [`AGENTS.md`](./AGENTS.md) |
| AI 개발 task 준비·공용 workspace·인수인계·산출물·자동 정리, Keduall 승격·DB·Vercel | [`docs/operations/ai-development-pipeline.md`](./docs/operations/ai-development-pipeline.md) |
| 제품 목표, 현재 범위와 사용자 약속 | [`docs/prd.md`](./docs/prd.md) |
| 현재 route와 구현 동작 | `src/app/`, `src/lib/routes.ts`, tests |
| UI와 theme | [`DESIGN.md`](./DESIGN.md), `src/theme/`, `src/styles/global.css` |
| 테스트와 완료 조건 | [`TESTING.md`](./TESTING.md) |
| 클라이언트 운영·복원력·환경 안전 계약 | [`docs/operations/README.md`](./docs/operations/README.md) |
| DB migration과 적용 순서 | [`supabase/migrations/INDEX.md`](./supabase/migrations/INDEX.md) |
| 사람이 읽는 Supabase 계약 | [`docs/supabase/README.md`](./docs/supabase/README.md) |
| 외부 백엔드 OpenAPI 참고 | [`docs/swagger-api/README.md`](./docs/swagger-api/README.md) |
| 날짜별 검증 계획과 결과 | [`docs/qa/README.md`](./docs/qa/README.md) |

## 주요 진입점

```text
src/app/                  Next.js route와 화면
src/components/           공통 UI
src/lib/                  제품·서버·Supabase 로직
src/theme/                Ant Design theme와 Tailwind bridge
tests/                    unit, integration, e2e
supabase/migrations/      DB schema, RLS, RPC 정본
```

환경 변수와 실행 명령은 [`.env.example`](./.env.example), [`package.json`](./package.json), [`TESTING.md`](./TESTING.md)를 확인합니다.
