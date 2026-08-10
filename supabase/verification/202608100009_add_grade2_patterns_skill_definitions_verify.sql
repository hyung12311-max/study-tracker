begin transaction read only;
with expected(skill_code,subject_code,display_name,description) as (values
  ('identify-number-pattern','math','수 규칙 찾기','나열된 수 사이의 일정한 변화를 찾아 규칙을 알아냅니다.'),
  ('continue-increasing-pattern','math','커지는 규칙 이어 쓰기','일정한 수만큼 커지는 규칙에 따라 다음 수를 구합니다.'),
  ('continue-decreasing-pattern','math','작아지는 규칙 이어 쓰기','일정한 수만큼 작아지는 규칙에 따라 다음 수를 구합니다.'),
  ('identify-repeating-cycle','math','반복 규칙 찾기','문자나 기호가 반복되는 주기를 찾아 다음 항목과 특정 위치를 구합니다.'),
  ('infer-missing-pattern-item','math','규칙의 빈칸 찾기','수나 기호의 규칙을 이용하여 빠진 항목을 찾습니다.'),
  ('explain-pattern-rule','math','규칙 설명하기','수와 기호가 변하거나 반복되는 방법을 말로 설명합니다.'),
  ('extend-two-step-pattern','math','두 단계 규칙 이어 쓰기','두 가지 변화가 번갈아 나타나는 규칙을 찾아 이어 씁니다.'),
  ('correct-pattern-reasoning','math','잘못된 규칙 바로잡기','규칙에 맞지 않는 항목이나 설명을 찾아 바르게 고칩니다.')
), reused(skill_code,display_name,description) as (select null::text,null::text,null::text where false),
checks(check_order,check_name,passed) as (values
  (1,'grade2 patterns definitions exact',(select count(*) from expected)=8 and not exists(select 1 from expected left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null)),
  (2,'grade2 patterns reused definitions exact',(select count(*) from reused)=0 and not exists(select 1 from reused left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>'math' or actual.display_name<>reused.display_name or actual.description is distinct from reused.description)),
  (3,'grade2 patterns skill codes valid',not exists(select 1 from expected where skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')),
  (4,'skill definitions remain force rls',(select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.learning_skill_definitions'::regclass)),
  (5,'browser roles remain blocked',not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
  (6,'service role remains read only',has_table_privilege('service_role','public.learning_skill_definitions','SELECT') and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
  (7,'skill definitions remain outside realtime',not exists(select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename='learning_skill_definitions')))
select check_order,check_name,passed,jsonb_build_object('summary',false) result_data from checks
union all select 999,'grade2 patterns skill verification summary',bool_and(passed),jsonb_build_object('summary',true,'total_checks',count(*),'passed_checks',count(*) filter(where passed),'failed_checks',count(*) filter(where not passed)) from checks order by check_order;
rollback;
