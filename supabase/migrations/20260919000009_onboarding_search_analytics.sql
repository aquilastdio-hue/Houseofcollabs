-- =============================================================================
-- Spotlit · 0009 · onboarding, marketplace search, analytics, briefs, reports
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles + onboarding
-- -----------------------------------------------------------------------------
create or replace function public.set_initial_role(p_role public.user_role)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue.' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;
  if p_role not in ('brand', 'creator') then
    raise exception 'Choose either a brand or a creator account.' using errcode = 'P0001', hint = 'INVALID_ROLE';
  end if;
  update public.profiles set role = p_role
  where id = auth.uid() and role is null
  returning * into v_profile;
  if not found then
    raise exception 'Your account type is already set.' using errcode = 'P0001', hint = 'ROLE_ALREADY_SET';
  end if;
  perform private.audit('role_selected', 'profile', auth.uid()::text, jsonb_build_object('role', p_role), auth.uid(), p_role::text::public.actor_role);
  return v_profile;
end;
$$;

create or replace function public.get_creator_completion(p_creator_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_creator_id, private.my_creator_id());
  v_c public.creators;
  v_items jsonb;
  v_done int;
  v_total int;
begin
  select * into v_c from public.creators where id = v_id;
  if not found then
    return jsonb_build_object('percent', 0, 'items', '[]'::jsonb, 'can_publish', false);
  end if;
  if v_c.profile_id <> auth.uid() and not private.is_admin() then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;

  v_items := jsonb_build_array(
    jsonb_build_object('key', 'photo', 'label', 'Profile photo', 'required', true, 'done', v_c.profile_image_url is not null),
    jsonb_build_object('key', 'bio', 'label', 'Bio (40+ characters)', 'required', true, 'done', char_length(coalesce(v_c.bio, '')) >= 40),
    jsonb_build_object('key', 'location', 'label', 'City', 'required', true, 'done', v_c.city is not null),
    jsonb_build_object('key', 'categories', 'label', 'At least one category', 'required', true,
      'done', exists (select 1 from public.creator_categories cc where cc.creator_id = v_id)),
    jsonb_build_object('key', 'languages', 'label', 'Languages you create in', 'required', true,
      'done', exists (select 1 from public.creator_languages l where l.creator_id = v_id)),
    jsonb_build_object('key', 'creator_type', 'label', 'Creator type', 'required', true, 'done', v_c.creator_type is not null),
    jsonb_build_object('key', 'services', 'label', 'At least one active service', 'required', true,
      'done', exists (select 1 from public.creator_services s where s.creator_id = v_id and s.active and s.archived_at is null)),
    jsonb_build_object('key', 'demographics', 'label', 'Gender and age', 'required', false, 'done', v_c.gender is not null and v_c.age is not null),
    jsonb_build_object('key', 'social', 'label', 'A social account', 'required', false,
      'done', exists (select 1 from public.creator_social_accounts s where s.creator_id = v_id)),
    jsonb_build_object('key', 'portfolio', 'label', '3+ portfolio pieces', 'required', false,
      'done', (select count(*) from public.portfolio_items p where p.creator_id = v_id and not p.is_hidden) >= 3),
    jsonb_build_object('key', 'addons', 'label', 'An add-on', 'required', false,
      'done', exists (select 1 from public.service_addons a join public.creator_services s on s.id = a.service_id
                      where s.creator_id = v_id and a.active)),
    jsonb_build_object('key', 'cover', 'label', 'Cover image', 'required', false, 'done', v_c.cover_image_url is not null)
  );

  select count(*) filter (where (x ->> 'done')::boolean), count(*)
  into v_done, v_total
  from jsonb_array_elements(v_items) x;

  return jsonb_build_object(
    'percent', round(v_done * 100.0 / v_total)::int,
    'items', v_items,
    'can_publish', not exists (
      select 1 from jsonb_array_elements(v_items) x
      where (x ->> 'required')::boolean and not (x ->> 'done')::boolean
    ),
    'status', v_c.status
  );
end;
$$;

create or replace function public.publish_creator_profile()
returns public.creators
language plpgsql security definer set search_path = ''
as $$
declare
  v_c public.creators;
  v_completion jsonb;
  v_needs_review boolean := private.setting_bool('require_creator_approval', true);
