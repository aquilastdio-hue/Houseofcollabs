-- Block Instagram ID even from rejected applications
--
-- Phone and email checks ignore rejected applications (allowing re-application),
-- but Instagram ID should be blocked even from rejected applications to prevent
-- the same person from re-applying with a different email.

begin;

-- Update instagram_is_registered to NOT exclude rejected applications
-- This means Instagram IDs from rejected applications will still be blocked
create or replace function private.instagram_is_registered(p_handle text, p_except_email text default null)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.normalize_instagram(p_handle) is not null
     and (
       exists (
         select 1 from public.applications a
         where private.normalize_instagram(a.social_handle) = private.normalize_instagram(p_handle)
           and (p_except_email is null or lower(a.email) <> lower(p_except_email))
       )
       or exists (
         select 1 from public.creator_social_accounts sa
         join public.creators c on c.id = sa.creator_id
         join public.profiles pr on pr.id = c.profile_id
         where sa.platform = 'instagram'
           and private.normalize_instagram(sa.username) = private.normalize_instagram(p_handle)
           and (p_except_email is null or lower(pr.email) <> lower(p_except_email))
       )
     );
$$;

comment on function private.instagram_is_registered(text, text) is
  'Check if an Instagram handle is already registered. Checks ALL applications (including rejected) and existing profiles.';

commit;
