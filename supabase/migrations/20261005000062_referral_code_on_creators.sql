-- 0062 · Carry the referral code onto the creator
--
-- The sign-up form collects a referral code into `applications.profile`, which
-- answers "who referred this applicant" only for as long as anyone is looking
-- at the application. Once approved, the creator record had no idea — so the
-- question an admin actually asks ("where did this creator come from?") could
-- only be answered by finding their original application and switching the
-- status filter to show approved ones.
--
-- The code now lives on the creator too, copied across at approval, and the
-- admin creator search matches it.
--
-- Backfill: every creator approved before this migration keeps whatever their
-- application recorded, which today is nothing — the field shipped hours ago
-- and no application carries one yet. The statement is still here so the two
-- stay consistent if an older application is ever edited to add a code.

begin;

alter table public.creators
  add column if not exists referral_code text;

comment on column public.creators.referral_code is
  'Referral code entered on the sign-up form, copied from applications.profile at approval. Null for creators who arrived without one.';

-- Null rather than '' for "no code", so the index stays small and
-- `referral_code is not null` is an honest test of "was referred".
create index if not exists creators_referral_code_idx
  on public.creators (upper(referral_code))
  where referral_code is not null;

-- ---------------------------------------------------------------- backfill --
update public.creators c
set referral_code = upper(btrim(a.profile ->> 'referral_code'))
from public.applications a
join public.profiles pr on lower(pr.email) = lower(a.email)
where pr.id = c.profile_id
  and a.role = 'creator'
  and nullif(btrim(a.profile ->> 'referral_code'), '') is not null
  and c.referral_code is null;

-- ------------------------------------------------------- carried at approval --
-- `apply_application` builds the creator row from the application. The code
-- rides along with everything else page 1 collected.

CREATE OR REPLACE FUNCTION private.apply_application(p_application_id uuid, p_profile_id uuid, p_actor_role actor_role DEFAULT 'system'::actor_role, p_media jsonb DEFAULT '{}'::jsonb)
 RETURNS applications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- The person's name, not the handle they typed.
    --
    -- Page 1 asks for both a full name and a "Creator / Instagram name", and
    -- almost everyone fills the second with their handle — or, in one case, a
    -- full instagram.com URL with a tracking parameter still attached. Taking
    -- that as the storefront name put "https://instagram.com/rohit.arora.5030
    -- ?igshid=..." on the public creators page where a name belongs.
    --
    -- So the contact name leads and the typed one is the fallback, for the
    -- rare application that has no full name.
    v_name := left(coalesce(nullif(btrim(v_app.full_name), ''), nullif(btrim(v_p ->> 'creator_name'), '')), 80);

    -- Followers: the Instagram figure they gave on page 2 is the better number,
    -- and it arrives as text. Clamp to the column's range.
    v_followers := least(greatest(coalesce(
      nullif(regexp_replace(coalesce(v_p -> 'instagram' ->> 'followers', ''), '[^0-9]', '', 'g'), '')::bigint,
      v_app.followers_count::bigint, 0), 0), 2000000000)::int;

    insert into public.creators (
      profile_id, display_name, bio, city, followers_count,
      profile_image_url, intro_video_url, available, featured, referral_code
    )
    values (
      p_profile_id, v_name, v_app.bio, v_app.city, v_followers,
      nullif(v_media ->> 'avatar_url', ''), nullif(v_media ->> 'intro_video_url', ''), true,
      -- Marked for Discover while the application was being reviewed.
      coalesce(v_app.discover, false),
      -- Who referred them. Upper-cased to match the form's own normalisation,
      -- so one code is one code however it was typed.
      upper(nullif(btrim(v_p ->> 'referral_code'), ''))
    )
    on conflict (profile_id) do update
      set bio = coalesce(public.creators.bio, excluded.bio),
          -- Re-approving never rewrites who referred them.
          referral_code = coalesce(public.creators.referral_code, excluded.referral_code),
          city = coalesce(public.creators.city, excluded.city),
          followers_count = greatest(public.creators.followers_count, excluded.followers_count),
          profile_image_url = coalesce(public.creators.profile_image_url, excluded.profile_image_url),
          intro_video_url = coalesce(public.creators.intro_video_url, excluded.intro_video_url),
          -- Re-approving can promote into Discover but never quietly demote.
          featured = public.creators.featured or excluded.featured,
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

    -- Page 4 also asks whether they take barter. It lived only in the
    -- application until now, which meant nothing could list or filter on it.
    update public.creators
    set barter_available = coalesce((v_p ->> 'barter_available')::boolean, false)
    where id = v_creator_id;

    -- ---------------------------------------------------------------- pricing
    -- Page 4 is a rate card: a figure against a collaboration type means they
    -- offer it, a blank means they don't. Each figure becomes a service so the
    -- storefront has something to sell the day they sign in.
    for v_rate in
      select * from (values
        ('ugc_video',           'UGC',                      'ugc_video',     5, 'instagram', 1),
        ('story',               'Instagram story',          'story',         2, 'instagram', 2),
        ('collab_reel',         'Collaborative reel',       'reel',          5, 'instagram', 3),
        ('static_carousel',     'Static / carousel post',   'post',          4, 'instagram', 4),
        ('youtube_integration', 'YouTube integration',      'youtube_video', 7, 'youtube',   5)
      ) as t(key, title, content_type, days, platform, rank)
    loop
      v_price := nullif(regexp_replace(coalesce(v_p -> 'rates' ->> v_rate.key, ''), '[^0-9.]', '', 'g'), '')::numeric;
      -- The column refuses anything outside this band; a typo shouldn't abort
      -- the whole approval, so out-of-range figures are skipped instead.
      if v_price is not null and v_price >= 100 and v_price <= 10000000 then
        if not exists (
          select 1 from public.creator_services s
          where s.creator_id = v_creator_id and s.title = v_rate.title
        ) then
          insert into public.creator_services (creator_id, title, price, delivery_days, content_type, platform, active, sort_order)
          values (v_creator_id, v_rate.title, v_price, v_rate.days, v_rate.content_type, v_rate.platform::public.social_platform, true, v_rate.rank);
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
$function$;