begin
  select * into v_c from public.creators where profile_id = auth.uid() for update;
  if not found then
    raise exception 'Create your creator profile first.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;
  if v_c.status = 'suspended' then
    raise exception 'Your profile is suspended. Contact support.' using errcode = 'P0001', hint = 'CREATOR_SUSPENDED';
  end if;
  if v_c.status in ('published', 'pending_review') then
    return v_c;
  end if;

  v_completion := public.get_creator_completion(v_c.id);
  if not (v_completion ->> 'can_publish')::boolean then
    raise exception 'Complete the required profile steps before publishing.' using errcode = 'P0001', hint = 'PROFILE_INCOMPLETE';
  end if;

  if v_needs_review then
    update public.creators set status = 'pending_review', rejection_reason = null, onboarding_step = 7
    where id = v_c.id returning * into v_c;
    perform private.notify_admins('creator_review', 'Creator awaiting review',
      format('%s submitted their profile for review.', v_c.display_name), 'creator', v_c.id, '/admin/creators/' || v_c.id);
    perform private.notify(auth.uid(), 'profile_submitted', 'Profile submitted for review',
      'We will review your profile shortly. You will be notified once it is live.', 'creator', v_c.id, '/creator');
  else
    update public.creators set status = 'published', published_at = coalesce(published_at, now()),
      approved_at = coalesce(approved_at, now()), rejection_reason = null, onboarding_step = 7
    where id = v_c.id returning * into v_c;
    perform private.notify(auth.uid(), 'profile_approved', 'Your profile is live',
      'Brands can now discover and hire you.', 'creator', v_c.id, '/creator');
  end if;
  perform private.audit('creator_profile_submitted', 'creator', v_c.id::text,
    jsonb_build_object('status', v_c.status), auth.uid(), 'creator');
  return v_c;
end;
$$;

create or replace function public.complete_onboarding()
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role := private.user_role();
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue.' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;
  if v_role is null then
    raise exception 'Choose your account type first.' using errcode = 'P0001', hint = 'ROLE_REQUIRED';
  elsif v_role = 'brand' and private.my_brand_id() is null then
    raise exception 'Add your brand details first.' using errcode = 'P0001', hint = 'BRAND_REQUIRED';
  elsif v_role = 'creator' and not exists (
    select 1 from public.creators c where c.profile_id = auth.uid() and c.status in ('pending_review', 'published')
  ) then
    raise exception 'Publish your creator profile to finish onboarding.' using errcode = 'P0001', hint = 'PROFILE_NOT_PUBLISHED';
  end if;
  update public.profiles set onboarding_completed = true where id = auth.uid() returning * into v_profile;
  return v_profile;
end;
$$;

-- Atomic replace helpers used by onboarding/profile editors.
create or replace function public.set_creator_categories(p_category_ids uuid[], p_primary_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator uuid := private.my_creator_id();
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_category_ids, '{}'::uuid[])) x);
begin
  if v_creator is null then
    raise exception 'Create your creator profile first.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  if cardinality(v_ids) = 0 or cardinality(v_ids) > 5 then
    raise exception 'Choose between 1 and 5 categories.' using errcode = 'P0001', hint = 'INVALID_CATEGORIES';
  end if;
  if (select count(*) from public.categories c where c.id = any (v_ids) and c.active) <> cardinality(v_ids) then
    raise exception 'One or more categories are not available.' using errcode = 'P0001', hint = 'INVALID_CATEGORIES';
  end if;
  delete from public.creator_categories where creator_id = v_creator and not (category_id = any (v_ids));
  insert into public.creator_categories (creator_id, category_id, is_primary)
  select v_creator, x, false from unnest(v_ids) x
  on conflict (creator_id, category_id) do nothing;
  update public.creator_categories set is_primary = false where creator_id = v_creator and is_primary;
  update public.creator_categories set is_primary = true
  where creator_id = v_creator and category_id = coalesce(case when p_primary_id = any (v_ids) then p_primary_id end, v_ids[1]);
end;
$$;

