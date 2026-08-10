-- Additive skill definitions for grade2 patterns.
begin;
create temporary table grade2_patterns_expected_skills (skill_code text primary key, subject_code text not null, display_name text not null, description text not null) on commit drop;
insert into grade2_patterns_expected_skills values
  ('identify-number-pattern','math','수 규칙 찾기','나열된 수 사이의 일정한 변화를 찾아 규칙을 알아냅니다.'),
  ('continue-increasing-pattern','math','커지는 규칙 이어 쓰기','일정한 수만큼 커지는 규칙에 따라 다음 수를 구합니다.'),
  ('continue-decreasing-pattern','math','작아지는 규칙 이어 쓰기','일정한 수만큼 작아지는 규칙에 따라 다음 수를 구합니다.'),
  ('identify-repeating-cycle','math','반복 규칙 찾기','문자나 기호가 반복되는 주기를 찾아 다음 항목과 특정 위치를 구합니다.'),
  ('infer-missing-pattern-item','math','규칙의 빈칸 찾기','수나 기호의 규칙을 이용하여 빠진 항목을 찾습니다.'),
  ('explain-pattern-rule','math','규칙 설명하기','수와 기호가 변하거나 반복되는 방법을 말로 설명합니다.'),
  ('extend-two-step-pattern','math','두 단계 규칙 이어 쓰기','두 가지 변화가 번갈아 나타나는 규칙을 찾아 이어 씁니다.'),
  ('correct-pattern-reasoning','math','잘못된 규칙 바로잡기','규칙에 맞지 않는 항목이나 설명을 찾아 바르게 고칩니다.');
do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null or to_regclass('public.learning_question_skills') is null then raise exception using errcode='P0001',message='learning skill metadata foundation is missing'; end if;
  if (select count(*) from grade2_patterns_expected_skills)<>8 then raise exception using errcode='P0001',message='grade2 patterns skill source is incomplete'; end if;
  if exists(select 1 from grade2_patterns_expected_skills expected join public.learning_skill_definitions actual using(skill_code) where actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null) then raise exception using errcode='23505',message='grade2 patterns skill definition conflicts with reviewed source'; end if;
end
$preflight$;
insert into public.learning_skill_definitions(skill_code,subject_code,display_name,description,curriculum_code)
select skill_code,subject_code,display_name,description,null from grade2_patterns_expected_skills on conflict(skill_code) do nothing;
commit;
