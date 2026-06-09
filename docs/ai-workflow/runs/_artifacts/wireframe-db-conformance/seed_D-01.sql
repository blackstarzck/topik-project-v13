-- ============================================================================
-- wireframe-db-conformance :: durable dev seed for screen D-01
-- (08-D-01-short-answer-writing-51, TOPIK writing question_no 51)
--
-- TARGET (mapped by MEANING against the LIVE schema): public.problems
-- SOURCE: docs/Wireframe/08-D-01-short-answer-writing-51/sample-51.json
--         (array of 90 items; representative = first valid item)
-- REPRESENTATIVE JSON item id: 'topik51-rule-0001'
--   (auto_checks_passed=true, review_passed=true → first valid)
--
-- PROVENANCE + IDEMPOTENCY
--   primary id = md5(source_file || ':' || <json item id>)::uuid
--             = e1c6dffb-066e-7ed5-5c09-f5136b7c6be6
--   materials.__seed = { source_file, source_id } + tags wireframe_seed, wf:D-01.
--   ON CONFLICT (id) DO NOTHING (immutable-provenance house convention) so an
--   unchanged-source re-run is a byte-identical no-op. NO reset/drop/truncate.
--
-- RECONCILE (CRITICAL — why this seed is GUARDED and inserts nothing today)
--   supabase/seed.sql already seeds a writing/51 representative with a FIXED UUID
--   (11111111-1111-1111-1111-111111111111), source 'curated', tag 'audit_seed',
--   publish_status 'published', review_status 'approved', visibility 'public'.
--   Live read on the dev DB (read-only COUNT) confirms exactly 1 such
--   audit_seed representative for (domain='writing', question_no=51) and 0
--   rows under our wireframe provenance id / 'wireframe_seed' marker.
--   Per the RECONCILE rule we DO NOT add a parallel copy. The DO block below
--   therefore inserts ONLY when no (writing,51) representative exists — i.e. it
--   is a deliberate no-op in the current dev DB. reconciledWithPriorSeed=true.
--
-- CONTRACT-NOT-LABEL
--   screen-data-summary.md L40 LABELS the 51 blank/hint structure "스키마 보강
--   필요" but its 확정 계약 + 메모 accept problems.materials/answer_key/rubric
--   jsonb. description.md states only render/layout needs (no stable per-blank
--   query/validation). So blank_1/blank_2/meta/source_context/validation fold
--   into materials/answer_key/rubric jsonb — NO typed blank columns invented.
--
-- SCOPE: touches only the user-facing public.problems table. No admin
--   (H-01/X-08/X-10/X-15) or frozen objects. No user-state rows (drafts/
--   submissions are runtime, seeded separately via a service-role + Auth-Admin
--   script — surfaced as a follow-up, NOT attempted here).
--
-- canDML=false (checkOnly) → NOT APPLIED this run. Artifact written only.
-- ============================================================================

do $seed_d01$
declare
  v_id          uuid := 'e1c6dffb-066e-7ed5-5c09-f5136b7c6be6';  -- md5(source_file||':'||item.id)::uuid
  v_exists      boolean;
