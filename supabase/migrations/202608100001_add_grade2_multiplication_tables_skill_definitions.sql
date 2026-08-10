-- Additive skill definitions for Grade 2 multiplication tables content.
begin;
create temporary table grade2_multiplication_tables_expected_skills (skill_code text primary key, subject_code text not null, display_name text not null, description text not null) on commit drop;
insert into grade2_multiplication_tables_expected_skills values
  ('multiply-by-2','math','2단 계산하기','2를 한 묶음의 수로 하는 곱셈구구의 값을 정확하게 구합니다.'),
  ('multiply-by-3','math','3단 계산하기','3을 한 묶음의 수로 하는 곱셈구구의 값을 정확하게 구합니다.'),
  ('multiply-by-4','math','4단 계산하기','4를 한 묶음의 수로 하는 곱셈구구의 값을 정확하게 구합니다.'),
  ('multiply-by-5','math','5단 계산하기','5를 한 묶음의 수로 하는 곱셈구구의 값을 정확하게 구합니다.'),
  ('multiply-by-6','math','6단 계산하기','6을 한 묶음의 수로 하는 곱셈구구의 값을 정확하게 구합니다.'),
  ('multiply-by-7','math','7단 계산하기','7을 한 묶음의 수로 하는 곱셈구구의 값을 정확하게 구합니다.'),
  ('multiply-by-8','math','8단 계산하기','8을 한 묶음의 수로 하는 곱셈구구의 값을 정확하게 구합니다.'),
  ('multiply-by-9','math','9단 계산하기','9를 한 묶음의 수로 하는 곱셈구구의 값을 정확하게 구합니다.'),
  ('identify-multiplication-table-pattern','math','곱셈구구 규칙 찾기','같은 단에서 묶음 수가 하나 늘 때 곱이 한 묶음의 수만큼 커지는 규칙을 찾습니다.'),
  ('infer-missing-multiplication-factor','math','곱셈식의 빈칸 찾기','곱과 한 인수를 이용하여 곱셈식의 빈칸에 알맞은 인수를 찾습니다.'),
  ('compare-multiplication-products','math','곱셈 결과 비교하기','각 곱셈식의 값을 정확히 계산하여 곱의 크기를 비교합니다.'),
  ('reason-about-multiplication-facts','math','곱셈구구로 추론하기','곱셈구구의 계산과 규칙을 이용하여 같은 곱이나 잘못된 결과를 판단하고 이유를 설명합니다.');
do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null or to_regclass('public.learning_question_skills') is null then raise exception using errcode='P0001',message='learning skill metadata foundation is missing'; end if;
  if (select count(*) from grade2_multiplication_tables_expected_skills)<>12 then raise exception using errcode='P0001',message='grade2 multiplication tables skill source is incomplete'; end if;
  if exists(select 1 from grade2_multiplication_tables_expected_skills expected join public.learning_skill_definitions actual using(skill_code) where actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null) then raise exception using errcode='23505',message='grade2 multiplication tables skill definition conflicts with reviewed source'; end if;
end
$preflight$;
insert into public.learning_skill_definitions(skill_code,subject_code,display_name,description,curriculum_code)
select skill_code,subject_code,display_name,description,null from grade2_multiplication_tables_expected_skills on conflict(skill_code) do nothing;
commit;
