-- 0018 - Admin -> People shows each person's own photo
--
-- The list used profiles.avatar_url, which is empty for most creators: their
-- sign-up photo is saved on the storefront (creators.profile_image_url). So 25
-- creators showed initials on People while the Creators list showed their
-- photo. Now: creator photo, else brand logo, else the account avatar.
-- Same function as 0016 otherwise. No data is changed.

begin;

CREATE OR REPLACE FUNCTION public.admin_list_people(p_search text DEFAULT NULL::text, p_role text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_sort text DEFAULT 'recent'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS TABLE(id uuid, full_name text, email text, avatar_url text, role text, status text, is_admin boolean, verified boolean, display_name text, entity_id uuid, onboarding_completed boolean, last_seen_at timestamp with time zone, created_at timestamp with time zone, orders_count integer, total_value numeric, referral_code text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_size   int := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset int := (greatest(coalesce(p_page, 1), 1) - 1) * v_size;
  -- Escape LIKE wildcards so a search for "%" can't scan everything.
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform private.require_admin();
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with base as (
    select
      p.id,
      p.full_name,
      p.email,
      -- The photo people chose: a creator's storefront photo (set from the
      -- sign-up form), a brand's logo, else whatever is on the account.
      coalesce(nullif(c.profile_image_url, ''), nullif(b.brand_logo_url, ''), nullif(p.avatar_url, '')) as avatar_url,
      coalesce(p.role::text, 'unassigned')          as role,
      -- "Storefront removed" when an admin removed the storefront and the
      -- account itself is still active; a suspended account reads Suspended.
      case
        when p.status = 'active' and c.deleted_at is not null then 'storefront_removed'
        else p.status::text
      end                                           as status,
      exists (select 1 from public.admin_users a where a.profile_id = p.id) as is_admin,
      coalesce(c.verified, false)                   as verified,
      coalesce(c.display_name, b.brand_name)        as display_name,
      coalesce(c.id, b.id)                          as entity_id,
      p.onboarding_completed,
      p.last_seen_at,
      p.created_at,
      -- Orders they took part in, from whichever side they sit on. Branch on
      -- which identity exists rather than coalescing the aggregates: count(*)
      -- returns 0 (not null) for no rows, so a coalesce would always pick the
      -- creator branch and report 0 for every brand.
      case
        when c.id is not null then (select count(*) from public.orders o where o.creator_id = c.id)
        when b.id is not null then (select count(*) from public.orders o where o.brand_id = b.id)
        else 0
      end::int                                      as orders_count,
      case
        when c.id is not null then
          (select coalesce(sum(o.total_amount), 0) from public.orders o where o.creator_id = c.id and o.paid_at is not null)
        when b.id is not null then
          (select coalesce(sum(o.total_amount), 0) from public.orders o where o.brand_id = b.id and o.paid_at is not null)
        else 0
      end                                           as total_value,
      -- Creators carry the code on their own row (migration 0062). Everyone
      -- else -- brands, and anyone not yet provisioned -- only ever had it on
      -- the application they signed up with, so fall back to that, newest
      -- first. Null when they arrived without one; the table shows a dash.
      coalesce(
        c.referral_code,
        (select upper(nullif(btrim(a.profile ->> 'referral_code'), ''))
         from public.applications a
         where lower(a.email) = lower(p.email)
           and nullif(btrim(a.profile ->> 'referral_code'), '') is not null
         order by a.created_at desc
         limit 1)
      )                                             as referral_code
    from public.profiles p
    left join public.creators c on c.profile_id = p.id
    left join public.brands   b on b.profile_id = p.id
    where (
        p_status is null or p_status = ''
        or (p_status = 'storefront_removed' and p.status = 'active' and c.deleted_at is not null)
        or (p_status = 'active' and p.status = 'active' and c.deleted_at is null)
        or (p_status not in ('storefront_removed', 'active') and p.status::text = p_status)
      )
      and (
        p_role is null or p_role = ''
        or (p_role = 'unassigned' and p.role is null)
        or (p_role = 'admin' and exists (select 1 from public.admin_users a where a.profile_id = p.id))
        or (p_role in ('brand', 'creator') and p.role::text = p_role)
      )
      and (
        v_q is null
        or p.full_name ilike v_q
        or p.email ilike v_q
        or c.display_name ilike v_q
        or b.brand_name ilike v_q
      )
      -- Same accounts the "Total accounts" card counts.
      and private.is_directory_account(p.id, p.role, p.email)
  ),
  counted as (select count(*) as n from base)
  select base.*, counted.n
  from base, counted
  order by
    case when p_sort = 'name'   then lower(coalesce(base.full_name, base.email)) end asc,
    case when p_sort = 'active' then base.last_seen_at end desc nulls last,
    case when p_sort = 'value'  then base.total_value end desc nulls last,
    case when p_sort = 'oldest' then base.created_at end asc,
    base.created_at desc
  limit v_size offset v_offset;
end;
$$;

commit;
