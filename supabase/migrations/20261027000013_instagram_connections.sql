-- 0013 - Instagram connections (Instagram API with Instagram Login)
--
-- A creator can connect their Instagram professional account on page 2 of the
-- sign-up form. The OAuth exchange happens in the `instagram-connect` Edge
-- Function; this migration is where its results live.
--
-- Applicants have no account yet, so a connection can't belong to a signed-in
-- user. It follows the phone-verification pattern instead (0063): the server
-- records it somewhere the browser cannot reach, the browser only ever holds
-- an unguessable connection id, the application carries that id in
-- `profile -> instagram -> connection_id`, and approval links the connection
-- to the creator it produced.
--
-- Everything sensitive sits in `private`, which has no grants to anon or
-- authenticated and isn't exposed through PostgREST. The Edge Function reaches
-- it through public functions that only `service_role` may execute. Tokens
-- arrive already encrypted (AES-256-GCM, key held only by the function), so the
-- table never holds a usable token even to someone reading the database.

begin;

-- ------------------------------------------------------------------ tables --

-- One row per "Connect Instagram" click: the CSRF state sent to Instagram and
-- the exact redirect URI it was sent with (the token exchange must repeat it).
create table if not exists private.instagram_oauth_states (
  state         text primary key check (char_length(state) between 32 and 128),
  redirect_uri  text not null check (char_length(redirect_uri) <= 500),
  created_at    timestamptz not null default now(),
  used_at       timestamptz
);

create table if not exists private.instagram_connections (
  id                      uuid primary key default gen_random_uuid(),
  ig_user_id              text not null,
  username                text not null,
  name                    text,
  account_type            text,
  profile_picture_url     text,
  followers_count         integer,
  follows_count           integer,
  media_count             integer,
  permissions             text[] not null default '{}',
  access_token_encrypted  text not null,
  token_expires_at        timestamptz,
  status                  text not null default 'connected'
                          check (status in ('connected', 'token_expired', 'revoked', 'error')),
  -- Computed from the media below: averages, top posts. Only metrics the API
  -- actually returned are counted; missing ones stay null, never zero.
  stats                   jsonb not null default '{}'::jsonb,
  -- Recent posts and Reels as Instagram returned them, with whatever insights
  -- were available for each.
  media                   jsonb not null default '[]'::jsonb,
  last_error              text,
  application_id          uuid references public.applications (id) on delete set null,
  creator_id              uuid references public.creators (id) on delete set null,
  connected_at            timestamptz not null default now(),
  last_synced_at          timestamptz,
  updated_at              timestamptz not null default now()
);

create index if not exists instagram_connections_application_idx on private.instagram_connections (application_id);
create index if not exists instagram_connections_creator_idx on private.instagram_connections (creator_id);
create index if not exists instagram_connections_ig_user_idx on private.instagram_connections (ig_user_id);

comment on table private.instagram_connections is
  'Instagram accounts creators connected through Instagram Login. Written only by the instagram-connect Edge Function; tokens are stored encrypted.';

-- ------------------------------------------- service-role functions (Edge) --

