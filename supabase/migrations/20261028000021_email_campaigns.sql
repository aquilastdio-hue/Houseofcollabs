-- 0021 - Email campaigns (Admin -> Email campaigns)
--
-- Admins write an email once and choose who gets it and when:
--   audience: creators | brands | everyone | specific people
--   schedule: now | once (a date and time) | daily (a time of day, IST)
-- A campaign is a draft until launched. Launching "now" sends at once;
-- "once" waits for its time; "daily" runs every day at its time until paused.
--
-- Sending reuses the email queue: one email_deliveries row per person
-- (campaign_id set), then send-notification sends them. Emails count as
-- "account" email, so anyone who turned account emails off is skipped, as
-- are suspended accounts and creators whose storefront was removed.
--
-- pg_cron runs private.run_email_campaigns() every 5 minutes and sends
-- whatever is due. The daily creator email from 0020 becomes a daily campaign
-- here (same text, same on/off state, same "Update my profile" button), and
-- its old schedule and admin calls are removed so it can't send twice.

begin;

create table if not exists public.email_campaigns (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null check (char_length(btrim(subject)) between 3 and 200),
  body          text not null check (char_length(btrim(body)) between 20 and 5000),
  audience      text not null check (audience in ('creators', 'brands', 'everyone', 'specific')),
  recipient_ids uuid[] not null default '{}' check (cardinality(recipient_ids) <= 500),
  schedule      text not null check (schedule in ('now', 'once', 'daily')),
  send_at       timestamptz,
  daily_time    time,
  -- Which email template frames it. 'creator_daily' keeps the "Update my
  -- profile" button of the daily creator email; everything else is plain.
  email_type    text not null default 'email_campaign' check (email_type in ('email_campaign', 'creator_daily')),
  status        text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'sent')),
  next_run_at   timestamptz,
  last_run_at   timestamptz,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint email_campaigns_once_needs_time check (schedule <> 'once' or send_at is not null),
  constraint email_campaigns_daily_needs_time check (schedule <> 'daily' or daily_time is not null),
  constraint email_campaigns_specific_needs_people check (audience <> 'specific' or cardinality(recipient_ids) > 0)
);

create index if not exists email_campaigns_due_idx on public.email_campaigns (status, next_run_at);

drop trigger if exists email_campaigns_set_updated_at on public.email_campaigns;
create trigger email_campaigns_set_updated_at before update on public.email_campaigns
  for each row execute function private.set_updated_at();

alter table public.email_campaigns enable row level security;
revoke all on public.email_campaigns from anon, authenticated;
grant all on public.email_campaigns to service_role;

alter table public.email_deliveries
  add column if not exists campaign_id uuid references public.email_campaigns (id) on delete set null;
create index if not exists email_deliveries_campaign_idx on public.email_deliveries (campaign_id, created_at desc);

-- ----------------------------------------------------------------- helpers --

-- The next time a daily campaign should run: today at that time (IST) if it's
-- still ahead, otherwise tomorrow.
create or replace function private.next_daily_run(p_time time, p_after timestamptz default now())
returns timestamptz
language sql
stable
set search_path to ''
as $$
  select case when c > p_after then c else c + interval '1 day' end
  from (select (((p_after at time zone 'Asia/Kolkata')::date + p_time)::timestamp at time zone 'Asia/Kolkata') as c) x;
$$;

create or replace function private.email_campaign_recipients(p_audience text, p_ids uuid[], p_email_type text)
returns table (profile_id uuid, email text)
language sql
stable
security definer
set search_path to ''
as $$
  select p.id, p.email
  from public.profiles p
  where p.status = 'active'
    and p.email is not null
    and private.wants_email(p.id, p_email_type)
    and case p_audience
          when 'specific' then p.id = any(coalesce(p_ids, '{}'))
          when 'creators' then p.role = 'creator'
          when 'brands'   then p.role = 'brand'
          when 'everyone' then p.role in ('creator', 'brand')
          else false
        end
    -- Creators only while their storefront exists (removed ones are skipped).
    and (p.role <> 'creator' or exists (select 1 from public.creators c where c.profile_id = p.id and c.deleted_at is null));
