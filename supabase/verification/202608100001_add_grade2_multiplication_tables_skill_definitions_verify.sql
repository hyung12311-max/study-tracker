begin transaction read only;
with expected(skill_code,subject_code,display_name,description) as (values
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
  ('reason-about-multiplication-facts','math','곱셈구구로 추론하기','곱셈구구의 계산과 규칙을 이용하여 같은 곱이나 잘못된 결과를 판단하고 이유를 설명합니다.')
), reused(skill_code,display_name,description) as (values
  ('model-multiplication-situation','생활 상황을 곱셈으로 나타내기','생활 속 같은 수씩 묶인 상황을 찾아 알맞은 곱셈식이나 문장으로 나타냅니다.'),
  ('correct-multiplication-reasoning','곱셈 의미의 오류 바로잡기','묶음 조건과 반복 덧셈을 비교하여 잘못된 곱셈 표현이나 설명을 찾아 바로잡습니다.')
),checks(check_order,check_name,passed) as (values
  (1,'grade2 multiplication tables definitions exact',(select count(*) from expected)=12 and not exists(select 1 from expected left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null)),
  (2,'grade2 multiplication tables reused definitions exact',(select count(*) from reused)=2 and not exists(select 1 from reused left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>'math' or actual.display_name<>reused.display_name or actual.description is distinct from reused.description)),
  (3,'grade2 multiplication tables skill codes valid',not exists(select 1 from expected where skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')),
  (4,'skill definitions remain force rls',(select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.learning_skill_definitions'::regclass)),
  (5,'browser roles remain blocked',not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
  (6,'service role remains read only',has_table_privilege('service_role','public.learning_skill_definitions','SELECT') and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
  (7,'skill definitions remain outside realtime',not exists(select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename='learning_skill_definitions')))
select check_order,check_name,passed,jsonb_build_object('summary',false) result_data from checks
union all select 999,'grade2 multiplication tables skill verification summary',bool_and(passed),jsonb_build_object('summary',true,'total_checks',count(*),'passed_checks',count(*) filter(where passed),'failed_checks',count(*) filter(where not passed)) from checks order by check_order;
rollback;
