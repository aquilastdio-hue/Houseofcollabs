-- =============================================================================
-- House of Collabs | 0051 | remove direct brand <-> creator messaging
-- =============================================================================
-- Brands and creators can no longer contact each other privately on the
-- platform. Everything that carried a private conversation is removed here:
-- the two tables, the RPCs in front of them, the notification triggers, the
-- attachment bucket and the Realtime channel policies.
--
-- What deliberately stays:
--
--   * `disputes` and `dispute_messages` -- an admin-mediated channel, rebuilt
--     separately so neither side ever writes to the other directly.
--   * `contact_messages` -- the public contact form, which writes to us.
--   * `notifications` -- how a creator learns a brief arrived, now that no
--     conversation is opened alongside it.
--
-- Five functions merely *mentioned* messages and are replaced whole, because
-- a function body cannot be edited in place. Their logic is otherwise the text
-- that is live today:
--
--   get_unread_counts           -- drops the 'messages' key, keeps notifications
--   get_creator_dashboard_stats -- drops 'conversations' and 'unread_messages'
--   get_brand_dashboard_stats   -- drops 'unread_messages'
--   send_brief                  -- no longer opens a conversation beside the brief
--   create_report               -- a message is no longer a reportable target
--
-- THIS DELETES DATA. Every conversation and message on the platform goes, and
-- there is no undo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Functions that read messages, replaced with versions that do not.
--    These run first so nothing depends on the tables by the time they drop.
-- -----------------------------------------------------------------------------
create or replace function public.get_unread_counts()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'notifications', (
      select count(*) from public.notifications n
      where n.user_id = (select auth.uid()) and not n.read
    )
  );
$$;

create or replace function public.get_creator_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_c public.creators;
  v_orders_total int;
begin
  select * into v_c from public.creators where profile_id = auth.uid();
  if not found then
    raise exception 'Creator profile not found.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  select count(*) into v_orders_total from public.orders o
  where o.creator_id = v_c.id and o.status not in ('draft', 'payment_pending');

  return jsonb_build_object(
    'status', v_c.status,
    'profile_views_total', v_c.profile_views,
    'profile_views_30d', (select count(*) from public.creator_profile_views v where v.creator_id = v_c.id and v.created_at > now() - interval '30 days'),
    'profile_views_prev_30d', (select count(*) from public.creator_profile_views v where v.creator_id = v_c.id
                                 and v.created_at between now() - interval '60 days' and now() - interval '30 days'),
    'wishlist_adds', v_c.wishlist_count,
    'orders_total', v_orders_total,
    'orders_pending_acceptance', (select count(*) from public.orders o where o.creator_id = v_c.id and o.status = 'creator_pending'),
    'orders_active', (select count(*) from public.orders o where o.creator_id = v_c.id and o.status in
      ('accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered', 'revision_requested', 'revision_submitted', 'disputed')),
    'pending_deliveries', (select count(*) from public.orders o where o.creator_id = v_c.id and o.status in
      ('accepted', 'received', 'in_progress', 'revision_requested')),
    'completed_orders', (select count(*) from public.orders o where o.creator_id = v_c.id and o.status = 'completed'),
    'conversion_rate', case when v_c.profile_views > 0 then round(v_orders_total * 100.0 / v_c.profile_views, 1) else 0 end,
    'revenue_total', (select coalesce(sum(e.net_amount), 0) from public.creator_earnings e where e.creator_id = v_c.id and e.status <> 'refunded'),
    'revenue_30d', (select coalesce(sum(e.net_amount), 0) from public.creator_earnings e where e.creator_id = v_c.id
                      and e.status <> 'refunded' and e.created_at > now() - interval '30 days'),
    'new_opportunities', (select count(*) from public.briefs b where b.creator_id = v_c.id and b.status = 'sent'),
    'rating', v_c.rating,
    'review_count', v_c.review_count,
    'views_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'views', coalesce(v.cnt, 0)) order by d.day), '[]'::jsonb)
      from generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') as d(day)
      left join (
        select created_at::date as day, count(*) as cnt from public.creator_profile_views
        where creator_id = v_c.id and created_at > now() - interval '14 days'
        group by 1
      ) v on v.day = d.day::date
    )
  );
end;
$$;