$$;

-- Put one email per recipient on the queue and start sending.
create or replace function private.queue_email_campaign(p_campaign_id uuid)
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare
  v public.email_campaigns;
  v_count int;
begin
  select * into v from public.email_campaigns where id = p_campaign_id;
  if not found then
    return 0;
  end if;
  insert into public.email_deliveries (user_id, recipient_email, email_type, category, subject, body, campaign_id)
  select r.profile_id, r.email, v.email_type, 'account', left(btrim(v.subject), 300), left(v.body, 5000), v.id
  from private.email_campaign_recipients(v.audience, v.recipient_ids, v.email_type) r;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    perform private.kick_email_queue(least(10, ceil(v_count / 100.0)::int));
  end if;
  return v_count;
end;
$$;

-- Every 5 minutes: send what's due.
create or replace function private.run_email_campaigns()
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare
  c public.email_campaigns;
  v_runs int := 0;
begin
  for c in
    select * from public.email_campaigns
    where status in ('scheduled', 'active') and next_run_at is not null and next_run_at <= now()
    order by next_run_at
    for update skip locked
  loop
    perform private.queue_email_campaign(c.id);
    if c.schedule = 'daily' then
      update public.email_campaigns
      set last_run_at = now(), next_run_at = private.next_daily_run(c.daily_time, now())
      where id = c.id;
    else
      update public.email_campaigns set status = 'sent', last_run_at = now(), next_run_at = null where id = c.id;
    end if;
    v_runs := v_runs + 1;
  end loop;
  return v_runs;
end;
$$;

revoke execute on function private.next_daily_run(time, timestamptz) from public, anon, authenticated;
revoke execute on function private.email_campaign_recipients(text, uuid[], text) from public, anon, authenticated;
revoke execute on function private.queue_email_campaign(uuid) from public, anon, authenticated;
revoke execute on function private.run_email_campaigns() from public, anon, authenticated;

-- A campaign with its numbers, for the admin page.
create or replace function private.email_campaign_json(c public.email_campaigns)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select to_jsonb(c) || jsonb_build_object(
    'total',     (select count(*) from public.email_deliveries d where d.campaign_id = c.id and d.subject not like '[TEST]%'),
    'delivered', (select count(*) from public.email_deliveries d where d.campaign_id = c.id and d.subject not like '[TEST]%' and d.status = 'sent'),
    'failed',    (select count(*) from public.email_deliveries d where d.campaign_id = c.id and d.subject not like '[TEST]%' and d.status = 'failed'),
    'waiting',   (select count(*) from public.email_deliveries d where d.campaign_id = c.id and d.subject not like '[TEST]%' and d.status in ('pending', 'processing')),
    'last_run_count', (select count(*) from public.email_deliveries d
                       where d.campaign_id = c.id and d.subject not like '[TEST]%' and c.last_run_at is not null
                         and d.created_at >= c.last_run_at - interval '1 minute'),
    'recipients_now', (select count(*) from private.email_campaign_recipients(c.audience, c.recipient_ids, c.email_type)),
    'people', case when c.audience = 'specific' then coalesce((
                select jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(p.full_name, p.email), 'email', p.email,
                                                    'role', p.role, 'avatar', p.avatar_url) order by p.full_name)
                from public.profiles p where p.id = any(c.recipient_ids)), '[]'::jsonb) else '[]'::jsonb end
  );
$$;

revoke execute on function private.email_campaign_json(public.email_campaigns) from public, anon, authenticated;

-- ------------------------------------------------------------ admin calls --

create or replace function public.admin_email_campaigns()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform private.require_admin();
  return coalesce((
    select jsonb_agg(private.email_campaign_json(c)
                     order by (c.status in ('active', 'scheduled')) desc, coalesce(c.last_run_at, c.created_at) desc)
    from public.email_campaigns c
  ), '[]'::jsonb);