create or replace function public.set_creator_languages(p_languages text[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator uuid := private.my_creator_id();
  v_langs text[] := array(
    select distinct initcap(btrim(x)) from unnest(coalesce(p_languages, '{}'::text[])) x
    where char_length(btrim(x)) between 2 and 40
  );
begin
  if v_creator is null then
    raise exception 'Create your creator profile first.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  if cardinality(v_langs) = 0 or cardinality(v_langs) > 10 then
    raise exception 'Choose between 1 and 10 languages.' using errcode = 'P0001', hint = 'INVALID_LANGUAGES';
  end if;
  delete from public.creator_languages
  where creator_id = v_creator and not (lower(language) = any (select lower(x) from unnest(v_langs) x));
  insert into public.creator_languages (creator_id, language)
  select v_creator, x from unnest(v_langs) x
  on conflict (creator_id, lower(language)) do nothing;
end;
$$;

create or replace function public.touch_last_seen()
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles set last_seen_at = now()
  where id = (select auth.uid())
    and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
$$;

create or replace function public.record_auth_event(p_event text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or p_event not in ('login', 'logout', 'password_changed', 'password_reset') then
    return;
  end if;
  if exists (
    select 1 from public.audit_logs a
    where a.actor_id = auth.uid() and a.action = p_event and a.created_at > now() - interval '10 seconds'
  ) then
    return;
  end if;
  perform private.audit(p_event, 'profile', auth.uid()::text, '{}'::jsonb);
end;
$$;

-- SERVICE ONLY: generic audit entry for Edge Functions (spec: create_audit_log)
create or replace function public.create_audit_log(
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'
)
returns void
language sql security definer set search_path = ''
as $$
  select private.audit(p_action, p_entity_type, p_entity_id, p_metadata, p_actor_id, null);
$$;

-- -----------------------------------------------------------------------------
-- Marketplace search — all filtering/sorting/pagination happens here.
-- -----------------------------------------------------------------------------
create or replace function public.search_creators(
  p_query text default null,
  p_category text default null,
  p_city text default null,
  p_state text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_followers int default null,
  p_max_followers int default null,
  p_max_delivery_days int default null,
  p_gender text default null,
  p_min_age int default null,
  p_max_age int default null,
  p_languages text[] default null,
  p_creator_type text default null,
  p_content_type text default null,
  p_platform text default null,
  p_verified_only boolean default false,
  p_available_only boolean default false,
  p_min_rating numeric default null,
  p_sort text default 'relevance',
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid,
  slug text,
  display_name text,
  headline text,
  profile_image_url text,
  cover_image_url text,
  intro_video_url text,
  city text,
  state text,
  country text,
  gender public.gender_type,
  age int,
  creator_type text,
  followers_count int,
  engagement_rate numeric,
  verified boolean,
  available boolean,
  featured boolean,
  rating numeric,
  review_count int,
  completed_orders int,
  starting_price numeric,
  fastest_delivery_days int,
  response_time text,
  content_types text[],
  categories jsonb,
  languages text[],
  platforms text[],
  portfolio_preview jsonb,
  last_seen_at timestamptz,
  published_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_q text := nullif(btrim(p_query), '');
  v_like text;
  v_tsq_text text;
  v_tsq tsquery;
  v_sort text := coalesce(nullif(p_sort, ''), 'relevance');
  v_limit int := least(greatest(coalesce(p_limit, 24), 1), 60);
  v_offset int := least(greatest(coalesce(p_offset, 0), 0), 10000);
  v_langs text[] := array(select lower(btrim(x)) from unnest(coalesce(p_languages, '{}'::text[])) x where btrim(x) <> '');
  v_city text := nullif(btrim(p_city), '');
  v_state text := nullif(btrim(p_state), '');
  v_needs_service boolean := p_min_price is not null or p_max_price is not null
                             or p_max_delivery_days is not null or nullif(p_content_type, '') is not null;
begin
  if v_q is not null then
    v_like := '%' || private.like_escape(v_q) || '%';
    select string_agg(t || ':*', ' & ') into v_tsq_text
    from regexp_split_to_table(lower(v_q), '[^a-z0-9]+') t
    where t <> '';
    if v_tsq_text is not null then
      v_tsq := to_tsquery('simple', v_tsq_text);
    end if;
  end if;

  return query
  with filtered as (
    select
      c.id,
      c.featured,
      c.verified,
      c.rating,
      c.review_count,
      c.followers_count,
      c.starting_price,
      c.fastest_delivery_days,
      c.published_at,
      case
        when v_q is null then 0::real
        else coalesce(ts_rank_cd(c.search_vector, v_tsq), 0)
             + case when c.display_name ilike v_like then 1 else 0 end
      end as rank
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id and pr.status = 'active'
    where c.status = 'published'
      and c.deleted_at is null
      and (v_q is null
           or (v_tsq is not null and c.search_vector @@ v_tsq)
           or c.display_name ilike v_like
           or c.city ilike v_like)
      and (nullif(p_category, '') is null or exists (
            select 1 from public.creator_categories cc
            join public.categories cat on cat.id = cc.category_id
            where cc.creator_id = c.id and cat.slug = lower(p_category)))
      and (v_city is null or c.city ilike '%' || private.like_escape(v_city) || '%')
      and (v_state is null or c.state ilike '%' || private.like_escape(v_state) || '%')
      and (p_min_followers is null or c.followers_count >= p_min_followers)
      and (p_max_followers is null or c.followers_count <= p_max_followers)
      and (nullif(p_gender, '') is null or c.gender::text = p_gender)
      and (p_min_age is null or c.age >= p_min_age)
      and (p_max_age is null or c.age <= p_max_age)
      and (nullif(p_creator_type, '') is null or c.creator_type = p_creator_type)
      and (not coalesce(p_verified_only, false) or c.verified)
      and (not coalesce(p_available_only, false) or c.available)
      and (p_min_rating is null or c.rating >= p_min_rating)
      and (cardinality(v_langs) = 0 or exists (
            select 1 from public.creator_languages l
            where l.creator_id = c.id and lower(l.language) = any (v_langs)))
      and (nullif(p_platform, '') is null or exists (
            select 1 from public.creator_social_accounts s
            where s.creator_id = c.id and s.platform::text = p_platform))
      and (not v_needs_service or exists (
            select 1 from public.creator_services s
            where s.creator_id = c.id and s.active and s.archived_at is null
              and (p_min_price is null or s.price >= p_min_price)
              and (p_max_price is null or s.price <= p_max_price)
              and (p_max_delivery_days is null or s.delivery_days <= p_max_delivery_days)
              and (nullif(p_content_type, '') is null or s.content_type = p_content_type)))
  ),
  ordered as (
    select
      f.id,
      count(*) over () as total,
      row_number() over (
        order by
          case when v_sort = 'price_asc' then f.starting_price end asc nulls last,
          case when v_sort = 'price_desc' then f.starting_price end desc nulls last,
          case when v_sort = 'followers' then f.followers_count end desc nulls last,
          case when v_sort = 'delivery' then f.fastest_delivery_days end asc nulls last,
          case when v_sort = 'rating' then f.rating end desc nulls last,
          case when v_sort = 'rating' then f.review_count end desc nulls last,
          case when v_sort = 'newest' then f.published_at end desc nulls last,
          f.rank desc,
          f.featured desc,
          f.verified desc,
          f.rating desc,
          f.review_count desc,
          f.followers_count desc,
          f.id
      ) as rn
    from filtered f
  ),
  page as (
    select o.id, o.total, o.rn from ordered o order by o.rn limit v_limit offset v_offset
  )
  select
    c.id,
    c.slug,
    c.display_name,
    c.headline,
    c.profile_image_url,
    c.cover_image_url,
    c.intro_video_url,
    c.city,
    c.state,
    c.country,
    c.gender,
    c.age,
    c.creator_type,
    c.followers_count,
    c.engagement_rate,
    c.verified,
    c.available,
    c.featured,
    c.rating,
    c.review_count,
    c.completed_orders,
    c.starting_price,
    c.fastest_delivery_days,
    c.response_time,
    c.content_types,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', cat.id, 'name', cat.name, 'slug', cat.slug, 'is_primary', cc.is_primary)
                       order by cc.is_primary desc, cat.sort_order)
      from public.creator_categories cc join public.categories cat on cat.id = cc.category_id
      where cc.creator_id = c.id
    ), '[]'::jsonb),
    coalesce(array(select l.language from public.creator_languages l where l.creator_id = c.id order by l.created_at), '{}'::text[]),
    coalesce(array(select distinct s.platform::text from public.creator_social_accounts s where s.creator_id = c.id), '{}'::text[]),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'type', x.type, 'media_url', x.media_url,
                                          'thumbnail_url', x.thumbnail_url, 'title', x.title))
      from (
        select pi.id, pi.type, pi.media_url, pi.thumbnail_url, pi.title
        from public.portfolio_items pi
        where pi.creator_id = c.id and not pi.is_hidden
        order by pi.sort_order, pi.created_at
        limit 4
      ) x
    ), '[]'::jsonb),
    pr.last_seen_at,
    c.published_at,
    p.total
  from page p
  join public.creators c on c.id = p.id
  join public.profiles pr on pr.id = c.profile_id
  order by p.rn;
