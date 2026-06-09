# B3 결정 — #52 정답 정책 (G10) (2026-06-09)

> owner가 **Opus 4.8 에이전트에 위임**(codex 대체). 양 저장소 실소스 대조 후 확정.

## DECISION
**#52 = 피드백/루브릭 채점 전용.** 권위 있는 빈칸별 정답셋(exact-match) **없음**. #52의 `answer_key`는 `kind:"complete_paragraph"`(model_answer + blank_target 힌트)로 **의도적 유지**(#51식 blank_completion 정답배열 아님).

## 근거 (file:line)
1. **채점기가 정답을 안 읽음**: 제출은 `generateMockFeedback({question_no,char_count,answer_text})`만 전달(`server-actions.ts:35-39`), `feedback-service.ts:40-77`은 루브릭 차원으로만 채점·answer_key/acceptedAnswers 미수신. → 정답셋은 죽은 필드.
2. **데이터가 이미 그 결정**: #52 answer_key는 complete_paragraph(model_answer+힌트, `seed 120200:14649-14654`), ㄱ/ㄴ 정답배열·blank_1/2 없음. #51은 blank_completion(정답배열·accepted_synonyms, `137-188`). normalizer `answerRecord?.[label]`(`problem-normalizer.ts:306`)가 #52엔 빈값.
3. #52 submit-gate `conditions`는 `blank.targetHint ?? blank.role`(힌트), 정답 아님(`:487-495`).
4. TOPIK 52는 연결표현 적절성 평가 → 다수 표현 허용, exact-match 부적합.
5. `acceptedAnswers`는 쓰기 UI가 소비조차 안 함(grep 0).

## #52 에디터가 저작할 것 (C3b, 기존 jsonb, 새 스키마 0)
- `prompt`(( ㄱ )( ㄴ ) 마커 = 빈칸 위치) · `answer_key`=`{kind:complete_paragraph, model_answer, blank_target_giyeok, blank_target_nieun}`(학습자용 참고+힌트, 채점키 아님) · `rubric{conditions,criteria}`(submit·피드백 차원) · title/topic_category_code/difficulty/노출축.
- **per-blank accepted_answers/synonyms/canonical 저작 금지**(=#51 전용 shape).

## 완성도 규칙 (#52)
`prompt`에 ( ㄱ )·( ㄴ ) 둘 다 + `rubric.conditions>0` AND `rubric.criteria>0`(현 게이트 유지, `:497-503`). `model_answer`는 **publish 품질상 admin 필수**지만 런타임 submit-gate 아님(없어도 학습자 차단 X). 정답배열은 불필요·비저작.

## 적발 (C3b서 수정 — topik-ai)
- 현 admin `buildContent('52')={instruction,choices:[],answer:''}`(`supabase-assessment-question-bank-service.ts:104-115`)는 **객관식 모양으로 잘못 모델링**·항상 빈값.
- `modelAnswerOf`가 `answer_key.text`만 읽음(`:118-121`) → #52는 `answer_key.model_answer`라 **admin이 #52 모범답안 빈값 표시**. C3b서 `model_answer`(+`.text` 폴백) 읽도록.

## 영향/시퀀싱
- 채점·submit-gate **변경 없음**(이미 루브릭). 이중채점 위험 없음(exact-match 미도입).
- **docs-only now**: v13 스키마/코드 변경 불필요(answer_key jsonb 이미 #52 형태 보유). G10 → **RESOLVED**. C3b 변경은 topik-ai owner 게이트.

## 출처
`server-actions.ts:35-39`, `feedback-service.ts:40-77`, `problem-normalizer.ts:262-320,484-503`, `seed 120200`(#51:137-188·#52:14649-14654), topik-ai `supabase-assessment-question-bank-service.ts:104-121`·`assessment-question-bank-types.ts:59-64`, 정합문서 G10.