create or replace function public.instagram_create_oauth_state(p_state text, p_redirect_uri text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Housekeeping: states are only good for minutes, so anything a day old is dead.
  delete from private.instagram_oauth_states where created_at < now() - interval '1 day';
  insert into private.instagram_oauth_states (state, redirect_uri) values (p_state, p_redirect_uri);
end;
$$;

-- Spends a state exactly once, within 15 minutes, and hands back the redirect
-- URI it was issued with.
create or replace function public.instagram_consume_oauth_state(p_state text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_redirect text;
begin
  update private.instagram_oauth_states
  set used_at = now()
  where state = p_state
    and used_at is null
    and created_at > now() - interval '15 minutes'
  returning redirect_uri into v_redirect;

  if v_redirect is null then
    raise exception 'This Instagram sign-in has expired or was already used. Please try connecting again.'
      using errcode = 'P0001', hint = 'INVALID_STATE';
  end if;
  return v_redirect;
end;
$$;

create or replace function public.instagram_save_connection(p_connection jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
begin
  insert into private.instagram_connections (
    ig_user_id, username, name, account_type, profile_picture_url,
    followers_count, follows_count, media_count, permissions,
    access_token_encrypted, token_expires_at, stats, media, last_synced_at
  ) values (
    p_connection ->> 'ig_user_id',
    p_connection ->> 'username',
    p_connection ->> 'name',
    p_connection ->> 'account_type',
    p_connection ->> 'profile_picture_url',
    (p_connection ->> 'followers_count')::integer,
    (p_connection ->> 'follows_count')::integer,
    (p_connection ->> 'media_count')::integer,
    coalesce(array(select jsonb_array_elements_text(p_connection -> 'permissions')), '{}'),
    p_connection ->> 'access_token_encrypted',
    (p_connection ->> 'token_expires_at')::timestamptz,
    coalesce(p_connection -> 'stats', '{}'::jsonb),
    coalesce(p_connection -> 'media', '[]'::jsonb),
    now()
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- What a sync needs: the encrypted token and when it runs out.
create or replace function public.instagram_connection_for_sync(p_id uuid)
returns table (id uuid, ig_user_id text, access_token_encrypted text, token_expires_at timestamptz, status text)
language sql
stable
security definer
set search_path to ''
as $$
  select c.id, c.ig_user_id, c.access_token_encrypted, c.token_expires_at, c.status
  from private.instagram_connections c
  where c.id = p_id;
$$;

-- Fields a sync may refresh. Anything absent from the patch is left alone.
create or replace function public.instagram_update_connection(p_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update private.instagram_connections c
  set username               = coalesce(p_patch ->> 'username', c.username),
      name                   = case when p_patch ? 'name' then p_patch ->> 'name' else c.name end,
      account_type           = coalesce(p_patch ->> 'account_type', c.account_type),
      profile_picture_url    = case when p_patch ? 'profile_picture_url' then p_patch ->> 'profile_picture_url' else c.profile_picture_url end,
      followers_count        = coalesce((p_patch ->> 'followers_count')::integer, c.followers_count),
      follows_count          = coalesce((p_patch ->> 'follows_count')::integer, c.follows_count),
      media_count            = coalesce((p_patch ->> 'media_count')::integer, c.media_count),
      access_token_encrypted = coalesce(p_patch ->> 'access_token_encrypted', c.access_token_encrypted),
      token_expires_at       = coalesce((p_patch ->> 'token_expires_at')::timestamptz, c.token_expires_at),
      stats                  = coalesce(p_patch -> 'stats', c.stats),
      media                  = coalesce(p_patch -> 'media', c.media),
      status                 = coalesce(p_patch ->> 'status', c.status),
      last_error             = case when p_patch ? 'last_error' then p_patch ->> 'last_error' else c.last_error end,
      last_synced_at         = case when p_patch ? 'synced' then now() else c.last_synced_at end,
      updated_at             = now()
  where c.id = p_id;
end;
$$;

revoke execute on function public.instagram_create_oauth_state(text, text) from public, anon, authenticated;
revoke execute on function public.instagram_consume_oauth_state(text) from public, anon, authenticated;
revoke execute on function public.instagram_save_connection(jsonb) from public, anon, authenticated;
revoke execute on function public.instagram_connection_for_sync(uuid) from public, anon, authenticated;
revoke execute on function public.instagram_update_connection(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.instagram_create_oauth_state(text, text) to service_role;
grant execute on function public.instagram_consume_oauth_state(text) to service_role;
grant execute on function public.instagram_save_connection(jsonb) to service_role;
grant execute on function public.instagram_connection_for_sync(uuid) to service_role;
grant execute on function public.instagram_update_connection(uuid, jsonb) to service_role;

-- ------------------------------------------------------------- admin read --
-- The latest connection for an application or a creator, everything except
-- the token.

create or replace function public.admin_instagram_connection(p_application_id uuid default null, p_creator_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
           'id', c.id,
           'ig_user_id', c.ig_user_id,
           'username', c.username,
           'name', c.name,
           'account_type', c.account_type,
           'profile_picture_url', c.profile_picture_url,
           'followers_count', c.followers_count,
           'follows_count', c.follows_count,
           'media_count', c.media_count,
           'permissions', to_jsonb(c.permissions),
           'status', c.status,
           'stats', c.stats,
           'media', c.media,
           'last_error', c.last_error,
           'token_expires_at', c.token_expires_at,
           'connected_at', c.connected_at,
           'last_synced_at', c.last_synced_at
         )
  into v
  from private.instagram_connections c
  where (p_application_id is not null and c.application_id = p_application_id)
     or (p_creator_id is not null and c.creator_id = p_creator_id)
  order by c.connected_at desc
  limit 1;
  return v;
end;
$$;

revoke execute on function public.admin_instagram_connection(uuid, uuid) from public, anon;
grant execute on function public.admin_instagram_connection(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ links --

-- Submitting the application claims the connection it names, once, if it was
-- made recently and nobody has claimed it yet.
create or replace function private.bind_instagram_connection_to_application()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id text := new.profile -> 'instagram' ->> 'connection_id';
begin
  if v_id is null or v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  update private.instagram_connections
  set application_id = new.id, updated_at = now()
  where id = v_id::uuid
    and application_id is null
    and connected_at > now() - interval '7 days';
  return null;
end;
$$;

drop trigger if exists applications_bind_instagram_connection on public.applications;
create trigger applications_bind_instagram_connection
  after insert on public.applications
  for each row
  when (new.role = 'creator')
  execute function private.bind_instagram_connection_to_application();

-- Approval links the connection to the creator account it produced, the same
-- moment the barter and travel answers are copied (0082).
create or replace function private.link_instagram_connection_to_creator()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update private.instagram_connections ic
  set creator_id = c.id, updated_at = now()
  from public.creators c
  where c.profile_id = new.profile_id
    and ic.application_id = new.id;
  return null;
end;
$$;

drop trigger if exists applications_link_instagram_creator on public.applications;
create trigger applications_link_instagram_creator
  after insert or update of status, profile_id on public.applications
  for each row
  when (new.role = 'creator' and new.status = 'approved' and new.profile_id is not null)
  execute function private.link_instagram_connection_to_creator();

-- ----------------------------------------------------------------- switch --
-- Whether the sign-up shows "Connect Instagram": hidden | optional | required.
-- Hidden until Meta approves App Review, so real creators aren't asked to
-- connect an account Instagram won't let them connect yet. Public, because the
-- sign-up form reads it before anyone has an account. Flip it with:
--   update public.platform_settings set value = '"required"'::jsonb where key = 'instagram_connect';
insert into public.platform_settings (key, value, description, is_public)
values ('instagram_connect', '"hidden"'::jsonb,
        'Connect Instagram on the creator sign-up: "hidden", "optional" or "required". Keep hidden until Meta approves App Review.', true)
on conflict (key) do nothing;

commit;
