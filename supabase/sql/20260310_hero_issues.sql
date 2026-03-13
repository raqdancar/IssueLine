create table if not exists public.hero_issues (
  id uuid primary key default gen_random_uuid(),
  hero_api_id integer not null references public.superheroes(api_id) on delete cascade,
  gcd_issue_id integer not null,
  series_id integer,
  series_name text,
  number text,
  volume text,
  title text,
  key_date text,
  on_sale_date date,
  publication_date text,
  issue_date date,
  price text,
  page_count text,
  cover text,
  cover_original text,
  cover_image_path text,
  raw jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (hero_api_id, gcd_issue_id)
);

create index if not exists hero_issues_hero_api_id_idx on public.hero_issues (hero_api_id);
create index if not exists hero_issues_gcd_issue_id_idx on public.hero_issues (gcd_issue_id);

create or replace function public.set_hero_issues_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_hero_issues_updated_at on public.hero_issues;
create trigger trg_set_hero_issues_updated_at
before update on public.hero_issues
for each row execute procedure public.set_hero_issues_updated_at();

alter table public.hero_issues enable row level security;

drop policy if exists "Hero issues service writes" on public.hero_issues;
create policy "Hero issues service writes" on public.hero_issues
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Hero issues public read" on public.hero_issues;
create policy "Hero issues public read" on public.hero_issues
  for select
  to authenticated, public
  using (true);


