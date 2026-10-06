-- 0065 · Count accounts, not applications, on the "platform" card
--
-- The applications dashboard reported `creators` and `brands` as counts of
-- *applications* by role. That included rejected ones, and it counted people
-- who had applied but never been provisioned — so the card claimed three brands
-- while `public.brands` was empty.
--
-- Two numbers are now returned alongside the application counts: how many
-- creators and brands actually exist on the platform. The old fields stay, so
-- nothing that reads them breaks.

begin;

create or replace function public.admin_application_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'total',     (select count(*) from public.applications),
    'new',       (select count(*) from public.applications where status = 'new'),
    'reviewing', (select count(*) from public.applications where status = 'reviewing'),
    'approved',  (select count(*) from public.applications where status = 'approved'),
    'rejected',  (select count(*) from public.applications where status = 'rejected'),
    'creators',  (select count(*) from public.applications where role = 'creator'),
    'brands',    (select count(*) from public.applications where role = 'brand'),
    -- Accounts that exist right now. A soft-deleted creator is gone as far as
    -- the platform is concerned, so it is not counted here either.
    'live_creators', (select count(*) from public.creators where deleted_at is null),
    'live_brands',   (select count(*) from public.brands),
    'new_7d',    (select count(*) from public.applications where created_at > now() - interval '7 days')
  );
end;
$function$;

commit;
