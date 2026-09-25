-- =============================================================================
-- House of Collabs · 0024 · make the email trigger able to reach the function
-- =============================================================================
-- `private.dispatch_notification_email()` and `private.drain_email_queue()` both
-- bail out early when `to_regnamespace('net')` is null. On the live project it
-- was: pg_cron was installed and the drain job was scheduled, but pg_net was
-- not, so the HTTP call never happened. Deliveries were being logged and then
-- sat as `pending` forever.
--
-- Guarded, so environments where pg_net is unavailable still apply cleanly.
-- =============================================================================

do $$
begin
  if to_regnamespace('net') is not null then
    raise notice 'pg_net already installed.';
  elsif exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    raise notice 'pg_net installed.';
  else
    raise notice 'pg_net not available: notification emails will only send when an admin drains the queue.';
  end if;
exception when others then
  raise notice 'pg_net setup skipped: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- Report the provider from a delivery that actually happened.
-- -----------------------------------------------------------------------------
-- 0022 took the provider from the newest row with a non-null provider. Since
-- the function now records console-mode as `skipped` (provider 'console') and
-- in-app-only rows as `skipped` (provider 'in-app'), that could report 'in-app'
-- as though it were a working mail provider. Only `sent` rows count.
create or replace function public.admin_email_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'total',      (select count(*) from public.email_deliveries),
    'sent',       (select count(*) from public.email_deliveries where status = 'sent'),
    'pending',    (select count(*) from public.email_deliveries where status in ('pending', 'processing')),
    'failed',     (select count(*) from public.email_deliveries where status = 'failed'),
    'skipped',    (select count(*) from public.email_deliveries where status = 'skipped'),
    'retryable',  (select count(*) from public.email_deliveries
                   where status in ('pending', 'failed') and attempts < max_attempts and next_attempt_at <= now()),
    'exhausted',  (select count(*) from public.email_deliveries where status = 'failed' and attempts >= max_attempts),
    'sent_24h',   (select count(*) from public.email_deliveries where status = 'sent' and sent_at > now() - interval '24 hours'),
    'failed_24h', (select count(*) from public.email_deliveries where status = 'failed' and created_at > now() - interval '24 hours'),
    'by_category',(select coalesce(jsonb_object_agg(c.category, c.n), '{}'::jsonb)
                   from (select category, count(*)::int as n from public.email_deliveries group by 1) c),
    -- Null until something is genuinely delivered, which is what the admin
    -- banner keys off to say "no provider configured".
    'provider',   (select provider from public.email_deliveries
                   where status = 'sent' and provider is not null order by sent_at desc limit 1),
    'last_sent_at', (select max(sent_at) from public.email_deliveries where status = 'sent'),
    -- Whether the database can call the Edge Function on its own. False means
    -- nothing sends until an admin presses "Retry queued".
    'auto_dispatch', (to_regnamespace('net') is not null and to_regnamespace('vault') is not null)
  );
end;
$$;

revoke execute on function public.admin_email_stats() from anon;
grant execute on function public.admin_email_stats() to authenticated;
