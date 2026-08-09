begin transaction read only;
with expected(skill_code,subject_code,display_name,description) as (values
  ('understand-thousands','math','1000의 의미 이해하기','백이 10개 모이면 1000이 되고 천 단위 묶음으로 나타낼 수 있음을 이해합니다.'),
  ('read-four-digit-number','math','네 자리 수 읽기','천의 자리부터 각 자리의 값을 살펴 0이 있는 자리도 빠뜨리지 않고 네 자리 수를 읽습니다.'),
  ('write-four-digit-number','math','네 자리 수 쓰기','말로 나타낸 천 백 십 일의 값을 각 자리에 맞게 숫자로 씁니다.'),
  ('represent-four-digit-place-units','math','천·백·십·일로 수 나타내기','천 백 십 일 단위의 개수를 각 자리에 맞게 연결하여 네 자리 수를 나타냅니다.'),
  ('compose-four-digit-number','math','네 자리 수 구성하기','천 백 십 일의 값을 합하여 하나의 네 자리 수를 구성합니다.'),
  ('decompose-four-digit-number','math','네 자리 수 분해하기','네 자리 수를 각 자리 숫자가 나타내는 값의 합으로 분해합니다.'),
  ('compare-four-digit-numbers','math','네 자리 수 비교하기','천의 자리부터 차례로 비교하여 두 네 자리 수의 크기를 판단합니다.'),
  ('order-four-digit-numbers','math','네 자리 수 순서 정하기','높은 자리부터 비교하여 여러 네 자리 수를 작은 수부터 또는 큰 수부터 정렬합니다.'),
  ('build-four-digit-number-from-digits','math','숫자 카드로 네 자리 수 만들기','주어진 숫자를 각 자리 조건에 맞게 배열하여 가장 크거나 작은 네 자리 수를 만듭니다.')
),checks(check_order,check_name,passed) as (values
  (1,'grade2 four digit definitions exact',(select count(*) from expected)=9 and not exists(select 1 from expected left join public.learning_skill_definitions actual using(skill_code) where actual.skill_code is null or actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null)),
  (2,'grade2 four digit skill codes valid',not exists(select 1 from expected where skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')),
  (3,'skill definitions remain force rls',(select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.learning_skill_definitions'::regclass)),
  (4,'browser roles remain blocked',not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
  (5,'service role remains read only',has_table_privilege('service_role','public.learning_skill_definitions','SELECT') and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
  (6,'skill definitions remain outside realtime',not exists(select 1 from pg_catalog.pg_publication_tables where schemaname='public' and tablename='learning_skill_definitions')))
select check_order,check_name,passed,jsonb_build_object('summary',false) result_data from checks
union all select 999,'grade2 four digit skill verification summary',bool_and(passed),jsonb_build_object('summary',true,'total_checks',count(*),'passed_checks',count(*) filter(where passed),'failed_checks',count(*) filter(where not passed)) from checks order by check_order;
rollback;