create or replace function public.get_brand_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_brand uuid := private.my_brand_id();
begin
  if v_brand is null then
    raise exception 'Brand profile not found.' using errcode = 'P0002', hint = 'BRAND_REQUIRED';
  end if;
  return jsonb_build_object(
    'creator_searches_30d', (select count(*) from public.search_events s where s.profile_id = auth.uid() and s.created_at > now() - interval '30 days'),
    'creator_profile_views_30d', (select count(*) from public.creator_profile_views v where v.viewer_id = auth.uid() and v.created_at > now() - interval '30 days'),
    'orders_total', (select count(*) from public.orders o where o.brand_id = v_brand and o.status <> 'draft'),
    'orders_active', (select count(*) from public.orders o where o.brand_id = v_brand and o.status in
      ('creator_pending', 'accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
       'revision_requested', 'revision_submitted', 'disputed')),
    'completed_orders', (select count(*) from public.orders o where o.brand_id = v_brand and o.status = 'completed'),
    'spend_total', (select coalesce(sum(p.amount - p.refunded_amount), 0) from public.payments p
                    join public.orders o on o.id = p.order_id
                    where o.brand_id = v_brand and p.status in ('captured', 'partially_refunded', 'refunded')),
    'spend_30d', (select coalesce(sum(p.amount - p.refunded_amount), 0) from public.payments p
                  join public.orders o on o.id = p.order_id
                  where o.brand_id = v_brand and p.status in ('captured', 'partially_refunded', 'refunded')
                    and p.captured_at > now() - interval '30 days'),
    'active_campaigns', (select count(distinct coalesce(o.brief_id, o.id)) from public.orders o where o.brand_id = v_brand and o.status in
      ('creator_pending', 'accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
       'revision_requested', 'revision_submitted')),
    'pending_actions', jsonb_build_object(
      'payment_pending', (select count(*) from public.orders o where o.brand_id = v_brand and o.status = 'payment_pending'),
      'awaiting_shipment', (select count(*) from public.orders o where o.brand_id = v_brand and o.status = 'awaiting_shipment'),
      'awaiting_review', (select count(*) from public.orders o where o.brand_id = v_brand and o.status in ('delivered', 'revision_submitted')),
      'draft_briefs', (select count(*) from public.briefs b where b.brand_id = v_brand and b.status = 'draft'),
      'reviews_due', (select count(*) from public.orders o where o.brand_id = v_brand and o.status = 'completed'
                        and not exists (select 1 from public.reviews r where r.order_id = o.id and r.reviewer_id = auth.uid()))
    ),
    'wishlisted_creators', (select count(distinct wi.creator_id) from public.wishlist_items wi
                            join public.wishlists w on w.id = wi.wishlist_id where w.brand_id = v_brand)
  );
end;
$$;

create or replace function public.send_brief(p_brief_id uuid, p_creator_id uuid)
returns public.briefs
language plpgsql security definer set search_path = ''
as $$
declare
  v_brief public.briefs;
  v_brand public.brands;
  v_creator_profile uuid;
begin
  select * into v_brand from public.brands where profile_id = auth.uid();
  select * into v_brief from public.briefs where id = p_brief_id and brand_id = v_brand.id for update;
  if not found then
    raise exception 'Brief not found.' using errcode = 'P0002', hint = 'BRIEF_NOT_FOUND';
  end if;
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;
  if v_brief.status not in ('draft', 'rejected', 'sent') then
    raise exception 'This brief can no longer be sent.' using errcode = 'P0001', hint = 'INVALID_BRIEF_STATE';
  end if;
  if not private.is_creator_public(p_creator_id) then
    raise exception 'This creator is not available.' using errcode = 'P0001', hint = 'CREATOR_UNAVAILABLE';
  end if;

  update public.briefs
  set creator_id = p_creator_id, status = 'sent', sent_at = now(), responded_at = null, response_note = null
  where id = v_brief.id returning * into v_brief;

  select c.profile_id into v_creator_profile from public.creators c where c.id = p_creator_id;
  perform private.notify(v_creator_profile, 'brief_received', format('New brief from %s', v_brand.brand_name),
    v_brief.title, 'brief', v_brief.id, '/creator/briefs/' || v_brief.id);
  perform private.audit('brief_sent', 'brief', v_brief.id::text, jsonb_build_object('creator_id', p_creator_id), auth.uid(), 'brand');
  return v_brief;
