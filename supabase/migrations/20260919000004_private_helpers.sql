-- =============================================================================
-- Spotlit · 0004 · private helper functions
-- RLS helpers, settings accessors, audit + notification writers, slugs.
-- All SECURITY DEFINER functions pin search_path = '' and schema-qualify names.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Identity helpers (used by RLS policies; wrap calls as `(select private.fn())`)
-- -----------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a
    where a.profile_id = (select auth.uid()) and a.active
  );
$$;

create or replace function private.user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function private.is_active_user()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

create or replace function private.my_brand_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select b.id from public.brands b where b.profile_id = (select auth.uid());
$$;

create or replace function private.my_creator_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from public.creators c where c.profile_id = (select auth.uid());
$$;

create or replace function private.is_creator_public(p_creator_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.creators c
    join public.profiles p on p.id = c.profile_id
    where c.id = p_creator_id
      and c.status = 'published'
      and c.deleted_at is null
      and p.status = 'active'
  );
$$;

create or replace function private.owns_creator(p_creator_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.creators c
    where c.id = p_creator_id and c.profile_id = (select auth.uid())
  );
$$;

create or replace function private.owns_service(p_service_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.creator_services s
    join public.creators c on c.id = s.creator_id
    where s.id = p_service_id and c.profile_id = (select auth.uid())
  );
$$;

create or replace function private.is_service_public(p_service_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.creator_services s
    where s.id = p_service_id
      and s.active
      and s.archived_at is null
      and private.is_creator_public(s.creator_id)
  );
$$;

create or replace function private.is_order_participant(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    join public.brands b on b.id = o.brand_id
    join public.creators c on c.id = o.creator_id
    where o.id = p_order_id
      and ((select auth.uid()) in (b.profile_id, c.profile_id))
  );
$$;

-- Creators only see an order once it has been paid for.
create or replace function private.can_view_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    join public.brands b on b.id = o.brand_id
    join public.creators c on c.id = o.creator_id
    where o.id = p_order_id
      and (
        b.profile_id = (select auth.uid())
        or (c.profile_id = (select auth.uid()) and o.status not in ('draft', 'payment_pending'))
      )
  );
$$;

create or replace function private.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.profile_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_brief(p_brief_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.briefs br
    join public.brands b on b.id = br.brand_id
    left join public.creators c on c.id = br.creator_id
    where br.id = p_brief_id
      and (
        b.profile_id = (select auth.uid())
        or (c.profile_id = (select auth.uid()) and br.status <> 'draft')
      )
  )
  or exists (
    select 1
    from public.orders o
    join public.creators c on c.id = o.creator_id
    where o.brief_id = p_brief_id
      and c.profile_id = (select auth.uid())
      and o.status not in ('draft', 'payment_pending')
  );
$$;

create or replace function private.owns_brief(p_brief_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.briefs br
    join public.brands b on b.id = br.brand_id
    where br.id = p_brief_id and b.profile_id = (select auth.uid())
  );
$$;

-- Creators may see a brand once there is a working relationship.
create or replace function private.can_view_brand(p_brand_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.brands b where b.id = p_brand_id and b.profile_id = (select auth.uid()))
  or exists (
    select 1 from public.orders o join public.creators c on c.id = o.creator_id
    where o.brand_id = p_brand_id and c.profile_id = (select auth.uid())
      and o.status not in ('draft', 'payment_pending')
  )
  or exists (
    select 1 from public.briefs br join public.creators c on c.id = br.creator_id
    where br.brand_id = p_brand_id and c.profile_id = (select auth.uid()) and br.status <> 'draft'
  )
  or exists (
    select 1 from public.conversations cv join public.creators c on c.id = cv.creator_id
    where cv.brand_id = p_brand_id and c.profile_id = (select auth.uid())
  );
$$;

create or replace function private.is_dispute_participant(p_dispute_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.disputes d
    where d.id = p_dispute_id and private.is_order_participant(d.order_id)
  );
$$;

-- Maps the caller to the actor role used by the order state machine.
create or replace function private.actor_role_for(p_profile_id uuid)
returns public.actor_role
language sql stable security definer set search_path = ''
as $$
  select case
    when p_profile_id is null then 'system'::public.actor_role
    when exists (select 1 from public.admin_users a where a.profile_id = p_profile_id and a.active) then 'admin'::public.actor_role
    else (
      select case p.role
        when 'brand' then 'brand'::public.actor_role
        when 'creator' then 'creator'::public.actor_role
        when 'admin' then 'admin'::public.actor_role
        else 'system'::public.actor_role
      end
      from public.profiles p where p.id = p_profile_id
    )
  end;
