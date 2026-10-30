-- 0026 - Admins can add creators and brands from a spreadsheet
--
-- Admin → Creators / Brands → More → Upload CSV. Each row becomes an account
-- exactly as if its application had been approved: the profile is active and
-- onboarded, a creator's storefront is published, a brand's workspace exists.
-- There is no application row; the audit log records who imported whom.
--
-- The admin-import-accounts Edge Function creates the login (it needs the
-- service role for that) and then calls this with the admin's own JWT, so
-- `require_admin` sees the real admin. The one-email-one-kind rule (0024)
-- still applies: an email that already has an account is refused.

begin;

-- "+91 98765 43210", "98765-43210"... anything the profiles check accepts.
create or replace function private.import_phone(p text)
returns text
language sql immutable set search_path = ''
as $$
  select case when x ~ '^\+?[0-9 ()-]{7,20}$' then x end
  from (select nullif(btrim(regexp_replace(coalesce(p, ''), '[^0-9+ ()-]', '', 'g')), '') as x) s;
$$;

-- "houseofcollabs.com" → "https://houseofcollabs.com"; junk → null.
create or replace function private.import_url(p text)
returns text
language sql immutable set search_path = ''
as $$
  select case when x is null then null
              when x ~* '^https?://[^\s]+$' then x
              when x ~* '^[^\s/]+\.[^\s]+$' then 'https://' || x
         end
  from (select nullif(btrim(p), '') as x) s;
$$;

create or replace function public.admin_import_account(p_profile_id uuid, p_role text, p_row jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_email text := lower(btrim(coalesce(p_row ->> 'email', '')));
  v_name text := nullif(btrim(coalesce(p_row ->> 'name', '')), '');
  v_brand text := nullif(btrim(coalesce(p_row ->> 'brand_name', '')), '');
  v_phone text := private.import_phone(p_row ->> 'phone');
  v_handle text := private.normalize_instagram(p_row ->> 'instagram');
  v_followers int := case when (p_row ->> 'followers') ~ '^[0-9]{1,10}$'
                          then least((p_row ->> 'followers')::bigint, 2000000000)::int else 0 end;
  v_role public.user_role;
  v_id uuid;
  v_cat text;
  v_cat_id uuid;
  v_first boolean := true;
begin
  if p_role not in ('creator', 'brand') then
    raise exception 'Unknown account type.' using errcode = 'P0001', hint = 'BAD_ROLE';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address doesn’t look right.' using errcode = 'P0001', hint = 'BAD_EMAIL';
  end if;
  if p_role = 'brand' then
    v_name := coalesce(v_name, v_brand);
    if v_brand is null or char_length(v_brand) < 2 then
      raise exception 'Add a brand name of at least 2 characters.' using errcode = 'P0001', hint = 'BAD_NAME';
    end if;
  end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Add a name of at least 2 characters.' using errcode = 'P0001', hint = 'BAD_NAME';
  end if;

  select p.role into v_role from public.profiles p where lower(p.email) = v_email and p.id <> p_profile_id;
  if found then
    raise exception 'This email already belongs to another account.' using errcode = 'P0001', hint = 'EMAIL_HAS_ACCOUNT';
  end if;
  select p.role into v_role from public.profiles p where p.id = p_profile_id;
  if v_role is not null then
    raise exception 'This email already has a % account.', v_role using errcode = 'P0001', hint = 'EMAIL_HAS_ACCOUNT';
  end if;

  insert into public.profiles (id, role, full_name, email, phone, status, onboarding_completed)
  values (p_profile_id, p_role::public.user_role, left(v_name, 120), v_email, v_phone, 'active', true)
  on conflict (id) do update
    set role = excluded.role,
        full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name),
        phone = coalesce(public.profiles.phone, excluded.phone),
        status = 'active',
        onboarding_completed = true;

  if p_role = 'creator' then
    if v_handle is not null and private.instagram_is_registered(v_handle, v_email) then
      raise exception 'This Instagram account already belongs to another creator.' using errcode = 'P0001', hint = 'DUPLICATE_INSTAGRAM';
    end if;

    insert into public.creators (profile_id, display_name, bio, city, state, followers_count, status, published_at, approved_at)
    values (p_profile_id, left(v_name, 80),
            left(nullif(btrim(p_row ->> 'bio'), ''), 1500),
            left(nullif(btrim(p_row ->> 'city'), ''), 80),
            left(nullif(btrim(p_row ->> 'state'), ''), 80),
            v_followers, 'published', now(), now())
    returning id into v_id;

    if v_handle is not null then
      insert into public.creator_social_accounts (creator_id, platform, username, profile_url, followers_count)
      values (v_id, 'instagram', left(v_handle, 100), 'https://www.instagram.com/' || v_handle, v_followers)
      on conflict do nothing;
    end if;

    -- Category names, matched to the catalogue like an application's; the
    -- first one that matches is primary, unknown ones are skipped.
    for v_cat in select jsonb_array_elements_text(coalesce(p_row -> 'categories', '[]'::jsonb)) loop
      select c.id into v_cat_id from public.categories c where lower(c.name) = lower(btrim(v_cat)) limit 1;
      if v_cat_id is not null then
        insert into public.creator_categories (creator_id, category_id, is_primary)
        values (v_id, v_cat_id, v_first)
        on conflict do nothing;
        v_first := false;
      end if;
    end loop;
  else
    insert into public.brands (profile_id, brand_name, website_url, instagram_url, industry, location, contact_email, contact_phone, preferences)
    values (p_profile_id, left(v_brand, 80),
            private.import_url(p_row ->> 'website'),
            case when v_handle is not null then 'https://www.instagram.com/' || v_handle end,
            left(nullif(btrim(p_row ->> 'industry'), ''), 80),
            left(nullif(btrim(p_row ->> 'city'), ''), 120),
            v_email, v_phone,
            jsonb_build_object('contact_person', nullif(btrim(p_row ->> 'name'), ''), 'imported', true))
    returning id into v_id;
  end if;

  perform private.audit('account_imported', 'profile', p_profile_id::text,
    jsonb_build_object('role', p_role, 'email', v_email, 'name', v_name), v_admin, 'admin');
  return jsonb_build_object('profile_id', p_profile_id, 'id', v_id);
end;
$$;

revoke execute on function public.admin_import_account(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_import_account(uuid, text, jsonb) to authenticated;
revoke execute on function private.import_phone(text) from public;
revoke execute on function private.import_url(text) from public;

commit;
