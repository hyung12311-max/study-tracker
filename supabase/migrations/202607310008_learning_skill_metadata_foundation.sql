-- Phase C-1: skill definitions, question mappings, and immutable attempt snapshots.
-- Additive analysis metadata only; official answers, grading, progress, and rewards are unchanged.

begin;

do $preflight$
begin
  if to_regclass('public.learning_questions') is null
     or to_regclass('public.learning_attempt_questions') is null
     or to_regclass('public.learning_content_versions') is null then
    raise exception using errcode = 'P0001', message = 'learning skill metadata prerequisites are missing';
  end if;
  if to_regclass('public.learning_skill_definitions') is not null
     or to_regclass('public.learning_question_skills') is not null
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'learning_attempt_questions'
         and column_name = 'skill_codes_snapshot'
     ) then
    raise exception using errcode = 'P0001', message = 'learning skill metadata objects already exist';
  end if;
end
$preflight$;

create table public.learning_skill_definitions (
  skill_code text primary key,
  subject_code text not null,
  display_name text not null,
  description text,
  curriculum_code text,
  created_at timestamptz not null default now(),
  constraint learning_skill_definitions_code_check check (
    btrim(skill_code) = skill_code
    and char_length(skill_code) between 1 and 100
    and skill_code ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint learning_skill_definitions_subject_check check (subject_code = 'math'),
  constraint learning_skill_definitions_display_name_check check (
    btrim(display_name) = display_name
    and char_length(display_name) between 1 and 120
  ),
  constraint learning_skill_definitions_description_check check (
    description is null
    or (btrim(description) = description and char_length(description) between 1 and 500)
  ),
  constraint learning_skill_definitions_curriculum_check check (
    curriculum_code is null
    or (btrim(curriculum_code) = curriculum_code and char_length(curriculum_code) between 1 and 100)
  )
);

create table public.learning_question_skills (
  question_id uuid not null,
  skill_code text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint learning_question_skills_pkey primary key (question_id, skill_code),
  constraint learning_question_skills_question_fk foreign key (question_id)
    references public.learning_questions(id) on delete restrict,
  constraint learning_question_skills_skill_fk foreign key (skill_code)
    references public.learning_skill_definitions(skill_code) on delete restrict
);

create unique index learning_question_skills_one_primary_uidx
  on public.learning_question_skills (question_id)
  where is_primary;
create index learning_question_skills_skill_question_idx
  on public.learning_question_skills (skill_code, question_id);

alter table public.learning_attempt_questions
  add column skill_codes_snapshot text[] not null default '{}'::text[],
  add constraint learning_attempt_questions_skill_snapshot_check check (
    cardinality(skill_codes_snapshot) <= 16
    and array_position(skill_codes_snapshot, null) is null
  );

create function public.guard_learning_question_skill_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if exists (
    select 1
    from public.learning_questions question
    join public.learning_stages stage on stage.id = question.stage_id
    join public.learning_content_versions version on version.id = stage.content_version_id
    where question.id = old.question_id
      and version.status <> 'draft'
  ) then
    raise exception using errcode = '55000', message = 'published learning question skills are immutable';
  end if;

  if tg_op = 'UPDATE' and exists (
    select 1
    from public.learning_questions question
    join public.learning_stages stage on stage.id = question.stage_id
    join public.learning_content_versions version on version.id = stage.content_version_id
    where question.id = new.question_id
      and version.status <> 'draft'
  ) then
    raise exception using errcode = '55000', message = 'published learning question skills are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

create trigger learning_question_skills_guard_change
before update or delete on public.learning_question_skills
for each row execute function public.guard_learning_question_skill_change();

create function public.snapshot_learning_attempt_question_skills()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  select coalesce(array_agg(mapping.skill_code order by mapping.is_primary desc, mapping.skill_code), '{}'::text[])
    into new.skill_codes_snapshot
  from public.learning_question_skills mapping
  where mapping.question_id = new.source_question_id;
  return new;
end
$function$;

create trigger learning_attempt_questions_skill_snapshot
before insert on public.learning_attempt_questions
for each row execute function public.snapshot_learning_attempt_question_skills();

alter function public.guard_learning_question_skill_change() owner to postgres;
alter function public.snapshot_learning_attempt_question_skills() owner to postgres;

alter table public.learning_skill_definitions enable row level security;
alter table public.learning_skill_definitions force row level security;
alter table public.learning_question_skills enable row level security;
alter table public.learning_question_skills force row level security;

revoke all privileges on table public.learning_skill_definitions,
  public.learning_question_skills from public, anon, authenticated, service_role;
grant select on table public.learning_skill_definitions,
  public.learning_question_skills to service_role;

revoke all on function public.guard_learning_question_skill_change()
  from public, anon, authenticated, service_role;
revoke all on function public.snapshot_learning_attempt_question_skills()
  from public, anon, authenticated, service_role;

commit;
