-- 0034 - Creator CSV upload: Instagram required, and more of the profile filled in
--
-- Every creator row needs an Instagram ID now, as the sign-up form does. And
-- the upload fills in more of the profile when the spreadsheet has it:
-- headline, gender, age, languages, YouTube channel and subscribers, and
-- engagement rate, alongside followers, categories, city, state and bio.
-- Anything unreadable is left blank rather than refusing the row, and the
-- creator can change all of it from their dashboard after signing in.
--
-- Only `admin_import_account` changes (0026); the rest of 0026 stands.

begin;

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
  v_youtube text := nullif(btrim(coalesce(p_row ->> 'youtube', '')), '');
  v_subscribers int := case when (p_row ->> 'youtube_subscribers') ~ '^[0-9]{1,10}$'
                            then least((p_row ->> 'youtube_subscribers')::bigint, 2000000000)::int else 0 end;
  v_gender public.gender_type := case when p_row ->> 'gender' in ('female', 'male', 'non_binary', 'prefer_not_to_say')
                                      then (p_row ->> 'gender')::public.gender_type end;
  v_age int := case when (p_row ->> 'age') ~ '^[0-9]{1,3}$' and (p_row ->> 'age')::int between 13 and 100
                    then (p_row ->> 'age')::int end;
  v_er numeric := case when (p_row ->> 'engagement_rate') ~ '^[0-9]{1,3}(\.[0-9]+)?$' and (p_row ->> 'engagement_rate')::numeric <= 100
                       then round((p_row ->> 'engagement_rate')::numeric, 2) end;
  v_lang text;
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
    if v_handle is null then
      raise exception 'Add an Instagram ID.' using errcode = 'P0001', hint = 'NO_INSTAGRAM';
    end if;
    if private.instagram_is_registered(v_handle, v_email) then
      raise exception 'This Instagram account already belongs to another creator.' using errcode = 'P0001', hint = 'DUPLICATE_INSTAGRAM';
    end if;

    insert into public.creators (profile_id, display_name, bio, city, state, followers_count, headline, gender, age, engagement_rate,
                                 status, published_at, approved_at)
    values (p_profile_id, left(v_name, 80),
            left(nullif(btrim(p_row ->> 'bio'), ''), 1500),
            left(nullif(btrim(p_row ->> 'city'), ''), 80),
            left(nullif(btrim(p_row ->> 'state'), ''), 80),
            v_followers,
            left(nullif(btrim(p_row ->> 'headline'), ''), 120), v_gender, v_age, v_er,
            'published', now(), now())
    returning id into v_id;

    if v_handle is not null then
      insert into public.creator_social_accounts (creator_id, platform, username, profile_url, followers_count)
      values (v_id, 'instagram', left(v_handle, 100), 'https://www.instagram.com/' || v_handle, v_followers)
      on conflict do nothing;
    end if;

    if v_youtube is not null then
      insert into public.creator_social_accounts (creator_id, platform, username, profile_url, followers_count)
      values (v_id, 'youtube',
              left(coalesce(nullif(regexp_replace(v_youtube, '^https?://(www\.|m\.)?(youtube\.com|youtu\.be)/', ''), ''), v_youtube), 100),
              left(v_youtube, 300), v_subscribers)
      on conflict do nothing;
    end if;

    for v_lang in select distinct btrim(l) from jsonb_array_elements_text(coalesce(p_row -> 'languages', '[]'::jsonb)) l
                  where char_length(btrim(l)) between 2 and 40 limit 10 loop
      insert into public.creator_languages (creator_id, language) values (v_id, v_lang) on conflict do nothing;
    end loop;

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

commit;
