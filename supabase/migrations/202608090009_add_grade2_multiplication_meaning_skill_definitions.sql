-- Additive skill definitions for Grade 2 multiplication meaning content authoring.
begin;

create temporary table grade2_multiplication_meaning_expected_skills (
  skill_code text primary key,
  subject_code text not null,
  display_name text not null,
  description text not null
) on commit drop;

insert into grade2_multiplication_meaning_expected_skills values
  ('identify-equal-groups', 'math', '같은 수씩 묶인 것 찾기', '각 묶음에 같은 수의 대상이 들어 있는지 살펴 곱셈으로 나타낼 수 있는 묶음을 찾습니다.'),
  ('count-equal-groups', 'math', '같은 수 묶음 세기', '한 묶음의 수와 묶음 수를 구분하여 같은 수씩 몇 묶음인지 셉니다.'),
  ('connect-repeated-addition-to-multiplication', 'math', '반복 덧셈과 곱셈 연결하기', '같은 수를 여러 번 더한 식을 한 묶음의 수와 묶음 수를 사용한 곱셈식으로 연결합니다.'),
  ('represent-equal-groups-as-multiplication', 'math', '같은 수 묶음을 곱셈식으로 나타내기', '한 묶음의 수 곱하기 묶음 수의 순서로 같은 수 묶음을 곱셈식으로 나타냅니다.'),
  ('interpret-multiplication-expression', 'math', '곱셈식의 뜻 해석하기', '곱셈식의 앞 수는 한 묶음의 수이고 뒤 수는 묶음 수임을 해석합니다.'),
  ('model-multiplication-situation', 'math', '생활 상황을 곱셈으로 나타내기', '생활 속 같은 수씩 묶인 상황을 찾아 알맞은 곱셈식이나 문장으로 나타냅니다.'),
  ('infer-missing-group-value', 'math', '묶음의 빠진 값 찾기', '전체 수와 한 묶음의 수 또는 묶음 수를 이용하여 빠진 묶음 값을 찾습니다.'),
  ('correct-multiplication-reasoning', 'math', '곱셈 의미의 오류 바로잡기', '묶음 조건과 반복 덧셈을 비교하여 잘못된 곱셈 표현이나 설명을 찾아 바로잡습니다.');

do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null
     or to_regclass('public.learning_question_skills') is null then
    raise exception using errcode = 'P0001', message = 'learning skill metadata foundation is missing';
  end if;

  if (select count(*) from grade2_multiplication_meaning_expected_skills) <> 8 then
    raise exception using errcode = 'P0001', message = 'grade2 multiplication meaning skill source is incomplete';
  end if;

  if exists (
    select 1
    from grade2_multiplication_meaning_expected_skills expected
    join public.learning_skill_definitions actual using (skill_code)
    where actual.subject_code <> expected.subject_code
       or actual.display_name <> expected.display_name
       or actual.description is distinct from expected.description
       or actual.curriculum_code is not null
  ) then
    raise exception using errcode = '23505', message = 'grade2 multiplication meaning skill definition conflicts with reviewed source';
  end if;
end
$preflight$;

insert into public.learning_skill_definitions (
  skill_code, subject_code, display_name, description, curriculum_code
)
select skill_code, subject_code, display_name, description, null
from grade2_multiplication_meaning_expected_skills
on conflict (skill_code) do nothing;

commit;
