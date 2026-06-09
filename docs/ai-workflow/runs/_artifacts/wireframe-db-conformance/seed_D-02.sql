-- ============================================================================
-- Durable dev seed — TALKPIK writing screen D-02 (answer-writing-52, question_no 52)
-- Artifact (parallel fan-out). checkOnly=true / canDML=false → NOT auto-applied.
--   This file is the durable, idempotent, additive seed definition only.
--   Apply path is the normal `supabase db reset` (which runs supabase/seed.sql)
--   plus this guarded statement; no destructive ops, no production rollout.
--
-- Source JSON  : docs/Wireframe/09-D-02-answer-writing-52/sample-52.json
--   array length (itemsAvailable) : 76
--   representative item picked     : a[0]
--   JSON provenance id (REQUIRED)  : 5c95afa6-2766-4db6-b4ea-860e917691a6
--   (index fallback FORBIDDEN — the JSON `id` field is the only provenance key)
--
-- Source priority honored:
--   description.md > functional-spec.md > screen-data-summary.md > hifi/wireframe > sample JSON
--
-- CONTRACT-NOT-LABEL: screen-data-summary.md LABELS the "52번 전용 조건 배열"
--   (조건/문장 완성 구조/예시 표현) as "스키마 보강 필요", but its 확정 계약 + 메모
--   accept the current jsonb problem-material contract ("현재는 JSON 기반 문제 자료
--   계약이다"; "52번 화면 데이터는 통합 writing 스키마로 충족된다").
--   description.md states NO concrete stable query/validation/render need for those
--   sub-structures (it only renders 지문/조건 카드/도움말 from the loaded problem).
--   → Treat them as jsonb-covered. stableQueryNeed=false. No new column invented.
--
-- ============================================================================
-- RECONCILIATION (high importance) — reconciledWithPriorSeed = TRUE
-- ----------------------------------------------------------------------------
-- A representative row for (domain='writing', question_no=52) ALREADY EXISTS in
-- supabase/seed.sql (the source-of-truth user-INDEPENDENT fixture, applied on
-- `supabase db reset`):
--
--   id            = 22222222-2222-2222-2222-222222222222
--   source        = 'curated'
--   domain        = 'writing'
--   question_no   = 52
--   topik_level   = 2
--   difficulty    = 3
--   title         = 'TOPIK 52번 — 설명문 빈칸 쓰기 (예시)'
--   tags          = ARRAY['audit_seed','writing','52']
--   publish_status= 'published'  review_status='approved'  visibility='public'
--
-- Per the RECONCILE rule we DO NOT add a parallel representative for the same
-- (domain, question_no). The 'wireframe_seed' insert below is therefore written
-- as a guarded, deterministic-id, ADDITIVE-ONLY statement keyed on provenance:
--   * It carries a DIFFERENT, deterministic primary id derived from provenance
--     (md5(source_file || ':' || json_id)::uuid) so it never collides with the
--     audit_seed fixture id.
--   * Its WHERE NOT EXISTS guard makes it a NO-OP whenever ANY row already
--     represents (writing, 52) — which the audit_seed fixture always does after
--     a normal reset. So on every periodic run it is a byte-identical no-op and
--     never creates a second 52번 representative.
--   * `on conflict (id) do nothing` keeps the provenance row immutable (house
--     convention) if it ever were inserted in a DB that lacks the audit_seed row.
--
-- Net effect with the existing fixture present: 0 rows inserted (no parallel
-- copy). The statement exists so that a clean DB *without* the audit_seed row
-- still converges to a valid 52번 representative carrying full wireframe
-- provenance — additive and idempotent either way.
-- ============================================================================

-- MEANING-FIRST mapping of sample-52.json a[0] → live `problems` columns
-- (every NOT NULL column of problems is supplied a CHECK-valid value):
--   source       := 'curated'                          (NOT NULL; matches fixtures)
--   domain       := 'writing'                           (NOT NULL; CHECK ok; from folder/question type)
--   question_no  := 52                                  (CHECK IN (51,52,53,54))
--   topik_level  := 2                                   (NOT NULL; CHECK IN (1,2); TOPIK II 52번)
--   difficulty   := 4                                   (meta.difficulty=4; CHECK 1..5 ok)
--   title        := derived human title from meta.domain + scenario_title
--   prompt       := JSON prompt_text  (the blanked 설명문 지문, ( ㄱ )/( ㄴ ))  → prompt
--   materials    := jsonb { narrative, context_notes, relation, scenario_logic,
--                           blank targets, chart_a/b roles, __seed provenance }  → materials
--   answer_key   := jsonb { model_answer, blank_target_giyeok, blank_target_nieun } → answer_key
--   rubric       := JSON rubric (content/structure/language)                    → rubric
--   tags         := ARRAY['wireframe_seed','wf:D-02','writing','52']
--   publish_status/review_status/visibility default to draft/pending/private,
--     but we set published/approved/public so the user RLS surface can read it
--     (mirrors the audit_seed fixture; same visibility contract).
--
-- NOT seeded here (out of scope, route to follow-up): writing_drafts /
--   writing_submissions are USER-DEPENDENT (need auth.uid()); they require a
--   separate service-role + Auth-Admin script and are intentionally omitted.
--
-- FROZEN island untouched: no organizations/org_members/assignments/admin_* and
--   no admin codes H-01/X-08/X-10/X-15.

insert into public.problems
  (id, source, domain, question_no, topik_level, difficulty,
   title, prompt, materials, answer_key, rubric, tags,
   publish_status, review_status, visibility)
select
  md5('docs/Wireframe/09-D-02-answer-writing-52/sample-52.json' || ':' ||
      '5c95afa6-2766-4db6-b4ea-860e917691a6')::uuid,
  'curated',
  'writing',
  52,
  2,
  4,
  'TOPIK 52번 — 설명문 빈칸 쓰기 (건강 / 수면의 질)',
  E'사람들은 보통 피곤할 때 잠을 오래 자면 피로가 풀릴 것이라고 생각한다. 그러나 수면 시간이 아무리 길어도 자는 동안 자주 깨면 피로가 완전히 풀리지 않는다. 왜냐하면 몸을 회복하는 데에는 수면 시간보다 수면의 질이 더 ( ㄱ ). 따라서 ( ㄴ ) 잠들기 전에 스마트폰 사용을 줄이고 매일 비슷한 시간에 잠자리에 드는 것이 좋다. 방을 어둡고 조용하게 유지하여 깊은 잠을 자는 환경을 만드는 것도 큰 도움이 된다.',
  jsonb_build_object(
    'narrative', jsonb_build_object(
      'summary_trend', '많은 사람은 피곤하면 잠만 오래 자면 된다고 생각한다.',
      'detail_feature', '그러나 잠자는 시간이 길어도 중간에 자주 깨면 몸은 충분히 회복되지 않는다.',
      'cause_sentence', '잠들기 전에는 스마트폰 화면을 줄이고 매일 비슷한 시간에 눕는 습관이 필요하다.',
      'problem_sentence', '방을 어둡고 조용하게 정리하면 잠이 드는 속도도 한결 안정된다.',
      'solution_sentence', '이렇게 수면의 흐름이 고르게 유지되면 다음 날 머리도 맑아진다.',
      'forecast_sentence', '결국 중요한 것은 수면 시간만이 아니라 깊게 쉬는 상태를 만드는 일이다.'
    ),
    'context_notes', jsonb_build_object(
      'display_label', '검수 기준',
      'row1_label', '핵심 주제', 'row1_value', '건강 / 수면의 질',
      'row2_label', '작업 상태', 'row2_value', '검수 메모 기준 빈칸 반영 지문',
      'status', '검수 메모 기준 문제형으로 변환되었다.'
    ),
    'relation', jsonb_build_object(
      'cause_label', '건강', 'effect_label', '수면의 질',
      'description', '빈칸을 뚫기 전의 완성된 52번형 설명문 원문이다.'
    ),
    'scenario_logic', jsonb_build_object(
      'scenario_title', '건강 / 수면의 질',
      'logic_chain', jsonb_build_array('현상','설명','원인','판단','실천','효과')
    ),
    'blank_count', 2,
    'blank_notation_policy', 'prompt_text_contains_( ? )_( ? )',
    '__seed', jsonb_build_object(
      'source_file', 'docs/Wireframe/09-D-02-answer-writing-52/sample-52.json',
      'source_id', '5c95afa6-2766-4db6-b4ea-860e917691a6'
    )
  ),
  jsonb_build_object(
    'model_answer', '사람들은 보통 피곤할 때 잠을 오래 자면 피로가 풀릴 것이라고 생각한다. 그러나 수면 시간이 아무리 길어도 자는 동안 자주 깨면 피로가 완전히 풀리지 않는다. 왜냐하면 몸을 회복하는 데에는 수면 시간보다 수면의 질이 더 중요하기 때문이다. 따라서 수면의 질을 높이려면 잠들기 전에 스마트폰 사용을 줄이고 매일 비슷한 시간에 잠자리에 드는 것이 좋다. 방을 어둡고 조용하게 유지하여 깊은 잠을 자는 환경을 만드는 것도 큰 도움이 된다.',
    'blank_target_giyeok', E'ㄱ: 검수 메모 기준 ''중요하기 때문이다'' 구간 전체를 빈칸으로 지정',
    'blank_target_nieun', E'ㄴ: 검수 메모 기준 ''수면의 질을 높이려면'' 구간 전체를 빈칸으로 지정'
  ),
  jsonb_build_object(
    'content', '완성 단락 자체가 설명문으로 자연스럽고 주제 흐름이 분명한가.',
    'structure', '현상, 설명, 원인, 판단, 실천, 효과가 무리 없이 이어지는가.',
    'language', '문어체 설명문에 맞는 표현을 사용하고 문장 연결이 매끄러운가.'
  ),
  ARRAY['wireframe_seed','wf:D-02','writing','52'],
  'published', 'approved', 'public'
where not exists (
  -- NO parallel representative: skip when (writing,52) already represented
  -- (the audit_seed fixture row 22222222-... satisfies this after every reset).
  select 1 from public.problems p
   where p.domain = 'writing' and p.question_no = 52
)
on conflict (id) do nothing;
