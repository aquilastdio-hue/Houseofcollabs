-- Role-specific activity and onboarding counts for the admin Creators and Brands pages.

begin;

create or replace function public.admin_people_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users_total',        (select count(*) from public.profiles),
    'users_active',       (select count(*) from public.profiles where status = 'active'),
    'users_suspended',    (select count(*) from public.profiles where status <> 'active'),
    'new_7d',             (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'new_30d',            (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'dau',                (select count(*) from public.profiles where last_seen_at > now() - interval '1 day'),
    'wau',                (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'mau',                (select count(*) from public.profiles where last_seen_at > now() - interval '30 days'),
    'by_role',            (select coalesce(jsonb_object_agg(coalesce(r.role::text, 'unassigned'), r.n), '{}'::jsonb)
                           from (select p.role, count(*)::int as n from public.profiles p group by 1) r),
    'creators_total',     (select count(*) from public.creators where deleted_at is null),
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
    'onboarding_done',    (select count(*) from public.profiles where onboarding_completed),
    'contact_open',       (select count(*) from public.contact_messages where status = 'new'),
    'reports_open',       (select count(*) from public.reports where status in ('open', 'under_review')),
    'disputes_open',      (select count(*) from public.disputes where status in ('created', 'under_review', 'waiting_for_brand', 'waiting_for_creator')),
    'payouts_pending',    (select count(*) from public.payout_requests where status in ('pending', 'processing'))
  );
end;
$function$;

commit;