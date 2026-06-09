-- =====================================================================
-- Wireframe→DB conformance durable dev seed  ·  D-04 (question_no 54)
-- Screen: 54번 에세이 작성 (essay writing)   ·  route /writing/essay-writing-54
-- Artifact-only (parallel fan-out). DO NOT edit shared files from here.
-- canDML = false (writePath=dml-only, checkOnly=true): this SQL is NOT
-- applied by this run. It is the durable, idempotent recipe a later apply
-- pass (or `supabase db reset` pickup) can run safely & repeatably.
--
-- SOURCE PRIORITY honored: description.md > functional-spec.md >
--   screen-data-summary.md > hifi/wireframe.png > sample JSON.
-- Mapping done by DOCUMENT MEANING first, key name second.
--
-- PROVENANCE (immutable):
--   source_file = docs/Wireframe/11-D-04-essay-writing-54/sample-54.json
--   source_id   = topik54-154-b01-01   (the JSON item's own stable `id`;
--                 NEVER an array index. All 154 ids unique. First valid item.)
--   primary id  = md5(source_file || ':' || source_id)::uuid
--               = 172e64c9-3681-3c67-b72e-9b77884d68f6
--   tags        += 'wireframe_seed', 'wf:D-04'
--   materials.__seed = { source_file, source_id }
--
-- IDEMPOTENCY: additive only. on conflict (id) do nothing (house convention
--   for immutable provenance rows) + a NOT EXISTS reconciliation guard.
--   No drop / reset / truncate. Unchanged source re-run = byte-identical no-op.
--
-- RECONCILIATION (reconciledWithPriorSeed = TRUE):
--   supabase/seed.sql ALREADY seeds a representative (domain='writing',
--   question_no=54) row with FIXED UUID 44444444-4444-4444-4444-444444444444,
--   source='curated', tag 'audit_seed'. Per the RECONCILE rule we must NOT add
--   a parallel copy of the same (domain, question_no) representative. The
--   guarded INSERT below therefore inserts ONLY when NO writing/54
--   representative (audit_seed OR wireframe_seed) yet exists — i.e. it is a
--   deliberate NO-OP against the current local stack. The block is kept so the
--   provenance recipe is durable if the audit_seed fixture is ever absent.
--
-- LIMIT: 1 representative item (the screen shows one representative example,
--   not the full 154-item bank). itemsAvailable=154, rowsPlanned=1.
--
-- NOT NULL coverage of public.problems (every NOT NULL col gets a CHECK-valid
-- value): source('curated'), domain('writing'), topik_level(2), title, prompt,
-- tags(default+wireframe tags), publish_status('published'), review_status
-- ('pending' — derived: sample review_passed=false), visibility('public').
-- (id/created_at/updated_at use defaults; question_no=54 is CHECK-valid;
--  difficulty=5 clamped into CHECK 1..5.)
--
-- FROZEN ISLAND: no admin codes (H-01/X-08/X-10/X-15), no admin/org objects
-- touched. Only the user-facing problems table.
-- =====================================================================

