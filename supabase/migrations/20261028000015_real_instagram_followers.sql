-- 0015 - Follower counts come from Instagram, not the sign-up form
--
-- `creators.followers_count` is what every public page shows: the profile
-- header, creator cards, compare, and the follower filters and sorting in
-- search. It used to be the sum of the numbers creators typed in for their
-- social accounts, so it drifted from the real Instagram figure on the Stats
-- tab (and could be rounded up or simply wrong).
--
-- Now, once the weekly Apify fetch has a real Instagram count for a creator,
-- that number *is* their follower count. The typed-in numbers are only used
-- until the first fetch (or for a profile Instagram couldn't find), and a
-- creator editing their social accounts can no longer override a real count.

begin;

create or replace function private.refresh_creator_followers(p_creator_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.creators c
  set followers_count = coalesce(
    (select s.followers_count
       from public.creator_instagram_stats s
      where s.creator_id = p_creator_id
        and s.status in ('ok', 'private')
        and s.followers_count is not null),
    (select sum(a.followers_count)::int from public.creator_social_accounts a where a.creator_id = p_creator_id),
    0)
  where c.id = p_creator_id;
$$;

-- Every fetch (weekly, or an admin's "Refresh now") updates the count at once.
create or replace function private.instagram_stats_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.refresh_creator_followers(new.creator_id);
  return null;
end;
$$;

revoke execute on function private.instagram_stats_after_change() from public, anon, authenticated;

drop trigger if exists creator_instagram_stats_followers on public.creator_instagram_stats;
create trigger creator_instagram_stats_followers
  after insert or update of followers_count, status on public.creator_instagram_stats
  for each row execute function private.instagram_stats_after_change();

-- Creators already fetched switch to their real count now.
select private.refresh_creator_followers(creator_id) from public.creator_instagram_stats;

commit;
