-- 0032 - Admin removes a creator's or brand's profile picture
--
-- On a creator's or brand's admin page the picture opens full screen, and its
-- ⋮ menu deletes it. `admin_remove_profile_photo` clears it (a creator's
-- storefront photo, a brand's logo, and the account avatar when it's the same
-- image), records it in the audit log, and marks the account with
-- `photo_removed_at`. The app then deletes the file from storage.
--
-- A FILE CAN BE SHARED. Approval makes a creator's first portfolio photo their
-- profile picture, so the two can be the same file. Only files nothing else
-- uses any more are handed back for deletion; a post keeps its photo.
--
-- THE NOTICE. While `photo_removed_at` is set, the creator or brand sees a
-- message asking for a new picture whenever they open their dashboard.
-- Uploading one clears it. People can read the column but not change it
-- (profiles updates are a column grant, 0012).
--
-- Storage only let people delete files in their own folder, so admins get
-- read and delete on the three buckets these pictures live in.

begin;

alter table public.profiles add column if not exists photo_removed_at timestamptz;

comment on column public.profiles.photo_removed_at is
  'When an admin removed this account''s profile picture. Set until a new one is uploaded; the dashboard asks for one meanwhile.';

-- Is anything still showing this file?
create or replace function private.file_in_use(p_url text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.portfolio_items p where p.media_url = p_url or p.thumbnail_url = p_url)
      or exists (select 1 from public.creators c where c.profile_image_url = p_url or c.cover_image_url = p_url or c.intro_video_url = p_url)
      or exists (select 1 from public.profiles pr where pr.avatar_url = p_url)
      or exists (select 1 from public.brands b where b.brand_logo_url = p_url);
$$;

create or replace function public.admin_remove_profile_photo(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_role public.user_role;
  v_avatar text;
  v_photo text;
  v_unused text[];
begin
  select p.role, p.avatar_url into v_role, v_avatar from public.profiles p where p.id = p_profile_id for update;
  if not found then
    raise exception 'Account not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  if v_role = 'creator' then
    select c.profile_image_url into v_photo from public.creators c where c.profile_id = p_profile_id;
    update public.creators set profile_image_url = null where profile_id = p_profile_id;
  elsif v_role = 'brand' then
    select b.brand_logo_url into v_photo from public.brands b where b.profile_id = p_profile_id;
    update public.brands set brand_logo_url = null where profile_id = p_profile_id;
  else
    raise exception 'Only creators and brands have a profile picture here.' using errcode = 'P0001', hint = 'BAD_ROLE';
  end if;
  if v_photo is null then
    raise exception 'There is no profile picture to remove.' using errcode = 'P0001', hint = 'NO_PHOTO';
  end if;

  update public.profiles
  set avatar_url = case when avatar_url = v_photo then null else avatar_url end,
      photo_removed_at = now()
  where id = p_profile_id;

  select coalesce(array_agg(u), '{}'::text[]) into v_unused
  from unnest(array[v_photo]) u
  where not private.file_in_use(u);

  perform private.audit('profile_photo_removed', 'profile', p_profile_id::text,
    jsonb_build_object('role', v_role, 'photo_url', v_photo, 'file_deleted', cardinality(v_unused) > 0), v_admin, 'admin');
  return jsonb_build_object('photo_url', v_photo, 'delete_files', to_jsonb(v_unused));
end;
$$;

revoke execute on function public.admin_remove_profile_photo(uuid) from public, anon;
grant execute on function public.admin_remove_profile_photo(uuid) to authenticated;
revoke execute on function private.file_in_use(text) from public;

-- A new picture ends the notice.
create or replace function private.clear_photo_removed()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.profiles set photo_removed_at = null
  where id = new.profile_id and photo_removed_at is not null;
  return null;
end;
$$;

drop trigger if exists creators_clear_photo_removed on public.creators;
create trigger creators_clear_photo_removed
  after update of profile_image_url on public.creators
  for each row
  when (new.profile_image_url is not null and new.profile_image_url is distinct from old.profile_image_url)
  execute function private.clear_photo_removed();

drop trigger if exists brands_clear_photo_removed on public.brands;
create trigger brands_clear_photo_removed
  after update of brand_logo_url on public.brands
  for each row
  when (new.brand_logo_url is not null and new.brand_logo_url is distinct from old.brand_logo_url)
  execute function private.clear_photo_removed();

-- Admins may read and delete files in the buckets profile pictures live in.
drop policy if exists "pictures: admins can read" on storage.objects;
create policy "pictures: admins can read" on storage.objects
  for select to authenticated
  using (bucket_id in ('avatars', 'brand-assets', 'creator-portfolio') and (select private.is_admin()));

drop policy if exists "pictures: admins can delete" on storage.objects;
create policy "pictures: admins can delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'brand-assets', 'creator-portfolio') and (select private.is_admin()));

commit;
