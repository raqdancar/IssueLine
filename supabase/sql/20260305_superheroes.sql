-- SuperHero API cache table.
create table if not exists public.superheroes (
  api_id integer primary key,
  name text not null,
  slug text,
  full_name text,
  alignment text,
  publisher text,
  powerstats jsonb,
  appearance jsonb,
  biography jsonb,
  work jsonb,
  connections jsonb,
  images jsonb,
  raw jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists superheroes_publisher_idx on public.superheroes (publisher);
create index if not exists superheroes_alignment_idx on public.superheroes (alignment);

alter table public.superheroes enable row level security;

-- Allows any authenticated user to read the cache (optional).
drop policy if exists "Allow authenticated read" on public.superheroes;
create policy "Allow authenticated read" on public.superheroes
  for select
  to authenticated
  using (true);

-- Allows the public (anon) key to read the cache for the UI.
drop policy if exists "Allow public read" on public.superheroes;
create policy "Allow public read" on public.superheroes
  for select
  to public
  using (true);
