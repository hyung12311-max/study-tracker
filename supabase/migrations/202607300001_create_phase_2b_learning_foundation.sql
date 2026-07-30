-- Phase 2B-1A: immutable learning content and child assignment foundation.
-- Additive only. No production content, attempts, answers, rewards, or Realtime.

begin;

do $preflight$
begin
  if to_regclass('public.families') is null
     or to_regclass('public.family_members') is null then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-1A preflight failed: family foundation is missing';
  end if;

  if to_regprocedure('gen_random_uuid()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-1A preflight failed: gen_random_uuid() is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index index
    where index.indrelid = 'public.family_members'::regclass
      and index.indisunique
      and regexp_replace(
        lower(pg_catalog.pg_get_indexdef(index.indexrelid)),
        '\s+',
        '',
        'g'
      ) like '%onpublic.family_membersusingbtree(family_id,id)%'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-1A preflight failed: family/member composite uniqueness is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns existing_column
    where existing_column.table_schema = 'public'
      and existing_column.table_name = 'family_members'
      and existing_column.column_name = 'role'
      and existing_column.data_type = 'text'
      and existing_column.is_nullable = 'NO'
  ) or not exists (
    select 1
    from information_schema.columns existing_column
    where existing_column.table_schema = 'public'
      and existing_column.table_name = 'family_members'
      and existing_column.column_name = 'is_active'
      and existing_column.data_type = 'boolean'
      and existing_column.is_nullable = 'NO'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-1A preflight failed: family member role/status contract changed';
  end if;

  if not coalesce((
    select role_row.rolbypassrls
    from pg_catalog.pg_roles role_row
    where role_row.rolname = 'service_role'
  ), false) then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-1A preflight failed: service_role must bypass RLS';
  end if;

  if exists (
    select 1
    from (
      values
        ('learning_courses'),
        ('learning_units'),
        ('learning_content_versions'),
        ('learning_stages'),
        ('learning_questions'),
        ('learning_question_options'),
        ('learning_assignments'),
        ('learning_stage_progress')
    ) target(table_name)
    where to_regclass('public.' || target.table_name) is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'phase 2B-1A preflight failed: a target table already exists';
  end if;
end
$preflight$;

create table public.learning_courses (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  internal_name text not null,
  subject_name text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  constraint learning_courses_code_key unique (course_code),
  constraint learning_courses_code_check check (
    btrim(course_code) = course_code
    and char_length(course_code) between 1 and 80
    and course_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
  ),
  constraint learning_courses_internal_name_check check (
    btrim(internal_name) = internal_name
    and char_length(internal_name) between 1 and 200
  ),
  constraint learning_courses_subject_name_check check (
    btrim(subject_name) = subject_name
    and char_length(subject_name) between 1 and 120
  ),
  constraint learning_courses_status_check check (
    status in ('draft', 'published', 'retired')
  )
);

create table public.learning_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  unit_code text not null,
  display_title text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint learning_units_course_fk
    foreign key (course_id)
    references public.learning_courses(id)
    on delete restrict,
  constraint learning_units_course_code_key unique (course_id, unit_code),
  constraint learning_units_course_order_key unique (course_id, sort_order),
  constraint learning_units_code_check check (
    btrim(unit_code) = unit_code
    and char_length(unit_code) between 1 and 80
    and unit_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
  ),
  constraint learning_units_title_check check (
    btrim(display_title) = display_title
    and char_length(display_title) between 1 and 200
  ),
  constraint learning_units_order_check check (sort_order > 0)
);

create table public.learning_content_versions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  version_no integer not null,
  status text not null default 'draft',
  content_hash text not null,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint learning_content_versions_unit_fk
    foreign key (unit_id)
    references public.learning_units(id)
    on delete restrict,
  constraint learning_content_versions_unit_version_key
    unique (unit_id, version_no),
  constraint learning_content_versions_unit_hash_key
    unique (unit_id, content_hash),
  constraint learning_content_versions_id_unit_key
    unique (id, unit_id),
  constraint learning_content_versions_number_check check (version_no > 0),
  constraint learning_content_versions_hash_check check (
    content_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint learning_content_versions_status_check check (
    status in ('draft', 'published', 'retired')
  ),
  constraint learning_content_versions_timestamps_check check (
    (status = 'draft' and published_at is null and retired_at is null)
    or
    (status = 'published' and published_at is not null and retired_at is null)
    or
    (
      status = 'retired'
      and published_at is not null
      and retired_at is not null
      and retired_at >= published_at
    )
  )
);

create table public.learning_stages (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null,
  display_order integer not null,
  display_title text not null,
  difficulty text not null,
  created_at timestamptz not null default now(),
  constraint learning_stages_version_fk
    foreign key (content_version_id)
    references public.learning_content_versions(id)
    on delete restrict,
  constraint learning_stages_version_order_key
    unique (content_version_id, display_order),
  constraint learning_stages_id_version_key
    unique (id, content_version_id),
  constraint learning_stages_order_check check (display_order > 0),
  constraint learning_stages_title_check check (
    btrim(display_title) = display_title
    and char_length(display_title) between 1 and 200
  ),
  constraint learning_stages_difficulty_check check (
    difficulty in ('seed', 'leaf', 'tree', 'crown')
  )
);

create table public.learning_questions (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null,
  display_order integer not null,
  prompt text not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  constraint learning_questions_stage_fk
    foreign key (stage_id)
    references public.learning_stages(id)
    on delete restrict,
  constraint learning_questions_stage_order_key
    unique (stage_id, display_order),
  constraint learning_questions_order_check check (display_order > 0),
  constraint learning_questions_prompt_check check (
    btrim(prompt) = prompt
    and char_length(prompt) between 1 and 5000
  ),
  constraint learning_questions_explanation_check check (
    btrim(explanation) = explanation
    and char_length(explanation) between 1 and 5000
  )
);

create table public.learning_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  display_order integer not null,
  option_text text not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  constraint learning_question_options_question_fk
    foreign key (question_id)
    references public.learning_questions(id)
    on delete restrict,
  constraint learning_question_options_question_order_key
    unique (question_id, display_order),
  constraint learning_question_options_order_check check (display_order > 0),
  constraint learning_question_options_text_check check (
    btrim(option_text) = option_text
    and char_length(option_text) between 1 and 2000
  )
);

