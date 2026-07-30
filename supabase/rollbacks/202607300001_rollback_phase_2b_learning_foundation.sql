-- PRE-DATA ONLY rollback for Phase 2B-1A.
-- Never run automatically. It refuses to remove any learning content,
-- assignment, or progress data and does not touch Phase 2A objects.

begin;

do $preflight$
begin
  if to_regclass('public.learning_courses') is null
     or to_regclass('public.learning_units') is null
     or to_regclass('public.learning_content_versions') is null
     or to_regclass('public.learning_stages') is null
     or to_regclass('public.learning_questions') is null
     or to_regclass('public.learning_question_options') is null
     or to_regclass('public.learning_assignments') is null
     or to_regclass('public.learning_stage_progress') is null then
    raise exception using
      errcode = 'P0001',
      message = 'rollback blocked: the complete Phase 2B-1A foundation is not present';
  end if;

  if exists (select 1 from public.learning_stage_progress)
     or exists (select 1 from public.learning_assignments)
     or exists (select 1 from public.learning_question_options)
     or exists (select 1 from public.learning_questions)
     or exists (select 1 from public.learning_stages)
     or exists (select 1 from public.learning_content_versions)
     or exists (select 1 from public.learning_units)
     or exists (select 1 from public.learning_courses) then
    raise exception using
      errcode = '55000',
      message = 'rollback blocked: Phase 2B learning data exists';
  end if;
end
$preflight$;

drop function public.cancel_learning_assignment(uuid, uuid, uuid, uuid);
drop function public.create_learning_assignment(uuid, uuid, uuid, uuid);
drop function public.retire_learning_content_version(uuid);
drop function public.publish_learning_content_version(uuid);

drop table public.learning_stage_progress;
drop table public.learning_assignments;
drop table public.learning_question_options;
drop table public.learning_questions;
drop table public.learning_stages;
drop table public.learning_content_versions;
drop table public.learning_units;
drop table public.learning_courses;

drop function public.validate_learning_assignment_scope();
drop function public.guard_learning_content_child_change();
drop function public.guard_learning_content_version_change();
drop function public.guard_learning_catalog_change();

commit;
