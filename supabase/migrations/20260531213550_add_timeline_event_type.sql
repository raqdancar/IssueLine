alter table public.hero_timelines
  add column if not exists event_type text;

-- Keep imported comics navigable while classifying editorial rows without a
-- canonical issue identifier as milestones.
update public.hero_timelines
set event_type = case
  when hero_issue_id is not null then 'issue'
  when coalesce(metadata ->> 'gcdIssueId', metadata ->> 'gcd_issue_id') ~ '^[0-9]+$' then 'issue'
  when coalesce(metadata ->> 'metronIssueId', metadata ->> 'metron_issue_id') ~ '^[0-9]+$' then 'issue'
  else 'milestone'
end
where event_type is null;

alter table public.hero_timelines
  alter column event_type set default 'milestone',
  alter column event_type set not null;

alter table public.hero_timelines
  drop constraint if exists hero_timelines_event_type_check;

alter table public.hero_timelines
  add constraint hero_timelines_event_type_check
  check (event_type in ('issue', 'milestone'));

create index if not exists hero_timelines_hero_api_id_event_type_idx
  on public.hero_timelines (hero_api_id, event_type);

comment on column public.hero_timelines.event_type is
  'Explicit timeline row type: imported comic issue or editorial milestone.';