create unique index learning_question_options_one_correct_uidx
  on public.learning_question_options (question_id)
  where is_correct;

create table public.learning_assignments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  assigned_member_id uuid not null,
  created_by_member_id uuid not null,
  unit_id uuid not null,
  content_version_id uuid not null,
  status text not null default 'active',
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_assignments_family_fk
    foreign key (family_id)
    references public.families(id)
    on delete restrict,
  constraint learning_assignments_assigned_member_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id)
    on delete restrict,
  constraint learning_assignments_created_by_member_fk
    foreign key (family_id, created_by_member_id)
    references public.family_members(family_id, id)
    on delete restrict,
  constraint learning_assignments_unit_fk
    foreign key (unit_id)
    references public.learning_units(id)
    on delete restrict,
  constraint learning_assignments_version_unit_fk
    foreign key (content_version_id, unit_id)
    references public.learning_content_versions(id, unit_id)
    on delete restrict,
  constraint learning_assignments_scope_version_key
    unique (id, family_id, assigned_member_id, content_version_id),
  constraint learning_assignments_full_scope_key
    unique (
      id,
      family_id,
      assigned_member_id,
      unit_id,
      content_version_id
    ),
  constraint learning_assignments_status_check check (
    status in ('active', 'completed', 'cancelled')
  ),
  constraint learning_assignments_timestamps_check check (
    (
      status = 'active'
      and completed_at is null
      and cancelled_at is null
    )
    or
    (
      status = 'completed'
      and completed_at is not null
      and cancelled_at is null
    )
    or
    (
      status = 'cancelled'
      and completed_at is null
      and cancelled_at is not null
    )
  )
);

