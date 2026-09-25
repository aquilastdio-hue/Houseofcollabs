-- =============================================================================
-- House of Collab · 0016 · rebrand from "Spotlit"
-- =============================================================================
-- Renames the brand where it is stored as data rather than code:
--   * the public support_email platform setting
--   * the pg_cron job names
--   * the prefix of newly generated order numbers
--
-- Existing order numbers are deliberately left alone: they are identifiers
-- already shown on past orders, receipts and messages, and rewriting them would
-- break those references. Only orders created from here on get the new prefix.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Public support contact
-- -----------------------------------------------------------------------------
update public.platform_settings
set value = '"support@houseofcollab.example"'
where key = 'support_email'
  and value = '"support@spotlit.example"';

-- -----------------------------------------------------------------------------
-- Order numbers: HOC-###### for new rows
-- -----------------------------------------------------------------------------
alter table public.orders
  alter column order_number
  set default ('HOC-' || lpad(nextval('public.order_number_seq')::text, 6, '0'));

-- -----------------------------------------------------------------------------
-- Scheduled jobs: re-register under the new names and drop the old ones.
-- Guarded the same way as migration 0014 so environments without pg_cron
-- (and the local harness) still apply cleanly.
-- -----------------------------------------------------------------------------
do $$
declare
  v_old text;
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;

    perform cron.schedule('house-of-collab-expire-pending-payments', '*/15 * * * *', 'select public.expire_pending_payments()');
    perform cron.schedule('house-of-collab-auto-cancel-unaccepted', '5 * * * *', 'select public.auto_cancel_unaccepted_orders()');
    perform cron.schedule('house-of-collab-auto-approve-deliveries', '10 * * * *', 'select public.auto_approve_stale_deliveries()');
    perform cron.schedule('house-of-collab-release-earnings', '20 * * * *', 'select public.release_matured_earnings()');

    -- Drop the previous jobs only once their replacements exist.
    foreach v_old in array array[
      'spotlit-expire-pending-payments',
      'spotlit-auto-cancel-unaccepted',
      'spotlit-auto-approve-deliveries',
      'spotlit-release-earnings'
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
