-- Atomically records Dayul's 20-question Hangul completion and awards 2 wallet stickers.
-- Additive only: no historical Hangul sessions are backfilled and no existing ledger rows are changed.

begin;

create table if not exists public.hangul_daily_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  member_id uuid not null references public.family_members(id),
  study_date date not null,
  target_count smallint not null,
  completed_count smallint not null,
  session_id text not null,
  result_summary jsonb not null,
  sticker_count smallint not null default 2,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint hangul_daily_completions_member_date_key unique (member_id, study_date),
  constraint hangul_daily_completions_member_session_key unique (member_id, session_id),
  constraint hangul_daily_completions_target_check check (target_count = 20),
  constraint hangul_daily_completions_completed_check check (completed_count = 20),
  constraint hangul_daily_completions_sticker_check check (sticker_count = 2),
  constraint hangul_daily_completions_session_check check (
    char_length(session_id) between 16 and 160
    and session_id ~ '^[A-Za-z0-9._:+-]+$'
  ),
  constraint hangul_daily_completions_summary_check check (
    jsonb_typeof(result_summary) = 'object'
    and result_summary ? 'questionCount'
    and result_summary ? 'completedQuestionIds'
    and (result_summary ->> 'questionCount')::integer = 20
    and jsonb_typeof(result_summary -> 'completedQuestionIds') = 'array'
    and jsonb_array_length(result_summary -> 'completedQuestionIds') = 20
  )
);

create index if not exists hangul_daily_completions_family_date_idx
  on public.hangul_daily_completions (family_id, study_date desc);

alter table public.hangul_daily_completions enable row level security;
revoke all on table public.hangul_daily_completions from public, anon, authenticated;
grant select, insert, update, delete on table public.hangul_daily_completions to service_role;

create or replace function public.complete_hangul_daily_with_reward(
  p_family_id uuid,
  p_member_id uuid,
  p_study_date date,
  p_target_count integer,
  p_completed_count integer,
  p_session_id text,
  p_result_summary jsonb
)
returns table (
  success boolean,
  already_completed boolean,
  completion_id uuid,
  sticker_awarded integer,
  study_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  completion_row public.hangul_daily_completions%rowtype;
begin
  if p_study_date is null or p_study_date <> (now() at time zone 'Asia/Seoul')::date then
    raise exception using errcode = '22023', message = 'study date must be today in Asia/Seoul';
  end if;
  if p_target_count <> 20 or p_completed_count <> 20 then
    raise exception using errcode = '22023', message = 'exactly 20 questions are required';
  end if;
  if p_session_id is null
     or char_length(p_session_id) not between 16 and 160
     or p_session_id !~ '^[A-Za-z0-9._:+-]+$' then
    raise exception using errcode = '22023', message = 'invalid session id';
  end if;
  if p_result_summary is null
     or jsonb_typeof(p_result_summary) <> 'object'
     or coalesce((p_result_summary ->> 'questionCount')::integer, 0) <> 20
     or jsonb_typeof(p_result_summary -> 'completedQuestionIds') <> 'array'
     or jsonb_array_length(p_result_summary -> 'completedQuestionIds') <> 20 then
    raise exception using errcode = '22023', message = 'invalid result summary';
  end if;

  perform 1
  from public.family_members
  where id = p_member_id
    and family_id = p_family_id
    and member_key = 'dayul'
    and role = 'child'
    and is_active = true
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'active Dayul child member is required';
  end if;

  insert into public.hangul_daily_completions (
    family_id, member_id, study_date, target_count, completed_count,
    session_id, result_summary, sticker_count, completed_at
  ) values (
    p_family_id, p_member_id, p_study_date, 20, 20,
    p_session_id, p_result_summary, 2, now()
  )
  on conflict do nothing
  returning * into completion_row;

  if completion_row.id is null then
    select completions.* into completion_row
    from public.hangul_daily_completions completions
    where completions.member_id = p_member_id
      and (completions.study_date = p_study_date or completions.session_id = p_session_id)
    order by case when completions.study_date = p_study_date then 0 else 1 end
    limit 1;
    if completion_row.id is null then
      raise exception using errcode = '40001', message = 'completion conflict could not be resolved';
    end if;
    return query select true, true, completion_row.id, 0, completion_row.study_date;
    return;
  end if;

  insert into public.sticker_transactions (
    family_id, member_id, amount, transaction_type,
    source_type, source_id, description, metadata
  ) values (
    p_family_id, p_member_id, 2, 'earn',
    'hangul_daily_complete', completion_row.id::text,
    '다율이 한글 놀이터 오늘의 20문제 완료',
    jsonb_build_object(
      'completion_id', completion_row.id,
      'study_date', completion_row.study_date,
      'session_id', completion_row.session_id
    )
  );

  return query select true, false, completion_row.id, 2, completion_row.study_date;
end;
$$;

revoke all on function public.complete_hangul_daily_with_reward(uuid, uuid, date, integer, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_hangul_daily_with_reward(uuid, uuid, date, integer, integer, text, jsonb)
  to service_role;

notify pgrst, 'reload schema';

commit;
