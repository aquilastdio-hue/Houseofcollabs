-- Shared helpers for SQL tests. Included at the top of each test file by
-- scripts/run-db-tests.mjs (lines starting with "-- @include").
-- Everything lives in pg_temp and is discarded with the session.

create or replace function pg_temp.new_user(p_email text, p_role text, p_name text)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
          extensions.crypt('test-password', extensions.gen_salt('bf', 4)), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('role', p_role, 'full_name', p_name), now(), now(), '', '', '', '');
  return v_id;
end $$;

-- Impersonate a user the way PostgREST does (claims GUC); caller then runs SET LOCAL ROLE.
create or replace function pg_temp.claims(p_uid uuid, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then jsonb_build_object('role', p_role)
         else jsonb_build_object('sub', p_uid, 'role', p_role) end::text, true);
end $$;

create or replace function pg_temp.expect_error(p_sql text, p_like text default null)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'EXPECTED ERROR NOT RAISED: %', p_sql;
exception when others then
  if sqlerrm like 'EXPECTED ERROR NOT RAISED%' then raise; end if;
  if p_like is not null and sqlerrm not ilike p_like then
    raise exception 'Wrong error for [%]: got "%", expected like "%"', p_sql, sqlerrm, p_like;
  end if;
end $$;

create or replace function pg_temp.check(p_ok boolean, p_msg text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_msg;
  end if;
end $$;

create or replace function pg_temp.id(p_key text) returns uuid language sql as $$
  select current_setting('t.' || p_key)::uuid
$$;
