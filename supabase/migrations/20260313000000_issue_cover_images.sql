alter table if exists public.hero_issues
  add column if not exists cover_image_path text;

comment on column public.hero_issues.cover_image_path is 'Relative path for the cover stored in the issue-images bucket.';