create unique index learning_assignments_active_unit_uidx
  on public.learning_assignments (
    family_id,
    assigned_member_id,
    unit_id
  )
  where status = 'active';

create table public.learning_stage_progress (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  assigned_member_id uuid not null,
  assignment_id uuid not null,
  content_version_id uuid not null,
  stage_id uuid not null,
  status text not null,
  unlocked_at timestamptz,
  passed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_stage_progress_assigned_member_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id)
    on delete restrict,
  constraint learning_stage_progress_assignment_scope_fk
    foreign key (
      assignment_id,
      family_id,
      assigned_member_id,
      content_version_id
    )
    references public.learning_assignments(
      id,
      family_id,
      assigned_member_id,
      content_version_id
    )
    on delete restrict,
  constraint learning_stage_progress_stage_version_fk
    foreign key (stage_id, content_version_id)
    references public.learning_stages(id, content_version_id)
    on delete restrict,
  constraint learning_stage_progress_assignment_stage_key
    unique (assignment_id, stage_id),
  constraint learning_stage_progress_id_assignment_stage_key
    unique (id, assignment_id, stage_id),
  constraint learning_stage_progress_status_check check (
    status in ('locked', 'unlocked', 'passed')
  ),
  constraint learning_stage_progress_timestamps_check check (
    (
      status = 'locked'
      and unlocked_at is null
      and passed_at is null
    )
    or
    (
      status = 'unlocked'
      and unlocked_at is not null
      and passed_at is null
    )
    or
    (
      status = 'passed'
      and unlocked_at is not null
      and passed_at is not null
      and passed_at >= unlocked_at
    )
  )
);

create index learning_courses_status_code_idx
  on public.learning_courses (status, course_code);
create index learning_units_course_order_idx
  on public.learning_units (course_id, sort_order);
create index learning_content_versions_unit_status_idx
  on public.learning_content_versions (unit_id, status, version_no desc);
create index learning_stages_version_order_idx
  on public.learning_stages (content_version_id, display_order);
create index learning_questions_stage_order_idx
  on public.learning_questions (stage_id, display_order);
create index learning_question_options_question_order_idx
  on public.learning_question_options (question_id, display_order);
create index learning_assignments_member_status_idx
  on public.learning_assignments (
    family_id,
    assigned_member_id,
    status,
    assigned_at desc
  );
create index learning_assignments_version_idx
  on public.learning_assignments (content_version_id);
create index learning_assignments_member_unit_idx
  on public.learning_assignments (
    family_id,
    assigned_member_id,
    unit_id
  );
create index learning_stage_progress_member_status_idx
  on public.learning_stage_progress (
    family_id,
    assigned_member_id,
    assignment_id,
    status
  );

create function public.guard_learning_catalog_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  has_released_content boolean;
begin
  if tg_table_name = 'learning_courses' then
    select exists (
      select 1
      from public.learning_units unit
      join public.learning_content_versions version
        on version.unit_id = unit.id
      where unit.course_id = old.id
        and version.status in ('published', 'retired')
    )
    into has_released_content;
  elsif tg_table_name = 'learning_units' then
    select exists (
      select 1
      from public.learning_content_versions version
      where version.unit_id = old.id
        and version.status in ('published', 'retired')
    )
    into has_released_content;
  else
    raise exception using
      errcode = 'P0001',
      message = 'unsupported learning catalog trigger target';
  end if;

  if has_released_content then
    raise exception using
      errcode = '55000',
      message = 'released learning catalog rows are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$function$;