insert into public.problems (
  id, source, domain, question_no, topik_level, difficulty,
  title, prompt, materials, answer_key, rubric, explanation,
  tags, publish_status, review_status, visibility
)
select
  md5('docs/Wireframe/11-D-04-essay-writing-54/sample-54.json' || ':' || 'topik54-154-b01-01')::uuid,
  'curated',                       -- source  (match existing fixtures; CHECK source IN ('ai_generated','curated'))
  'writing',                       -- domain  (DERIVED from folder/question type, NOT from meta.domain '기술'; CHECK domain IN ('reading','listening','writing'))
  54::smallint,                    -- question_no (CHECK IN (51,52,53,54))
  2::smallint,                     -- topik_level (54 = TOPIK II; CHECK IN (1,2))
  5::smallint,                     -- difficulty  (meta.difficulty=5, in CHECK 1..5; out-of-range would clamp to null)
  'TOPIK 54번 — 디지털 시민성 (에세이)',  -- title (DERIVED from topic_seed_title '디지털 시민성'; NOT NULL)
  -- prompt = sample prompt_text (full essay task instruction + 3 sub-tasks). NOT NULL.
  E'다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오. 단, 문제를 그대로 옮겨 쓰지 마시오. (50점)\n\n'
  || E'디지털 시민성은 온라인 공간에서 다른 사람의 권리와 규칙을 존중하면서 책임 있게 참여하는 태도를 의미한다.\n\n'
  || E'최근 많은 사람이 일상적으로 인터넷을 사용하면서 디지털 시민성의 중요성이 커지고 있다. 온라인 공간은 편리한 소통과 정보 공유를 가능하게 하지만, 책임 없는 행동이 반복되면 갈등과 불신도 빠르게 커질 수 있다.\n\n'
  || E'아래의 내용을 중심으로 ''디지털 시민성의 역할과 실천''에 대한 자신의 생각을 쓰라.\n'
  || E'1) 디지털 시민성은 온라인 공동체에서 어떤 역할을 하는가?\n'
  || E'2) 익명성이 강한 환경에서는 어떤 갈등이나 문제가 커질 수 있는가?\n'
  || E'3) 책임 있는 온라인 참여가 생활 속에서 이루어지려면 어떤 기준이 필요하다고 생각하는가?',
  -- materials (jsonb): question-shaping metadata (meta.*) + immutable __seed provenance.
  --   meta.domain '기술' is a TOPIC domain, NOT the schema skill-domain; it rides here, not in problems.domain.
  jsonb_build_object(
    'meta', jsonb_build_object(
      'topic_domain', '기술',
      'topic_type', 'role_conflict_standard',
      'question_type', 'role_conflict_standard',
      'inference_gap', true
    ),
    '__seed', jsonb_build_object(
      'source_file', 'docs/Wireframe/11-D-04-essay-writing-54/sample-54.json',
      'source_id', 'topik54-154-b01-01'
    )
  ),
  -- answer_key (jsonb): model_answer mapped by MEANING (answer reference), not by key name.
  jsonb_build_object(
    'model_answer',
    E'디지털 시민성은 온라인 공간에서 다른 사람과 함께 살아가기 위한 기본 태도이다. 인터넷에서는 누구나 쉽게 의견을 올리고 정보를 나눌 수 있지만, 그만큼 말과 행동의 영향도 빠르게 커진다. 따라서 디지털 시민성이 높으면 서로 다른 생각을 가진 사람도 규칙 안에서 토론할 수 있고, 거짓 정보나 무례한 표현이 퍼지는 속도도 줄일 수 있다. 반대로 익명성에 기대어 책임 없는 말을 하거나 출처를 확인하지 않은 내용을 반복하면 갈등이 커지고 공동체의 신뢰가 약해진다.'
  ),
  -- rubric (jsonb): homogeneous {content, structure, language}. Maps by meaning + name.
  jsonb_build_object(
    'content',   '주어진 세 가지 과제를 모두 수행하고, 주제와 직접 관련된 내용을 풍부하고 구체적으로 전개하였는가.',
    'structure', '도입-전개-마무리의 흐름이 분명하고, 단락 구성과 담화 표지가 논리 전개에 효과적으로 기여하는가.',
    'language',  '격식체를 유지하면서 문법, 어휘, 맞춤법을 다양하고 정확하게 사용하였는가.'
  ),
  null,                            -- explanation (NULLable; not present in sample)
  ARRAY['wireframe_seed','wf:D-04','writing','54'],  -- tags (NOT NULL; wireframe provenance tags)
  'published',                     -- publish_status (CHECK IN ('draft','published','archived'))
  'pending',                       -- review_status DERIVED: sample review_passed=false → 'pending' (CHECK IN ('pending','approved','rejected'))
  'public'                         -- visibility (CHECK IN ('private','public','org'))
where not exists (
  -- RECONCILIATION GUARD: skip if a representative for (writing, 54) already
  -- exists (audit_seed from supabase/seed.sql, or a prior wireframe_seed).
  select 1
  from public.problems p
  where p.domain = 'writing'
    and p.question_no = 54
    and (p.tags && ARRAY['audit_seed','wireframe_seed'])
)
on conflict (id) do nothing;   -- immutable provenance row: re-run = no-op

-- Verify-count (read-only; for an apply pass to confirm marker presence):
--   select count(*) from public.problems
--   where domain='writing' and question_no=54 and tags && ARRAY['wireframe_seed'];
--
-- USER-DEPENDENT rows (writing_drafts / writing_submissions / writing_feedback
-- / study_events) are NOT seeded here — they require auth user UUIDs via a
-- separate service-role + Auth-Admin script. FOLLOW-UP, not attempted here.
