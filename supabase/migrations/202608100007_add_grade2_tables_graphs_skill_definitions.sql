-- Additive skill definitions for grade2 tables graphs.
begin;
create temporary table grade2_tables_graphs_expected_skills (skill_code text primary key, subject_code text not null, display_name text not null, description text not null) on commit drop;
insert into grade2_tables_graphs_expected_skills values
  ('read-data-table','math','자료 표 읽기','표의 항목과 수를 연결하여 필요한 자료를 정확하게 읽습니다.'),
  ('complete-data-table','math','자료 표 완성하기','원자료와 합계를 확인하여 표의 빠진 항목이나 수를 채웁니다.'),
  ('compare-category-counts','math','항목 수 비교하기','표나 그래프의 여러 항목 수를 비교합니다.'),
  ('find-most-least-category','math','가장 많은·적은 항목 찾기','자료 수를 비교하여 가장 많은 항목과 가장 적은 항목을 찾습니다.'),
  ('calculate-data-difference','math','자료 수의 차 구하기','두 항목의 수를 비교하여 차이를 구합니다.'),
  ('infer-missing-data','math','빠진 자료 수 찾기','전체와 알려진 항목 수를 이용하여 빠진 자료 수를 구합니다.'),
  ('read-text-graph','math','텍스트 그래프 읽기','기호로 나타낸 그래프에서 항목별 수와 전체를 읽습니다.'),
  ('connect-table-and-graph','math','표와 그래프 연결하기','표의 수와 그래프의 기호 수가 서로 맞는지 확인합니다.'),
  ('correct-data-interpretation','math','자료 해석 바로잡기','표와 그래프의 합계·비교·차이 해석 오류를 찾아 고칩니다.');
do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null or to_regclass('public.learning_question_skills') is null then raise exception using errcode='P0001',message='learning skill metadata foundation is missing'; end if;
  if (select count(*) from grade2_tables_graphs_expected_skills)<>9 then raise exception using errcode='P0001',message='grade2 tables graphs skill source is incomplete'; end if;
  if exists(select 1 from grade2_tables_graphs_expected_skills expected join public.learning_skill_definitions actual using(skill_code) where actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null) then raise exception using errcode='23505',message='grade2 tables graphs skill definition conflicts with reviewed source'; end if;
end
$preflight$;
insert into public.learning_skill_definitions(skill_code,subject_code,display_name,description,curriculum_code)
select skill_code,subject_code,display_name,description,null from grade2_tables_graphs_expected_skills on conflict(skill_code) do nothing;
commit;