create function public.guard_learning_content_version_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  transition_name text;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception using
        errcode = '55000',
        message = 'published or retired learning versions are immutable';
    end if;
    return old;
  end if;

  transition_name := current_setting(
    'study_plus.learning_content_transition',
    true
  );

  if old.status = 'draft' and new.status = 'draft' then
    return new;
  end if;

  if old.status = 'draft'
     and new.status = 'published'
     and transition_name = 'publish'
     and new.id = old.id
     and new.unit_id = old.unit_id
     and new.version_no = old.version_no
     and new.content_hash = old.content_hash
     and new.created_at = old.created_at
     and new.published_at is not null
     and new.retired_at is null then
    return new;
  end if;

  if old.status = 'published'
     and new.status = 'retired'
     and transition_name = 'retire'
     and new.id = old.id
     and new.unit_id = old.unit_id
     and new.version_no = old.version_no
     and new.content_hash = old.content_hash
     and new.created_at = old.created_at
     and new.published_at = old.published_at
     and new.retired_at is not null then
    return new;
  end if;

  raise exception using
    errcode = '55000',
    message = 'invalid learning content version transition';
end
$function$;

create function public.guard_learning_content_child_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  old_version_status text;
  new_version_status text;
begin
  if tg_table_name = 'learning_stages' then
    if tg_op <> 'INSERT' then
      select version.status
      into old_version_status
      from public.learning_content_versions version
      where version.id = old.content_version_id;
    end if;
    if tg_op <> 'DELETE' then
      select version.status
      into new_version_status
      from public.learning_content_versions version
      where version.id = new.content_version_id;
    end if;
  elsif tg_table_name = 'learning_questions' then
    if tg_op <> 'INSERT' then
      select version.status
      into old_version_status
      from public.learning_stages stage
      join public.learning_content_versions version
        on version.id = stage.content_version_id
      where stage.id = old.stage_id;
    end if;
    if tg_op <> 'DELETE' then
      select version.status
      into new_version_status
      from public.learning_stages stage
      join public.learning_content_versions version
        on version.id = stage.content_version_id
      where stage.id = new.stage_id;
    end if;
  elsif tg_table_name = 'learning_question_options' then
    if tg_op <> 'INSERT' then
      select version.status
      into old_version_status
      from public.learning_questions question
      join public.learning_stages stage
        on stage.id = question.stage_id
      join public.learning_content_versions version
        on version.id = stage.content_version_id
      where question.id = old.question_id;
    end if;
    if tg_op <> 'DELETE' then
      select version.status
      into new_version_status
      from public.learning_questions question
      join public.learning_stages stage
        on stage.id = question.stage_id
      join public.learning_content_versions version
        on version.id = stage.content_version_id
      where question.id = new.question_id;
    end if;
  else
    raise exception using
      errcode = 'P0001',
      message = 'unsupported learning content child trigger target';
  end if;

  if coalesce(old_version_status, 'draft') <> 'draft'
     or coalesce(new_version_status, 'draft') <> 'draft' then
    raise exception using
      errcode = '55000',
      message = 'published or retired learning content is immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$function$;

create function public.validate_learning_assignment_scope()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'UPDATE'
     and (
       new.family_id,
       new.assigned_member_id,
       new.created_by_member_id,
       new.unit_id,
       new.content_version_id
     ) is distinct from (
       old.family_id,
       old.assigned_member_id,
       old.created_by_member_id,
       old.unit_id,
       old.content_version_id
     ) then
    raise exception using
      errcode = '55000',
      message = 'learning assignment ownership and content are immutable';
  end if;

  perform 1
  from public.family_members actor
  where actor.id = new.created_by_member_id
    and actor.family_id = new.family_id
    and actor.role = 'parent'
    and actor.is_active = true;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members child
  where child.id = new.assigned_member_id
    and child.family_id = new.family_id
    and child.role = 'child'
    and child.is_active = true;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  perform 1
  from public.learning_content_versions version
  where version.id = new.content_version_id
    and version.unit_id = new.unit_id
    and version.status = 'published';
  if not found then
    raise exception using
      errcode = '55000',
      message = 'published content version is required';
  end if;

  return new;
end
$function$;

