begin transaction read only;
with expected(skill_code,subject_code,display_name,description) as (values
  ('read-data-table','math','자료 표 읽기','표의 항목과 수를 연결하여 필요한 자료를 정확하게 읽습니다.'),
  ('complete-data-table','math','자료 표 완성하기','원자료와 합계를 확인하여 표의 빠진 항목이나 수를 채웁니다.'),
  ('compare-category-counts','math','항목 수 비교하기','표나 그래프의 여러 항목 수를 비교합니다.'),
  ('find-most-least-category','math','가장 많은·적은 항목 찾기','자료 수를 비교하여 가장 많은 항목과 가장 적은 항목을 찾습니다.'),
  ('calculate-data-difference','math','자료 수의 차 구하기','두 항목의 수를 비교하여 차이를 구합니다.'),
  ('infer-missing-data','math','빠진 자료 수 찾기','전체와 알려진 항목 수를 이용하여 빠진 자료 수를 구합니다.'),
  ('read-text-graph','math','텍스트 그래프 읽기','기호로 나타낸 그래프에서 항목별 수와 전체를 읽습니다.'),
  ('connect-table-and-graph','math','표와 그래프 연결하기','표의 수와 그래프의 기호 수가 서로 맞는지 확인합니다.'),
  ('correct-data-interpretation','math','자료 해석 바로잡기','표와 그래프의 합계·비교·차이 해석 오류를 찾아 고칩니다.')
), reused(skill_code,display_name,description) as (values
  ('classify-by-given-rule','주어진 기준으로 분류하기','주어진 한 가지 기준에 맞는 항목을 빠짐없이 골라 분류합니다.')
),
checks(check_order,check_name,passed) as (values
  (1,'grade2 tables graphs definitions exact',(select count(*) from expected)=9 and not exists(select 1 from expected left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null)),
  (2,'grade2 tables graphs reused definitions exact',(select count(*) from reused)=1 and not exists(select 1 from reused left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>'math' or actual.display_name<>reused.display_name or actual.description is distinct from reused.description)),
  (3,'grade2 tables graphs skill codes valid',not exists(select 1 from expected where skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')),
  (4,'skill definitions remain force rls',(select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.learning_skill_definitions'::regclass)),
  (5,'browser roles remain blocked',not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
  (6,'service role remains read only',has_table_privilege('service_role','public.learning_skill_definitions','SELECT') and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
  (7,'skill definitions remain outside realtime',not exists(select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename='learning_skill_definitions')))
select check_order,check_name,passed,jsonb_build_object('summary',false) result_data from checks
union all select 999,'grade2 tables graphs skill verification summary',bool_and(passed),jsonb_build_object('summary',true,'total_checks',count(*),'passed_checks',count(*) filter(where passed),'failed_checks',count(*) filter(where not passed)) from checks order by check_order;
rollback;
