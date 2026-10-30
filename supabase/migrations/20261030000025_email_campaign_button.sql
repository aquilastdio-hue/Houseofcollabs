-- 0025 - Email campaigns can end with a button of the admin's choosing
--
-- Different campaigns point people at different places: "Update my profile",
-- "See open campaigns", "Post a campaign"... The admin now types the button's
-- words and picks the page on the site it opens (a path such as
-- /creator/services). Each queued email copies both, like it copies the
-- subject and message, and send-notification draws the button from them.
--
-- The daily creator email keeps the "Update my profile" button it always had,
-- now stored the same way. Safe to run more than once.

begin;

alter table public.email_campaigns
  add column if not exists button_label text,
  add column if not exists button_url text;

alter table public.email_deliveries
  add column if not exists button_label text,
  add column if not exists button_url text;

-- Both or neither; short words; a page on this site, never another site,
-- javascript: or a protocol-relative //host.
create or replace function private.email_button_ok(p_label text, p_url text)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(
    (p_label is null and p_url is null)
    or (p_label is not null and p_url is not null
        and char_length(btrim(p_label)) between 2 and 40
        and p_url ~ '^/($|[^/\s])[^\s]*$'
        and char_length(p_url) <= 500),
    false);
$$;

alter table public.email_campaigns drop constraint if exists email_campaigns_button_ok;
alter table public.email_campaigns
  add constraint email_campaigns_button_ok check (
    (button_label is null and button_url is null)
    or (button_label is not null and button_url is not null
        and char_length(btrim(button_label)) between 2 and 40
        and button_url ~ '^/($|[^/\s])[^\s]*$'
        and char_length(button_url) <= 500));

update public.email_campaigns
set button_label = 'Update my profile', button_url = '/creator/profile'
where email_type = 'creator_daily' and button_url is null;

-- ------------------------------------------------------------------ save ---
-- Same as 0022 plus the button. A save without the button keys keeps what the
-- campaign already had, so an older editor can't strip it by accident.
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
  v_has_button boolean := p_data ? 'button_url';
  v_label text := nullif(btrim(p_data ->> 'button_label'), '');
  v_url text := nullif(btrim(p_data ->> 'button_url'), '');
begin
  if v_has_button and not private.email_button_ok(v_label, v_url) then
    raise exception 'Give the button 2 to 40 characters of text and pick the page it opens.'
      using errcode = 'P0001', hint = 'BAD_BUTTON';
  end if;

  if p_campaign_id is null then
    insert into public.email_campaigns (subject, body, audience, recipient_ids, schedule, send_at, daily_time, button_label, button_url, created_by)
    values (btrim(p_data ->> 'subject'), btrim(p_data ->> 'body'), p_data ->> 'audience', v_ids, v_schedule,
            case when v_schedule = 'once' then v_send_at end, case when v_schedule = 'daily' then v_daily end,
            v_label, v_url, v_admin)
    returning id into v_id;
  else
    update public.email_campaigns c
    set subject = btrim(p_data ->> 'subject'), body = btrim(p_data ->> 'body'), audience = p_data ->> 'audience',
        recipient_ids = v_ids, schedule = v_schedule,
        send_at = case when v_schedule = 'once' then v_send_at end,
        daily_time = case when v_schedule = 'daily' then v_daily end,
        button_label = case when v_has_button then v_label else c.button_label end,
        button_url = case when v_has_button then v_url else c.button_url end,
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
    jsonb_build_object('subject', btrim(p_data ->> 'subject'), 'audience', p_data ->> 'audience', 'schedule', v_schedule,
                       'button', v_label, 'button_url', v_url), v_admin, 'admin');
  return v_id;
end;
$$;

-- ----------------------------------------------------------------- queue ---
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
  insert into public.email_deliveries (user_id, recipient_email, email_type, category, subject, body, button_label, button_url, campaign_id)
  select r.profile_id, r.email, v.email_type, 'account', left(btrim(v.subject), 300), left(v.body, 5000), v.button_label, v.button_url, v.id
  from private.email_campaign_recipients(v.audience, v.recipient_ids, v.email_type) r;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    perform private.kick_email_queue(least(10, ceil(v_count / 100.0)::int));
  end if;
  return v_count;
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
  insert into public.email_deliveries (user_id, recipient_email, email_type, category, subject, body, button_label, button_url, campaign_id)
  values (v_admin, v_email, c.email_type, 'account', '[TEST] ' || left(btrim(c.subject), 293), left(c.body, 5000), c.button_label, c.button_url, c.id);
  perform private.kick_email_queue(1);
  return v_email;
end;
$$;

revoke execute on function private.queue_email_campaign(uuid) from public, anon, authenticated;
revoke execute on function public.admin_save_email_campaign(uuid, jsonb) from public, anon;
revoke execute on function public.admin_test_email_campaign(uuid) from public, anon;
grant execute on function public.admin_save_email_campaign(uuid, jsonb) to authenticated;
grant execute on function public.admin_test_email_campaign(uuid) to authenticated;

commit;