begin
  -- RECONCILE guard: skip if ANY representative already exists for (writing,51)
  -- (either the seed.sql 'audit_seed' fixture or a prior 'wireframe_seed' run).
  select exists(
    select 1 from public.problems
    where domain = 'writing' and question_no = 51
  ) into v_exists;

  if v_exists then
    raise notice 'D-01 seed: representative for (writing,51) already present — reconciled, no parallel copy inserted.';
  else
    insert into public.problems (
      id,                 -- deterministic provenance id (REQUIRED; never array index)
      source,             -- NOT NULL; 'curated' to match existing audit_seed fixtures
      domain,             -- NOT NULL; CHECK reading/listening/writing
      question_no,        -- CHECK 51/52/53/54; meta.exam_number = 51
      topik_level,        -- NOT NULL; CHECK 1/2 (sample difficulty_target 'TOPIK 3급' → level 2 = TOPIK II)
      difficulty,         -- CHECK 1..5 or null; sample 'TOPIK 3급' has no 1..5 mapping → null
      title,              -- NOT NULL; derived human title (no seed-usable default)
      prompt,             -- NOT NULL; <- prompt_text
      materials,          -- jsonb; <- meta + source_context + blank_1/blank_2 + __seed provenance
      answer_key,         -- jsonb; <- answer_key + model_answer
      rubric,             -- jsonb; <- validation + review_memo + blank_target_* + blank meta
      tags,               -- NOT NULL default {}; wireframe_seed markers + taxonomy
      publish_status,     -- NOT NULL; CHECK draft/published/archived
      review_status,      -- NOT NULL; CHECK pending/approved/rejected (auto+review passed → approved)
      visibility          -- NOT NULL; CHECK private/public/org
    )
    values (
      v_id,
      'curated',
      'writing',
      51,
      2,
      null,
      'TOPIK 51번 — 기숙사 방 변경 문의 (공개 문의형, 와이어프레임 시드)',
      E'<게시판>\n제목: 기숙사 방 변경 문의\n\n안녕하세요?\n저는 현재 기숙사를 이용하고 있는 외국인 유학생입니다.\n지금 사용하고 있는 방은 도로와 가까워서 너무 시끄럽습니다.\n특히 밤에는 자동차 소리 때문에 잠을 ( ㄱ ).\n그래서 조용한 방으로 바꾸고 싶은데, 어떻게 해야 합니까?\n방법을 ( ㄴ ) 감사하겠습니다.',
      jsonb_build_object(
        '__seed', jsonb_build_object(
          'source_file', 'docs/Wireframe/08-D-01-short-answer-writing-51/sample-51.json',
          'source_id',   'topik51-rule-0001'
        ),
        'meta', jsonb_build_object(
          'exam_number', 51,
          'difficulty_target', 'TOPIK 3급',
          'category', 'public_inquiry',
          'text_type', '문의형 게시글',
          'scenario_type', '기숙사 방 변경',
          'speech_act', '문의',
          'blank_count', 2,
          'text_state', 'blank_inserted_in_prompt_text',
          'blank_notation_policy', 'prompt_text_contains_( ㄱ )_( ㄴ )'
        ),
        'source_context', jsonb_build_object(
          'situation_summary', '도로 쪽 소음으로 공부에 방해를 받아 기숙사 방 변경 방법과 필요 서류를 게시판에 문의하는 글이다.',
          'resolved_text', E'안녕하세요?\n저는 현재 기숙사를 이용하고 있는 외국인 유학생입니다.\n지금 사용하고 있는 방은 도로와 가까워서 너무 시끄럽습니다.\n특히 밤에는 자동차 소리 때문에 잠을 잘 수 없습니다.\n그래서 조용한 방으로 바꾸고 싶은데, 어떻게 해야 합니까?\n방법을 알려 주시면 감사하겠습니다.'
        ),
        'blanks', jsonb_build_array(
          jsonb_build_object('position','ㄱ','role','문맥 세팅','function','이해 부족 진술','answer_type','종결 표현','canonical_answer','잘 수 없습니다','why_this_is_correct','검수자가 지정한 문장 맥락에 자연스럽게 들어가는 표현이다.'),
          jsonb_build_object('position','ㄴ','role','종결 화행','function','안내 요청','answer_type','종결 표현','canonical_answer','알려 주시면','why_this_is_correct','검수자가 지정한 요청·안내 표현으로 문장을 자연스럽게 완성한다.')
        )
      ),
      jsonb_build_object(
        'ㄱ', jsonb_build_array('잘 수 없습니다','잘 수가 없습니다','잘 못 잡니다'),
        'ㄴ', jsonb_build_array('알려 주시면','안내해 주시면','가르쳐 주시면'),
        'model_answer', E'ㄱ: 잘 수 없습니다 / 잘 수가 없습니다 / 잘 못 잡니다\nㄴ: 알려 주시면 / 안내해 주시면 / 가르쳐 주시면'
      ),
      jsonb_build_object(
        'validation', jsonb_build_object(
          'register_passed', true,
          'slot_role_passed', true,
          'topik3_passed', true,
          'blank_markers_removed', false,
          'parentheses_absent_in_prompt_text', false
        ),
        'review_memo', E'1. [내용 수정] 제목: 기숙사 방 변경 문의 …\n2. [빈칸 지정] ㄱ: ''잘 수 없습니다'' / ㄴ: ''알려 주시면''',
        'blank_target_giyeok', 'ㄱ: 7행에서 ''잘 수 없습니다'' 구간 전체를 빈칸으로 지정',
        'blank_target_nieun', 'ㄴ: 9행에서 ''알려 주시면'' 구간 전체를 빈칸으로 지정'
      ),
      array['wireframe_seed','wf:D-01','writing','51','public_inquiry']::text[],
      'published',
      'approved',
      'public'
    )
    on conflict (id) do nothing;  -- immutable-provenance: unchanged re-run = no-op

    raise notice 'D-01 seed: inserted wireframe_seed representative % (writing,51).', v_id;
  end if;
end
$seed_d01$;
