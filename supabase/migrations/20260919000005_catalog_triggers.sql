-- =============================================================================
-- Spotlit · 0005 · identity + catalog triggers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New auth user → profile. The requested role is WHITELISTED: only brand or
-- creator are accepted from user metadata; anything else (incl. admin) → NULL.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_requested text := lower(coalesce(new.raw_user_meta_data ->> 'role', ''));
  v_role public.user_role;
  v_name text;
begin
  if v_requested in ('brand', 'creator') then
    v_role := v_requested::public.user_role;
  end if;
  v_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');

  insert into public.profiles (id, role, full_name, email, avatar_url)
  values (
    new.id,
    v_role,
    left(v_name, 120),
    new.email,
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''), '')
  )
  on conflict (id) do nothing;

  perform private.audit(
    'profile_created', 'profile', new.id::text,
    jsonb_build_object('role', v_role, 'provider', new.raw_app_meta_data ->> 'provider'),
    new.id,
    coalesce(v_role::text, 'system')::public.actor_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Creators: slug + weighted search vector
-- -----------------------------------------------------------------------------
create or replace function private.creators_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_categories text;
  v_languages text;
begin
  if tg_op = 'INSERT' then
    new.slug := private.unique_creator_slug(coalesce(nullif(new.slug, ''), new.display_name), new.id);
  elsif new.slug is distinct from old.slug then
    new.slug := private.unique_creator_slug(coalesce(nullif(new.slug, ''), new.display_name), new.id);
  end if;

  new.city := nullif(btrim(new.city), '');
  new.state := nullif(btrim(new.state), '');

  select string_agg(cat.name, ' ') into v_categories
  from public.creator_categories cc
  join public.categories cat on cat.id = cc.category_id
  where cc.creator_id = new.id;

  select string_agg(l.language, ' ') into v_languages
  from public.creator_languages l
  where l.creator_id = new.id;

  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(v_categories, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.headline, '')), 'B') ||
    setweight(to_tsvector('simple', concat_ws(' ', new.city, new.state, replace(coalesce(new.creator_type, ''), '_', ' '))), 'B') ||
    setweight(to_tsvector('simple', coalesce(v_languages, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.bio, '')), 'D');
  return new;
end;
$$;

create trigger creators_before_write
  before insert or update on public.creators
  for each row execute function private.creators_before_write();

-- Children that feed the search vector "touch" the creator row to recompute it.
create or replace function private.touch_creator_from_child()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator_id uuid := coalesce(new.creator_id, old.creator_id);
begin
  update public.creators set updated_at = now() where id = v_creator_id;
  if tg_op = 'UPDATE' and old.creator_id is distinct from new.creator_id then
    update public.creators set updated_at = now() where id = old.creator_id;
  end if;
  return null;
end;
$$;

create trigger creator_categories_touch_creator
  after insert or update or delete on public.creator_categories
  for each row execute function private.touch_creator_from_child();

create trigger creator_languages_touch_creator
  after insert or update or delete on public.creator_languages
  for each row execute function private.touch_creator_from_child();

