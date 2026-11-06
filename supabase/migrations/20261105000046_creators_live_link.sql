-- 0046 - A live link to the creators spreadsheet, for Excel and Google Sheets
--
-- Admin -> Creators -> More -> "Live link": one web address that always
-- returns the current creators CSV (the same columns as Download CSV), so a
-- Google Sheet (=IMPORTDATA) or an Excel workbook (Data -> From Web) stays up
-- to date by itself. Served by the Edge Function `creators-feed`.
--
-- The link carries a long random key, and the key is the only lock: anyone
-- with the link can read creators' emails and WhatsApp numbers. So it's off
-- until an admin turns it on, an admin can replace it (the old one stops
-- working at once) or turn it off, and every use is counted.
--
--   private.creators_listing   the creators list itself, no permission check
--   public.admin_list_creators  admins only (unchanged for the website)
--   public.creators_feed        the live link: the key, then the same rows
--
-- Built on 0044 (live).

begin;

-- ------------------------------------------------------------ the listing --

CREATE OR REPLACE FUNCTION private.creators_listing(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_verified boolean DEFAULT NULL::boolean, p_featured boolean DEFAULT NULL::boolean, p_include_deleted boolean DEFAULT false, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, profile_id uuid, display_name text, slug text, email text, whatsapp text, profile_image_url text, city text, state text, status creator_status, account_status account_status, verified boolean, featured boolean, available boolean, followers_count integer, engagement_rate numeric, avg_reel_views numeric, service_prices jsonb, rating numeric, review_count integer, categories text[], orders_count bigint, revenue numeric, joined_at timestamp with time zone, deleted_at timestamp with time zone, referral_code text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_like text := '%' || private.like_escape(btrim(coalesce(p_search, ''))) || '%';
  v_digits text;
  v_phone text;
begin
  if btrim(coalesce(p_search, '')) ~ '^[0-9 +()-]+$' then
    v_digits := regexp_replace(p_search, '[^0-9]', '', 'g');
    v_phone := private.normalize_phone(p_search);
  end if;
  if length(coalesce(v_digits, '')) < 4 then
    v_digits := null;
  end if;

  return query
  with base as (
    select c.*, pr.email as p_email, private.creator_whatsapp(c.profile_id) as p_whatsapp, pr.status as p_status
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id
    where (coalesce(p_include_deleted, false) or c.deleted_at is null or p_status in ('storefront_removed', 'deleted'))
      and case p_status
            when 'published' then c.status = 'published' and pr.status = 'active'
            when 'suspended' then c.status = 'suspended' or pr.status = 'suspended'
            when 'storefront_removed' then c.deleted_at is not null and pr.status = 'active'
            when 'deleted' then pr.status = 'deleted'
            else nullif(p_status, '') is null or c.status::text = p_status
          end
      and (p_verified is null or c.verified = p_verified)
      and (p_featured is null or c.featured = p_featured)
  ),
  matched as (
    select b.* from base b
    where nullif(btrim(p_search), '') is null or b.display_name ilike v_like or b.p_email ilike v_like
          or b.city ilike v_like or b.slug ilike v_like
          or b.referral_code ilike v_like
          or (v_digits is not null and (regexp_replace(coalesce(b.p_whatsapp, ''), '[^0-9]', '', 'g') like '%' || v_digits || '%'
                                        or private.normalize_phone(b.p_whatsapp) like '%' || v_phone || '%'))
  ),
  agg as (
    select b.id,
      (select count(*) from public.orders o where o.creator_id = b.id and o.status not in ('draft', 'payment_pending')) as orders_count,
      (select coalesce(sum(o.total_amount - o.brand_fee_amount), 0) from public.orders o where o.creator_id = b.id and o.status = 'completed') as revenue
    from matched b
  )
  select b.id, b.profile_id, b.display_name, b.slug, b.p_email, b.p_whatsapp, b.profile_image_url, b.city, b.state, b.status, b.p_status,
         b.verified, b.featured, b.available, b.followers_count, s.engagement_rate, s.avg_reel_views,
         coalesce((select jsonb_object_agg(p.content_type, p.price)
                   from (select cs.content_type, min(cs.price) as price
                         from public.creator_services cs
                         where cs.creator_id = b.id and cs.active and cs.archived_at is null
                         group by cs.content_type) p), '{}'::jsonb),
         b.rating, b.review_count,
         coalesce(array(select cat.name from public.creator_categories cc join public.categories cat on cat.id = cc.category_id
                        where cc.creator_id = b.id order by cc.is_primary desc), '{}'::text[]),
         a.orders_count, a.revenue, b.created_at, b.deleted_at, b.referral_code,
         count(*) over ()
  from matched b join agg a on a.id = b.id
  -- Only a public account's numbers: a private one has a row but nothing in it.
  left join public.creator_instagram_stats s on s.creator_id = b.id and s.status = 'ok'
  order by
    case when p_sort = 'revenue' then a.revenue end desc nulls last,
    case when p_sort = 'orders' then a.orders_count end desc nulls last,
    case when p_sort = 'followers' then b.followers_count end desc nulls last,
    case when p_sort = 'engagement' then s.engagement_rate end desc nulls last,
    case when p_sort = 'reel_views' then s.avg_reel_views end desc nulls last,
    case when p_sort = 'rating' then b.rating end desc nulls last,
    case when p_sort = 'name' then b.display_name end asc,
    b.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

revoke execute on function private.creators_listing(text, text, boolean, boolean, boolean, text, integer, integer) from public, anon, authenticated;

-- The admin list is now the listing behind the admin check (same arguments,
-- same columns, so the website doesn't change).
CREATE OR REPLACE FUNCTION public.admin_list_creators(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_verified boolean DEFAULT NULL::boolean, p_featured boolean DEFAULT NULL::boolean, p_include_deleted boolean DEFAULT false, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, profile_id uuid, display_name text, slug text, email text, whatsapp text, profile_image_url text, city text, state text, status creator_status, account_status account_status, verified boolean, featured boolean, available boolean, followers_count integer, engagement_rate numeric, avg_reel_views numeric, service_prices jsonb, rating numeric, review_count integer, categories text[], orders_count bigint, revenue numeric, joined_at timestamp with time zone, deleted_at timestamp with time zone, referral_code text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_admin();
  return query
  select * from private.creators_listing(p_search, p_status, p_verified, p_featured, p_include_deleted, p_sort,
                                         least(greatest(coalesce(p_limit, 25), 1), 100), p_offset);
end;
$function$;

revoke execute on function public.admin_list_creators(text, text, boolean, boolean, boolean, text, integer, integer) from public, anon;
grant execute on function public.admin_list_creators(text, text, boolean, boolean, boolean, text, integer, integer) to authenticated;

-- --------------------------------------------------------------- the key --

create table if not exists private.data_feeds (
  kind          text primary key check (kind in ('creators')),
  key           text not null unique check (key ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null,
  last_used_at  timestamptz,
  uses          integer not null default 0
);

comment on table private.data_feeds is
  'Keys for live spreadsheet links (Admin -> Creators -> More -> Live link). Served by the creators-feed Edge Function.';

-- Only the functions below (running as the owner) and the service role touch
-- it; RLS with no policies keeps everyone else out even if the grants change.
alter table private.data_feeds enable row level security;
revoke all on private.data_feeds from public, anon, authenticated;

-- What the admin screen shows: the link's key and how it's been used, or null when it's off.
create or replace function public.admin_creators_feed()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
begin
  perform private.require_admin();
  return (
    select jsonb_build_object('key', f.key, 'created_at', f.created_at, 'last_used_at', f.last_used_at, 'uses', f.uses)
    from private.data_feeds f where f.kind = 'creators'
  );
end;
$$;

-- On: a new key (replacing any old one, which stops working). Off: no link at all.
create or replace function public.admin_set_creators_feed(p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
begin
  delete from private.data_feeds where kind = 'creators';
  if coalesce(p_on, false) then
    -- 256 random bits: two v4 UUIDs, hex only.
    insert into private.data_feeds (kind, key, created_by)
    values ('creators', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), v_admin);
  end if;
  perform private.audit(case when coalesce(p_on, false) then 'creators_feed_link_created' else 'creators_feed_link_turned_off' end,
                        'data_feed', 'creators', '{}'::jsonb);
  return public.admin_creators_feed();
end;
$$;

revoke execute on function public.admin_creators_feed() from public, anon;
revoke execute on function public.admin_set_creators_feed(boolean) from public, anon;
grant execute on function public.admin_creators_feed() to authenticated;
grant execute on function public.admin_set_creators_feed(boolean) to authenticated;

-- ------------------------------------------------------------- the feed --

-- Called only by the creators-feed Edge Function (service role), with the key
-- from the link. Pages of 1,000; each request counts once.
create or replace function public.creators_feed(p_key text, p_offset integer default 0)
 RETURNS TABLE(id uuid, profile_id uuid, display_name text, slug text, email text, whatsapp text, profile_image_url text, city text, state text, status creator_status, account_status account_status, verified boolean, featured boolean, available boolean, followers_count integer, engagement_rate numeric, avg_reel_views numeric, service_prices jsonb, rating numeric, review_count integer, categories text[], orders_count bigint, revenue numeric, joined_at timestamp with time zone, deleted_at timestamp with time zone, referral_code text, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_key is null or not exists (select 1 from private.data_feeds f where f.kind = 'creators' and f.key = p_key) then
    raise exception 'This link doesn''t work any more. Ask an admin for the new one.' using errcode = '42501', hint = 'FEED_LINK_INVALID';
  end if;
  if coalesce(p_offset, 0) = 0 then
    update private.data_feeds f set last_used_at = now(), uses = f.uses + 1 where f.kind = 'creators';
  end if;
  return query
  select * from private.creators_listing(p_limit => 1000, p_offset => greatest(coalesce(p_offset, 0), 0));
end;
$function$;

revoke execute on function public.creators_feed(text, integer) from public, anon, authenticated;
grant execute on function public.creators_feed(text, integer) to service_role;

commit;
