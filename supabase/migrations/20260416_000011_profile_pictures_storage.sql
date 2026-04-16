begin;

-- Supabase Storage setup note: The 'avatars' bucket must be created via the Supabase dashboard UI
-- or via a call to the management API. SQL migrations cannot create buckets directly.
-- After applying this migration, manually create a public bucket named 'avatars' in Storage settings,
-- then the RLS policies below will apply automatically.

drop policy if exists "Users can upload avatar images" on storage.objects;
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;

-- RLS Policy: Allow authenticated users to upload to their own folder
create policy "Users can upload avatar images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Allow anyone (public read) to view avatars
create policy "Avatar images are publicly accessible"
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- RLS Policy: Allow users to delete their own avatars
create policy "Users can delete their own avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
