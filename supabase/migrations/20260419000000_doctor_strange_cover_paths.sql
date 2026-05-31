-- Doctor Strange cover path migration to hero-scoped folder structure.
-- Target structure:
--   covers/doctor-strange/<existing-subpath-or-file>
--
-- This script updates:
-- 1) hero_issues.cover_image_path
-- 2) hero_timelines.metadata.cover_image_path / coverImagePath
-- 3) hero_timelines.metadata.cover (public URL) when it follows Supabase object/public URL shape.
--
-- Run inside Supabase SQL editor.

begin;

-- 0) Resolve Doctor Strange hero id.
with doctor_strange as (
  select api_id
  from public.superheroes
  where slug = 'doctor-strange'
  order by api_id
  limit 1
)
-- 1) Update hero_issues cover paths.
update public.hero_issues hi
set cover_image_path = case
  when hi.cover_image_path is null or btrim(hi.cover_image_path) = '' then hi.cover_image_path
  when hi.cover_image_path like 'covers/doctor-strange/%' then hi.cover_image_path
  when hi.cover_image_path like 'covers/%' then regexp_replace(hi.cover_image_path, '^covers/', 'covers/doctor-strange/')
  when hi.cover_image_path like 'doctor-strange/%' then 'covers/' || hi.cover_image_path
  else 'covers/doctor-strange/' || regexp_replace(hi.cover_image_path, '^/+','')
end
from doctor_strange ds
where hi.hero_api_id = ds.api_id
  and hi.cover_image_path is not null
  and btrim(hi.cover_image_path) <> '';

-- 2) Sync hero_timelines metadata cover paths from hero_issues by gcd issue id.
with doctor_strange as (
  select api_id
  from public.superheroes
  where slug = 'doctor-strange'
  order by api_id
  limit 1
),
timeline_map as (
  select
    ht.id as timeline_id,
    ht.metadata,
    hi.cover_image_path as new_cover_path
  from public.hero_timelines ht
  join doctor_strange ds
    on ht.hero_api_id = ds.api_id
  join public.hero_issues hi
    on hi.hero_api_id = ht.hero_api_id
   and hi.gcd_issue_id = coalesce(
     nullif(ht.metadata->>'gcdIssueId', '')::int,
     nullif(ht.metadata->>'gcd_issue_id', '')::int
   )
  where hi.cover_image_path is not null
    and btrim(hi.cover_image_path) <> ''
)
update public.hero_timelines ht
set metadata =
  case
    when tm.metadata ? 'cover'
      and (tm.metadata->>'cover') ~ '/object/public/[^/]+/' then
      jsonb_set(
        jsonb_set(
          jsonb_set(tm.metadata, '{cover_image_path}', to_jsonb(tm.new_cover_path), true),
          '{coverImagePath}', to_jsonb(tm.new_cover_path), true
        ),
        '{cover}',
        to_jsonb(
          regexp_replace(
            tm.metadata->>'cover',
            '(/object/public/[^/]+/).*',
            '\1' || tm.new_cover_path
          )
        ),
        true
      )
    else
      jsonb_set(
        jsonb_set(tm.metadata, '{cover_image_path}', to_jsonb(tm.new_cover_path), true),
        '{coverImagePath}', to_jsonb(tm.new_cover_path), true
      )
  end
from timeline_map tm
where ht.id = tm.timeline_id;

commit;

-- Verification helpers:
-- 1) Check issue paths
-- select cover_image_path, count(*)
-- from public.hero_issues hi
-- join public.superheroes s on s.api_id = hi.hero_api_id
-- where s.slug = 'doctor-strange'
-- group by cover_image_path
-- order by cover_image_path;
--
-- 2) Check timeline metadata paths
-- select
--   metadata->>'cover_image_path' as cover_image_path,
--   metadata->>'coverImagePath' as coverImagePath,
--   count(*)
-- from public.hero_timelines ht
-- join public.superheroes s on s.api_id = ht.hero_api_id
-- where s.slug = 'doctor-strange'
-- group by 1, 2
-- order by 1 nulls last, 2 nulls last;

