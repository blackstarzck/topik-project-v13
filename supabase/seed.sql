-- Domain row seed (user-INDEPENDENT only) for the Implementation Coverage Audit
-- (Plan rev4, 2026-05-23) and for general local development.
--
-- This file is auto-applied by `supabase db reset`. Therefore it must contain
-- only SQL that does NOT depend on auth user UUIDs.
--
-- User-dependent seed (learning_goals, writing_submissions, library_items,
-- recommendation_runs/items, study_events, admin_audit_logs) is created
-- separately AFTER auth users are created via the Supabase Auth Admin API.
--
-- All rows carry an 'audit_seed' tag in their tags array or payload so Task 7
-- cleanup can scope deletion.

-- Five sample problems (writing 51-54 + one reading) — fixed UUIDs for
-- cross-reference from the Node seed script.
insert into public.problems (id, source, domain, question_no, topik_level, difficulty, title, prompt, materials, tags, publish_status, review_status, visibility)
values
  ('11111111-1111-1111-1111-111111111111', 'curated', 'writing', 51, 2, 2,
   'TOPIK 51번 — 안내문 빈칸 쓰기 (예시)',
   E'다음 글의 (㉠)과 (㉡)에 들어갈 알맞은 표현을 쓰십시오.\n\n안녕하십니까. 다음 주 토요일에 한국 문화 체험 행사가 있습니다. 참가하고 싶으신 분은 (㉠). 자세한 사항은 (㉡).',
   null,
   ARRAY['audit_seed','writing','51'], 'published', 'approved', 'public'),
  ('22222222-2222-2222-2222-222222222222', 'curated', 'writing', 52, 2, 3,
   'TOPIK 52번 — 설명문 빈칸 쓰기 (예시)',
   E'다음 글의 (㉠)과 (㉡)에 들어갈 알맞은 표현을 쓰십시오.\n\n사람들은 행복을 위해 노력한다. 행복은 사람마다 다르지만 (㉠). 반대로 (㉡).',
   null,
   ARRAY['audit_seed','writing','52'], 'published', 'approved', 'public'),
  ('33333333-3333-3333-3333-333333333333', 'curated', 'writing', 53, 2, 4,
   'TOPIK 53번 — 도표 분석 (예시)',
   '다음을 참고하여 ''스마트폰 사용 시간 변화''에 대한 글을 200~300자로 쓰십시오.',
   -- Phase 7-C P1-4: 53번 materials chart 시드. UI는 MaterialsPanel에서 placeholder로
   -- 렌더 (실 차트 라이브러리 통합은 Tier 2). 본 시드는 LongFormEditor의 materials
   -- prop 경로가 실제 데이터로 작동하는지 보장.
   '{"chart": {"type": "bar", "data": [{"year": 2018, "hours": 2.1}, {"year": 2020, "hours": 3.4}, {"year": 2022, "hours": 4.2}, {"year": 2024, "hours": 4.8}], "options": {"y_axis": "일평균 사용 시간 (시간)", "x_axis": "연도"}}}'::jsonb,
   ARRAY['audit_seed','writing','53'], 'published', 'approved', 'public'),
  ('44444444-4444-4444-4444-444444444444', 'curated', 'writing', 54, 2, 5,
   'TOPIK 54번 — 주제 글쓰기 (예시)',
   E'다음을 주제로 자신의 생각을 600~700자로 쓰십시오.\n\n주제: 현대 사회에서 협력의 중요성',
   null,
   ARRAY['audit_seed','writing','54'], 'published', 'approved', 'public'),
  ('55555555-5555-5555-5555-555555555555', 'curated', 'reading', null, 2, 2,
   'TOPIK 읽기 (예시 지문)',
   E'다음 글을 읽고 물음에 답하십시오.\n\n한국의 사계절은 뚜렷한 변화를 보인다. 봄에는 ...',
   null,
   ARRAY['audit_seed','reading'], 'published', 'approved', 'public')
on conflict (id) do nothing;
