-- =============================================================================
-- House of Collabs · 0018 · product name is "House of Collabs" (plural)
-- =============================================================================
-- Migration 0016 renamed the brand to "House of Collab"; the product name is
-- actually "House of Collabs". This corrects the two places the name is stored
-- as data rather than code: the public support contact and the pg_cron job
-- names. Order numbers already use the HOC- prefix, which is unchanged.
-- =============================================================================

update public.platform_settings
set value = '"support@houseofcollabs.example"'
where key = 'support_email'
  and value = '"support@houseofcollab.example"';

do $$
declare
  v_old text;
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;

    perform cron.schedule('house-of-collabs-expire-pending-payments', '*/15 * * * *', 'select public.expire_pending_payments()');
    perform cron.schedule('house-of-collabs-auto-cancel-unaccepted', '5 * * * *', 'select public.auto_cancel_unaccepted_orders()');
    perform cron.schedule('house-of-collabs-auto-approve-deliveries', '10 * * * *', 'select public.auto_approve_stale_deliveries()');
    perform cron.schedule('house-of-collabs-release-earnings', '20 * * * *', 'select public.release_matured_earnings()');

    -- Drop the singular-named jobs only once their replacements exist.
    foreach v_old in array array[
      'house-of-collab-expire-pending-payments',
      'house-of-collab-auto-cancel-unaccepted',
      'house-of-collab-auto-approve-deliveries',
      'house-of-collab-release-earnings'
    ] loop
      if exists (select 1 from cron.job where jobname = v_old) then
        perform cron.unschedule(v_old);
      end if;
    end loop;
  else
    raise notice 'pg_cron not available: nothing to rename.';
  end if;
exception when others then
  raise notice 'pg_cron rename skipped: %', sqlerrm;
end;
$$;
