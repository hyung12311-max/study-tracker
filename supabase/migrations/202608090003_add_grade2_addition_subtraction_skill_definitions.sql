-- Additive skill definitions for Grade 2 addition and subtraction content authoring.
begin;

create temporary table grade2_addition_subtraction_expected_skills (
  skill_code text primary key,
  subject_code text not null,
  display_name text not null,
  description text not null
) on commit drop;

insert into grade2_addition_subtraction_expected_skills values
  ('add-without-regrouping', 'math', '받아올림 없는 덧셈', '일의 자리와 십의 자리를 같은 자리끼리 더하여 받아올림 없는 덧셈을 계산합니다.'),
  ('add-with-regrouping', 'math', '받아올림 있는 덧셈', '일의 자리의 합이 10을 넘을 때 받아올림하여 두 자리 수의 덧셈을 계산합니다.'),
  ('subtract-without-regrouping', 'math', '받아내림 없는 뺄셈', '일의 자리와 십의 자리를 같은 자리끼리 빼어 받아내림 없는 뺄셈을 계산합니다.'),
  ('subtract-with-regrouping', 'math', '받아내림 있는 뺄셈', '일의 자리에서 뺄 수 없을 때 십의 자리에서 받아내림하여 계산합니다.'),
  ('model-addition-situation', 'math', '덧셈 상황을 식으로 나타내기', '두 수량을 모으거나 늘리는 상황을 덧셈식으로 나타내고 해결합니다.'),
  ('model-subtraction-situation', 'math', '뺄셈 상황을 식으로 나타내기', '전체에서 일부를 빼거나 두 수량의 차이를 구하는 상황을 뺄셈식으로 나타냅니다.'),
  ('compare-calculation-results', 'math', '계산 결과 비교하기', '덧셈과 뺄셈을 정확히 계산하여 두 결과의 크기를 비교합니다.'),
  ('find-missing-number', 'math', '빈칸의 수 찾기', '덧셈과 뺄셈의 관계를 이용하여 식의 빈칸에 들어갈 수를 찾습니다.'),
  ('correct-calculation-reasoning', 'math', '덧셈·뺄셈 풀이 바로잡기', '받아올림과 받아내림 등의 계산 오류를 찾고 올바른 이유와 결과로 고칩니다.');

do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null
     or to_regclass('public.learning_question_skills') is null then
    raise exception using errcode = 'P0001', message = 'learning skill metadata foundation is missing';
  end if;

  if (select count(*) from grade2_addition_subtraction_expected_skills) <> 9 then
    raise exception using errcode = 'P0001', message = 'grade2 addition subtraction skill source is incomplete';
  end if;

  if exists (
    select 1
    from grade2_addition_subtraction_expected_skills expected
    join public.learning_skill_definitions actual using (skill_code)
    where actual.subject_code <> expected.subject_code
       or actual.display_name <> expected.display_name
       or actual.description is distinct from expected.description
       or actual.curriculum_code is not null
  ) then
    raise exception using errcode = '23505', message = 'grade2 addition subtraction skill definition conflicts with reviewed source';
  end if;
end
$preflight$;

insert into public.learning_skill_definitions (
  skill_code, subject_code, display_name, description, curriculum_code
)
select skill_code, subject_code, display_name, description, null
from grade2_addition_subtraction_expected_skills
on conflict (skill_code) do nothing;

commit;
