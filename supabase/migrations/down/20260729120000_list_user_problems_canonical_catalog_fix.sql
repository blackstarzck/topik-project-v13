-- down: 20260729120000_list_user_problems_canonical_catalog_fix — 문서화된 no-op.
--
-- 이 파일 단독의 "정확한 역"은 20260722120000 이 설치한 list_user_problems
-- 정의로 되돌리는 것이지만, 그 정의는 20260714140000 이 drop 한 private
-- helper 2개(is_writing_canonical_read_enabled / is_canonical_writing_problem_anchor)
-- 를 참조해 모든 호출이 42883 이 되는 결함본이다(topik-ai manifest B4 참조).
-- 두 파일은 단일 트랜잭션 배치(B4)로만 적용되므로 "20260722120000 만 적용된
-- 상태"는 라이브에 존재하지 않고, 결함본을 복원하는 down 은 운영 사고
-- 장치가 될 뿐이라 만들지 않는다.
--
-- B4 배치 롤백 절차: 이 파일(no-op) 실행 후 같은 트랜잭션에서
-- down/20260722120000_writing_completion_and_pdf_outcomes.sql 을 실행한다.
-- 그 파일이 배치 적용 직전 라이브 상태(20260713083000 본문 + 20260714140000
-- 이 확립한 post-cutover catalog CTE, KPI 정의, export_files 컬럼/제약)를
-- 한 번에 복원한다.

do $$
begin
  raise notice 'down/20260729120000: no-op — B4 배치 롤백은 down/20260722120000 이 수행한다.';
end
$$;
