create table if not exists public.collected_editions (
  id uuid primary key default gen_random_uuid(),
  hero_api_id integer not null references public.superheroes(api_id) on delete cascade,
  title text not null,
  subtitle text,
  series_title text,
  print_language text,
  publisher text,
  publication_date text,
  cover_date text,
  description text,
  page_count integer,
  format text not null default 'unknown',
  cover_image_url text,
  source text not null default 'gcd',
  source_external_id text,
  source_series_id integer,
  isbn text,
  source_payload jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists collected_editions_hero_api_id_idx
  on public.collected_editions (hero_api_id);

create index if not exists collected_editions_source_external_id_idx
  on public.collected_editions (source_external_id)
  where source_external_id is not null;

alter table public.collected_editions enable row level security;

drop policy if exists "Collected editions service writes" on public.collected_editions;
create policy "Collected editions service writes" on public.collected_editions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Collected editions public read" on public.collected_editions;
create policy "Collected editions public read" on public.collected_editions
  for select
  to authenticated, public
  using (true);

create table if not exists public.collected_edition_issue_links (
  id uuid primary key default gen_random_uuid(),
  collected_edition_id uuid not null references public.collected_editions(id) on delete cascade,
  hero_issue_id uuid not null references public.hero_issues(id) on delete cascade,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (collected_edition_id, hero_issue_id)
);

create index if not exists collected_edition_issue_links_hero_issue_id_idx
  on public.collected_edition_issue_links (hero_issue_id);

alter table public.collected_edition_issue_links enable row level security;

drop policy if exists "Collected edition links service writes" on public.collected_edition_issue_links;
create policy "Collected edition links service writes" on public.collected_edition_issue_links
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Collected edition links public read" on public.collected_edition_issue_links;
create policy "Collected edition links public read" on public.collected_edition_issue_links
  for select
  to authenticated, public
  using (true);
