create table if not exists public.hero_images (
  id uuid primary key default gen_random_uuid(),
  hero_api_id integer not null references public.superheroes(api_id) on delete cascade,
  variant text not null default 'default',
  alt text,
  storage_path text not null unique,
  public_url text,
  width integer,
  height integer,
  size_bytes integer,
  content_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists hero_images_hero_api_id_idx on public.hero_images (hero_api_id);
create index if not exists hero_images_is_active_idx on public.hero_images (is_active);

create or replace function public.set_hero_images_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_hero_images_updated_at on public.hero_images;
create trigger trg_set_hero_images_updated_at
before update on public.hero_images
for each row execute procedure public.set_hero_images_updated_at();

alter table public.hero_images enable row level security;

drop policy if exists "Hero images service writes" on public.hero_images;
create policy "Hero images service writes" on public.hero_images
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Hero images public read" on public.hero_images;
create policy "Hero images public read" on public.hero_images
  for select
  to public, authenticated
  using (is_active is true);
