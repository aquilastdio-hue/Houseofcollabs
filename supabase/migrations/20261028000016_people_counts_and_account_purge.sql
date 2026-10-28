-- 0016 - People counts that add up, a "Storefront removed" status, and a
--        permanent delete that leaves nothing behind
--
-- 1. One definition of an account for Admin -> People. "Total accounts" counted
--    every profile, but the People list already hid rejected applicants who
--    never got a role. private.is_directory_account() is now the one rule for
--    both, so the card and the list always agree.
--
-- 2. Every creator account counts as a creator: live, suspended, or with the
--    storefront removed (Admin -> People and the admin dashboard). Before,
--    removed storefronts dropped out of "Creators" but stayed in "Total
--    accounts", so the total ran 2 ahead of creators + brands + admins.
--    creators_removed is reported so the cards can say how many those are.
--
-- 3. Admin -> People shows "Storefront removed" as a status (account active,
--    storefront removed by an admin) and the Status filter can find them.
--
-- 4. purge_account_records(): what deleting a login leaves behind. Deleting the
--    auth user cascades the profile, storefront, portfolio, services and
--    notifications, but sign-up applications, email logs, contact messages and
--    phone checks are only unlinked. The admin-account-action function calls
--    this right after a successful delete, so nothing about the person stays.
--    Accounts with orders, earnings or payouts still can't be deleted (they are
--    financial records the other party relies on), so this never runs for them.
--
-- No existing user data is changed by this migration.

begin;

