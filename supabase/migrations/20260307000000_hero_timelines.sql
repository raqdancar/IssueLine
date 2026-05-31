create table if not exists public.hero_timelines (
  id uuid primary key default gen_random_uuid(),
  hero_api_id integer not null references public.superheroes(api_id) on delete cascade,
  headline text not null,
  summary text,
  issue_code text,
  issue_date date not null,
  source_url text,
  severity text not null default 'info',
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists hero_timelines_hero_api_id_issue_date_idx
  on public.hero_timelines (hero_api_id, issue_date desc);

create or replace function public.set_hero_timelines_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_hero_timelines_updated_at on public.hero_timelines;
create trigger trg_set_hero_timelines_updated_at
before update on public.hero_timelines
for each row execute procedure public.set_hero_timelines_updated_at();

alter table public.hero_timelines enable row level security;

drop policy if exists "Hero timelines service writes" on public.hero_timelines;
create policy "Hero timelines service writes" on public.hero_timelines
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Hero timelines public read" on public.hero_timelines;
create policy "Hero timelines public read" on public.hero_timelines
  for select
  to authenticated, public
  using (true);
