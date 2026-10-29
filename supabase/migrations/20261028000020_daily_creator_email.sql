-- 0020 - Daily creator email, every morning at 10:00 IST
--
-- One email a day to every active creator (with a live storefront) reminding
-- them to keep their profile complete, upload their best work and price
-- sensibly. Email only — no in-app notification, so the bell doesn't fill up
-- with the same reminder every day.
--
-- The subject and message live in platform_settings ('daily_creator_email')
-- and are edited, paused or test-sent from Admin -> Announcements. It's an
-- "account" email (a reminder about their own profile): on by default, and
-- creators who turn account emails off in their settings are skipped.
-- (Marketing emails are opt-in here, so filing it there would reach almost
-- no one.) pg_cron queues the emails at 04:30 UTC (= 10:00 IST) and the email
-- queue sends them straight away; a second run the same day does nothing.
--
-- Delivery rows carry the message in a new `body` column, since there is no
-- notification behind them. Needs the matching send-notification update.

begin;

alter table public.email_deliveries
  add column if not exists body text check (body is null or char_length(body) <= 5000);

insert into public.platform_settings (key, value, description, is_public)
values (
  'daily_creator_email',
  jsonb_build_object(
    -- Starts off: switch it on in Admin -> Announcements once send-notification
    -- is updated (older versions would send these without their message).
    'enabled', false,
    'subject', '📢 Important Update for All Creators!',
    'body', $body$To make sure your profile attracts more brand collaborations and opportunities, please take a few minutes to complete the following steps:

✅ 1. Log in to Your Profile
Please log in to your account on our platform and check your profile carefully.

✅ 2. Verify Your Profile Details
Make sure all your information and data are accurate, complete, and up to date.

✅ 3. Upload Your Best Content
Upload your best pictures, videos, and content samples to showcase your creativity and help brands understand your work.

✅ 4. Keep Your Rates Reasonable
Please set your rates wisely and keep them competitive. Brands may overlook profiles with excessively high rates, so choose prices that reflect your experience and content quality.

💡 For Example: Keep your UGC content rates lower than your collaborative reel rates, as UGC collaborations generally have a different pricing structure from influencer collaborations.

Remember: A complete profile, high-quality content, and reasonable pricing can increase your chances of getting noticed by brands and receiving collaboration opportunities. 🚀

Thank you for being a part of our creator community! ❤️

Team House of Collabs$body$
  ),
  'Daily 10:00 IST email to creators. Edit in Admin -> Announcements.',
  false
)
on conflict (key) do nothing;