create or replace function private.is_directory_account(p_id uuid, p_role public.user_role, p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  -- Rejected applicants who never got a role belong on the applications list,
  -- not in the people directory (same rule admin_list_people already used).
  select not (
    p_role is null
    and exists (
      select 1 from public.applications a
      where (a.profile_id = p_id or lower(a.email) = lower(p_email))
        and a.status = 'rejected'
    )
  );
$$;

revoke execute on function private.is_directory_account(uuid, public.user_role, text) from public, anon, authenticated;

comment on function private.is_directory_account(uuid, public.user_role, text) is
  'Whether a profile counts as an account on Admin -> People (both the cards and the list).';

create or replace function public.admin_people_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users_total',        (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email)),
    'users_active',       (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.status = 'active'),
    'users_suspended',    (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.status <> 'active'),
    'new_7d',             (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.created_at > now() - interval '7 days'),
    'new_30d',            (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.created_at > now() - interval '30 days'),
    'dau',                (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.last_seen_at > now() - interval '1 day'),
    'wau',                (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.last_seen_at > now() - interval '7 days'),
    'mau',                (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.last_seen_at > now() - interval '30 days'),
    'by_role',            (select coalesce(jsonb_object_agg(coalesce(r.role::text, 'unassigned'), r.n), '{}'::jsonb)
                           from (select p.role, count(*)::int as n from public.profiles p
                                 where private.is_directory_account(p.id, p.role, p.email) group by 1) r),
    -- Every creator account: live, suspended, or with the storefront removed.
    'creators_total',     (select count(*) from public.creators),
    'creators_removed',   (select count(*) from public.creators where deleted_at is not null),
    'creators_published', (select count(*) from public.creators where status = 'published' and deleted_at is null),
    'creators_verified',  (select count(*) from public.creators where verified and deleted_at is null),
    'creators_pending',   (select count(*) from public.creators where status = 'pending_review' and deleted_at is null),
    'creators_active_today', (select count(*) from public.creators c
                              join public.profiles p on p.id = c.profile_id
                              where c.deleted_at is null and p.last_seen_at > now() - interval '1 day'),
    'creators_onboarded_today', (select count(*) from public.creators c
                                 where c.deleted_at is null
                                   and (c.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
    'brands_total',       (select count(*) from public.brands),
    'brands_active',      (select count(*) from public.brands b
                           join public.profiles p on p.id = b.profile_id where p.status = 'active'),
    'brands_active_today', (select count(*) from public.brands b
                            join public.profiles p on p.id = b.profile_id
                            where p.last_seen_at > now() - interval '1 day'),
    'brands_onboarded_today', (select count(*) from public.brands b
                               where (b.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
    'onboarding_done',    (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.onboarding_completed),
    'contact_open',       (select count(*) from public.contact_messages where status = 'new'),
    'reports_open',       (select count(*) from public.reports where status in ('open', 'under_review')),
    'disputes_open',      (select count(*) from public.disputes where status in ('created', 'under_review', 'waiting_for_brand', 'waiting_for_creator')),
    'payouts_pending',    (select count(*) from public.payout_requests where status in ('pending', 'processing'))
  );
end;
$function$;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'gmv', (select coalesce(sum(p.amount), 0) from public.payments p where p.status in ('captured', 'partially_refunded', 'refunded')),
    'net_gmv', (select coalesce(sum(p.amount - p.refunded_amount), 0) from public.payments p where p.status in ('captured', 'partially_refunded', 'refunded')),
    'gmv_30d', (select coalesce(sum(p.amount), 0) from public.payments p
                where p.status in ('captured', 'partially_refunded', 'refunded') and p.captured_at > now() - interval '30 days'),
    'platform_revenue', (select coalesce(sum(o.platform_fee_amount), 0) from public.orders o where o.status = 'completed'),
    'orders_total', (select count(*) from public.orders o where o.status not in ('draft', 'payment_pending')),
    'orders_30d', (select count(*) from public.orders o where o.status not in ('draft', 'payment_pending') and o.created_at > now() - interval '30 days'),
    'avg_order_value', (select coalesce(round(avg(o.total_amount)), 0) from public.orders o where o.paid_at is not null),
    'creators_total', (select count(*) from public.creators c),
    'creators_published', (select count(*) from public.creators c where c.status = 'published' and c.deleted_at is null),
    'creators_pending_review', (select count(*) from public.creators c where c.status = 'pending_review' and c.deleted_at is null),
    'brands_total', (select count(*) from public.brands),
    'active_collaborations', (select count(*) from public.orders o where o.status in
      ('creator_pending', 'accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
       'revision_requested', 'revision_submitted')),
    'completed_orders', (select count(*) from public.orders o where o.status = 'completed'),
    'pending_payouts_count', (select count(*) from public.payout_requests pr where pr.status in ('pending', 'processing')),
    'pending_payouts_amount', (select coalesce(sum(pr.amount), 0) from public.payout_requests pr where pr.status in ('pending', 'processing')),
    'refunds_count', (select count(*) from public.payment_refunds r where r.status = 'processed'),
    'refunds_amount', (select coalesce(sum(r.amount), 0) from public.payment_refunds r where r.status = 'processed'),
    'refunds_required', (select count(*) from public.orders o where o.refund_required),
    'disputes_open', (select count(*) from public.disputes d where d.status in ('created', 'under_review', 'waiting_for_brand', 'waiting_for_creator')),
    'reports_open', (select count(*) from public.reports r where r.status in ('open', 'under_review')),
    'orders_by_status', (select coalesce(jsonb_object_agg(s.status, s.cnt), '{}'::jsonb)
                         from (select o.status, count(*) as cnt from public.orders o group by o.status) s)
  );
end;
$$;

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
      p.avatar_url,
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

comment on function public.admin_list_people is
  'Admin-only paginated directory of every account (private.is_directory_account) with its creator/brand identity, order activity and a storefront_removed status.';

-- ------------------------------------------------------------ account purge --

create or replace function public.purge_account_records(
  p_profile_id uuid,
  p_email text,
  p_application_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_ids uuid[];
  v_phones text[];
  v_apps int;
  v_phone_checks int;
  v_emails int;
  v_contact int;
begin
  -- Only after the login is gone: refuse while the profile still exists.
  if exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Delete the account first.' using errcode = 'P0001', hint = 'ACCOUNT_STILL_EXISTS';
  end if;

  select coalesce(array_agg(a.id), '{}'), coalesce(array_agg(distinct private.normalize_phone(a.phone)) filter (where a.phone is not null), '{}')
    into v_ids, v_phones
  from public.applications a
  where a.id = any(coalesce(p_application_ids, '{}'))
     or a.profile_id = p_profile_id
     or (v_email is not null and lower(a.email) = v_email);

  delete from private.phone_verifications pv
  where pv.application_id = any(v_ids)
     or private.normalize_phone(pv.phone) = any(v_phones);
  get diagnostics v_phone_checks = row_count;

  delete from public.applications a where a.id = any(v_ids);
  get diagnostics v_apps = row_count;

  delete from public.email_deliveries e
  where e.user_id = p_profile_id or (v_email is not null and lower(e.recipient_email) = v_email);
  get diagnostics v_emails = row_count;

  delete from public.contact_messages m
  where m.profile_id = p_profile_id or (v_email is not null and lower(m.email) = v_email);
  get diagnostics v_contact = row_count;

  return jsonb_build_object('applications', v_apps, 'phone_checks', v_phone_checks, 'emails', v_emails, 'contact_messages', v_contact);
end;
$$;

revoke execute on function public.purge_account_records(uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.purge_account_records(uuid, text, uuid[]) to service_role;

comment on function public.purge_account_records(uuid, text, uuid[]) is
  'Service role only. After an account is deleted, removes its applications, phone checks, email log and contact messages.';

commit;
