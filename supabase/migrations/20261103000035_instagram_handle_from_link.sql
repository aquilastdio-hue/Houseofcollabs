-- 0035 - Instagram stats: fetch the account the creator's link points to
--
-- The sign-up form asks for an Instagram ID (typed) and a profile link
-- (pasted). The weekly stats fetch used the typed ID, and 31 creators typed one
-- that isn't their account: a missing underscore ("Yashu_makeover" for
-- yashu__makeovers, a different person with 188 followers), their name, or a
-- phone number. Their pasted links are right, being copied from Instagram.
--
-- So the fetch now uses the account in the link when the link is a profile
-- link, and the typed ID otherwise (a link to one post, a reel or an invite
-- names no account). What the creator entered is not changed.

begin;

-- 'https://www.instagram.com/yashu__makeovers?igsh=...' → 'yashu__makeovers';
-- a post, reel, invite or other non-profile link → null.
create or replace function private.instagram_handle_from_link(p_link text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when p_link ilike '%instagram.com/%'
     and h ~ '^[a-z0-9._]{1,30}$'
     and h not in ('p', 'reel', 'reels', 'tv', 'stories', 'explore', 'invites', 'accounts',
                   'direct', 'share', 's', 'about', 'web', 'legal', 'developer')
    then h
  end
  from (select private.normalize_instagram(p_link) as h) x;
$$;

revoke execute on function private.instagram_handle_from_link(text) from public;

-- 0014's targets, reading the link first.
create or replace function public.instagram_stats_targets(p_creator_id uuid default null)
returns table (creator_id uuid, username text)
language sql
stable
security definer
set search_path to ''
as $$
  select distinct on (c.id) c.id,
         coalesce(private.instagram_handle_from_link(sa.profile_url), private.normalize_instagram(sa.username))
  from public.creators c
  join public.creator_social_accounts sa on sa.creator_id = c.id and sa.platform = 'instagram'
  where c.deleted_at is null
    and coalesce(private.instagram_handle_from_link(sa.profile_url), private.normalize_instagram(sa.username)) is not null
    and (case when p_creator_id is null then private.is_creator_public(c.id) else c.id = p_creator_id end)
  order by c.id, sa.created_at;
$$;

commit;