$$;

-- -----------------------------------------------------------------------------
-- Settings accessors
-- -----------------------------------------------------------------------------
create or replace function private.setting(p_key text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select s.value from public.platform_settings s where s.key = p_key;
$$;

create or replace function private.setting_numeric(p_key text, p_default numeric)
returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb := private.setting(p_key);
begin
  if v is null or jsonb_typeof(v) not in ('number', 'string') then
    return p_default;
  end if;
  return (v #>> '{}')::numeric;
exception when others then
  return p_default;
end;
$$;

create or replace function private.setting_bool(p_key text, p_default boolean)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb := private.setting(p_key);
begin
  if v is null then
    return p_default;
  end if;
  return (v #>> '{}')::boolean;
exception when others then
  return p_default;
end;
$$;

-- -----------------------------------------------------------------------------
-- Audit log writer
-- -----------------------------------------------------------------------------
create or replace function private.audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}',
  p_actor_id uuid default null,
  p_actor_role public.actor_role default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
begin
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    coalesce(p_actor_role, private.actor_role_for(v_actor)),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Notification writers (the only way notifications are created)
-- -----------------------------------------------------------------------------
create or replace function private.notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_action_url text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;
  insert into public.notifications (user_id, type, title, message, reference_type, reference_id, action_url)
  values (p_user_id, p_type, left(p_title, 200), left(p_message, 1000), p_reference_type, p_reference_id, p_action_url)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.notify_admins(
  p_type text,
  p_title text,
  p_message text default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_action_url text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, title, message, reference_type, reference_id, action_url)
  select a.profile_id, p_type, left(p_title, 200), left(p_message, 1000), p_reference_type, p_reference_id, p_action_url
  from public.admin_users a
  where a.active;
end;
$$;

-- -----------------------------------------------------------------------------
-- Text helpers
-- -----------------------------------------------------------------------------
create or replace function private.slugify(p_text text)
returns text
language sql immutable set search_path = ''
as $$
  select btrim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'), '-');
$$;

-- Escapes LIKE wildcards in user input.
create or replace function private.like_escape(p_text text)
returns text
language sql immutable set search_path = ''
as $$
  select replace(replace(replace(coalesce(p_text, ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;

create or replace function private.unique_creator_slug(p_source text, p_creator_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_base text := left(private.slugify(p_source), 60);
  v_slug text;
  v_n int := 1;
begin
  if v_base = '' then
    v_base := 'creator-' || left(replace(p_creator_id::text, '-', ''), 8);
  end if;
  v_slug := v_base;
  while exists (select 1 from public.creators c where c.slug = v_slug and c.id <> p_creator_id) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

create or replace function private.unique_brand_slug(p_source text, p_brand_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_base text := left(private.slugify(p_source), 60);
  v_slug text;
  v_n int := 1;
begin
  if v_base = '' then
    v_base := 'brand-' || left(replace(p_brand_id::text, '-', ''), 8);
  end if;
  v_slug := v_base;
  while exists (select 1 from public.brands b where b.brand_slug = v_slug and b.id <> p_brand_id) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

create or replace function private.format_inr(p_amount numeric)
returns text
language sql immutable set search_path = ''
as $$
  select '₹' || to_char(coalesce(p_amount, 0), 'FM99,99,99,99,990');
$$;

-- -----------------------------------------------------------------------------
-- Grants: RLS helpers must be executable by API roles (they run as definer).
-- -----------------------------------------------------------------------------
grant execute on function
  private.is_admin(),
  private.user_role(),
  private.is_active_user(),
  private.my_brand_id(),
  private.my_creator_id(),
  private.is_creator_public(uuid),
  private.owns_creator(uuid),
  private.owns_service(uuid),
  private.is_service_public(uuid),
  private.is_order_participant(uuid),
  private.can_view_order(uuid),
  private.is_conversation_participant(uuid),
  private.can_view_brief(uuid),
  private.owns_brief(uuid),
  private.can_view_brand(uuid),
  private.is_dispute_participant(uuid)
to anon, authenticated, service_role;
