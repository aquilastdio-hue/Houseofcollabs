-- =============================================================================
-- House of Collabs · 0026 · drop TikTok, add X and Threads
-- =============================================================================
-- TikTok has been unavailable in India since 2020, so it was dead weight in
-- every platform picker. X and Threads are where this marketplace's creators
-- actually post.
--
-- Postgres cannot remove a label from an enum in place, so the type is swapped:
-- rename the old one, create the new one, retype the columns through `text`,
-- drop the old. Verified dependencies first — three columns and two indexes,
-- no views, functions or defaults:
--
--   creator_social_accounts.platform  (not null)
--   creator_services.platform
--   portfolio_items.platform
--   creator_social_accounts_creator_id_platform_username_key  (rebuilt)
--   creator_social_accounts_platform_idx                      (rebuilt)
--
-- The live database holds zero 'tiktok' rows, and neither does the seed. The
-- remap below is for any other environment: without it the cast would fail
-- with "invalid input value", which is the right failure but an unhelpful one.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Nothing may still say 'tiktok' when the type is replaced.
-- -----------------------------------------------------------------------------
do $$
declare
  v_accounts int;
begin
  -- A creator could already have an 'other' row under the same handle, and
  -- (creator_id, platform, username) is unique — drop the duplicate instead of
  -- failing the migration.
  delete from public.creator_social_accounts a
  where a.platform = 'tiktok'
    and exists (
      select 1 from public.creator_social_accounts b
      where b.creator_id = a.creator_id and b.platform = 'other' and b.username = a.username
    );

  update public.creator_social_accounts set platform = 'other' where platform = 'tiktok';
  get diagnostics v_accounts = row_count;

  update public.creator_services set platform = null where platform = 'tiktok';
  update public.portfolio_items set platform = null where platform = 'tiktok';

  if v_accounts > 0 then
    raise notice 'Moved % TikTok account(s) to "Other".', v_accounts;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Swap the type.
-- -----------------------------------------------------------------------------
alter type public.social_platform rename to social_platform_v1;

create type public.social_platform as enum ('instagram', 'youtube', 'x', 'threads', 'facebook', 'other');

alter table public.creator_social_accounts
  alter column platform type public.social_platform using platform::text::public.social_platform;
alter table public.creator_services
  alter column platform type public.social_platform using platform::text::public.social_platform;
alter table public.portfolio_items
  alter column platform type public.social_platform using platform::text::public.social_platform;

drop type public.social_platform_v1;

comment on type public.social_platform is
  'Where a creator posts. TikTok was removed in 0026 (unavailable in India); X and Threads added.';
