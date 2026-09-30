-- =============================================================================
-- House of Collabs | 0047 | portfolio pieces carry no caption
-- =============================================================================
-- Copying a photo or video across from an application stamped it with the title
-- "From my application". That is a note about provenance, and it rendered as a
-- caption on the public storefront under every tile -- a brand browsing the page
-- has no use for it, and it read as though the creator had written it.
--
-- New copies get no title, and the existing ones are cleared at the bottom. A
-- creator who types their own caption keeps it: only the exact stamped string
-- is removed. Everything else is unchanged from 0046; the body is restated
-- because a function can only be replaced whole.
-- =============================================================================

-- Both signatures gain `p_media`. They have to be dropped rather than replaced:
-- adding a defaulted argument creates an overload, and then the existing
-- two-argument calls become ambiguous.
drop function if exists public.provision_application_account(uuid, uuid);
drop function if exists private.apply_application(uuid, uuid, public.actor_role);

create or replace function private.apply_application(
  p_application_id uuid,
  p_profile_id uuid,
  p_actor_role public.actor_role default 'system',
  p_media jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.applications;
  v_p jsonb;
  v_media jsonb := coalesce(p_media, '{}'::jsonb);
  v_creator_id uuid;
  v_cat text;
  v_cat_id uuid;
  v_first boolean := true;
  v_rate record;
  v_price numeric;
  v_start numeric;
  v_types text[] := '{}';
  v_url text;
  v_name text;
  v_site text;
  v_insta text;
  v_phone text;
  v_followers int;
  v_subs int;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'That account does not exist.' using errcode = 'P0002', hint = 'PROFILE_NOT_FOUND';
  end if;

  v_p := coalesce(v_app.profile, '{}'::jsonb);

  -- `profiles.phone` and `brands.contact_phone` enforce the same format, so the
  -- number is checked once, before anything writes it. An unparseable one is
  -- dropped rather than allowed to abort the whole approval.
  v_phone := nullif(btrim(coalesce(v_app.phone, '')), '');
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{7,20}$' then v_phone := null; end if;

  -- Role + onboarded, so `homeFor` sends them to their dashboard and
  -- `RequireRole` lets them in.
  update public.profiles
  set role = v_app.role::public.user_role,
      onboarding_completed = true,
      full_name = coalesce(nullif(btrim(full_name), ''), v_app.full_name),
      phone = coalesce(phone, v_phone),
      avatar_url = coalesce(avatar_url, nullif(v_media ->> 'avatar_url', ''))
  where id = p_profile_id;

  if v_app.role = 'creator' then
    -- The form asks for the display name on page 1; the contact name is the
    -- fallback for applications that predate it.
    v_name := left(coalesce(nullif(btrim(v_p ->> 'creator_name'), ''), v_app.full_name), 80);

    -- Followers: the Instagram figure they gave on page 2 is the better number,
    -- and it arrives as text. Clamp to the column's range.
    v_followers := least(greatest(coalesce(
      nullif(regexp_replace(coalesce(v_p -> 'instagram' ->> 'followers', ''), '[^0-9]', '', 'g'), '')::bigint,
      v_app.followers_count::bigint, 0), 0), 2000000000)::int;

    insert into public.creators (
      profile_id, display_name, bio, city, followers_count,
      profile_image_url, intro_video_url, available
    )
    values (
      p_profile_id, v_name, v_app.bio, v_app.city, v_followers,
      nullif(v_media ->> 'avatar_url', ''), nullif(v_media ->> 'intro_video_url', ''), true
    )
    on conflict (profile_id) do update
      set bio = coalesce(public.creators.bio, excluded.bio),
          city = coalesce(public.creators.city, excluded.city),
          followers_count = greatest(public.creators.followers_count, excluded.followers_count),
          profile_image_url = coalesce(public.creators.profile_image_url, excluded.profile_image_url),
          intro_video_url = coalesce(public.creators.intro_video_url, excluded.intro_video_url),
          updated_at = now()
    returning id into v_creator_id;

    -- The rating the admin gave on the application follows them here. They rate
    -- while reviewing — before approving — so at that moment there is no creator
    -- for `admin_rate_application` to sync to, and its "keep the ranking in
    -- step" branch never fires. Without this the rating stays stranded on the
    -- application and the ranking screen shows an approved creator as unrated.
    --
    -- `coalesce` on conflict so re-approving never overwrites a rating that has
    -- since been changed on the ranking screen itself, which is the newer word.
    if v_app.admin_rating is not null then
      insert into public.creator_rankings (creator_id, admin_rating, updated_by)
      values (v_creator_id, v_app.admin_rating, coalesce(auth.uid(), p_profile_id))
      on conflict (creator_id) do update
        set admin_rating = coalesce(public.creator_rankings.admin_rating, excluded.admin_rating),
            updated_by = excluded.updated_by;
    end if;

    -- ---------------------------------------------------------------- socials
    v_url := nullif(btrim(coalesce(v_p -> 'instagram' ->> 'url', '')), '');
    if v_url is not null and v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
    if coalesce(nullif(btrim(v_p -> 'instagram' ->> 'handle'), ''), v_app.social_handle) is not null then
      insert into public.creator_social_accounts (creator_id, platform, username, profile_url, followers_count)
      values (
        v_creator_id, 'instagram',
        left(regexp_replace(coalesce(nullif(btrim(v_p -> 'instagram' ->> 'handle'), ''), v_app.social_handle), '^@', ''), 100),
        v_url, v_followers
      )
      on conflict (creator_id, platform, username) do update
        set followers_count = greatest(public.creator_social_accounts.followers_count, excluded.followers_count),
            profile_url = coalesce(public.creator_social_accounts.profile_url, excluded.profile_url);
    end if;

    v_url := nullif(btrim(coalesce(v_p -> 'youtube' ->> 'url', '')), '');
    if v_url is not null then
      if v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
      v_subs := least(greatest(coalesce(
        nullif(regexp_replace(coalesce(v_p -> 'youtube' ->> 'subscribers', ''), '[^0-9]', '', 'g'), '')::bigint, 0), 0), 2000000000)::int;
      insert into public.creator_social_accounts (creator_id, platform, username, profile_url, followers_count)
      values (v_creator_id, 'youtube', left(regexp_replace(v_url, '^https?://(www\.)?youtube\.com/', ''), 100), v_url, v_subs)
      on conflict (creator_id, platform, username) do update
        set followers_count = greatest(public.creator_social_accounts.followers_count, excluded.followers_count);
    end if;

    -- ------------------------------------------------------------- categories
    foreach v_cat in array coalesce(v_app.categories, '{}'::text[]) loop
      select id into v_cat_id from public.categories where lower(name) = lower(btrim(v_cat)) limit 1;
      if v_cat_id is not null then
        insert into public.creator_categories (creator_id, category_id, is_primary)
        values (v_creator_id, v_cat_id, v_first)
        on conflict do nothing;
        v_first := false;
      end if;
    end loop;

    -- ---------------------------------------------------------------- pricing
    -- Page 4 is a rate card: a figure against a collaboration type means they
    -- offer it, a blank means they don't. Each figure becomes a service so the
    -- storefront has something to sell the day they sign in.
    for v_rate in
      select * from (values
        ('ugc_video',           'UGC video + 30-day usage', 'ugc_video',     5, 'instagram'),
        ('extra_usage',         'Extra 30-day usage',       'other',         3, 'instagram'),
        ('collab_reel',         'Collaborative reel',       'reel',          5, 'instagram'),
        ('static_carousel',     'Static / carousel post',   'post',          4, 'instagram'),
        ('story',               'Instagram story',          'story',         2, 'instagram'),
        ('youtube_integration', 'YouTube integration',      'youtube_video', 7, 'youtube')
      ) as t(key, title, content_type, days, platform)
    loop
      v_price := nullif(regexp_replace(coalesce(v_p -> 'rates' ->> v_rate.key, ''), '[^0-9.]', '', 'g'), '')::numeric;
      -- The column refuses anything outside this band; a typo shouldn't abort
      -- the whole approval, so out-of-range figures are skipped instead.
      if v_price is not null and v_price >= 100 and v_price <= 10000000 then
        if not exists (
          select 1 from public.creator_services s
          where s.creator_id = v_creator_id and s.title = v_rate.title
        ) then
          insert into public.creator_services (creator_id, title, price, delivery_days, content_type, platform, active)
          values (v_creator_id, v_rate.title, v_price, v_rate.days, v_rate.content_type, v_rate.platform::public.social_platform, true);
        end if;
        v_types := v_types || v_rate.content_type;
        v_start := least(coalesce(v_start, v_price), v_price);
      end if;
    end loop;

    -- -------------------------------------------------------------- portfolio
    for v_url in select jsonb_array_elements_text(coalesce(v_media -> 'photos', '[]'::jsonb)) loop
      if not exists (select 1 from public.portfolio_items i where i.creator_id = v_creator_id and i.media_url = v_url) then
        -- No title. Anything set here shows as a caption on the public
        -- storefront, and "From my application" is a note about where the file
        -- came from, not something a brand browsing the page wants to read.
        insert into public.portfolio_items (creator_id, type, media_url)
        values (v_creator_id, 'image', v_url);
      end if;
    end loop;
    for v_url in select jsonb_array_elements_text(coalesce(v_media -> 'videos', '[]'::jsonb)) loop
      if not exists (select 1 from public.portfolio_items i where i.creator_id = v_creator_id and i.media_url = v_url) then
        insert into public.portfolio_items (creator_id, type, media_url)
        values (v_creator_id, 'video', v_url);
      end if;
    end loop;

    -- Derived from the rate card above, so it has to wait for the loop.
    --
    -- Approval also puts the storefront live. `publish_creator_profile` makes a
    -- creator clear a completion checklist first, but that gate exists to stop
    -- people publishing an empty storefront with nobody having looked at it —
    -- which is exactly what an admin approving the application has just done by
    -- hand. Making them wait on a bio they were never asked for would leave an
    -- approved creator invisible on the very page approval is for.
    --
    -- Only a draft is promoted. Suspended, rejected and already-published are
    -- left exactly as they are, so re-approving can never quietly un-suspend
    -- someone. `status` on the right-hand side is the pre-update value, so all
    -- four branches agree on which case they are in.
    update public.creators
    set starting_price = coalesce(starting_price, v_start),
        content_types = case
          when cardinality(content_types) = 0 then array(select distinct t from unnest(v_types) as t)
          else content_types end,
        status = case when status = 'draft' then 'published'::public.creator_status else status end,
        published_at = case when status = 'draft' then coalesce(published_at, now()) else published_at end,
        approved_at = case when status = 'draft' then coalesce(approved_at, now()) else approved_at end,
        onboarding_step = greatest(onboarding_step, 7),
        updated_at = now()
    where id = v_creator_id;

  else
    -- ------------------------------------------------------------------ brand
    -- Page 1 accepts a site or a handle, so it is only a website if it looks
    -- like one — the column rejects anything that isn't a URL.
    v_site := coalesce(
      nullif(btrim(v_app.website), ''),
      nullif(btrim(v_p -> 'verification' ->> 'company_website'), ''),
      nullif(btrim(v_p ->> 'website_or_handle'), '')
    );
    if v_site is not null and v_site !~* '^https?://' then
      v_site := case when v_site like '@%' or v_site not like '%.%' then null else 'https://' || v_site end;
    end if;

    v_insta := nullif(btrim(coalesce(v_p -> 'verification' ->> 'instagram_url', '')), '');
    if v_insta is not null and v_insta !~* '^https?://' then
      v_insta := 'https://instagram.com/' || regexp_replace(v_insta, '^@', '');
    end if;

    insert into public.brands (
      profile_id, brand_name, website_url, instagram_url, description,
      industry, location, contact_email, contact_phone, brand_logo_url
    )
    values (
      p_profile_id,
      left(coalesce(nullif(btrim(v_app.brand_name), ''), v_app.full_name), 80),
      v_site, v_insta, left(coalesce(v_app.looking_for, ''), 2000),
      left(coalesce(nullif(btrim(v_p ->> 'industry'), ''), ''), 80),
      left(coalesce(v_app.city, ''), 120),
      v_app.email, v_phone,
      nullif(v_media ->> 'logo_url', '')
    )
    on conflict (profile_id) do update
      set website_url = coalesce(public.brands.website_url, excluded.website_url),
          instagram_url = coalesce(public.brands.instagram_url, excluded.instagram_url),
          description = coalesce(nullif(public.brands.description, ''), excluded.description),
          industry = coalesce(nullif(public.brands.industry, ''), excluded.industry),
          location = coalesce(nullif(public.brands.location, ''), excluded.location),
          contact_email = coalesce(public.brands.contact_email, excluded.contact_email),
          contact_phone = coalesce(public.brands.contact_phone, excluded.contact_phone),
          brand_logo_url = coalesce(public.brands.brand_logo_url, excluded.brand_logo_url),
          updated_at = now();
  end if;

  update public.applications
  set status = 'approved',
      profile_id = p_profile_id,
      reviewed_by = coalesce(reviewed_by, auth.uid()),
      reviewed_at = coalesce(reviewed_at, now())
  where id = p_application_id
  returning * into v_app;

  perform private.notify(
    p_profile_id,
    'application_approved',
    'You''re in',
    format('Welcome to House of Collabs. Your %s account is ready.', v_app.role),
    'profile', p_profile_id,
    case v_app.role when 'brand' then '/brand' else '/creator' end
  );

  perform private.audit('application_account_provisioned', 'application', v_app.id::text,
    jsonb_build_object('role', v_app.role, 'profile_id', p_profile_id, 'via', p_actor_role,
                       'media', jsonb_build_object(
                         'photos', jsonb_array_length(coalesce(v_media -> 'photos', '[]'::jsonb)),
                         'videos', jsonb_array_length(coalesce(v_media -> 'videos', '[]'::jsonb)))),
    coalesce(auth.uid(), p_profile_id), p_actor_role);

  return v_app;
end;
$$;

comment on function private.apply_application(uuid, uuid, public.actor_role, jsonb) is
  'Seeds role, onboarding flag and the whole workspace from an application. Callers own the permission check.';

-- -----------------------------------------------------------------------------
-- Admin-initiated. `p_media` carries public URLs for uploads the approval
-- function has already copied out of the private applications bucket.
-- -----------------------------------------------------------------------------
create or replace function public.provision_application_account(
  p_application_id uuid,
  p_profile_id uuid,
  p_media jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return private.apply_application(p_application_id, p_profile_id, 'admin', p_media);
end;
$$;

revoke execute on function public.provision_application_account(uuid, uuid, jsonb) from public, anon;
grant execute on function public.provision_application_account(uuid, uuid, jsonb) to authenticated;


-- -----------------------------------------------------------------------------
-- Ratings given before this migration existed, which never reached the ranking.
-- -----------------------------------------------------------------------------
insert into public.creator_rankings (creator_id, admin_rating)
select c.id, a.admin_rating
from public.applications a
join public.creators c on c.profile_id = a.profile_id
where a.admin_rating is not null
on conflict (creator_id) do update
  set admin_rating = coalesce(public.creator_rankings.admin_rating, excluded.admin_rating);


-- -----------------------------------------------------------------------------
-- Captions already stamped on existing pieces. Scoped to the exact string so a
-- caption a creator wrote themselves is never touched.
-- -----------------------------------------------------------------------------
update public.portfolio_items
set title = null, updated_at = now()
where title = 'From my application';
