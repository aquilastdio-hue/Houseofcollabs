-- 0029 - Admin → Creators: the Status filter matches what admins look for
--
-- The filter now offers Published, Suspended, Storefront removed and Deleted
-- (Draft, Pending review and Rejected are gone from it). `p_status` keeps its
-- type, so only `admin_list_creators` changes:
--
--   * published           live storefront on an active account
--   * suspended           the storefront or the whole account is suspended.
--                         Suspending someone from People only changes the
--                         account, so before this those creators were missed.
--   * storefront_removed  an admin removed the storefront; the account is
--                         active (the same rule as People)
--   * deleted             the account was closed: the person deleted it but
--                         had orders or payouts, so their records stay.
--                         Accounts erased completely leave nothing to list.
--
-- The last two include removed storefronts without the "Include removed"
-- switch. Any other value still matches the creator status exactly.

begin;

CREATE OR REPLACE FUNCTION public.admin_list_creators(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_verified boolean DEFAULT NULL::boolean, p_featured boolean DEFAULT NULL::boolean, p_include_deleted boolean DEFAULT false, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, profile_id uuid, display_name text, slug text, email text, whatsapp text, profile_image_url text, city text, state text, status creator_status, account_status account_status, verified boolean, featured boolean, available boolean, followers_count integer, rating numeric, review_count integer, categories text[], orders_count bigint, revenue numeric, joined_at timestamp with time zone, deleted_at timestamp with time zone, referral_code text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_like text := '%' || private.like_escape(btrim(coalesce(p_search, ''))) || '%';
  v_digits text;
  v_phone text;
begin
  perform private.require_admin();
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
         b.verified, b.featured, b.available, b.followers_count, b.rating, b.review_count,
         coalesce(array(select cat.name from public.creator_categories cc join public.categories cat on cat.id = cc.category_id
                        where cc.creator_id = b.id order by cc.is_primary desc), '{}'::text[]),
         a.orders_count, a.revenue, b.created_at, b.deleted_at, b.referral_code,
         count(*) over ()
  from matched b join agg a on a.id = b.id
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
