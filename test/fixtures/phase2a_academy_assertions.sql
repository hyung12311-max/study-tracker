\set ON_ERROR_STOP on

insert into public.family_members (id, family_id, role, is_active) values
  ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'parent', true),
  ('10000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'child', true),
  ('10000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'child', true),
  ('10000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'child', false),
  ('20000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'parent', true),
  ('20000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'child', true);

insert into public.academy_schedules (
  id, academy_name, day_of_week, start_time, memo, star_count,
  family_id, assigned_member_id, created_by_member_id
) values
  (
    '30000000-0000-4000-8000-000000000001',
    'legacy one',
    1,
    '17:00',
    null,
    1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000002',
    null
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'legacy two',
    3,
    '18:00',
    null,
    1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000002',
    null
  );

do $legacy_completions$
begin
  perform public.complete_academy_schedule(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    date '2026-07-28'
  );
  perform public.complete_academy_schedule(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    date '2026-07-28'
  );
end
$legacy_completions$;

do $academy_assertions$
declare
  created public.academy_schedules%rowtype;
  completed public.academy_completion_history%rowtype;
  error_code text;
begin
  created := public.create_academy_schedule_for_assignee(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    'new schedule',
    5,
    '19:00',
    'memo',
    1
  );

  if created.family_id
       is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
     or created.assigned_member_id
       is distinct from '10000000-0000-4000-8000-000000000003'::uuid
     or created.created_by_member_id
       is distinct from '10000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'new academy ownership was not recorded atomically';
  end if;

  begin
    perform public.update_academy_schedule_for_assignee(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      created.id,
      'attack',
      1,
      '10:00',
      '',
      1
    );
    raise exception 'cross-child update unexpectedly succeeded';
  exception
    when sqlstate 'P0002' then null;
  end;

  perform public.update_academy_schedule_for_assignee(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    created.id,
    'updated schedule',
    6,
    '20:00',
    '',
    1
  );

  if exists (
    select 1
    from public.academy_schedules schedules
    where schedules.id = created.id
      and (
        schedules.family_id
          is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
        or schedules.assigned_member_id
          is distinct from '10000000-0000-4000-8000-000000000003'::uuid
        or schedules.created_by_member_id
          is distinct from '10000000-0000-4000-8000-000000000001'::uuid
      )
  ) then
    raise exception 'academy update changed ownership';
  end if;

  begin
    perform public.delete_academy_schedule_for_assignee(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000001'
    );
    raise exception 'completed academy schedule deletion unexpectedly succeeded';
  exception
    when sqlstate 'P0003' then null;
  end;

  completed := public.complete_academy_schedule_for_assignee(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    created.id,
    date '2026-07-29'
  );
  completed := public.complete_academy_schedule_for_assignee(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    created.id,
    date '2026-07-29'
  );

  if (
    select count(*)
    from public.academy_completion_history completions
    where completions.family_id
      = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      and completions.member_id
        = '10000000-0000-4000-8000-000000000003'::uuid
      and completions.academy_schedule_id = created.id
      and completions.completed_date = date '2026-07-29'
  ) <> 1 then
    raise exception 'duplicate academy completion was created';
  end if;

  if (
    select count(*)
    from public.sticker_transactions transactions
    where transactions.family_id
      = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      and transactions.member_id
        = '10000000-0000-4000-8000-000000000003'::uuid
      and transactions.source_type = 'academy_complete'
      and transactions.source_id = completed.id::text
  ) <> 1 then
    raise exception 'duplicate academy reward ledger row was created';
  end if;

  begin
    perform public.complete_academy_schedule_for_assignee(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000003',
      '30000000-0000-4000-8000-000000000001',
      date '2026-07-29'
    );
    raise exception 'cross-child completion unexpectedly succeeded';
  exception
    when sqlstate 'P0002' then null;
  end;

  begin
    perform public.create_academy_schedule_for_assignee(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000004',
      'inactive child',
      1,
      '10:00',
      '',
      1
    );
    raise exception 'inactive-child creation unexpectedly succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.create_academy_schedule_for_assignee(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      'other family',
      1,
      '10:00',
      '',
      1
    );
    raise exception 'cross-family creation unexpectedly succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  if (
    select count(*)
    from public.academy_schedules schedules
    where schedules.created_by_member_id is null
  ) <> 2 then
    raise exception 'legacy creator-null schedules changed';
  end if;

  delete from public.academy_completion_history
  where academy_schedule_id = created.id;
  delete from public.sticker_transactions
  where source_type = 'academy_complete'
    and source_id = completed.id::text;

  if public.delete_academy_schedule_for_assignee(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    created.id
  ) is distinct from created.id then
    raise exception 'uncompleted academy schedule deletion failed';
  end if;
end
$academy_assertions$;
