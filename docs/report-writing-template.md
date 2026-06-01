# Report Writing Template

This document is mandatory when an AI agent writes a user-facing report, status update, review report, comparison report, handoff, or completion summary.

Use this document together with [`docs/user-communication-style.md`](user-communication-style.md). The communication style document controls tone. This document controls report shape.

## Core Rule

Write reports so a non-developer or vibe coder can understand the result quickly.

Start with the answer. Put evidence after the answer. Add difficult terms only when needed, and explain them first in plain Korean with the original term in parentheses.

## Default Report Shape

Use this order unless the user asks for a different format:

1. One-line conclusion
2. Three-card scoreboard
3. Priority actions
4. "What happened / why it matters / how to check" items
5. Evidence bundle
6. Glossary

## 1. One-Line Conclusion

Answer the user's main question in one short sentence.

Examples:

- 결론: 문서 분리는 끝났고, 자동 점검도 통과했습니다.
- 결론: 기능은 동작하지만, 화면 확인이 아직 남았습니다.
- 결론: 지금 막힌 이유는 권한 정보가 없기 때문입니다.

## 2. Three-Card Scoreboard

Use three short cards near the top of the report.

Recommended cards:

- Status: complete, not complete, blocked, or needs review.
- Changed: files, docs, behavior, UI, data, or settings changed.
- Risk: none, low, medium, high, or unknown.

Korean labels should be user-friendly:

- 상태
- 바뀐 것
- 남은 위험

Example:

```markdown
**3카드 요약**

- **상태**
  - 완료
- **바뀐 것**
  - 문서 2개 수정
- **남은 위험**
  - 낮음
```

## 3. Priority Actions

Use plain Korean priority labels:

- 지금 당장
- 이번 주 안에
- 여유 있을 때

If technical priority labels are useful, place them after the plain Korean label:

- 지금 당장(P0)
- 이번 주 안에(P1)
- 여유 있을 때(P2)

## 4. Explanation Items

For each important item, use this three-line shape:

- 무슨 일?
- 왜 중요?
- 확인 방법?

Example:

```markdown
**말투 지침 분리**

- 무슨 일? 사용자 응답 규칙을 별도 문서로 뺐습니다.
- 왜 중요? 에이전트가 매번 같은 기준으로 답하게 됩니다.
- 확인 방법? `AGENTS.md`의 필수 시작 절차를 보면 됩니다.
```

## 5. Evidence Bundle

Keep evidence clear and compact. Do not bury the conclusion inside evidence.

Include only the fields that matter for the report:

- Docs consulted
- Files changed
- Checks run
- Check results
- Skipped checks and reason
- Remaining risks
- Follow-up needed

For developer workflow reports, preserve the required evidence fields from [`docs/ai-workflow/templates/report-template.md`](ai-workflow/templates/report-template.md).

## 6. Glossary

Add a glossary when the report includes difficult terms, internal agent terms, English workflow words, tool names, variable names, function names, or project-specific labels.

Format:

```markdown
**용어**

- 작업 일지(ledger): 나중에 이어서 볼 수 있게 남기는 작업 기록입니다.
- 자동 점검 과정(workflow checker): 문서 규칙이 깨졌는지 기계로 확인하는 과정입니다.
```

## Short Completion Report Template

```markdown
결론: <끝났는지, 남았는지, 막혔는지 한 문장으로 말합니다.>

**3카드 요약**

- **상태**
  - <완료 / 미완료 / 막힘 / 검토 필요>
- **바뀐 것**
  - <문서, 코드, 화면, 설정 등>
- **남은 위험**
  - <없음 / 낮음 / 중간 / 높음 / 알 수 없음>

**확인 결과**

- <실행한 확인 1>: <통과 / 실패 / 건너뜀>
- <실행한 확인 2>: <통과 / 실패 / 건너뜀>

**다음 할 일**

- 지금 당장: <없음 또는 할 일>
- 이번 주 안에: <없음 또는 할 일>
- 여유 있을 때: <없음 또는 할 일>

**용어**

- <쉬운 설명>(<원어>): <한 줄 풀이>
```

## Long Report Template

```markdown
결론: <가장 중요한 판단을 한 문장으로 말합니다.>

**3카드 요약**

- **상태**
  - <완료 / 미완료 / 막힘 / 검토 필요>
- **바뀐 것**
  - <핵심 변경>
- **남은 위험**
  - <위험 수준과 이유>

**우선순위별 액션**

- 지금 당장: <가장 급한 일>
- 이번 주 안에: <가까운 후속 작업>
- 여유 있을 때: <개선하면 좋은 일>

**핵심 내용**

**<항목 이름>**

- 무슨 일? <짧은 설명>
- 왜 중요? <사용자에게 미치는 영향>
- 확인 방법? <어디서 확인하는지>

**증거 묶음**

- 읽은 문서:
  - `<path>`
- 바뀐 파일:
  - `<path>`
- 실행한 확인:
  - `<command or method>`: <결과>
- 건너뛴 확인:
  - <이유>

**남은 위험**

- <위험 또는 없음>

**용어**

- <쉬운 설명>(<원어>): <한 줄 풀이>
```

## HTML Report Template

Use this shape when the user asks for an HTML report or when a visual report would be easier to understand.

```html
<main>
  <section>
    <h1>한 줄 결론</h1>
    <p>문서 분리는 끝났고, 필수 읽기 규칙도 연결됐습니다.</p>
  </section>

  <section>
    <h2>3카드 스코어보드</h2>
    <div class="cards">
      <article>
        <h3>상태</h3>
        <p>완료</p>
      </article>
      <article>
        <h3>바뀐 것</h3>
        <p>문서 2개 수정</p>
      </article>
      <article>
        <h3>남은 위험</h3>
        <p>낮음</p>
      </article>
    </div>
  </section>

  <section>
    <h2>우선순위별 액션</h2>
    <ul>
      <li>지금 당장: 없음</li>
      <li>이번 주 안에: 다른 에이전트 문서에도 연결 검토</li>
      <li>여유 있을 때: 예시 보고서 템플릿 추가</li>
    </ul>
  </section>

  <section>
    <h2>핵심 내용</h2>
    <article>
      <h3>말투 지침 분리</h3>
      <p><strong>무슨 일?</strong> 사용자 응답 규칙을 별도 문서로 뺐습니다.</p>
      <p><strong>왜 중요?</strong> 에이전트가 매번 같은 기준으로 답하게 됩니다.</p>
      <p><strong>확인 방법?</strong> AGENTS.md의 필수 시작 절차를 보면 됩니다.</p>
    </article>
  </section>

  <section>
    <h2>용어</h2>
    <dl>
      <dt>작업 일지(ledger)</dt>
      <dd>나중에 이어서 볼 수 있게 남기는 작업 기록입니다.</dd>
    </dl>
  </section>
</main>
```

## When To Use Tables

Use tables only when comparison or evidence scanning is easier in rows and columns.

Prefer cards or short bullets for user-facing summaries. Use tables for technical evidence only when they improve readability.

## Do Not

- Do not start with a long process explanation.
- Do not make the user search for the conclusion.
- Do not use unexplained English workflow words.
- Do not pack many file paths or checks into one long sentence.
- Do not include every internal detail when the user only needs the decision.
