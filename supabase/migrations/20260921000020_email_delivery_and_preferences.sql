-- =============================================================================
-- House of Collabs · 0020 · email delivery log, category preferences,
--                            lifecycle notifications
-- =============================================================================
-- The notification → email pipeline already exists (private.dispatch_notification_email
-- fires pg_net at the send-notification Edge Function on every notifications
-- INSERT). This migration closes the gaps around it:
--
--   * email_deliveries — one durable row per outgoing email: status, attempts,
--     provider message id, last error. Unique on notification_id, so a retried
--     webhook or a replayed event can never send twice.
--   * per-category opt-outs on profiles, with a hard-coded set of critical
--     types that always send (security, money, account status).
--   * welcome + onboarding-completed notifications, the two lifecycle events
--     that had no trigger.
--
-- The trigger now records the intent (a pending delivery) *before* calling out,
-- so an email is never lost when pg_net or the provider is unavailable — the
-- retry worker picks the row up later.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Per-category preferences. `email_notifications` stays the master switch.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email_orders    boolean not null default true,
  add column if not exists email_payments  boolean not null default true,
  add column if not exists email_campaigns boolean not null default true,
  add column if not exists email_account   boolean not null default true,
  add column if not exists email_marketing boolean not null default false;

comment on column public.profiles.email_marketing is
  'Opt-in (defaults false): announcements and non-essential platform email.';

-- -----------------------------------------------------------------------------
-- Which bucket a notification type belongs to. `critical` ignores preferences:
-- money movement, failed payments, disputes and account status are operational
-- messages a user must not be able to silence.
-- -----------------------------------------------------------------------------
create or replace function private.email_category(p_type text)
returns text
language sql immutable
as $$
  select case
    when p_type in ('payment_failed', 'payout_failed', 'refund_processed',
                    'account_suspended', 'account_reactivated', 'profile_suspended',
                    'dispute_opened', 'order_cancelled', 'order_expired')
      then 'critical'
    when p_type in ('order_new', 'order_accepted', 'order_approved', 'order_completed',
                    'order_in_progress', 'content_delivered', 'revision_requested',
                    'revision_submitted', 'shipment_required', 'shipment_update',
                    'review_received')
      then 'orders'
    when p_type in ('payment_received', 'earnings_available', 'payout_requested',
                    'payout_processed')
      then 'payments'
    when p_type in ('brief_received')
      then 'campaigns'
    when p_type in ('welcome', 'onboarding_completed', 'profile_submitted',
                    'profile_approved', 'profile_rejected', 'creator_verified')
      then 'account'
    when p_type in ('announcement')
      then 'marketing'
    else 'account'
  end;
$$;

