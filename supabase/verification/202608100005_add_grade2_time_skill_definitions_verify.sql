begin transaction read only;
with expected(skill_code,subject_code,display_name,description) as (values
  ('read-clock-time','math','시계의 시각 읽기','시침과 분침이 나타내는 몇 시 몇 분을 정확하게 읽습니다.'),
  ('interpret-clock-hands','math','시침과 분침 해석하기','시침과 분침의 위치와 역할을 연결하여 시각을 해석합니다.'),
  ('use-five-minute-intervals','math','5분 단위 읽기','분침이 가리키는 숫자를 5분 단위로 바꾸어 읽습니다.'),
  ('distinguish-am-pm','math','오전과 오후 구별하기','생활 시간대와 시각을 연결하여 오전과 오후를 구별합니다.'),
  ('calculate-time-after','math','몇 분 후 시각 구하기','시작 시각에 지난 분을 더하여 끝 시각을 구합니다.'),
  ('calculate-time-before','math','몇 분 전 시각 구하기','기준 시각에서 분을 빼어 이전 시각이나 시작 시각을 구합니다.'),
  ('calculate-elapsed-time','math','지난 시간 구하기','시작 시각과 끝 시각 사이에 지난 시간을 분 단위로 구합니다.'),
  ('correct-time-reasoning','math','시각 계산 바로잡기','시계 읽기와 전후 시간 계산의 오류를 찾아 바르게 고칩니다.')
), reused(skill_code,display_name,description) as (select null::text,null::text,null::text where false),
checks(check_order,check_name,passed) as (values
  (1,'grade2 time definitions exact',(select count(*) from expected)=8 and not exists(select 1 from expected left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null)),
  (2,'grade2 time reused definitions exact',(select count(*) from reused)=0 and not exists(select 1 from reused left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>'math' or actual.display_name<>reused.display_name or actual.description is distinct from reused.description)),
  (3,'grade2 time skill codes valid',not exists(select 1 from expected where skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')),
  (4,'skill definitions remain force rls',(select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.learning_skill_definitions'::regclass)),
  (5,'browser roles remain blocked',not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
  (6,'service role remains read only',has_table_privilege('service_role','public.learning_skill_definitions','SELECT') and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
  (7,'skill definitions remain outside realtime',not exists(select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename='learning_skill_definitions')))
select check_order,check_name,passed,jsonb_build_object('summary',false) result_data from checks
union all select 999,'grade2 time skill verification summary',bool_and(passed),jsonb_build_object('summary',true,'total_checks',count(*),'passed_checks',count(*) filter(where passed),'failed_checks',count(*) filter(where not passed)) from checks order by check_order;
rollback;
