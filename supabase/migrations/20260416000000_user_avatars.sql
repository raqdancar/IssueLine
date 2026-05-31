-- Private avatar bucket used by the account page.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Avatar owners can read" on storage.objects;
create policy "Avatar owners can read" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar owners can upload" on storage.objects;
create policy "Avatar owners can upload" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar owners can update" on storage.objects;
create policy "Avatar owners can update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar owners can delete" on storage.objects;
create policy "Avatar owners can delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
