-- Phase 2C-1A: parent-selected subject levels and catalog recommendation metadata.
-- Additive only. Recommendations never create assignments.

begin;

do $preflight$
begin
  if to_regclass('public.family_members') is null
     or to_regclass('public.learning_units') is null then
    raise exception using errcode = 'P0001', message = 'phase 2C-1A prerequisites are missing';
  end if;
  if to_regclass('public.learning_member_subject_profiles') is not null
     or to_regclass('public.learning_unit_recommendation_metadata') is not null
     or to_regprocedure('public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)') is not null then
    raise exception using errcode = 'P0001', message = 'phase 2C-1A target objects already exist';
  end if;
  if not exists (
    select 1
    from public.learning_units u
    join public.learning_courses c on c.id = u.course_id
    where u.id = '51000000-0000-4000-8000-000000000002'::uuid
      and u.unit_code = 'make-ten'
      and c.subject_name = '수학'
  ) then
    raise exception using errcode = 'P0001', message = 'make-ten unit contract changed';
  end if;
end
$preflight$;

create table public.learning_member_subject_profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  member_id uuid not null,
  subject text not null,
  level_code text not null,
  source text not null default 'parent',
  configured_by_member_id uuid not null,
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_member_subject_profiles_family_fk
    foreign key (family_id) references public.families(id) on delete restrict,
  constraint learning_member_subject_profiles_member_fk
    foreign key (family_id, member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_member_subject_profiles_actor_fk
    foreign key (family_id, configured_by_member_id)
    references public.family_members(family_id, id) on delete restrict,
  constraint learning_member_subject_profiles_member_subject_key unique (member_id, subject),
  constraint learning_member_subject_profiles_subject_check check (subject = 'math'),
  constraint learning_member_subject_profiles_level_check check (
    level_code in ('ready', 'elementary_1', 'elementary_2', 'elementary_3',
      'elementary_4', 'elementary_5', 'elementary_6')
  ),
  constraint learning_member_subject_profiles_source_check check (source = 'parent')
);

create index learning_member_subject_profiles_family_member_idx
  on public.learning_member_subject_profiles (family_id, member_id);

create table public.learning_unit_recommendation_metadata (
  unit_id uuid primary key,
  subject text not null,
  recommended_start_level_code text not null,
  recommended_end_level_code text,
  parent_sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint learning_unit_recommendation_metadata_unit_fk
    foreign key (unit_id) references public.learning_units(id) on delete restrict,
  constraint learning_unit_recommendation_metadata_subject_check check (subject = 'math'),
  constraint learning_unit_recommendation_metadata_start_check check (
    recommended_start_level_code in ('ready', 'elementary_1', 'elementary_2', 'elementary_3',
      'elementary_4', 'elementary_5', 'elementary_6')
  ),
  constraint learning_unit_recommendation_metadata_end_check check (
    recommended_end_level_code is null or recommended_end_level_code in
      ('ready', 'elementary_1', 'elementary_2', 'elementary_3',
       'elementary_4', 'elementary_5', 'elementary_6')
  ),
  constraint learning_unit_recommendation_metadata_range_check check (
    recommended_end_level_code is null
    or array_position(array['ready','elementary_1','elementary_2','elementary_3',
      'elementary_4','elementary_5','elementary_6'], recommended_end_level_code)
       >= array_position(array['ready','elementary_1','elementary_2','elementary_3',
      'elementary_4','elementary_5','elementary_6'], recommended_start_level_code)
  ),
  constraint learning_unit_recommendation_metadata_order_check check (parent_sort_order > 0)
);

create function public.validate_learning_member_subject_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'UPDATE' and (
    new.family_id is distinct from old.family_id
    or new.member_id is distinct from old.member_id
    or new.subject is distinct from old.subject
  ) then
    raise exception using errcode = '55000', message = 'learning profile identity is immutable';
  end if;
  if not exists (
    select 1 from public.family_members m
    where m.id = new.member_id and m.family_id = new.family_id
      and m.role = 'child' and m.is_active = true
  ) or not exists (
    select 1 from public.family_members m
    where m.id = new.configured_by_member_id and m.family_id = new.family_id
      and m.role = 'parent' and m.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'active parent and child scope is required';
  end if;
  new.updated_at := now();
  return new;
end
$function$;

create trigger learning_member_subject_profiles_scope_trigger
before insert or update on public.learning_member_subject_profiles
for each row execute function public.validate_learning_member_subject_profile();

create function public.upsert_learning_member_subject_profile(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_member_id uuid,
  p_subject text,
  p_level_code text
)
returns public.learning_member_subject_profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  result_row public.learning_member_subject_profiles;
begin
  insert into public.learning_member_subject_profiles (
    family_id, member_id, subject, level_code, source, configured_by_member_id,
    configured_at, updated_at
  ) values (
    p_family_id, p_member_id, p_subject, p_level_code, 'parent', p_actor_member_id,
    now(), now()
  )
  on conflict (member_id, subject) do update
    set level_code = excluded.level_code,
        source = 'parent',
        configured_by_member_id = excluded.configured_by_member_id,
        configured_at = now(),
        updated_at = now()
    where learning_member_subject_profiles.family_id = excluded.family_id
  returning * into result_row;

  if result_row.id is null then
    raise exception using errcode = '42501', message = 'learning profile family scope mismatch';
  end if;
  return result_row;
end
$function$;

alter function public.validate_learning_member_subject_profile() owner to postgres;
alter function public.upsert_learning_member_subject_profile(uuid, uuid, uuid, text, text) owner to postgres;

alter table public.learning_member_subject_profiles enable row level security;
alter table public.learning_member_subject_profiles force row level security;
alter table public.learning_unit_recommendation_metadata enable row level security;
alter table public.learning_unit_recommendation_metadata force row level security;

revoke all privileges on table public.learning_member_subject_profiles
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_unit_recommendation_metadata
  from public, anon, authenticated, service_role;
grant select on table public.learning_member_subject_profiles,
  public.learning_unit_recommendation_metadata to service_role;

revoke all on function public.validate_learning_member_subject_profile()
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_learning_member_subject_profile(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_learning_member_subject_profile(uuid, uuid, uuid, text, text)
  to service_role;

insert into public.learning_unit_recommendation_metadata (
  unit_id, subject, recommended_start_level_code, recommended_end_level_code, parent_sort_order
) values (
  '51000000-0000-4000-8000-000000000002'::uuid,
  'math', 'elementary_1', 'elementary_1', 1
);

commit;
