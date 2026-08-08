begin;

do $guard$
begin
  if (to_regclass('public.learning_question_skills') is not null
      and exists (select 1 from public.learning_question_skills))
     or (to_regclass('public.learning_skill_definitions') is not null
      and exists (select 1 from public.learning_skill_definitions))
     or exists (
       select 1 from public.learning_attempt_questions
       where cardinality(skill_codes_snapshot) <> 0
     ) then
    raise exception using errcode = '55000', message = 'learning skill metadata is in use';
  end if;
end
$guard$;

drop trigger learning_attempt_questions_skill_snapshot
  on public.learning_attempt_questions;
drop function public.snapshot_learning_attempt_question_skills();

drop trigger learning_question_skills_guard_change
  on public.learning_question_skills;
drop function public.guard_learning_question_skill_change();

drop table public.learning_question_skills;
drop table public.learning_skill_definitions;

alter table public.learning_attempt_questions
  drop column skill_codes_snapshot;

commit;
