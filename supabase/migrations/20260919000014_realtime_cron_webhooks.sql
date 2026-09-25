-- =============================================================================
-- Spotlit · 0014 · Realtime, scheduled jobs, notification email webhook
-- Optional platform features are guarded so migrations run everywhere.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Realtime: postgres_changes (RLS-filtered per subscriber)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages', 'notifications', 'orders', 'conversation_participants', 'order_status_history'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;

-- Private broadcast/presence channels `conversation:{id}` (typing + online state)
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$
      create policy "Conversation participants receive channel events" on realtime.messages
        for select to authenticated
        using (
          realtime.topic() like 'conversation:%'
          and private.is_conversation_participant(private.try_uuid(split_part(realtime.topic(), ':', 2)))
        )
    $p$;
    execute $p$
      create policy "Conversation participants send channel events" on realtime.messages
        for insert to authenticated
        with check (
          realtime.topic() like 'conversation:%'
          and private.is_conversation_participant(private.try_uuid(split_part(realtime.topic(), ':', 2)))
        )
    $p$;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Scheduled jobs (pg_cron). Safe to re-run: cron.schedule upserts by job name.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('spotlit-expire-pending-payments', '*/15 * * * *', 'select public.expire_pending_payments()');
    perform cron.schedule('spotlit-auto-cancel-unaccepted', '5 * * * *', 'select public.auto_cancel_unaccepted_orders()');
    perform cron.schedule('spotlit-auto-approve-deliveries', '10 * * * *', 'select public.auto_approve_stale_deliveries()');
    perform cron.schedule('spotlit-release-earnings', '20 * * * *', 'select public.release_matured_earnings()');
  else
    raise notice 'pg_cron not available: schedule the maintenance functions externally.';
  end if;
exception when others then
  raise notice 'pg_cron setup skipped: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- Email dispatch webhook: notifications → send-notification Edge Function.
-- Enabled only when pg_net + Vault secrets `project_url` and
-- `notification_webhook_secret` exist (see README). Never blocks the insert.
-- -----------------------------------------------------------------------------
create or replace function private.dispatch_notification_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_opt_in boolean;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return null;
  end if;
  select p.email_notifications into v_opt_in from public.profiles p where p.id = new.user_id;
  if not coalesce(v_opt_in, false) then
    return null;
  end if;
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_url using 'project_url';
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_secret using 'notification_webhook_secret';
    if v_url is null or v_secret is null then
      return null;
    end if;
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
      using rtrim(v_url, '/') || '/functions/v1/send-notification',
            jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'record', to_jsonb(new)),
            jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
  exception when others then
    raise warning 'notification email dispatch skipped: %', sqlerrm;
  end;
  return null;
end;
$$;

create trigger notifications_dispatch_email
  after insert on public.notifications
  for each row execute function private.dispatch_notification_email();
