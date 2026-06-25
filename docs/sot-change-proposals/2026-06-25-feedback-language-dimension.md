# Feedback language dimension SOT update proposal

## 대상 문서

- `docs/Wireframe/data-usage-index.md`
- 쓰기 피드백/리포트 관련 Wireframe 기능 명세
- Supabase feedback schema를 설명하는 문서가 있다면 해당 문서

## 수정 이유

외부 Writing API backend가 피드백 trait를 `content`, `structure`, `language`로 정규화해 Supabase에 push한다. 기존 Supabase 계약은 `feedback_dimension_scores.dimension`과 `private.assert_submission_payload` validator에서 `language`를 허용하지 않아 backend push가 `23514 check_violation`으로 실패할 수 있다.

## 제안 변경

피드백 dimension 허용 목록을 다음 값으로 확장한다.

```text
grammar, vocab, structure, content, expression, topic_fit, language
```

`language`는 언어 사용 전반을 나타내는 trait로 취급한다. 화면 라벨은 한국어 `언어`, 영어 `Language`, 베트남어 `Ngôn ngữ`를 사용한다.

## 구현 반영

- 새 migration으로 `feedback_dimension_scores_dimension_check`를 재정의한다.
- `private.assert_submission_payload`의 dimension validator에 `language`를 추가한다.
- TypeScript Supabase type union과 `FEEDBACK_DIMENSIONS`에 `language`를 추가한다.
- 외부 API feedback mapper에서 `trait: "language"`를 `dimension: "language"`로 저장한다.
- 관련 UI label catalog와 비교/성장/보관함 차원 라벨 목록에 `language`를 추가한다.

## 검증 기준

- 외부 feedback payload의 `trait_scores[].trait = "language"`가 내부 dimension row로 매핑된다.
- migration SQL에 `language`가 CHECK constraint와 RPC validator 양쪽에 포함된다.
- TypeScript typecheck에서 `feedback_dimension_scores.dimension = "language"`가 허용된다.
- i18n catalog parity와 관련 단위 테스트가 통과한다.
