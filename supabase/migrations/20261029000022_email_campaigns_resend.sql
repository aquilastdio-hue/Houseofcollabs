-- 0022 - Email campaigns: send a campaign again
--
-- 0021 locked a campaign once it was sent. Admins reuse campaigns (send the
-- same email to someone else, or turn a one-off back into a daily email), so
-- a sent campaign can now be edited and launched again; its numbers keep
-- adding up across sends. Also counts emails that were logged but not sent
-- ("skipped", e.g. while no email provider is connected), so the admin page
-- can say so instead of showing them as simply undelivered.

begin;

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
    'skipped',   (select count(*) from public.email_deliveries d where d.campaign_id = c.id and d.subject not like '[TEST]%' and d.status = 'skipped'),
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

-- Create (no id) or edit a campaign, including one that was already sent.
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
    where c.id = p_campaign_id
    returning c.id into v_id;
    if v_id is null then
      raise exception 'Campaign not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
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
    -- A sent campaign can go out again (to a new audience, or as a daily email).
    if c.status not in ('draft', 'paused', 'sent') then
      raise exception 'This campaign is already running. Pause it first.' using errcode = 'P0001', hint = 'NOT_LAUNCHABLE';
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

revoke execute on function public.admin_save_email_campaign(uuid, jsonb) from public, anon;
revoke execute on function public.admin_email_campaign_action(uuid, text) from public, anon;
grant execute on function public.admin_save_email_campaign(uuid, jsonb) to authenticated;
grant execute on function public.admin_email_campaign_action(uuid, text) to authenticated;

commit;