/** True when this user still wants email for this notification type. */
create or replace function private.wants_email(p_user_id uuid, p_type text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.profiles;
  v_cat text := private.email_category(p_type);
begin
  select * into p from public.profiles where id = p_user_id;
  if p is null or p.email is null or p.status <> 'active' then
    return false;
  end if;
  -- Critical messages ignore every opt-out, including the master switch.
  if v_cat = 'critical' then
    return true;
  end if;
  if not p.email_notifications then
    return false;
  end if;
  return case v_cat
    when 'orders'    then p.email_orders
    when 'payments'  then p.email_payments
    when 'campaigns' then p.email_campaigns
    when 'marketing' then p.email_marketing
    else p.email_account
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Delivery log
-- -----------------------------------------------------------------------------
create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  -- One email per notification. The unique constraint IS the idempotency key:
  -- a replayed webhook or a retried trigger hits it and does nothing.
  notification_id uuid unique references public.notifications (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  recipient_email text not null,
  email_type text not null check (char_length(email_type) <= 60),
  category text not null default 'account',
  subject text check (char_length(subject) <= 300),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  provider text,
  provider_message_id text,
  attempts int not null default 0,
  max_attempts int not null default 5,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz
);

create index if not exists email_deliveries_status_idx on public.email_deliveries (status, next_attempt_at);
create index if not exists email_deliveries_user_idx on public.email_deliveries (user_id, created_at desc);
create index if not exists email_deliveries_created_idx on public.email_deliveries (created_at desc);

comment on table public.email_deliveries is
  'Outgoing transactional email, one row per notification. Admin-readable only.';

alter table public.email_deliveries enable row level security;

-- Admins read the log; nobody writes through the API (service role only).
create policy "Admins read email deliveries" on public.email_deliveries
  for select to authenticated
  using ((select private.is_admin()));

grant select on public.email_deliveries to authenticated;

-- -----------------------------------------------------------------------------
-- Dispatch: record intent, then try to deliver. Never blocks the insert.
-- -----------------------------------------------------------------------------
create or replace function private.dispatch_notification_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_email text;
begin
  if not private.wants_email(new.user_id, new.type) then
    return null;
  end if;
  select p.email into v_email from public.profiles p where p.id = new.user_id;

  -- Durable record first: if the call below never happens (pg_net missing,
  -- Vault unset, provider down) the retry worker still finds this row.
  insert into public.email_deliveries (notification_id, user_id, recipient_email, email_type, category, subject)
  values (new.id, new.user_id, v_email, new.type, private.email_category(new.type), left(new.title, 300))
  on conflict (notification_id) do nothing;

  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
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

-- -----------------------------------------------------------------------------
-- Lifecycle notifications that had no trigger
-- -----------------------------------------------------------------------------

/** Welcome, once, as soon as a profile row appears. */
create or replace function private.notify_welcome()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.notify(
    new.id,
    'welcome',
    'Welcome to House of Collabs',
    case new.role
      when 'creator' then 'Set up your storefront so brands can find you and order your services.'
      when 'brand'   then 'Tell creators about your brand, then start browsing storefronts.'
      else 'Choose how you’ll use House of Collabs to get started.'
    end,
    'profile', new.id,
    case new.role when 'creator' then '/creator' when 'brand' then '/brand' else '/onboarding' end
  );
  return null;
end;
$$;

drop trigger if exists profiles_notify_welcome on public.profiles;
create trigger profiles_notify_welcome
  after insert on public.profiles
  for each row execute function private.notify_welcome();

/** Onboarding completed — fires on the false → true transition only. */
create or replace function private.notify_onboarding_complete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.onboarding_completed and not coalesce(old.onboarding_completed, false) then
    perform private.notify(
      new.id,
      'onboarding_completed',
      'Your account is ready',
      case new.role
        when 'creator' then 'Your storefront is set up. Keep your services and portfolio fresh to win more orders.'
        when 'brand'   then 'Your brand profile is set up. Find creators and place your first order.'
        else 'Your account is ready to use.'
      end,
      'profile', new.id,
      case new.role when 'creator' then '/creator' when 'brand' then '/discover' else '/' end
    );
  end if;
  return null;
end;
$$;

drop trigger if exists profiles_notify_onboarding on public.profiles;
create trigger profiles_notify_onboarding
  after update of onboarding_completed on public.profiles
  for each row execute function private.notify_onboarding_complete();

-- -----------------------------------------------------------------------------
-- Retry queue reader, for the scheduled worker (service role only).
-- -----------------------------------------------------------------------------
create or replace function public.claim_pending_emails(p_limit int default 20)
returns setof public.email_deliveries
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  update public.email_deliveries d
  set status = 'processing', attempts = d.attempts + 1
  where d.id in (
    select x.id from public.email_deliveries x
    where x.status in ('pending', 'failed')
      and x.attempts < x.max_attempts
      and x.next_attempt_at <= now()
    order by x.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  returning d.*;
end;
$$;

/** Records the outcome of one send attempt. Exponential backoff on failure. */
create or replace function public.record_email_result(
  p_id uuid,
  p_status text,
  p_provider text default null,
  p_message_id text default null,
  p_error text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception 'Unknown email status: %', p_status using errcode = 'P0001';
  end if;
  update public.email_deliveries
  set status = case
        -- Out of attempts stays failed; otherwise queue another try.
        when p_status = 'failed' and attempts >= max_attempts then 'failed'
        else p_status
      end,
      provider = coalesce(p_provider, provider),
      provider_message_id = coalesce(p_message_id, provider_message_id),
      last_error = case when p_status = 'failed' then left(p_error, 2000) else null end,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      -- 2^attempts minutes: 2, 4, 8, 16, 32.
      next_attempt_at = case when p_status = 'failed'
        then now() + (power(2, least(attempts, 5)) * interval '1 minute')
        else next_attempt_at end
  where id = p_id;
end;
$$;

revoke execute on function public.claim_pending_emails, public.record_email_result from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Retry worker. Every 5 minutes, ask send-notification to drain whatever is
-- still pending or awaiting a retry. Guarded like the other scheduled jobs so
-- environments without pg_cron/pg_net/Vault still apply this migration.
-- -----------------------------------------------------------------------------
create or replace function private.drain_email_queue()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return;
  end if;
  -- Nothing waiting: skip the HTTP call entirely.
  if not exists (
    select 1 from public.email_deliveries
    where status in ('pending', 'failed') and attempts < max_attempts and next_attempt_at <= now()
  ) then
    return;
  end if;
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_url using 'project_url';
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_secret using 'notification_webhook_secret';
    if v_url is null or v_secret is null then
      return;
    end if;
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
      using rtrim(v_url, '/') || '/functions/v1/send-notification',
            jsonb_build_object('retry', true, 'limit', 50),
            jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
  exception when others then
    raise warning 'email queue drain skipped: %', sqlerrm;
  end;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('house-of-collabs-drain-email-queue', '*/5 * * * *', 'select private.drain_email_queue()');
  else
    raise notice 'pg_cron not available: run private.drain_email_queue() externally.';
  end if;
exception when others then
  raise notice 'email queue cron setup skipped: %', sqlerrm;
end;
$$;