create trigger learning_courses_guard_change
before update or delete on public.learning_courses
for each row execute function public.guard_learning_catalog_change();

create trigger learning_units_guard_change
before update or delete on public.learning_units
for each row execute function public.guard_learning_catalog_change();

create trigger learning_content_versions_guard_change
before update or delete on public.learning_content_versions
for each row execute function public.guard_learning_content_version_change();

create trigger learning_stages_guard_change
before insert or update or delete on public.learning_stages
for each row execute function public.guard_learning_content_child_change();

create trigger learning_questions_guard_change
before insert or update or delete on public.learning_questions
for each row execute function public.guard_learning_content_child_change();

create trigger learning_question_options_guard_change
before insert or update or delete on public.learning_question_options
for each row execute function public.guard_learning_content_child_change();

create trigger learning_assignments_validate_scope
before insert or update of
  family_id,
  assigned_member_id,
  created_by_member_id,
  unit_id,
  content_version_id
on public.learning_assignments
for each row execute function public.validate_learning_assignment_scope();

create function public.publish_learning_content_version(
  p_content_version_id uuid
)
returns public.learning_content_versions
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_version public.learning_content_versions%rowtype;
  target_course public.learning_courses%rowtype;
  stage_count integer;
  invalid_stage_count integer;
  invalid_question_count integer;
  published_version public.learning_content_versions%rowtype;
