begin transaction read only;
with expected(skill_code,subject_code,display_name,description) as (values
  ('calculate-length-addition','math','길이 덧셈하기','같은 단위의 두 길이를 더하여 전체 길이를 구합니다.'),
  ('calculate-length-subtraction','math','길이 뺄셈하기','같은 단위의 길이를 빼서 남은 길이를 구합니다.'),
  ('solve-total-length','math','전체 길이 구하기','이어진 두 길이나 생활 상황의 전체 길이를 덧셈으로 구합니다.'),
  ('solve-remaining-length','math','남은 길이 구하기','전체 길이에서 사용한 길이를 빼서 남은 길이를 구합니다.'),
  ('compare-length-difference','math','두 길이의 차 구하기','긴 길이에서 짧은 길이를 빼서 두 길이의 차를 구합니다.'),
  ('infer-missing-length','math','빈칸 길이 찾기','길이의 덧셈과 뺄셈 관계를 이용하여 모르는 길이를 찾습니다.'),
  ('use-meter-centimeter-relation','math','m와 cm 관계 사용하기','1m가 100cm임을 이용하여 기본적인 길이 관계를 이해합니다.'),
  ('correct-length-calculation-reasoning','math','길이 계산 바로잡기','계산 방법이나 단위 사용의 오류를 찾아 알맞은 식과 결과로 고칩니다.')
), reused(skill_code,display_name,description) as (select null::text,null::text,null::text where false),
checks(check_order,check_name,passed) as (values
  (1,'grade2 length calculation definitions exact',(select count(*) from expected)=8 and not exists(select 1 from expected left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null)),
  (2,'grade2 length calculation reused definitions exact',(select count(*) from reused)=0 and not exists(select 1 from reused left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>'math' or actual.display_name<>reused.display_name or actual.description is distinct from reused.description)),
  (3,'grade2 length calculation skill codes valid',not exists(select 1 from expected where skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')),
  (4,'skill definitions remain force rls',(select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.learning_skill_definitions'::regclass)),
  (5,'browser roles remain blocked',not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
  (6,'service role remains read only',has_table_privilege('service_role','public.learning_skill_definitions','SELECT') and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
  (7,'skill definitions remain outside realtime',not exists(select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename='learning_skill_definitions')))
select check_order,check_name,passed,jsonb_build_object('summary',false) result_data from checks
union all select 999,'grade2 length calculation skill verification summary',bool_and(passed),jsonb_build_object('summary',true,'total_checks',count(*),'passed_checks',count(*) filter(where passed),'failed_checks',count(*) filter(where not passed)) from checks order by check_order;
rollback;
