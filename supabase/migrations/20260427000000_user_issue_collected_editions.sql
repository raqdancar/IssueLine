create table if not exists public.user_issue_collected_editions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_id uuid not null references public.hero_timelines(id) on delete cascade,
  collected_edition_id uuid not null references public.collected_editions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, issue_id, collected_edition_id)
);

create index if not exists user_issue_collected_editions_user_issue_idx
  on public.user_issue_collected_editions (user_id, issue_id);

create index if not exists user_issue_collected_editions_user_edition_idx
  on public.user_issue_collected_editions (user_id, collected_edition_id);

create or replace function public.set_user_issue_collected_editions_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_user_issue_collected_editions_updated_at on public.user_issue_collected_editions;
create trigger trg_set_user_issue_collected_editions_updated_at
before update on public.user_issue_collected_editions
for each row execute procedure public.set_user_issue_collected_editions_updated_at();

alter table public.user_issue_collected_editions enable row level security;

drop policy if exists "Issue collected editions service writes" on public.user_issue_collected_editions;
create policy "Issue collected editions service writes" on public.user_issue_collected_editions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Issue collected editions own read" on public.user_issue_collected_editions;
create policy "Issue collected editions own read" on public.user_issue_collected_editions
  for select
  to authenticated
  using (auth.uid() = user_id);