begin
  select version.*
  into target_version
  from public.learning_content_versions version
  where version.id = p_content_version_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning content version was not found';
  end if;

  if target_version.status <> 'draft' then
    raise exception using
      errcode = '55000',
      message = 'only draft learning content can be published';
  end if;

  select course.*
  into target_course
  from public.learning_units unit
  join public.learning_courses course
    on course.id = unit.course_id
  where unit.id = target_version.unit_id
  for update of course;

  if not found or target_course.status = 'retired' then
    raise exception using
      errcode = '55000',
      message = 'active learning course and unit are required';
  end if;

  select count(*)
  into stage_count
  from public.learning_stages stage
  where stage.content_version_id = target_version.id;

  if stage_count < 1 then
    raise exception using
      errcode = '23514',
      message = 'published learning content requires at least one stage';
  end if;

  if (
    select min(stage.display_order) <> 1
      or max(stage.display_order) <> count(*)
    from public.learning_stages stage
    where stage.content_version_id = target_version.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'learning stage display order must be contiguous from one';
  end if;

  select count(*)
  into invalid_stage_count
  from public.learning_stages stage
  where stage.content_version_id = target_version.id
    and (
      select count(*)
      from public.learning_questions question
      where question.stage_id = stage.id
    ) < 1;

  if invalid_stage_count > 0 then
    raise exception using
      errcode = '23514',
      message = 'each published learning stage requires a question';
  end if;

  select count(*)
  into invalid_stage_count
  from public.learning_stages stage
  where stage.content_version_id = target_version.id
    and (
      select min(question.display_order) <> 1
        or max(question.display_order) <> count(*)
      from public.learning_questions question
      where question.stage_id = stage.id
    );

  if invalid_stage_count > 0 then
    raise exception using
      errcode = '23514',
      message = 'learning question display order must be contiguous from one';
  end if;

  select count(*)
  into invalid_question_count
  from public.learning_questions question
  join public.learning_stages stage
    on stage.id = question.stage_id
  where stage.content_version_id = target_version.id
    and (
      (
        select count(*)
        from public.learning_question_options option
        where option.question_id = question.id
      ) < 2
      or
      (
        select count(*)
        from public.learning_question_options option
        where option.question_id = question.id
          and option.is_correct
      ) <> 1
      or
      (
        select min(option.display_order) <> 1
          or max(option.display_order) <> count(*)
        from public.learning_question_options option
        where option.question_id = question.id
      )
    );

  if invalid_question_count > 0 then
    raise exception using
      errcode = '23514',
      message = 'published questions require contiguous options and exactly one correct answer';
  end if;

  if target_course.status = 'draft' then
    update public.learning_courses
    set status = 'published'
    where id = target_course.id;
  end if;

  perform set_config(
    'study_plus.learning_content_transition',
    'publish',
    true
  );

  update public.learning_content_versions
  set status = 'published',
      published_at = now()
  where id = target_version.id
  returning * into published_version;

  return published_version;
end
$function$;

create function public.retire_learning_content_version(
  p_content_version_id uuid
)
returns public.learning_content_versions
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_version public.learning_content_versions%rowtype;
  retired_version public.learning_content_versions%rowtype;
begin
  select version.*
  into target_version
  from public.learning_content_versions version
  where version.id = p_content_version_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning content version was not found';
  end if;

  if target_version.status <> 'published' then
    raise exception using
      errcode = '55000',
      message = 'only published learning content can be retired';
  end if;

  perform set_config(
    'study_plus.learning_content_transition',
    'retire',
    true
  );

  update public.learning_content_versions
  set status = 'retired',
      retired_at = now()
  where id = target_version.id
  returning * into retired_version;

  return retired_version;
end
$function$;

create function public.create_learning_assignment(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_content_version_id uuid
)
returns table (
  assignment_id uuid,
  unit_id uuid,
  content_version_id uuid,
  assigned_member_id uuid,
  first_stage_id uuid,
  stage_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_version public.learning_content_versions%rowtype;
  created_assignment public.learning_assignments%rowtype;
  first_stage uuid;
  created_stage_count integer;
begin
  perform 1
  from public.families family
  where family.id = p_family_id
  for key share;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'family was not found';
  end if;

  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = p_family_id
    and actor.role = 'parent'
    and actor.is_active = true
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active parent member is required';
  end if;

  perform 1
  from public.family_members child
  where child.id = p_assigned_member_id
    and child.family_id = p_family_id
    and child.role = 'child'
    and child.is_active = true
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active assigned child is required';
  end if;

  select version.*
  into target_version
  from public.learning_content_versions version
  where version.id = p_content_version_id
    and version.status = 'published'
  for key share;
  if not found then
    raise exception using
      errcode = '55000',
      message = 'published content version is required';
  end if;

  select stage.id
  into first_stage
  from public.learning_stages stage
  where stage.content_version_id = target_version.id
  order by stage.display_order
  limit 1;
  if first_stage is null then
    raise exception using
      errcode = '23514',
      message = 'published content has no stages';
  end if;

  begin
    insert into public.learning_assignments (
      family_id,
      assigned_member_id,
      created_by_member_id,
      unit_id,
      content_version_id,
      status
    )
    values (
      p_family_id,
      p_assigned_member_id,
      p_actor_member_id,
      target_version.unit_id,
      target_version.id,
      'active'
    )
    returning * into created_assignment;
  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message = 'an active assignment already exists for this child and unit';
  end;

  insert into public.learning_stage_progress (
    family_id,
    assigned_member_id,
    assignment_id,
    content_version_id,
    stage_id,
    status,
    unlocked_at
  )
  select
    created_assignment.family_id,
    created_assignment.assigned_member_id,
    created_assignment.id,
    created_assignment.content_version_id,
    stage.id,
    case
      when stage.id = first_stage then 'unlocked'
      else 'locked'
    end,
    case
      when stage.id = first_stage then now()
      else null
    end
  from public.learning_stages stage
  where stage.content_version_id = created_assignment.content_version_id
  order by stage.display_order;

  get diagnostics created_stage_count = row_count;
  if created_stage_count < 1 then
    raise exception using
      errcode = '23514',
      message = 'assignment stage progress was not created';
  end if;

  return query
  select
    created_assignment.id,
    created_assignment.unit_id,
    created_assignment.content_version_id,
    created_assignment.assigned_member_id,
    first_stage,
    created_stage_count;
end
$function$;

create function public.cancel_learning_assignment(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_assigned_member_id uuid,
  p_assignment_id uuid
)
returns public.learning_assignments
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_assignment public.learning_assignments%rowtype;
  cancelled_assignment public.learning_assignments%rowtype;
begin
  perform 1
  from public.family_members actor
  where actor.id = p_actor_member_id
    and actor.family_id = p_family_id
    and actor.role = 'parent'
    and actor.is_active = true
  for update;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'active parent member is required';
  end if;

  select assignment.*
  into target_assignment
  from public.learning_assignments assignment
  where assignment.id = p_assignment_id
    and assignment.family_id = p_family_id
    and assignment.assigned_member_id = p_assigned_member_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'learning assignment was not found';
  end if;

  if target_assignment.status <> 'active' then
    raise exception using
      errcode = '55000',
      message = 'only active learning assignments can be cancelled';
  end if;

  -- Phase 2B-2 extends this transaction boundary by abandoning any
  -- in-progress attempt after the assignment lock and before this update.
  update public.learning_assignments
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = target_assignment.id
    and status = 'active'
  returning * into cancelled_assignment;

  if cancelled_assignment.id is null then
    raise exception using
      errcode = '40001',
      message = 'learning assignment changed concurrently';
  end if;

  return cancelled_assignment;
end
$function$;

alter function public.guard_learning_catalog_change() owner to postgres;
alter function public.guard_learning_content_version_change() owner to postgres;
alter function public.guard_learning_content_child_change() owner to postgres;
alter function public.validate_learning_assignment_scope() owner to postgres;
alter function public.publish_learning_content_version(uuid) owner to postgres;
alter function public.retire_learning_content_version(uuid) owner to postgres;
alter function public.create_learning_assignment(uuid, uuid, uuid, uuid)
  owner to postgres;
alter function public.cancel_learning_assignment(uuid, uuid, uuid, uuid)
  owner to postgres;

alter table public.learning_courses enable row level security;
alter table public.learning_courses force row level security;
alter table public.learning_units enable row level security;
alter table public.learning_units force row level security;
alter table public.learning_content_versions enable row level security;
alter table public.learning_content_versions force row level security;
alter table public.learning_stages enable row level security;
alter table public.learning_stages force row level security;
alter table public.learning_questions enable row level security;
alter table public.learning_questions force row level security;
alter table public.learning_question_options enable row level security;
alter table public.learning_question_options force row level security;
alter table public.learning_assignments enable row level security;
alter table public.learning_assignments force row level security;
alter table public.learning_stage_progress enable row level security;
alter table public.learning_stage_progress force row level security;

revoke all privileges on table public.learning_courses
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_units
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_content_versions
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_stages
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_questions
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_question_options
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_assignments
  from public, anon, authenticated, service_role;
revoke all privileges on table public.learning_stage_progress
  from public, anon, authenticated, service_role;

grant select on table
  public.learning_courses,
  public.learning_units,
  public.learning_content_versions,
  public.learning_stages,
  public.learning_questions,
  public.learning_question_options,
  public.learning_assignments,
  public.learning_stage_progress
to service_role;

revoke all on function public.guard_learning_catalog_change()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_learning_content_version_change()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_learning_content_child_change()
  from public, anon, authenticated, service_role;
revoke all on function public.validate_learning_assignment_scope()
  from public, anon, authenticated, service_role;
revoke all on function public.publish_learning_content_version(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.retire_learning_content_version(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.create_learning_assignment(
  uuid,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.cancel_learning_assignment(
  uuid,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, service_role;

grant execute on function public.publish_learning_content_version(uuid)
  to service_role;
grant execute on function public.retire_learning_content_version(uuid)
  to service_role;
grant execute on function public.create_learning_assignment(
  uuid,
  uuid,
  uuid,
  uuid
) to service_role;
grant execute on function public.cancel_learning_assignment(
  uuid,
  uuid,
  uuid,
  uuid
) to service_role;

commit;
