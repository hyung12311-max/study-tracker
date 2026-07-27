-- Establishes family ownership columns against the verified 2026-07-27
-- production snapshot. This migration intentionally keeps new columns nullable
-- until every legacy browser/RPC write path supplies explicit ownership.

begin;

lock table
  public.families,
  public.family_members,
  public.study_plans,
  public.book_plans,
  public.reading_plans,
  public.academy_schedules,
  public.academy_completion_history,
  public.sticker_history,
  public.sticker_transactions
in share row exclusive mode;

do $preflight$
declare
  default_family_id uuid;
  hagyeom_member_id uuid;
  history_3_created_at timestamptz;
  history_4_created_at timestamptz;
  observed_count bigint;
  observed_amount bigint;
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'study_plans'
      and column_name = 'id'
      and data_type = 'bigint'
      and is_identity = 'YES'
      and identity_generation = 'ALWAYS'
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: study_plans.id must be bigint identity always';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sticker_history'
      and column_name in ('id', 'study_plan_id')
      and data_type = 'bigint'
  ) <> 2 then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: sticker_history ids must be bigint';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'book_plans' and column_name = 'id')
        or (table_name = 'reading_plans' and column_name = 'id')
        or (
          table_name = 'study_plans'
          and column_name in ('book_plan_id', 'reading_plan_id')
        )
      )
      and data_type = 'uuid'
  ) <> 4 then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: book/reading ownership link types differ';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'families' and column_name = 'id')
        or (
          table_name = 'family_members'
          and column_name in ('id', 'family_id')
        )
        or (
          table_name = 'reading_plans'
          and column_name in ('family_id', 'created_by_member_id')
        )
        or (
          table_name = 'academy_completion_history'
          and column_name in ('family_id', 'member_id')
        )
        or (
          table_name = 'sticker_history'
          and column_name in ('family_id', 'member_id')
        )
        or (
          table_name = 'sticker_transactions'
          and column_name in ('family_id', 'member_id')
        )
      )
      and data_type = 'uuid'
  ) <> 11 then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: family/member key types must be uuid';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and (
        (
          table_name in (
            'study_plans',
            'book_plans',
            'academy_schedules'
          )
          and column_name in (
            'family_id',
            'assigned_member_id',
            'created_by_member_id'
          )
        )
        or (
          table_name = 'reading_plans'
          and column_name = 'assigned_member_id'
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: an ownership column already exists';
  end if;

  if (select count(*) from public.families) <> 1
     or (select count(*) from public.family_members) <> 4
     or (select count(*) from public.study_plans) <> 42
     or (select count(*) from public.book_plans) <> 0
     or (select count(*) from public.reading_plans) <> 1
     or (select count(*) from public.academy_schedules) <> 2
     or (select count(*) from public.academy_completion_history) <> 2
     or (select count(*) from public.sticker_history) <> 32
     or (select count(*) from public.sticker_transactions) <> 34 then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: verified production row counts changed';
  end if;

  select families.id, family_members.id
  into default_family_id, hagyeom_member_id
  from public.families
  join public.family_members
    on family_members.family_id = families.id
  where families.family_key = 'default'
    and family_members.member_key = 'hagyeom'
    and family_members.role = 'child'
    and family_members.is_active = true;

  if default_family_id is null or hagyeom_member_id is null then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: active default/hagyeom child is missing';
  end if;

  if (
    select count(*)
    from public.families
    join public.family_members
      on family_members.family_id = families.id
    where families.family_key = 'default'
      and family_members.member_key = 'hagyeom'
      and family_members.role = 'child'
      and family_members.is_active = true
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: default/hagyeom child is ambiguous';
  end if;

  if exists (
    select 1
    from public.reading_plans
    where family_id <> default_family_id
       or created_by_member_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: reading plan ownership changed';
  end if;

  if exists (
    select 1
    from public.reading_plans
    left join public.family_members
      on family_members.id = reading_plans.created_by_member_id
     and family_members.family_id = reading_plans.family_id
    where family_members.id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: reading plan creator family mismatch';
  end if;

  if exists (
    select 1
    from public.academy_schedules
    left join (
      select
        academy_completion_history.academy_schedule_id,
        count(*) as completion_count,
        count(distinct academy_completion_history.family_id)
          as family_count,
        count(distinct academy_completion_history.member_id)
          as member_count
      from public.academy_completion_history
      group by academy_completion_history.academy_schedule_id
    ) candidates
      on candidates.academy_schedule_id = academy_schedules.id
    where candidates.academy_schedule_id is null
       or candidates.completion_count < 1
       or candidates.family_count <> 1
       or candidates.member_count <> 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: academy schedule owner is not singular';
  end if;

  if exists (
    select 1
    from public.academy_completion_history
    left join public.family_members
      on family_members.id = academy_completion_history.member_id
     and family_members.family_id = academy_completion_history.family_id
    where family_members.id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: academy completion owner mismatch';
  end if;

  select count(*)
  into observed_count
  from public.sticker_history
  where study_plan_id = 9;

  if observed_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = '1B duplicate guard failed: plan 9 must have exactly two history rows';
  end if;

  if (
    select count(*)
    from (
      select sticker_history.study_plan_id
      from public.sticker_history
      group by sticker_history.study_plan_id
      having count(*) > 1
    ) duplicate_groups
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = '1B duplicate guard failed: plan 9 must be the only duplicate group';
  end if;

  if (
    select count(*)
    from public.sticker_history
    where study_plan_id = 9
      and id in (3, 4)
  ) <> 2
  or exists (
    select 1
    from public.sticker_history
    where study_plan_id = 9
      and id not in (3, 4)
  ) then
    raise exception using
      errcode = 'P0001',
      message = '1B duplicate guard failed: expected history ids 3 and 4 only';
  end if;

  if (
    select count(distinct family_id)
    from public.sticker_history
    where study_plan_id = 9
  ) <> 1
  or (
    select count(distinct member_id)
    from public.sticker_history
    where study_plan_id = 9
  ) <> 1
  or exists (
    select 1
    from public.sticker_history
    where study_plan_id = 9
      and (
        family_id is null
        or member_id is null
        or sticker_count <> 1
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = '1B duplicate guard failed: history owner or reward differs';
  end if;

  if exists (
    select 1
    from public.sticker_history
    left join public.families
      on families.id = sticker_history.family_id
    left join public.family_members
      on family_members.id = sticker_history.member_id
     and family_members.family_id = sticker_history.family_id
    where sticker_history.study_plan_id = 9
      and (
        families.id is null
        or family_members.id is null
        or families.family_key <> 'default'
        or family_members.member_key <> 'hagyeom'
        or family_members.role <> 'child'
        or not family_members.is_active
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = '1B duplicate guard failed: history is not default/hagyeom';
  end if;

  select
    max(created_at) filter (where id = 3),
    max(created_at) filter (where id = 4)
  into history_3_created_at, history_4_created_at
  from public.sticker_history
  where study_plan_id = 9;

  if history_3_created_at is null
     or history_4_created_at is null
     or history_4_created_at <= history_3_created_at then
    raise exception using
      errcode = 'P0001',
      message = '1B duplicate guard failed: legacy history timestamp order differs';
  end if;

  select count(*), coalesce(sum(amount), 0)
  into observed_count, observed_amount
  from public.sticker_transactions
  where source_type = 'study_complete'
    and source_id = '9';

  if observed_count <> 1 or observed_amount <> 1 then
    raise exception using
      errcode = 'P0001',
      message = '1B duplicate guard failed: plan 9 ledger count or amount differs';
  end if;

  if exists (
    select 1
    from public.sticker_transactions
    where source_type = 'study_complete'
      and source_id = '9'
      and (
        family_id <> default_family_id
        or member_id <> hagyeom_member_id
        or transaction_type <> 'earn'
        or created_at is distinct from history_3_created_at
        or created_at = history_4_created_at
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = '1B duplicate guard failed: plan 9 ledger linkage differs';
  end if;

  if (
    select count(*)
    from public.sticker_transactions
    where source_type = 'study_complete'
  ) <> 31 then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: study_complete transaction count changed';
  end if;

  if (
    select coalesce(sum(sticker_transactions.amount), 0)
    from public.sticker_transactions
    where sticker_transactions.member_id = hagyeom_member_id
  ) <> 47 then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: hagyeom ledger balance is not 47';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger
    join pg_catalog.pg_class
      on pg_class.oid = pg_trigger.tgrelid
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
    join pg_catalog.pg_proc
      on pg_proc.oid = pg_trigger.tgfoid
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'sticker_history'
      and pg_trigger.tgname = 'sync_study_sticker_transaction'
      and not pg_trigger.tgisinternal
      and pg_trigger.tgenabled = 'O'
      and pg_proc.proname = 'sync_study_sticker_transaction'
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: sticker ledger sync trigger differs';
  end if;

  if to_regclass('public.sticker_history_study_plan_unique_idx') is not null then
    raise exception using
      errcode = 'P0001',
      message = '1B preflight failed: sticker history unique index already exists';
  end if;
end
$preflight$;

do $family_member_key$
begin
  if not exists (
    select 1
    from pg_catalog.pg_index indexes
    where indexes.indrelid = 'public.family_members'::regclass
      and indexes.indisunique
      and indexes.indisvalid
      and indexes.indpred is null
      and indexes.indexprs is null
      and indexes.indnkeyatts = 2
      and (
        select array_agg(
          attributes.attname::text
          order by keys.ordinality
        )
        from unnest(indexes.indkey) with ordinality
          as keys(attribute_number, ordinality)
        join pg_catalog.pg_attribute attributes
          on attributes.attrelid = indexes.indrelid
         and attributes.attnum = keys.attribute_number
        where keys.ordinality <= indexes.indnkeyatts
      ) = array['family_id', 'id']::text[]
  ) then
    if to_regclass('public.family_members_family_id_id_uidx') is not null then
      raise exception using
        errcode = 'P0001',
        message = '1B preflight failed: composite owner index name is occupied';
    end if;

    execute '
      create unique index family_members_family_id_id_uidx
      on public.family_members (family_id, id)
    ';
  end if;
end
$family_member_key$;

alter table public.study_plans
  add column family_id uuid,
  add column assigned_member_id uuid,
  add column created_by_member_id uuid;

alter table public.book_plans
  add column family_id uuid,
  add column assigned_member_id uuid,
  add column created_by_member_id uuid;

alter table public.reading_plans
  add column assigned_member_id uuid;

alter table public.academy_schedules
  add column family_id uuid,
  add column assigned_member_id uuid,
  add column created_by_member_id uuid;

update public.study_plans
set
  family_id = owners.family_id,
  assigned_member_id = owners.member_id
from (
  select
    families.id as family_id,
    family_members.id as member_id
  from public.families
  join public.family_members
    on family_members.family_id = families.id
  where families.family_key = 'default'
    and family_members.member_key = 'hagyeom'
    and family_members.role = 'child'
    and family_members.is_active = true
) owners;

update public.reading_plans
set assigned_member_id = family_members.id
from public.families
join public.family_members
  on family_members.family_id = families.id
where reading_plans.family_id = families.id
  and families.family_key = 'default'
  and family_members.member_key = 'hagyeom'
  and family_members.role = 'child'
  and family_members.is_active = true;

update public.academy_schedules
set
  family_id = owners.family_id,
  assigned_member_id = owners.member_id
from (
  select
    academy_completion_history.academy_schedule_id,
    (array_agg(
      distinct academy_completion_history.family_id
    ))[1] as family_id,
    (array_agg(
      distinct academy_completion_history.member_id
    ))[1] as member_id
  from public.academy_completion_history
  group by academy_completion_history.academy_schedule_id
) owners
where owners.academy_schedule_id = academy_schedules.id;

alter table public.study_plans
  add constraint study_plans_family_fk
    foreign key (family_id)
    references public.families(id)
    on delete restrict,
  add constraint study_plans_assigned_family_member_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id)
    on delete restrict,
  add constraint study_plans_created_by_family_member_fk
    foreign key (family_id, created_by_member_id)
    references public.family_members(family_id, id)
    on delete restrict;

alter table public.book_plans
  add constraint book_plans_family_fk
    foreign key (family_id)
    references public.families(id)
    on delete restrict,
  add constraint book_plans_assigned_family_member_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id)
    on delete restrict,
  add constraint book_plans_created_by_family_member_fk
    foreign key (family_id, created_by_member_id)
    references public.family_members(family_id, id)
    on delete restrict;

alter table public.reading_plans
  add constraint reading_plans_assigned_family_member_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id)
    on delete restrict;

alter table public.academy_schedules
  add constraint academy_schedules_family_fk
    foreign key (family_id)
    references public.families(id)
    on delete restrict,
  add constraint academy_schedules_assigned_family_member_fk
    foreign key (family_id, assigned_member_id)
    references public.family_members(family_id, id)
    on delete restrict,
  add constraint academy_schedules_created_by_family_member_fk
    foreign key (family_id, created_by_member_id)
    references public.family_members(family_id, id)
    on delete restrict;

create index study_plans_family_assigned_date_idx
  on public.study_plans (family_id, assigned_member_id, study_date);

create index study_plans_family_created_by_idx
  on public.study_plans (family_id, created_by_member_id);

create index book_plans_family_assigned_idx
  on public.book_plans (family_id, assigned_member_id);

create index reading_plans_family_assigned_idx
  on public.reading_plans (family_id, assigned_member_id);

create index academy_schedules_family_assigned_idx
  on public.academy_schedules (family_id, assigned_member_id);

-- The existing delete trigger removes the plan ledger row for any history
-- deletion. Disable only this verified trigger while removing the proven
-- ledger-less legacy duplicate, then restore it in the same transaction.
alter table public.sticker_history
  disable trigger sync_study_sticker_transaction;

do $cleanup$
declare
  deleted_count bigint;
begin
  delete from public.sticker_history
  where id = 4
    and study_plan_id = 9;

  get diagnostics deleted_count = row_count;
  if deleted_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = '1B cleanup failed: guarded history id 4 delete count was not one';
  end if;
end
$cleanup$;

alter table public.sticker_history
  enable trigger sync_study_sticker_transaction;

create unique index sticker_history_study_plan_unique_idx
  on public.sticker_history (study_plan_id)
  where study_plan_id is not null;

do $postflight$
declare
  default_family_id uuid;
  hagyeom_member_id uuid;
begin
  select families.id, family_members.id
  into strict default_family_id, hagyeom_member_id
  from public.families
  join public.family_members
    on family_members.family_id = families.id
  where families.family_key = 'default'
    and family_members.member_key = 'hagyeom'
    and family_members.role = 'child'
    and family_members.is_active = true;

  if (select count(*) from public.study_plans) <> 42
     or exists (
       select 1
       from public.study_plans
       where family_id is distinct from default_family_id
          or assigned_member_id is distinct from hagyeom_member_id
          or created_by_member_id is not null
     ) then
    raise exception using
      errcode = 'P0001',
      message = '1B postflight failed: study plan backfill differs';
  end if;

  if (select count(*) from public.book_plans) <> 0 then
    raise exception using
      errcode = 'P0001',
      message = '1B postflight failed: book plans changed';
  end if;

  if (select count(*) from public.reading_plans) <> 1
     or exists (
       select 1
       from public.reading_plans
       where family_id is distinct from default_family_id
          or assigned_member_id is distinct from hagyeom_member_id
          or created_by_member_id is null
     ) then
    raise exception using
      errcode = 'P0001',
      message = '1B postflight failed: reading plan backfill differs';
  end if;

  if (select count(*) from public.academy_schedules) <> 2
     or exists (
       select 1
       from public.academy_schedules
       join public.academy_completion_history
         on academy_completion_history.academy_schedule_id
          = academy_schedules.id
       where academy_schedules.family_id
               is distinct from academy_completion_history.family_id
          or academy_schedules.assigned_member_id
               is distinct from academy_completion_history.member_id
          or academy_schedules.created_by_member_id is not null
     ) then
    raise exception using
      errcode = 'P0001',
      message = '1B postflight failed: academy schedule backfill differs';
  end if;

  if (select count(*) from public.sticker_history) <> 31
     or (select count(*) from public.sticker_history where study_plan_id = 9) <> 1
     or not exists (
       select 1
       from public.sticker_history
       where study_plan_id = 9
         and id = 3
         and family_id = default_family_id
         and member_id = hagyeom_member_id
         and sticker_count = 1
     )
     or exists (
       select 1
       from public.sticker_history
       group by study_plan_id
       having count(*) > 1
     ) then
    raise exception using
      errcode = 'P0001',
      message = '1B postflight failed: sticker history cleanup differs';
  end if;

  if (
    select count(*)
    from public.sticker_transactions
    where source_type = 'study_complete'
  ) <> 31
  or (
    select count(*)
    from public.sticker_transactions
    where source_type = 'study_complete'
      and source_id = '9'
      and member_id = hagyeom_member_id
      and family_id = default_family_id
      and transaction_type = 'earn'
      and amount = 1
  ) <> 1
  or (
    select coalesce(sum(sticker_transactions.amount), 0)
    from public.sticker_transactions
    where sticker_transactions.member_id = hagyeom_member_id
  ) <> 47 then
    raise exception using
      errcode = 'P0001',
      message = '1B postflight failed: sticker ledger changed';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger
    where pg_trigger.tgrelid = 'public.sticker_history'::regclass
      and pg_trigger.tgname = 'sync_study_sticker_transaction'
      and not pg_trigger.tgisinternal
      and pg_trigger.tgenabled = 'O'
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = '1B postflight failed: sticker ledger sync trigger not restored';
  end if;
end
$postflight$;

-- TODO(phase 3): after browser CRUD and legacy RPCs write explicit ownership,
-- enforce NOT NULL on required owner columns and replace unconditional RLS.
-- Defer sticker_history family/member NOT NULL for the same writer-compatibility
-- reason even though all verified existing rows currently have both values.
-- Do not revoke the existing create_book_plan or
-- complete_study_plan_and_reschedule grants until their callers are migrated.

notify pgrst, 'reload schema';

commit;
