-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 — Storage buckets for avatars + screenshots
--
-- Two public-read buckets on Supabase Storage:
--   • avatars      — profile avatar images ({profileId}.jpg)
--   • screenshots  — proof-of-work screenshots ({profileId}/{id}.jpg + _preview.jpg)
--
-- Public-read so anyone viewing a profile can load the images without auth.
-- Write access is restricted to authenticated users via RLS policies so
-- only the operator (via the dashboard) can upload/overwrite their own files.
-- ═══════════════════════════════════════════════════════════════════════════

-- Create the buckets (public = anyone can read via the public URL)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

-- ─── RLS policies: avatars ──────────────────────────────────────────────

-- Anyone can read (public bucket)
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar (service role bypasses this)
create policy "avatars_auth_insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Authenticated users can update/overwrite their own avatar
create policy "avatars_auth_update"
  on storage.objects for update
  using (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Authenticated users can delete their own avatar
create policy "avatars_auth_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- ─── RLS policies: screenshots ──────────────────────────────────────────

-- Anyone can read (public bucket)
create policy "screenshots_public_read"
  on storage.objects for select
  using (bucket_id = 'screenshots');

-- Authenticated users can upload screenshots
create policy "screenshots_auth_insert"
  on storage.objects for insert
  with check (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

-- Authenticated users can update/overwrite screenshots
create policy "screenshots_auth_update"
  on storage.objects for update
  using (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

-- Authenticated users can delete screenshots
create policy "screenshots_auth_delete"
  on storage.objects for delete
  using (bucket_id = 'screenshots' AND auth.role() = 'authenticated');