-- -------------------------------------------------------------- admin search --
-- So typing a code into the Creators search box finds everyone who used it.

CREATE OR REPLACE FUNCTION public.admin_list_creators(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_verified boolean DEFAULT NULL::boolean, p_featured boolean DEFAULT NULL::boolean, p_include_deleted boolean DEFAULT false, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, profile_id uuid, display_name text, slug text, email text, profile_image_url text, city text, state text, status creator_status, account_status account_status, verified boolean, featured boolean, available boolean, followers_count integer, rating numeric, review_count integer, categories text[], orders_count bigint, revenue numeric, joined_at timestamp with time zone, deleted_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_like text := '%' || private.like_escape(btrim(coalesce(p_search, ''))) || '%';
begin
  perform private.require_admin();
  return query
  with base as (
    select c.*, pr.email as p_email, pr.status as p_status
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id
    where (coalesce(p_include_deleted, false) or c.deleted_at is null)
      and (nullif(btrim(p_search), '') is null or c.display_name ilike v_like or pr.email ilike v_like
           or c.city ilike v_like or c.slug ilike v_like
           or c.referral_code ilike v_like)
      and (nullif(p_status, '') is null or c.status::text = p_status)
      and (p_verified is null or c.verified = p_verified)
      and (p_featured is null or c.featured = p_featured)
  ),
  agg as (
    select b.id,
      (select count(*) from public.orders o where o.creator_id = b.id and o.status not in ('draft', 'payment_pending')) as orders_count,
      (select coalesce(sum(o.total_amount), 0) from public.orders o where o.creator_id = b.id and o.status = 'completed') as revenue
    from base b
  )
  select b.id, b.profile_id, b.display_name, b.slug, b.p_email, b.profile_image_url, b.city, b.state, b.status, b.p_status,
         b.verified, b.featured, b.available, b.followers_count, b.rating, b.review_count,
         coalesce(array(select cat.name from public.creator_categories cc join public.categories cat on cat.id = cc.category_id
                        where cc.creator_id = b.id order by cc.is_primary desc), '{}'::text[]),
         a.orders_count, a.revenue, b.created_at, b.deleted_at,
         count(*) over ()
  from base b join agg a on a.id = b.id
  order by
    case when p_sort = 'revenue' then a.revenue end desc nulls last,
    case when p_sort = 'orders' then a.orders_count end desc nulls last,
    case when p_sort = 'followers' then b.followers_count end desc nulls last,
    case when p_sort = 'rating' then b.rating end desc nulls last,
    case when p_sort = 'name' then b.display_name end asc,
    b.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

commit;