end;
$$;

create or replace function public.create_report(
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason text,
  p_description text default null
)
returns public.reports
language plpgsql security definer set search_path = ''
as $$
declare
  v_report public.reports;
  v_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'Please sign in to report content.' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;
  if (select count(*) from public.reports r where r.reported_by = auth.uid() and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have reached the daily report limit.' using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;

  v_exists := case p_target_type
    when 'creator' then exists (select 1 from public.creators where id = p_target_id)
    when 'brand' then exists (select 1 from public.brands where id = p_target_id)
    when 'portfolio' then exists (select 1 from public.portfolio_items where id = p_target_id)
    when 'review' then exists (select 1 from public.reviews where id = p_target_id)
    when 'order' then private.is_order_participant(p_target_id)
  end;
  if not coalesce(v_exists, false) then
    raise exception 'The reported item could not be found.' using errcode = 'P0002', hint = 'TARGET_NOT_FOUND';
  end if;

  insert into public.reports (reported_by, target_type, target_id, reason, description)
  values (auth.uid(), p_target_type, p_target_id, left(btrim(p_reason), 120), nullif(btrim(p_description), ''))
  returning * into v_report;

  perform private.notify_admins('report_created', 'New report',
    format('A %s was reported: %s', p_target_type, left(btrim(p_reason), 80)), 'report', v_report.id, '/admin/reports');
  perform private.audit('report_created', 'report', v_report.id::text,
    jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id), auth.uid(), null);
  return v_report;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Realtime: stop publishing the tables and drop the channel policies that
--    let two participants share a `conversation:<id>` topic.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime drop table public.messages;
    end if;
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
    ) then
      alter publication supabase_realtime drop table public.conversations;
    end if;
  end if;
end;
$$;

drop policy if exists "Conversation participants receive channel events" on realtime.messages;
drop policy if exists "Conversation participants send channel events" on realtime.messages;

-- -----------------------------------------------------------------------------
-- 3. Attachments. Dropping the three policies is what actually closes the
--    bucket: with no policy left, RLS denies every read and write to everyone.
--
--    The bucket row itself stays behind. Supabase guards storage.buckets and
--    storage.objects with a trigger that refuses direct SQL deletes and points
--    at the Storage API instead, so removing the (empty) bucket is a dashboard
--    step: Storage -> message-attachments -> Delete bucket. It holds no files.
-- -----------------------------------------------------------------------------
drop policy if exists "message-attachments: participants upload" on storage.objects;
drop policy if exists "message-attachments: participants and admins read" on storage.objects;
drop policy if exists "message-attachments: uploader deletes" on storage.objects;

-- -----------------------------------------------------------------------------
-- 4. The RPCs the client called, and the triggers behind them.
-- -----------------------------------------------------------------------------
drop function if exists public.start_conversation(uuid, uuid);
drop function if exists public.get_my_conversations(boolean, text);
drop function if exists public.mark_conversation_read(uuid);
drop function if exists public.set_conversation_archived(uuid, boolean);
drop function if exists private.ensure_conversation(uuid, uuid, uuid, text);

-- -----------------------------------------------------------------------------
-- 5. Notifications that point at a conversation would 404 from here on.
-- -----------------------------------------------------------------------------
delete from public.notifications where reference_type = 'conversation' or type = 'message';

-- -----------------------------------------------------------------------------
-- 6. The tables. `cascade` carries the indexes, RLS policies, the updated_at
--    trigger and the two message triggers with them.
-- -----------------------------------------------------------------------------
drop table if exists public.messages cascade;
drop table if exists public.conversation_participants cascade;
drop table if exists public.conversations cascade;

drop function if exists private.messages_before_insert();
drop function if exists private.messages_after_insert();
drop function if exists private.is_conversation_participant(uuid);

-- -----------------------------------------------------------------------------
-- 7. `report_target` keeps its 'message' value: Postgres cannot remove a value
--    from an enum in use, and create_report no longer accepts it anyway.
--    Historic reports against a message are left as an audit record.
-- -----------------------------------------------------------------------------
