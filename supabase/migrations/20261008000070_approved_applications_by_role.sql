-- Separate approved application totals by applicant role for the admin dashboard.

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
    'approved_creators', (select count(*) from public.applications where status = 'approved' and role = 'creator'),
    'approved_brands',   (select count(*) from public.applications where status = 'approved' and role = 'brand'),
    'rejected',  (select count(*) from public.applications where status = 'rejected'),
    'creators',  (select count(*) from public.applications where role = 'creator'),
    'brands',    (select count(*) from public.applications where role = 'brand'),
    'live_creators', (select count(*) from public.creators where deleted_at is null),
    'live_brands',   (select count(*) from public.brands),
    'new_7d',    (select count(*) from public.applications where created_at > now() - interval '7 days')
  );
end;
$function$;

commit;