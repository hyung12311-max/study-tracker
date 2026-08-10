-- Additive skill definitions for grade2 length calculation.
begin;
create temporary table grade2_length_calculation_expected_skills (skill_code text primary key, subject_code text not null, display_name text not null, description text not null) on commit drop;
insert into grade2_length_calculation_expected_skills values
  ('calculate-length-addition','math','길이 덧셈하기','같은 단위의 두 길이를 더하여 전체 길이를 구합니다.'),
  ('calculate-length-subtraction','math','길이 뺄셈하기','같은 단위의 길이를 빼서 남은 길이를 구합니다.'),
  ('solve-total-length','math','전체 길이 구하기','이어진 두 길이나 생활 상황의 전체 길이를 덧셈으로 구합니다.'),
  ('solve-remaining-length','math','남은 길이 구하기','전체 길이에서 사용한 길이를 빼서 남은 길이를 구합니다.'),
  ('compare-length-difference','math','두 길이의 차 구하기','긴 길이에서 짧은 길이를 빼서 두 길이의 차를 구합니다.'),
  ('infer-missing-length','math','빈칸 길이 찾기','길이의 덧셈과 뺄셈 관계를 이용하여 모르는 길이를 찾습니다.'),
  ('use-meter-centimeter-relation','math','m와 cm 관계 사용하기','1m가 100cm임을 이용하여 기본적인 길이 관계를 이해합니다.'),
  ('correct-length-calculation-reasoning','math','길이 계산 바로잡기','계산 방법이나 단위 사용의 오류를 찾아 알맞은 식과 결과로 고칩니다.');
do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null or to_regclass('public.learning_question_skills') is null then raise exception using errcode='P0001',message='learning skill metadata foundation is missing'; end if;
  if (select count(*) from grade2_length_calculation_expected_skills)<>8 then raise exception using errcode='P0001',message='grade2 length calculation skill source is incomplete'; end if;
  if exists(select 1 from grade2_length_calculation_expected_skills expected join public.learning_skill_definitions actual using(skill_code) where actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null) then raise exception using errcode='23505',message='grade2 length calculation skill definition conflicts with reviewed source'; end if;
end
$preflight$;
insert into public.learning_skill_definitions(skill_code,subject_code,display_name,description,curriculum_code)
select skill_code,subject_code,display_name,description,null from grade2_length_calculation_expected_skills on conflict(skill_code) do nothing;
commit;