-- The daily reminder is an account email (creators can opt out of it).
CREATE OR REPLACE FUNCTION private.email_category(p_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_type in ('payment_failed', 'payout_failed', 'refund_processed',
                    'account_suspended', 'account_reactivated', 'profile_suspended',
                    'order_cancelled', 'order_expired')
      then 'critical'
    when p_type in ('order_new', 'order_accepted', 'order_approved', 'order_completed',
                    'order_in_progress', 'content_delivered', 'revision_requested',
                    'revision_submitted', 'shipment_required', 'shipment_update',
                    'review_received')
      then 'orders'
    when p_type in ('payment_received', 'earnings_available', 'payout_requested',
                    'payout_processed')
      then 'payments'
    when p_type in ('brief_received', 'campaign_review', 'campaign_approved', 'campaign_rejected',
                    'campaign_invite', 'campaign_application', 'campaign_accepted', 'campaign_declined')
      then 'campaigns'
    when p_type in ('welcome', 'onboarding_completed', 'profile_submitted',
                    'profile_approved', 'profile_rejected', 'creator_verified', 'creator_daily')
      then 'account'
    when p_type in ('announcement')
      then 'marketing'
    else 'account'
  end;
$function$;

-- Ask send-notification to work through the queue now (each call sends up to
-- 100), instead of waiting for the 5-minute worker.
create or replace function private.kick_email_queue(p_times int default 1)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_url using 'project_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_secret using 'notification_webhook_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  for i in 1 .. greatest(1, least(coalesce(p_times, 1), 10)) loop
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
      using rtrim(v_url, '/') || '/functions/v1/send-notification',
            jsonb_build_object('retry', true, 'limit', 100),
            jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
  end loop;
exception when others then
  raise warning 'email queue kick skipped: %', sqlerrm;
end;
$$;

-- Who gets it: active creator accounts whose storefront hasn't been removed,
-- and who haven't turned off account emails (or all emails).
create or replace function private.daily_creator_email_recipients()
returns table (profile_id uuid, email text)
language sql
stable
security definer
set search_path to ''
as $$
  select p.id, p.email
  from public.profiles p
  where p.role = 'creator'
    and p.status = 'active'
    and p.email is not null
    and exists (select 1 from public.creators c where c.profile_id = p.id and c.deleted_at is null)
    and private.wants_email(p.id, 'creator_daily');
$$;

-- Queue today's email. Does nothing when switched off or already sent today.
create or replace function private.queue_daily_creator_email()
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare
  v jsonb := (select value from public.platform_settings where key = 'daily_creator_email');
  v_count int;
begin
  if v is null or not coalesce((v ->> 'enabled')::boolean, false)
     or nullif(btrim(v ->> 'subject'), '') is null or nullif(btrim(v ->> 'body'), '') is null then
    return 0;
  end if;
  -- Once a day: a second run (or a retried cron) finds today's batch and stops.
  -- Test copies an admin sent themselves don't count.
  if exists (select 1 from public.email_deliveries d
             where d.email_type = 'creator_daily' and d.subject not like '[TEST]%'
               and (d.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date) then
    return 0;
  end if;

  insert into public.email_deliveries (user_id, recipient_email, email_type, category, subject, body)
  select r.profile_id, r.email, 'creator_daily', 'account', left(btrim(v ->> 'subject'), 300), left(v ->> 'body', 5000)
  from private.daily_creator_email_recipients() r;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform private.kick_email_queue(least(10, ceil(v_count / 100.0)::int));
  end if;
  return v_count;
end;
$$;

revoke execute on function private.kick_email_queue(int) from public, anon, authenticated;
revoke execute on function private.daily_creator_email_recipients() from public, anon, authenticated;
revoke execute on function private.queue_daily_creator_email() from public, anon, authenticated;

-- ------------------------------------------------------------ admin panel --

create or replace function public.admin_daily_creator_email()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v jsonb;
  v_last date;
begin
  perform private.require_admin();
  select value into v from public.platform_settings where key = 'daily_creator_email';
  select max((d.created_at at time zone 'Asia/Kolkata')::date) into v_last
  from public.email_deliveries d where d.email_type = 'creator_daily' and d.subject not like '[TEST]%';
  return coalesce(v, '{}'::jsonb) || jsonb_build_object(
    'recipients', (select count(*) from private.daily_creator_email_recipients()),
    'last_date', v_last,
    'last_count', (select count(*) from public.email_deliveries d
                   where d.email_type = 'creator_daily' and d.subject not like '[TEST]%'
                     and (d.created_at at time zone 'Asia/Kolkata')::date = v_last),
    'last_sent', (select count(*) from public.email_deliveries d
                  where d.email_type = 'creator_daily' and d.subject not like '[TEST]%' and d.status = 'sent'
                    and (d.created_at at time zone 'Asia/Kolkata')::date = v_last),
    'last_failed', (select count(*) from public.email_deliveries d
                    where d.email_type = 'creator_daily' and d.subject not like '[TEST]%' and d.status = 'failed'
                      and (d.created_at at time zone 'Asia/Kolkata')::date = v_last)
  );
end;
$$;

create or replace function public.admin_save_daily_creator_email(p_enabled boolean, p_subject text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
begin
  if char_length(btrim(coalesce(p_subject, ''))) not between 3 and 200 then
    raise exception 'The subject needs 3 to 200 characters.' using errcode = 'P0001', hint = 'SUBJECT_INVALID';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 20 and 5000 then
    raise exception 'The message needs 20 to 5,000 characters.' using errcode = 'P0001', hint = 'BODY_INVALID';
  end if;
  insert into public.platform_settings (key, value, description, is_public, updated_by)
  values ('daily_creator_email', jsonb_build_object('enabled', p_enabled, 'subject', btrim(p_subject), 'body', btrim(p_body)),
          'Daily 10:00 IST email to creators. Edit in Admin -> Announcements.', false, v_admin)
  on conflict (key) do update set value = excluded.value, updated_by = v_admin;
  perform private.audit('daily_creator_email_saved', 'platform_setting', 'daily_creator_email',
    jsonb_build_object('enabled', p_enabled, 'subject', btrim(p_subject)), v_admin, 'admin');
  return public.admin_daily_creator_email();
end;
$$;

-- A single copy to the admin who asks, using what's saved right now.
create or replace function public.admin_test_daily_creator_email()
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v jsonb := (select value from public.platform_settings where key = 'daily_creator_email');
  v_email text := (select email from public.profiles where id = v_admin);
begin
  if v_email is null then
    raise exception 'Your account has no email address.' using errcode = 'P0001', hint = 'NO_EMAIL';
  end if;
  insert into public.email_deliveries (user_id, recipient_email, email_type, category, subject, body)
  values (v_admin, v_email, 'creator_daily', 'account', '[TEST] ' || left(btrim(v ->> 'subject'), 293), left(v ->> 'body', 5000));
  perform private.kick_email_queue(1);
  return v_email;
end;
$$;

revoke execute on function public.admin_daily_creator_email() from public, anon;
revoke execute on function public.admin_save_daily_creator_email(boolean, text, text) from public, anon;
revoke execute on function public.admin_test_daily_creator_email() from public, anon;
grant execute on function public.admin_daily_creator_email() to authenticated;
grant execute on function public.admin_save_daily_creator_email(boolean, text, text) to authenticated;
grant execute on function public.admin_test_daily_creator_email() to authenticated;

-- ---------------------------------------------------------------- schedule --

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.unschedule(jobid) from cron.job where jobname = 'house-of-collabs-daily-creator-email';
    -- 04:30 UTC is 10:00 in India (no daylight saving there).
    perform cron.schedule('house-of-collabs-daily-creator-email', '30 4 * * *', 'select private.queue_daily_creator_email()');
  else
    raise notice 'pg_cron not available: call private.queue_daily_creator_email() daily another way.';
  end if;
exception when others then
  raise notice 'daily creator email schedule skipped: %', sqlerrm;
end;
$$;

commit;
