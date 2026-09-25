-- =============================================================================
-- Spotlit · 0007 · messaging + notifications
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Conversations: exactly one per brand/creator pair, two participants.
-- -----------------------------------------------------------------------------
create or replace function private.ensure_conversation(
  p_brand_id uuid,
  p_creator_id uuid,
  p_order_id uuid default null,
  p_system_message text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_brand_profile uuid;
  v_creator_profile uuid;
begin
  select b.profile_id into v_brand_profile from public.brands b where b.id = p_brand_id;
  select c.profile_id into v_creator_profile from public.creators c where c.id = p_creator_id;
  if v_brand_profile is null or v_creator_profile is null then
    raise exception 'Conversation participants not found.' using errcode = 'P0002', hint = 'PARTICIPANT_NOT_FOUND';
  end if;

  select id into v_id from public.conversations
  where brand_id = p_brand_id and creator_id = p_creator_id and type = 'direct';

  if v_id is null then
    insert into public.conversations (type, brand_id, creator_id, order_id)
    values ('direct', p_brand_id, p_creator_id, p_order_id)
    on conflict (brand_id, creator_id) where type = 'direct' do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.conversations
      where brand_id = p_brand_id and creator_id = p_creator_id and type = 'direct';
    end if;
  end if;

  insert into public.conversation_participants (conversation_id, profile_id, participant_role)
  values (v_id, v_brand_profile, 'brand'), (v_id, v_creator_profile, 'creator')
  on conflict (conversation_id, profile_id) do nothing;

  if p_order_id is not null then
    update public.conversations set order_id = p_order_id where id = v_id;
  end if;

  if p_system_message is not null then
    insert into public.messages (conversation_id, sender_id, body, message_type, metadata)
    values (v_id, null, p_system_message, 'system',
            case when p_order_id is not null then jsonb_build_object('order_id', p_order_id) else '{}'::jsonb end);
  end if;
  return v_id;
end;
$$;

-- Brands can message any published creator. Creators can only reply/initiate
-- with brands they already have a relationship with (anti-spam).
create or replace function public.start_conversation(p_creator_id uuid default null, p_brand_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role := private.user_role();
  v_my_brand uuid := private.my_brand_id();
  v_my_creator uuid := private.my_creator_id();
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue.' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;

  if v_role = 'brand' then
    if v_my_brand is null then
      raise exception 'Complete your brand profile before messaging creators.' using errcode = 'P0001', hint = 'BRAND_REQUIRED';
    end if;
    if p_creator_id is null or not private.is_creator_public(p_creator_id) then
      raise exception 'This creator is not available for messages.' using errcode = 'P0001', hint = 'CREATOR_UNAVAILABLE';
    end if;
    return private.ensure_conversation(v_my_brand, p_creator_id);
  elsif v_role = 'creator' then
    if v_my_creator is null or p_brand_id is null or not private.can_view_brand(p_brand_id) then
      raise exception 'You can message brands after they contact you or place an order.' using errcode = 'P0001', hint = 'NO_RELATIONSHIP';
    end if;
    return private.ensure_conversation(p_brand_id, v_my_creator);
  end if;
  raise exception 'Messaging is available to brands and creators.' using errcode = '42501', hint = 'ROLE_REQUIRED';
end;
$$;

-- Inbox listing with counterpart info and unread counts (single round trip).
create or replace function public.get_my_conversations(p_archived boolean default false, p_search text default null)
returns table (
  id uuid,
  brand_id uuid,
  creator_id uuid,
  order_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid,
  unread_count int,
  archived boolean,
  muted boolean,
  my_role public.actor_role,
  counterpart_profile_id uuid,
  counterpart_name text,
  counterpart_avatar_url text,
  counterpart_slug text,
  counterpart_verified boolean,
  counterpart_last_seen_at timestamptz,
  created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    cv.id,
    cv.brand_id,
    cv.creator_id,
    cv.order_id,
    cv.last_message_at,
    cv.last_message_preview,
    cv.last_message_sender_id,
    (
      select count(*)::int from public.messages m
      where m.conversation_id = cv.id
        and m.deleted_at is null
        and m.sender_id is distinct from me.profile_id
        and m.message_type <> 'system'
        and m.created_at > coalesce(me.last_read_at, '-infinity'::timestamptz)
    ) as unread_count,
    me.archived,
    me.muted,
    me.participant_role as my_role,
    case when me.participant_role = 'brand' then c.profile_id else b.profile_id end as counterpart_profile_id,
    case when me.participant_role = 'brand' then c.display_name else b.brand_name end as counterpart_name,
    case when me.participant_role = 'brand' then c.profile_image_url else b.brand_logo_url end as counterpart_avatar_url,
    case when me.participant_role = 'brand' then c.slug else b.brand_slug end as counterpart_slug,
    case when me.participant_role = 'brand' then c.verified else false end as counterpart_verified,
    op.last_seen_at as counterpart_last_seen_at,
    cv.created_at
  from public.conversation_participants me
  join public.conversations cv on cv.id = me.conversation_id
  join public.brands b on b.id = cv.brand_id
  join public.creators c on c.id = cv.creator_id
  left join public.profiles op on op.id = case when me.participant_role = 'brand' then c.profile_id else b.profile_id end
  where me.profile_id = (select auth.uid())
    and me.archived = coalesce(p_archived, false)
    and (
      nullif(btrim(p_search), '') is null
      or (case when me.participant_role = 'brand' then c.display_name else b.brand_name end)
           ilike '%' || private.like_escape(btrim(p_search)) || '%'
      or cv.last_message_preview ilike '%' || private.like_escape(btrim(p_search)) || '%'
    )
  order by coalesce(cv.last_message_at, cv.created_at) desc;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversation_participants
  set last_read_at = clock_timestamp()
  where conversation_id = p_conversation_id and profile_id = auth.uid();

  update public.notifications
  set read = true, read_at = now()
  where user_id = auth.uid() and type = 'message' and reference_id = p_conversation_id and not read;
end;
$$;

create or replace function public.set_conversation_archived(p_conversation_id uuid, p_archived boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversation_participants
  set archived = coalesce(p_archived, false)
  where conversation_id = p_conversation_id and profile_id = auth.uid();
  if not found then
    raise exception 'Conversation not found.' using errcode = 'P0002', hint = 'CONVERSATION_NOT_FOUND';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Message triggers
-- -----------------------------------------------------------------------------
create or replace function private.messages_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_att jsonb;
begin
  new.body := nullif(btrim(new.body), '');
  if jsonb_array_length(new.attachments) > 10 then
    raise exception 'You can attach up to 10 files per message.' using errcode = 'P0001', hint = 'TOO_MANY_ATTACHMENTS';
  end if;
  for v_att in select * from jsonb_array_elements(new.attachments) loop
    if jsonb_typeof(v_att) <> 'object'
      or split_part(coalesce(v_att ->> 'path', ''), '/', 1) <> new.conversation_id::text then
      raise exception 'Invalid attachment.' using errcode = 'P0001', hint = 'INVALID_ATTACHMENT';
    end if;
  end loop;
  new.created_at := clock_timestamp();
  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function private.messages_before_insert();

create or replace function private.messages_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_sender_name text;
  v_preview text;
  v_recipient record;
  v_existing uuid;
begin
  v_preview := left(coalesce(
    new.body,
    case when jsonb_array_length(new.attachments) > 1 then jsonb_array_length(new.attachments) || ' attachments'
         when jsonb_array_length(new.attachments) = 1 then coalesce(new.attachments -> 0 ->> 'name', 'Attachment')
    end,
    ''
  ), 160);

  update public.conversations
  set last_message_at = new.created_at,
      last_message_preview = v_preview,
      last_message_sender_id = new.sender_id
  where id = new.conversation_id;

  if new.sender_id is null or new.message_type = 'system' then
    return null;
  end if;

  -- Sender has read their own conversation; recipients see it un-archived.
  update public.conversation_participants set last_read_at = new.created_at
  where conversation_id = new.conversation_id and profile_id = new.sender_id;
  update public.conversation_participants set archived = false
  where conversation_id = new.conversation_id and profile_id <> new.sender_id and archived;

  select coalesce(
    (select b.brand_name from public.brands b where b.profile_id = new.sender_id),
    (select c.display_name from public.creators c where c.profile_id = new.sender_id),
    (select p.full_name from public.profiles p where p.id = new.sender_id),
    'Someone'
  ) into v_sender_name;

  for v_recipient in
    select cp.profile_id, cp.participant_role, cp.muted
    from public.conversation_participants cp
    where cp.conversation_id = new.conversation_id and cp.profile_id <> new.sender_id
  loop
    continue when v_recipient.muted;
    v_existing := null;
    -- Coalesce: keep a single unread "message" notification per conversation.
    update public.notifications
    set title = format('New message from %s', v_sender_name),
        message = v_preview,
        created_at = now()
    where user_id = v_recipient.profile_id and type = 'message'
      and reference_id = new.conversation_id and not read
    returning id into v_existing;

    if v_existing is null then
      perform private.notify(
        v_recipient.profile_id, 'message', format('New message from %s', v_sender_name), v_preview,
        'conversation', new.conversation_id,
        case v_recipient.participant_role when 'brand' then '/brand/messages/' when 'creator' then '/creator/messages/' else '/admin/' end
          || new.conversation_id
      );
    end if;
  end loop;

  perform private.audit('message_sent', 'conversation', new.conversation_id::text,
    jsonb_build_object('message_id', new.id, 'attachments', jsonb_array_length(new.attachments)), new.sender_id, null);
  return null;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function private.messages_after_insert();

-- -----------------------------------------------------------------------------
-- Notifications (spec: mark_notification_read)
-- -----------------------------------------------------------------------------
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.notifications
  set read = true, read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = (select auth.uid());
$$;

create or replace function public.mark_all_notifications_read()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  update public.notifications
  set read = true, read_at = now()
  where user_id = auth.uid() and not read;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.get_unread_counts()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'notifications', (
      select count(*) from public.notifications n
      where n.user_id = (select auth.uid()) and not n.read
    ),
    'messages', (
      select count(*) from public.conversation_participants me
      join public.messages m on m.conversation_id = me.conversation_id
      where me.profile_id = (select auth.uid())
        and not me.archived
        and m.deleted_at is null
        and m.message_type <> 'system'
        and m.sender_id is distinct from me.profile_id
        and m.created_at > coalesce(me.last_read_at, '-infinity'::timestamptz)
    )
  );
$$;
