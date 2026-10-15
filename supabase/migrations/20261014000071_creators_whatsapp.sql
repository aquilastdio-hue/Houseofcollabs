-- 0071 - Creators' WhatsApp numbers in the admin panel
--
-- Every creator gives a WhatsApp number on the onboarding form. The wizard
-- stores it in `applications.phone` (early applications also kept a copy in
-- `profile ->> 'whatsapp'`), and approval copies it onto `profiles.phone` --
-- but only when the profile had no phone yet and the number passed the profile
-- format check, so the profile copy can be missing or stale. Admins need the
-- number the creator actually gave, so it is read from the application first
-- and the profile phone is only the fallback.
--
-- `private.creator_whatsapp` is that one rule; `admin_list_creators` returns
-- it and matches it on search. The creator detail page reads the same columns
-- through PostgREST (admins can read applications), so it needs nothing here.
--
-- Search treats the text as a number only when it looks like one (digits,
-- spaces, + ( ) -, at least four digits), so "Rohan 2024" stays a name search.
-- It matches on the bare digits, so a fragment typed with its prefix
-- ('+91 98765') is found, and on `private.normalize_phone`, so a full number
-- finds the creator whichever way either side wrote it.

begin;

-- ------------------------------------------------------------------ helper --

create or replace function private.creator_whatsapp(p_profile_id uuid)
returns text
language sql
stable
set search_path to ''
as $$
  select coalesce(
    (select coalesce(nullif(btrim(a.phone), ''), nullif(btrim(a.profile ->> 'whatsapp'), ''))
     from public.applications a
     where a.profile_id = p_profile_id
       and a.role = 'creator'
       and coalesce(nullif(btrim(a.phone), ''), nullif(btrim(a.profile ->> 'whatsapp'), '')) is not null
     order by (a.status = 'approved') desc, a.created_at desc
     limit 1),
    (select nullif(btrim(pr.phone), '') from public.profiles pr where pr.id = p_profile_id)
  );
$$;

comment on function private.creator_whatsapp(uuid) is
  'The WhatsApp number a creator gave on their application, falling back to the profile phone.';

-- ------------------------------------------------------------------ list --
-- Dropped and recreated rather than replaced: adding a column to RETURNS TABLE
-- changes the signature, which CREATE OR REPLACE refuses. The drop takes the
-- grant with it, so it is restated below.

drop function if exists public.admin_list_creators(text, text, boolean, boolean, boolean, text, integer, integer);

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
    where (coalesce(p_include_deleted, false) or c.deleted_at is null)
      and (nullif(p_status, '') is null or c.status::text = p_status)
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
      (select coalesce(sum(o.total_amount), 0) from public.orders o where o.creator_id = b.id and o.status = 'completed') as revenue
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

revoke execute on function public.admin_list_creators(text, text, boolean, boolean, boolean, text, integer, integer) from public, anon;
grant execute on function public.admin_list_creators(text, text, boolean, boolean, boolean, text, integer, integer) to authenticated;

commit;
