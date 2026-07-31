-- down: 20260724120000_user_data_reference_integrity 롤백.
--
-- review_set 검증 트리거/함수를 제거하고, 3개 학습자 테이블의 authenticated
-- UPDATE 를 컬럼 단위에서 직전의 테이블 단위로 되돌린다.
--
-- 의도적 비복원 3건:
--   * RLS enable / force 는 만지지 않는다. 세 테이블 모두 20260520121100
--     부터 이미 enable + force 상태였고 forward 의 해당 구문은 재천명이었다.
--   * service_role 의 명시적 DML grant 는 Supabase 기본 default privileges 와
--     동치이므로 회수하지 않는다(제거해도 기본 권한으로 동작이 같다).
--   * public / anon 의 UPDATE 는 default-privilege drift 였고 forward 가 이를
--     정리했다. RLS(forced) 때문에 앱 동작 차이가 없으므로 재부여하지 않는다.

begin;

drop trigger if exists trg_validate_review_set_study_event
  on public.study_events;
drop function if exists private.validate_review_set_study_event();

revoke update (tags) on table public.library_items from authenticated;
revoke update (status) on table public.recommendation_items from authenticated;
revoke update (storage_path, status, ready_at)
  on table public.export_files from authenticated;

grant update on table public.library_items to authenticated;
grant update on table public.recommendation_items to authenticated;
grant update on table public.export_files to authenticated;

commit;
