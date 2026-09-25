-- =============================================================================
-- Spotlit · 0013 · Storage buckets + policies
--
-- Path conventions (first folder is what policies check):
--   avatars/{auth.uid}/{uuid}.{ext}                 public
--   creator-portfolio/{auth.uid}/{uuid}.{ext}       public
--   brand-assets/{auth.uid}/{uuid}.{ext}            public
--   brief-attachments/{brief_id}/{uuid}-{name}      private (signed URLs)
--   order-deliverables/{order_id}/{uuid}-{name}     private (signed URLs)
--   message-attachments/{conversation_id}/{uuid}-{name} private (signed URLs)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('creator-portfolio', 'creator-portfolio', true, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('brand-assets', 'brand-assets', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp',
          'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg']),
  ('brief-attachments', 'brief-attachments', false, 26214400,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'video/mp4', 'video/quicktime', 'video/webm', 'application/zip']),
  ('order-deliverables', 'order-deliverables', false, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm',
          'application/pdf', 'application/zip', 'text/plain']),
  ('message-attachments', 'message-attachments', false, 26214400,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'video/mp4', 'video/quicktime', 'video/webm', 'application/zip'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Owner-folder buckets (avatars, creator-portfolio, brand-assets)
-- Public reads happen through the public CDN URL; API select is owner-only so
-- buckets cannot be enumerated.
-- -----------------------------------------------------------------------------
create policy "avatars: owner can upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );
create policy "avatars: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "portfolio: creators upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-portfolio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.user_role()) = 'creator'
    and (select private.is_active_user())
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov')
  );
create policy "portfolio: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'creator-portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "portfolio: owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'creator-portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "portfolio: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'creator-portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "brand-assets: brands upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.user_role()) = 'brand'
    and (select private.is_active_user())
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'webm', 'mp3', 'm4a', 'mp4', 'wav', 'ogg')
  );
create policy "brand-assets: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "brand-assets: owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "brand-assets: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- -----------------------------------------------------------------------------
-- Private: brief attachments (brand writes; brand + assigned creator + admin read)
-- -----------------------------------------------------------------------------
create policy "brief-attachments: brand uploads to own brief" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brief-attachments'
    and private.owns_brief(private.try_uuid((storage.foldername(name))[1]))
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'doc', 'docx',
                                            'xls', 'xlsx', 'ppt', 'pptx', 'mp4', 'mov', 'webm', 'zip')
  );
create policy "brief-attachments: authorized read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'brief-attachments'
    and (private.can_view_brief(private.try_uuid((storage.foldername(name))[1])) or (select private.is_admin()))
  );
create policy "brief-attachments: brand deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'brief-attachments' and private.owns_brief(private.try_uuid((storage.foldername(name))[1])));

-- -----------------------------------------------------------------------------
-- Private: order deliverables / revision references / dispute evidence
-- -----------------------------------------------------------------------------
create policy "order-deliverables: participants upload to active orders" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'order-deliverables'
    and private.can_upload_order_file(private.try_uuid((storage.foldername(name))[1]))
    and (select private.is_active_user())
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'webm', 'pdf', 'zip', 'txt')
  );
create policy "order-deliverables: participants and admins read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'order-deliverables'
    and (private.can_view_order(private.try_uuid((storage.foldername(name))[1])) or (select private.is_admin()))
  );
create policy "order-deliverables: uploader removes unsubmitted files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'order-deliverables'
    and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
    and not exists (select 1 from public.order_deliverables d where d.storage_path = name)
  );

-- -----------------------------------------------------------------------------
-- Private: chat attachments (conversation participants only)
-- -----------------------------------------------------------------------------
create policy "message-attachments: participants upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and private.is_conversation_participant(private.try_uuid((storage.foldername(name))[1]))
    and (select private.is_active_user())
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'docx', 'xlsx',
                                            'pptx', 'mp4', 'mov', 'webm', 'zip')
  );
create policy "message-attachments: participants and admins read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (private.is_conversation_participant(private.try_uuid((storage.foldername(name))[1])) or (select private.is_admin()))
  );
create policy "message-attachments: uploader deletes" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
  );