end;
$$;

-- How many people an audience reaches right now (before saving).
create or replace function public.admin_email_campaign_reach(p_audience text, p_ids uuid[] default '{}')
returns int
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform private.require_admin();
  return (select count(*) from private.email_campaign_recipients(p_audience, p_ids, 'email_campaign'));
end;
$$;

-- Create (no id) or edit a campaign that hasn't finished sending.
create or replace function public.admin_save_email_campaign(p_campaign_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_id uuid;
  v_ids uuid[] := coalesce((select array_agg(distinct x::uuid) from jsonb_array_elements_text(coalesce(p_data -> 'recipient_ids', '[]')) x), '{}');
  v_schedule text := p_data ->> 'schedule';
  v_daily time := nullif(p_data ->> 'daily_time', '')::time;
  v_send_at timestamptz := nullif(p_data ->> 'send_at', '')::timestamptz;
begin
  if p_campaign_id is null then
    insert into public.email_campaigns (subject, body, audience, recipient_ids, schedule, send_at, daily_time, created_by)
    values (btrim(p_data ->> 'subject'), btrim(p_data ->> 'body'), p_data ->> 'audience', v_ids, v_schedule,
            case when v_schedule = 'once' then v_send_at end, case when v_schedule = 'daily' then v_daily end, v_admin)
    returning id into v_id;
  else
    update public.email_campaigns c
    set subject = btrim(p_data ->> 'subject'), body = btrim(p_data ->> 'body'), audience = p_data ->> 'audience',
        recipient_ids = v_ids, schedule = v_schedule,
        send_at = case when v_schedule = 'once' then v_send_at end,
        daily_time = case when v_schedule = 'daily' then v_daily end,
        -- A live campaign picks up its new timing straight away.
        next_run_at = case
          when c.status = 'active' and v_schedule = 'daily' then private.next_daily_run(v_daily, now())
          when c.status = 'scheduled' and v_schedule = 'once' then v_send_at
          else c.next_run_at end,
        status = case
          when c.status = 'active' and v_schedule <> 'daily' then 'paused'
          when c.status = 'scheduled' and v_schedule <> 'once' then 'paused'
          else c.status end
    where c.id = p_campaign_id and c.status <> 'sent'
    returning c.id into v_id;
    if v_id is null then
      raise exception 'A campaign that has already been sent can’t be edited.' using errcode = 'P0001', hint = 'ALREADY_SENT';
    end if;
  end if;
  perform private.audit('email_campaign_saved', 'email_campaign', v_id::text,
    jsonb_build_object('subject', btrim(p_data ->> 'subject'), 'audience', p_data ->> 'audience', 'schedule', v_schedule), v_admin, 'admin');
  return v_id;
end;
$$;

-- launch | pause | resume | delete
create or replace function public.admin_email_campaign_action(p_campaign_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  c public.email_campaigns;
  v_count int := 0;
begin
  select * into c from public.email_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'Campaign not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  if p_action in ('launch', 'resume') then
    if c.status not in ('draft', 'paused') then
      raise exception 'This campaign is already running or sent.' using errcode = 'P0001', hint = 'NOT_LAUNCHABLE';
    end if;
    if c.schedule = 'now' then
      v_count := private.queue_email_campaign(c.id);
      update public.email_campaigns set status = 'sent', last_run_at = now(), next_run_at = null where id = c.id;
    elsif c.schedule = 'once' then
      if c.send_at <= now() then
        raise exception 'That time has passed. Pick a time in the future, or send it now.' using errcode = 'P0001', hint = 'TIME_PASSED';
      end if;
      update public.email_campaigns set status = 'scheduled', next_run_at = c.send_at where id = c.id;
    else
      update public.email_campaigns set status = 'active', next_run_at = private.next_daily_run(c.daily_time, now()) where id = c.id;
    end if;
  elsif p_action = 'pause' then
    if c.status not in ('active', 'scheduled') then
      raise exception 'Only a scheduled or daily campaign can be paused.' using errcode = 'P0001', hint = 'NOT_RUNNING';
    end if;
    update public.email_campaigns set status = 'paused', next_run_at = null where id = c.id;
  elsif p_action = 'delete' then
    if c.status in ('active', 'scheduled') then
      raise exception 'Pause it first.' using errcode = 'P0001', hint = 'RUNNING';
    end if;
    delete from public.email_campaigns where id = c.id;
  else
    raise exception 'Unknown action.' using errcode = 'P0001', hint = 'BAD_ACTION';
  end if;

  perform private.audit('email_campaign_' || p_action, 'email_campaign', c.id::text,
    jsonb_build_object('subject', c.subject, 'queued', v_count), v_admin, 'admin');
  return jsonb_build_object('action', p_action, 'queued', v_count);
end;
$$;

-- One copy to the admin who asks.
create or replace function public.admin_test_email_campaign(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  c public.email_campaigns;
  v_email text := (select email from public.profiles where id = v_admin);
begin
  select * into c from public.email_campaigns where id = p_campaign_id;
  if not found then
    raise exception 'Campaign not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  if v_email is null then
    raise exception 'Your account has no email address.' using errcode = 'P0001', hint = 'NO_EMAIL';
  end if;
  insert into public.email_deliveries (user_id, recipient_email, email_type, category, subject, body, campaign_id)
  values (v_admin, v_email, c.email_type, 'account', '[TEST] ' || left(btrim(c.subject), 293), left(c.body, 5000), c.id);
  perform private.kick_email_queue(1);
  return v_email;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_email_campaigns()', 'public.admin_email_campaign_reach(text, uuid[])',
    'public.admin_save_email_campaign(uuid, jsonb)', 'public.admin_email_campaign_action(uuid, text)',
    'public.admin_test_email_campaign(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- ---------------------------------- bring in the daily creator email (0020) --

do $$
declare
  v jsonb := (select value from public.platform_settings where key = 'daily_creator_email');
  v_id uuid;
begin
  if v is not null and not exists (select 1 from public.email_campaigns where email_type = 'creator_daily') then
    insert into public.email_campaigns (subject, body, audience, schedule, daily_time, email_type, status, next_run_at, last_run_at)
    values (v ->> 'subject', v ->> 'body', 'creators', 'daily', '10:00', 'creator_daily',
            case when coalesce((v ->> 'enabled')::boolean, false) then 'active' else 'paused' end,
            case when coalesce((v ->> 'enabled')::boolean, false) then private.next_daily_run('10:00', now()) end,
            (select max(d.created_at) from public.email_deliveries d where d.email_type = 'creator_daily' and d.subject not like '[TEST]%'))
    returning id into v_id;
    update public.email_deliveries set campaign_id = v_id where email_type = 'creator_daily' and campaign_id is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------- schedule --

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    -- The 0020 job is replaced by the campaign runner (the daily email is a campaign now).
    perform cron.unschedule(jobid) from cron.job where jobname = 'house-of-collabs-daily-creator-email';
    perform cron.unschedule(jobid) from cron.job where jobname = 'house-of-collabs-email-campaigns';
    perform cron.schedule('house-of-collabs-email-campaigns', '*/5 * * * *', 'select private.run_email_campaigns()');
  else
    raise notice 'pg_cron not available: call private.run_email_campaigns() every few minutes another way.';
  end if;
exception when others then
  raise notice 'email campaign schedule skipped: %', sqlerrm;
end;
$$;

-- The 0020 settings card is replaced by this page, so its calls go too.
drop function if exists public.admin_daily_creator_email();
drop function if exists public.admin_save_daily_creator_email(boolean, text, text);
drop function if exists public.admin_test_daily_creator_email();
drop function if exists private.queue_daily_creator_email();
drop function if exists private.daily_creator_email_recipients();

commit;