-- -----------------------------------------------------------------------------
-- Brands: slug
-- -----------------------------------------------------------------------------
create or replace function private.brands_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.brand_name is distinct from old.brand_name or new.brand_slug is distinct from old.brand_slug then
    new.brand_slug := private.unique_brand_slug(
      case when tg_op = 'INSERT' then coalesce(nullif(new.brand_slug, ''), new.brand_name) else new.brand_name end,
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger brands_before_write
  before insert or update on public.brands
  for each row execute function private.brands_before_write();

-- Every brand gets a default wishlist.
create or replace function private.brands_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.wishlists (brand_id, name, description, is_default)
  values (new.id, 'Saved creators', 'Your default shortlist', true)
  on conflict do nothing;
  return new;
end;
$$;

create trigger brands_after_insert
  after insert on public.brands
  for each row execute function private.brands_after_insert();

-- -----------------------------------------------------------------------------
-- Denormalised marketplace columns
-- -----------------------------------------------------------------------------
create or replace function private.refresh_creator_service_stats(p_creator_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.creators c
  set starting_price = s.min_price,
      fastest_delivery_days = s.min_days,
      content_types = coalesce(s.types, '{}')
  from (
    select min(price) as min_price,
           min(delivery_days) as min_days,
           array_agg(distinct content_type order by content_type) as types
    from public.creator_services
    where creator_id = p_creator_id and active and archived_at is null
  ) s
  where c.id = p_creator_id;
end;
$$;

create or replace function private.creator_services_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.refresh_creator_service_stats(coalesce(new.creator_id, old.creator_id));
  if tg_op = 'UPDATE' and old.creator_id is distinct from new.creator_id then
    perform private.refresh_creator_service_stats(old.creator_id);
  end if;
  return null;
end;
$$;

create trigger creator_services_after_change
  after insert or update or delete on public.creator_services
  for each row execute function private.creator_services_after_change();

create or replace function private.refresh_creator_followers(p_creator_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.creators c
  set followers_count = coalesce((
    select sum(s.followers_count)::int from public.creator_social_accounts s where s.creator_id = p_creator_id
  ), 0)
  where c.id = p_creator_id;
$$;

create or replace function private.social_accounts_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.refresh_creator_followers(coalesce(new.creator_id, old.creator_id));
  return null;
end;
$$;

create trigger creator_social_accounts_after_change
  after insert or update or delete on public.creator_social_accounts
  for each row execute function private.social_accounts_after_change();

-- -----------------------------------------------------------------------------
-- Ratings (spec name: update_creator_rating)
-- -----------------------------------------------------------------------------
create or replace function private.update_creator_rating(p_creator_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.creators c
  set rating = coalesce(r.avg_rating, 0),
      review_count = coalesce(r.cnt, 0)
  from (
    select round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as cnt
    from public.reviews
    where creator_id = p_creator_id and reviewer_role = 'brand' and status = 'published'
  ) r
  where c.id = p_creator_id;
$$;

create or replace function private.reviews_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.update_creator_rating(coalesce(new.creator_id, old.creator_id));
  return null;
end;
$$;

create trigger reviews_after_change
  after insert or update or delete on public.reviews
  for each row execute function private.reviews_after_change();

-- -----------------------------------------------------------------------------
-- Wishlist adds (distinct brands) → creators.wishlist_count
-- -----------------------------------------------------------------------------
create or replace function private.wishlist_items_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator uuid := coalesce(new.creator_id, old.creator_id);
begin
  update public.creators c
  set wishlist_count = (
    select count(distinct w.brand_id)::int
    from public.wishlist_items wi
    join public.wishlists w on w.id = wi.wishlist_id
    where wi.creator_id = v_creator
  )
  where c.id = v_creator;
  return null;
end;
$$;

create trigger wishlist_items_after_change
  after insert or delete on public.wishlist_items
  for each row execute function private.wishlist_items_after_change();

-- -----------------------------------------------------------------------------
-- Audit user-editable profile changes (ignores counters / derived columns)
-- -----------------------------------------------------------------------------
create or replace function private.audit_profile_changes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_changed text[];
  v_ignored text[] := array[
    'updated_at', 'search_vector', 'profile_views', 'wishlist_count', 'rating', 'review_count',
    'completed_orders', 'starting_price', 'fastest_delivery_days', 'content_types',
    'followers_count', 'last_seen_at', 'onboarding_step'
  ];
begin
  select array_agg(n.key order by n.key) into v_changed
  from jsonb_each(to_jsonb(new)) n
  where n.value is distinct from (to_jsonb(old) -> n.key)
    and not (n.key = any (v_ignored));

  if v_changed is not null then
    perform private.audit(
      'profile_updated', tg_table_name, new.id::text,
      jsonb_build_object('fields', to_jsonb(v_changed))
    );
  end if;
  return null;
end;
$$;

create trigger creators_audit_changes
  after update on public.creators
  for each row execute function private.audit_profile_changes();

create trigger brands_audit_changes
  after update on public.brands
  for each row execute function private.audit_profile_changes();

create trigger profiles_audit_changes
  after update on public.profiles
  for each row execute function private.audit_profile_changes();

-- -----------------------------------------------------------------------------
-- Audit admin-managed configuration tables
-- -----------------------------------------------------------------------------
create or replace function private.audit_config_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_id text := coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'slug');
begin
  perform private.audit(
    lower(tg_table_name) || '_' || lower(tg_op),
    tg_table_name,
    v_id,
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
    )
  );
  return null;
end;
$$;

create trigger categories_audit
  after insert or update or delete on public.categories
  for each row execute function private.audit_config_change();

create trigger creator_types_audit
  after insert or update or delete on public.creator_types
  for each row execute function private.audit_config_change();

create trigger platform_settings_audit
  after insert or update or delete on public.platform_settings
  for each row execute function private.audit_config_change();