end;
$$;

create or replace function public.get_public_stats()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'creators', (select count(*) from public.creators c where c.status = 'published' and c.deleted_at is null),
    'cities', (select count(distinct lower(c.city)) from public.creators c where c.status = 'published' and c.deleted_at is null),
    'categories', (select count(*) from public.categories where active),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'avg_rating', (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.status = 'published' and r.reviewer_role = 'brand'),
    'avg_starting_price', (select round(avg(c.starting_price)) from public.creators c where c.status = 'published' and c.deleted_at is null)
  );
$$;

-- -----------------------------------------------------------------------------
-- Analytics
-- -----------------------------------------------------------------------------
create or replace function public.record_profile_view(p_creator_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_role public.user_role;
begin
  if not private.is_creator_public(p_creator_id) then
    return;
  end if;
  if v_viewer is not null then
    if exists (select 1 from public.creators c where c.id = p_creator_id and c.profile_id = v_viewer) then
      return;
    end if;
    if exists (
      select 1 from public.creator_profile_views v
      where v.creator_id = p_creator_id and v.viewer_id = v_viewer and v.created_at > now() - interval '30 minutes'
    ) then
      return;
    end if;
    select p.role into v_role from public.profiles p where p.id = v_viewer;
  end if;
  insert into public.creator_profile_views (creator_id, viewer_id, viewer_role) values (p_creator_id, v_viewer, v_role);
  update public.creators set profile_views = profile_views + 1 where id = p_creator_id;
end;
$$;

create or replace function public.record_search_event(p_query text, p_filters jsonb default '{}', p_results_count int default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  -- ignore identical searches within 5 seconds (typing / re-renders)
  if exists (
    select 1 from public.search_events s
    where s.profile_id = auth.uid() and s.created_at > now() - interval '5 seconds'
      and s.query is not distinct from nullif(btrim(p_query), '') and s.filters = coalesce(p_filters, '{}'::jsonb)
  ) then
    return;
  end if;
  insert into public.search_events (profile_id, query, filters, results_count)
  values (auth.uid(), left(nullif(btrim(p_query), ''), 300), coalesce(p_filters, '{}'::jsonb), p_results_count);
end;
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
    'conversations', (select count(*) from public.conversation_participants cp where cp.profile_id = auth.uid()),
    'unread_messages', (public.get_unread_counts() ->> 'messages')::int,
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
    'unread_messages', (public.get_unread_counts() ->> 'messages')::int,
    'wishlisted_creators', (select count(distinct wi.creator_id) from public.wishlist_items wi
                            join public.wishlists w on w.id = wi.wishlist_id where w.brand_id = v_brand)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Briefs: send to a creator / creator responds
-- -----------------------------------------------------------------------------
create or replace function public.send_brief(p_brief_id uuid, p_creator_id uuid)
returns public.briefs
language plpgsql security definer set search_path = ''
as $$
declare
  v_brief public.briefs;
  v_brand public.brands;
  v_creator_profile uuid;
  v_conv uuid;
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

  v_conv := private.ensure_conversation(v_brand.id, p_creator_id, null, format('Brief shared: "%s"', v_brief.title));
  select c.profile_id into v_creator_profile from public.creators c where c.id = p_creator_id;
  perform private.notify(v_creator_profile, 'brief_received', format('New brief from %s', v_brand.brand_name),
    v_brief.title, 'brief', v_brief.id, '/creator/briefs/' || v_brief.id);
  perform private.audit('brief_sent', 'brief', v_brief.id::text, jsonb_build_object('creator_id', p_creator_id), auth.uid(), 'brand');
  return v_brief;
end;
$$;

create or replace function public.respond_to_brief(p_brief_id uuid, p_accept boolean, p_note text default null)
returns public.briefs
language plpgsql security definer set search_path = ''
as $$
declare
  v_brief public.briefs;
  v_brand_profile uuid;
  v_creator_name text;
begin
  select br.* into v_brief from public.briefs br
  join public.creators c on c.id = br.creator_id
  where br.id = p_brief_id and c.profile_id = auth.uid()
  for update of br;
  if not found then
    raise exception 'Brief not found.' using errcode = 'P0002', hint = 'BRIEF_NOT_FOUND';
  end if;
  if v_brief.status <> 'sent' then
    raise exception 'This brief has already been answered.' using errcode = 'P0001', hint = 'INVALID_BRIEF_STATE';
  end if;

  update public.briefs
  set status = case when p_accept then 'accepted'::public.brief_status else 'rejected'::public.brief_status end,
      responded_at = now(),
      response_note = nullif(btrim(p_note), '')
  where id = v_brief.id returning * into v_brief;

  select b.profile_id into v_brand_profile from public.brands b where b.id = v_brief.brand_id;
  select c.display_name into v_creator_name from public.creators c where c.id = v_brief.creator_id;
  perform private.notify(v_brand_profile, case when p_accept then 'brief_accepted' else 'brief_rejected' end,
    format('%s %s your brief', v_creator_name, case when p_accept then 'accepted' else 'declined' end),
    coalesce(nullif(btrim(p_note), ''), v_brief.title), 'brief', v_brief.id, '/brand/briefs/' || v_brief.id);
  return v_brief;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reports
-- -----------------------------------------------------------------------------
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
    when 'message' then exists (select 1 from public.messages m where m.id = p_target_id and private.is_conversation_participant(m.conversation_id))
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
