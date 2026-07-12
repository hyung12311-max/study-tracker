-- Initial learning screen: status/date filtering and ordering.
create index if not exists study_plans_status_date_idx on public.study_plans (status, study_date);

-- Recent sticker history lookup.
create index if not exists sticker_history_created_at_idx on public.sticker_history (created_at desc);

-- Today's academy schedule ordering.
create index if not exists academy_schedules_day_time_idx on public.academy_schedules (day_of_week, start_time);

-- Recent academy completions used by the sticker summary.
create index if not exists academy_completion_date_idx on public.academy_completion_history (completed_date desc, academy_schedule_id);
