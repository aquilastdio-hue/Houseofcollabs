-- 0060 - Three functions still read tables that messaging took with it
--
-- Migration 0051 removed direct messaging and dropped `public.conversations`
-- and `public.messages`. Three functions were left reading them. Postgres does
-- not record a dependency from a function body to a table, so the drop
-- succeeded quietly and each function kept its stale body.
--
--   private.can_view_brand                  -> public.conversations
--   private.brand_has_creator_relationship  -> public.conversations
--   public.admin_list_brands                -> public.messages
--
-- Impact, confirmed by running each path:
--
--   * `can_view_brand` backs the SELECT policy on `brands`. A SQL function is
--     planned as a whole before any branch runs, so the missing table throws
--     even though the dead clause is last and could never be true. Every read
--     of a brand row by anyone who is not its owner or an admin failed --
--     a creator could not load the brand's name or logo on their own order.
--
--   * `brand_has_creator_relationship` backs the SELECT policies on `creators`,
--     `creator_categories`, `creator_languages`, `creator_services` and
--     `portfolio_items`. Published creators are matched by an earlier clause in
--     the policy, so the function is never invoked for them and the public
--     marketplace was unaffected; it threw only for unpublished creators.
--
--   * `admin_list_brands` powers /admin/brands, which has been showing
--     "Something went wrong" since 0051.
--
-- Each dropped clause referenced rows that no longer exist, so removing them
-- changes no outcome that was ever reachable -- it only stops the error.

begin;

CREATE OR REPLACE FUNCTION private.brand_has_creator_relationship(p_creator_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.orders o join public.brands b on b.id = o.brand_id
    where o.creator_id = p_creator_id and b.profile_id = (select auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_view_brand(p_brand_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.brands b where b.id = p_brand_id and b.profile_id = (select auth.uid()))
  or exists (
    select 1 from public.orders o join public.creators c on c.id = o.creator_id
    where o.brand_id = p_brand_id and c.profile_id = (select auth.uid())
      and o.status not in ('draft', 'payment_pending')
  )
  or exists (
    select 1 from public.briefs br join public.creators c on c.id = br.creator_id
    where br.brand_id = p_brand_id and c.profile_id = (select auth.uid()) and br.status <> 'draft'
  );
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_brands(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, profile_id uuid, brand_name text, brand_slug text, brand_logo_url text, email text, contact_email text, contact_phone text, industry text, location text, account_status account_status, orders_count bigint, spend numeric, last_activity_at timestamp with time zone, joined_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_like text := '%' || private.like_escape(btrim(coalesce(p_search, ''))) || '%';
begin
  perform private.require_admin();
  return query
  with base as (
    select b.*, pr.email as p_email, pr.status as p_status, pr.last_seen_at as p_last_seen
    from public.brands b
    join public.profiles pr on pr.id = b.profile_id
    where (nullif(btrim(p_search), '') is null or b.brand_name ilike v_like or pr.email ilike v_like
           or b.contact_email ilike v_like or b.industry ilike v_like)
      and (nullif(p_status, '') is null or pr.status::text = p_status)
  ),
  agg as (
    select b.id,
      (select count(*) from public.orders o where o.brand_id = b.id and o.status not in ('draft', 'payment_pending')) as orders_count,
      (select coalesce(sum(p.amount - p.refunded_amount), 0) from public.payments p join public.orders o on o.id = p.order_id
        where o.brand_id = b.id and p.status in ('captured', 'partially_refunded', 'refunded')) as spend,
      greatest(
        b.p_last_seen,
        (select max(o.created_at) from public.orders o where o.brand_id = b.id)
      ) as last_activity
    from base b
  )
  select b.id, b.profile_id, b.brand_name, b.brand_slug, b.brand_logo_url, b.p_email, b.contact_email, b.contact_phone,
         b.industry, b.location, b.p_status, a.orders_count, a.spend, a.last_activity, b.created_at,
         count(*) over ()
  from base b join agg a on a.id = b.id
  order by
    case when p_sort = 'spend' then a.spend end desc nulls last,
    case when p_sort = 'orders' then a.orders_count end desc nulls last,
    case when p_sort = 'activity' then a.last_activity end desc nulls last,
    case when p_sort = 'name' then b.brand_name end asc,
    b.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

commit;
