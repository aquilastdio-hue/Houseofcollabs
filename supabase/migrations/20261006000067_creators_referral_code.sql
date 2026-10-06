-- 0067 - Return the referral code from the admin creators list
--
-- `admin_list_creators` could already *search* by referral code (0062) but
-- never returned it, so the Creators table had no way to show where someone
-- came from. The CTE selects `c.*`, so the value was in hand all along -- it
-- was simply never projected.
--
-- Dropped and recreated rather than replaced: adding a column to RETURNS TABLE
-- changes the signature, which CREATE OR REPLACE refuses.

begin;

drop function if exists public.admin_list_creators(text, text, boolean, boolean, boolean, text, integer, integer);

CREATE OR REPLACE FUNCTION public.admin_list_creators(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_verified boolean DEFAULT NULL::boolean, p_featured boolean DEFAULT NULL::boolean, p_include_deleted boolean DEFAULT false, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, profile_id uuid, display_name text, slug text, email text, profile_image_url text, city text, state text, status creator_status, account_status account_status, verified boolean, featured boolean, available boolean, followers_count integer, rating numeric, review_count integer, categories text[], orders_count bigint, revenue numeric, joined_at timestamp with time zone, deleted_at timestamp with time zone, referral_code text, total_count bigint)
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
    select c.*, pr.email as p_email, pr.status as p_status
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id
    where (coalesce(p_include_deleted, false) or c.deleted_at is null)
      and (nullif(btrim(p_search), '') is null or c.display_name ilike v_like or pr.email ilike v_like
           or c.city ilike v_like or c.slug ilike v_like
           or c.referral_code ilike v_like)
      and (nullif(p_status, '') is null or c.status::text = p_status)
      and (p_verified is null or c.verified = p_verified)
      and (p_featured is null or c.featured = p_featured)
  ),
  agg as (
    select b.id,
      (select count(*) from public.orders o where o.creator_id = b.id and o.status not in ('draft', 'payment_pending')) as orders_count,
      (select coalesce(sum(o.total_amount), 0) from public.orders o where o.creator_id = b.id and o.status = 'completed') as revenue
    from base b
  )
  select b.id, b.profile_id, b.display_name, b.slug, b.p_email, b.profile_image_url, b.city, b.state, b.status, b.p_status,
         b.verified, b.featured, b.available, b.followers_count, b.rating, b.review_count,
         coalesce(array(select cat.name from public.creator_categories cc join public.categories cat on cat.id = cc.category_id
                        where cc.creator_id = b.id order by cc.is_primary desc), '{}'::text[]),
         a.orders_count, a.revenue, b.created_at, b.deleted_at, b.referral_code,
         count(*) over ()
  from base b join agg a on a.id = b.id
  order by
    case when p_sort = 'revenue' then a.revenue end desc nulls last,
    case when p_sort = 'orders' then a.orders_count end desc nulls last,
    case when p_sort = 'followers' then b.followers_count end desc nulls last,
    case when p_sort = 'rating' then b.rating end desc nulls last,
    case when p_sort = 'name' then b.display_name end asc,
    b.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

commit;
