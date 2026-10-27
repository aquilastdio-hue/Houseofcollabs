-- 0014 - Public Instagram stats on creator profiles (via Apify)
--
-- Each live creator's public Instagram numbers — followers, posts, average
-- likes and comments, engagement rate, average Reel views, recent posts — are
-- read by the `instagram-stats` Edge Function using Apify's Instagram Profile
-- Scraper and stored here, one row per creator, for the storefront to show.
--
-- Public data only: what anyone can see on a public Instagram profile. Private
-- accounts get a row with status 'private' and no numbers.
--
-- Refreshed every Sunday (03:00 UTC = 08:30 IST) by pg_cron, which asks the
-- Edge Function to start one Apify run for every live creator; Apify calls the
-- function back when the run finishes. Admins can refresh one creator at any
-- time. The cron call reuses the vault secrets the email queue already uses
-- (`project_url`, `notification_webhook_secret`).

begin;

create table if not exists public.creator_instagram_stats (
  creator_id        uuid primary key references public.creators (id) on delete cascade,
  username          text not null,
  status            text not null default 'ok' check (status in ('ok', 'private', 'not_found', 'error')),
  followers_count   integer,
  follows_count     integer,
  posts_count       integer,
  is_verified       boolean,
  profile_pic_url   text,
  -- Averages over the recent posts Apify returned; null when none had the number.
  avg_likes         numeric,
  avg_comments      numeric,
  engagement_rate   numeric,          -- (avg likes + avg comments) ÷ followers, in %
  avg_reel_views    numeric,
  posts_sampled     integer not null default 0,
  reels_sampled     integer not null default 0,
  recent_posts      jsonb not null default '[]'::jsonb,
  last_error        text,
  fetched_at        timestamptz,
  updated_at        timestamptz not null default now()
);

comment on table public.creator_instagram_stats is
  'Public Instagram stats per creator, refreshed weekly from Apify by the instagram-stats Edge Function.';

alter table public.creator_instagram_stats enable row level security;

drop policy if exists "Live creators' Instagram stats are public" on public.creator_instagram_stats;
create policy "Live creators' Instagram stats are public" on public.creator_instagram_stats
  for select to anon, authenticated
  using (private.is_creator_public(creator_id) or (select private.is_admin()));

revoke all on public.creator_instagram_stats from anon, authenticated;
grant select on public.creator_instagram_stats to anon, authenticated;
grant all on public.creator_instagram_stats to service_role;

-- Copies of the recent-post thumbnails and profile picture. Instagram's own
-- image links expire within days and refuse to load on other sites, so the
-- function keeps its own copy: instagram-media/{creator_id}/{shortcode}.jpg.
-- Public reads through the CDN URL; only the service role writes (no policies).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('instagram-media', 'instagram-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------- service-role helpers --

-- Who to fetch: live creators with an Instagram username, or just one.
create or replace function public.instagram_stats_targets(p_creator_id uuid default null)
returns table (creator_id uuid, username text)
language sql
stable
security definer
set search_path to ''
as $$
  select distinct on (c.id) c.id, private.normalize_instagram(sa.username)
  from public.creators c
  join public.creator_social_accounts sa on sa.creator_id = c.id and sa.platform = 'instagram'
  where c.deleted_at is null
    and private.normalize_instagram(sa.username) is not null
    and (case when p_creator_id is null then private.is_creator_public(c.id) else c.id = p_creator_id end)
  order by c.id, sa.created_at;
$$;

-- Writes a batch of computed rows (one per creator), replacing what was there.
create or replace function public.instagram_stats_upsert(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_count integer;
begin
  insert into public.creator_instagram_stats as s (
    creator_id, username, status, followers_count, follows_count, posts_count, is_verified,
    profile_pic_url, avg_likes, avg_comments, engagement_rate, avg_reel_views,
    posts_sampled, reels_sampled, recent_posts, last_error, fetched_at, updated_at
  )
  select (r ->> 'creator_id')::uuid, r ->> 'username', coalesce(r ->> 'status', 'ok'),
         (r ->> 'followers_count')::integer, (r ->> 'follows_count')::integer, (r ->> 'posts_count')::integer,
         (r ->> 'is_verified')::boolean, r ->> 'profile_pic_url',
         (r ->> 'avg_likes')::numeric, (r ->> 'avg_comments')::numeric, (r ->> 'engagement_rate')::numeric,
         (r ->> 'avg_reel_views')::numeric,
         coalesce((r ->> 'posts_sampled')::integer, 0), coalesce((r ->> 'reels_sampled')::integer, 0),
         coalesce(r -> 'recent_posts', '[]'::jsonb), r ->> 'last_error', now(), now()
  from jsonb_array_elements(p_rows) r
  where exists (select 1 from public.creators c where c.id = (r ->> 'creator_id')::uuid)
  on conflict (creator_id) do update
    set username = excluded.username, status = excluded.status,
        followers_count = excluded.followers_count, follows_count = excluded.follows_count,
        posts_count = excluded.posts_count, is_verified = excluded.is_verified,
        profile_pic_url = excluded.profile_pic_url, avg_likes = excluded.avg_likes,
        avg_comments = excluded.avg_comments, engagement_rate = excluded.engagement_rate,
        avg_reel_views = excluded.avg_reel_views, posts_sampled = excluded.posts_sampled,
        reels_sampled = excluded.reels_sampled, recent_posts = excluded.recent_posts,
        last_error = excluded.last_error, fetched_at = excluded.fetched_at, updated_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.instagram_stats_targets(uuid) from public, anon, authenticated;
revoke execute on function public.instagram_stats_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.instagram_stats_targets(uuid) to service_role;
grant execute on function public.instagram_stats_upsert(jsonb) to service_role;

-- ------------------------------------------------------- weekly refresh --

create or replace function private.request_instagram_stats_refresh()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    raise warning 'instagram stats refresh skipped: pg_net or vault missing';
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_url using 'project_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_secret using 'notification_webhook_secret';
  if v_url is null or v_secret is null then
    raise warning 'instagram stats refresh skipped: vault secrets project_url / notification_webhook_secret not set';
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
    using rtrim(v_url, '/') || '/functions/v1/instagram-stats',
          jsonb_build_object('action', 'refresh-all'),
          jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
exception when others then
  raise warning 'instagram stats refresh failed: %', sqlerrm;
end;
$$;

-- Each call starts a paid Apify run: only the cron job (as postgres) may.
revoke execute on function private.request_instagram_stats_refresh() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.unschedule(jobid) from cron.job where jobname = 'house-of-collabs-instagram-stats';
    perform cron.schedule('house-of-collabs-instagram-stats', '0 3 * * 0', 'select private.request_instagram_stats_refresh()');
  else
    raise notice 'pg_cron not available: call private.request_instagram_stats_refresh() weekly another way.';
  end if;
exception when others then
  raise notice 'instagram stats cron setup skipped: %', sqlerrm;
end;
$$;

commit;
