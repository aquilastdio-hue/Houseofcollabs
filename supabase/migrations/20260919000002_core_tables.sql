-- =============================================================================
-- Spotlit · 0002 · identity + marketplace catalog tables
-- profiles, admin_users, platform_settings, categories, creator_types, brands,
-- creators, creator_categories, creator_social_accounts, creator_languages,
-- creator_services, service_addons, portfolio_items
-- =============================================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — one row per auth user. id == auth.users.id; auth_user_id mirrors it.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  auth_user_id uuid generated always as (id) stored unique,
  role public.user_role,
  full_name text check (char_length(full_name) <= 120),
  email text,
  avatar_url text,
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  status public.account_status not null default 'active',
  onboarding_completed boolean not null default false,
  email_notifications boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.role is 'Set once at signup (brand|creator) or via set_initial_role(); admin is granted only through admin_users.';
create index profiles_role_idx on public.profiles (role);
create index profiles_status_idx on public.profiles (status);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- admin_users — the single source of truth for admin rights
-- -----------------------------------------------------------------------------
create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  permissions text[] not null default '{*}',
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- platform_settings — admin-configurable key/value settings
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,62}$'),
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger platform_settings_set_updated_at before update on public.platform_settings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- categories / creator_types — admin-managed taxonomies
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 500),
  icon text,
  image_url text,
  color text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_active_sort_idx on public.categories (active, sort_order);
create trigger categories_set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();

create table public.creator_types (
  slug text primary key check (slug ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  name text not null unique,
  description text,
  min_followers int,
  max_followers int,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- brands
-- -----------------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  brand_name text not null check (char_length(brand_name) between 2 and 80),
  brand_slug text not null unique,
  brand_logo_url text,
  brand_pronunciation text check (char_length(brand_pronunciation) <= 120),
  pronunciation_audio_url text,
  website_url text check (website_url is null or website_url ~* '^https?://[^\s]+$'),
  instagram_url text check (instagram_url is null or instagram_url ~* '^https?://[^\s]+$'),
  description text check (char_length(description) <= 2000),
  industry text check (char_length(industry) <= 80),
  location text check (char_length(location) <= 120),
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brands_brand_name_trgm_idx on public.brands using gin (brand_name extensions.gin_trgm_ops);
create trigger brands_set_updated_at before update on public.brands
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- creators — public storefront + denormalised search columns
-- -----------------------------------------------------------------------------
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 1500),
  profile_image_url text,
  cover_image_url text,
  intro_video_url text,
  gender public.gender_type,
  age int check (age between 13 and 100),
  city text check (char_length(city) <= 80),
  state text check (char_length(state) <= 80),
  country text not null default 'India' check (char_length(country) <= 80),
  creator_type text references public.creator_types (slug) on update cascade on delete set null,
  followers_count int not null default 0 check (followers_count >= 0),
  engagement_rate numeric(5, 2) check (engagement_rate between 0 and 100),
  verified boolean not null default false,
  available boolean not null default true,
  response_time text check (response_time in ('within_1_hour', 'within_few_hours', 'within_1_day', 'within_few_days')),
  rating numeric(3, 2) not null default 0 check (rating between 0 and 5),
  review_count int not null default 0,
  profile_views int not null default 0,
  wishlist_count int not null default 0,
  completed_orders int not null default 0,
  starting_price numeric(12, 2),
  fastest_delivery_days int,
  content_types text[] not null default '{}',
  status public.creator_status not null default 'draft',
  featured boolean not null default false,
  onboarding_step int not null default 1 check (onboarding_step between 1 and 7),
  rejection_reason text,
  published_at timestamptz,
  approved_at timestamptz,
  deleted_at timestamptz,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.creators.starting_price is 'Maintained by trigger: lowest active service price.';
comment on column public.creators.fastest_delivery_days is 'Maintained by trigger: lowest active service delivery_days.';

-- Marketplace indexes (partial on the visible set keeps them small)
create index creators_public_idx on public.creators (status, available, verified)
  where deleted_at is null;
create index creators_city_idx on public.creators (lower(city)) where status = 'published' and deleted_at is null;
create index creators_state_idx on public.creators (lower(state)) where status = 'published' and deleted_at is null;
create index creators_city_trgm_idx on public.creators using gin (city extensions.gin_trgm_ops);
create index creators_starting_price_idx on public.creators (starting_price) where status = 'published' and deleted_at is null;
create index creators_followers_idx on public.creators (followers_count desc) where status = 'published' and deleted_at is null;
create index creators_delivery_idx on public.creators (fastest_delivery_days) where status = 'published' and deleted_at is null;
create index creators_rating_idx on public.creators (rating desc, review_count desc) where status = 'published' and deleted_at is null;
create index creators_published_at_idx on public.creators (published_at desc) where status = 'published' and deleted_at is null;
create index creators_type_gender_idx on public.creators (creator_type, gender) where status = 'published' and deleted_at is null;
create index creators_age_idx on public.creators (age) where status = 'published' and deleted_at is null;
create index creators_search_vector_idx on public.creators using gin (search_vector);
create index creators_display_name_trgm_idx on public.creators using gin (display_name extensions.gin_trgm_ops);
create index creators_featured_idx on public.creators (featured) where featured and status = 'published' and deleted_at is null;
create index creators_status_created_idx on public.creators (status, created_at desc);
create trigger creators_set_updated_at before update on public.creators
  for each row execute function private.set_updated_at();

create table public.creator_categories (
  creator_id uuid not null references public.creators (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (creator_id, category_id)
);
create index creator_categories_category_idx on public.creator_categories (category_id, creator_id);
create unique index creator_categories_one_primary_idx on public.creator_categories (creator_id) where is_primary;

create table public.creator_social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  platform public.social_platform not null,
  username text not null check (char_length(username) between 1 and 100),
  profile_url text check (profile_url is null or profile_url ~* '^https?://[^\s]+$'),
  followers_count int not null default 0 check (followers_count between 0 and 2000000000),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, platform, username)
);
create index creator_social_accounts_creator_idx on public.creator_social_accounts (creator_id);
create index creator_social_accounts_platform_idx on public.creator_social_accounts (platform, creator_id);
create trigger creator_social_accounts_set_updated_at before update on public.creator_social_accounts
  for each row execute function private.set_updated_at();

create table public.creator_languages (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  language text not null check (char_length(language) between 2 and 40),
  created_at timestamptz not null default now()
);
create unique index creator_languages_unique_idx on public.creator_languages (creator_id, lower(language));
create index creator_languages_language_idx on public.creator_languages (lower(language), creator_id);

-- -----------------------------------------------------------------------------
-- creator_services / service_addons — fixed-price packages
-- -----------------------------------------------------------------------------
create table public.creator_services (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text check (char_length(description) <= 2000),
  price numeric(12, 2) not null check (price between 100 and 10000000),
  delivery_days int not null check (delivery_days between 1 and 90),
  revisions_included int not null default 1 check (revisions_included between 0 and 10),
  includes text[] not null default '{}' check (cardinality(includes) <= 12),
  content_type text not null default 'ugc_video' check (content_type in (
    'ugc_video', 'reel', 'story', 'post', 'youtube_video', 'short', 'photo',
    'review', 'unboxing', 'tutorial', 'live', 'other'
  )),
  platform public.social_platform,
  requires_shipping boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creator_services_creator_active_price_idx on public.creator_services (creator_id, active, price)
  where archived_at is null;
create index creator_services_price_idx on public.creator_services (price) where active and archived_at is null;
create index creator_services_delivery_idx on public.creator_services (delivery_days) where active and archived_at is null;
create index creator_services_content_type_idx on public.creator_services (content_type) where active and archived_at is null;
create trigger creator_services_set_updated_at before update on public.creator_services
  for each row execute function private.set_updated_at();

create table public.service_addons (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.creator_services (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 500),
  price numeric(12, 2) not null check (price between 0 and 10000000),
  addon_type public.addon_type not null default 'custom',
  extra_revisions int not null default 0 check (extra_revisions between 0 and 10),
  delivery_days_override int check (delivery_days_override between 1 and 90),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index service_addons_service_idx on public.service_addons (service_id, active);
create trigger service_addons_set_updated_at before update on public.service_addons
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- portfolio_items
-- -----------------------------------------------------------------------------
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  type public.portfolio_item_type not null,
  title text check (char_length(title) <= 120),
  description text check (char_length(description) <= 1000),
  media_url text not null check (char_length(media_url) <= 2048),
  thumbnail_url text check (char_length(thumbnail_url) <= 2048),
  storage_path text,
  category_id uuid references public.categories (id) on delete set null,
  platform public.social_platform,
  brand_name text check (char_length(brand_name) <= 80),
  width int,
  height int,
  duration_seconds numeric(8, 2),
  is_hidden boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'link' or media_url ~* '^https?://')
);
create index portfolio_items_creator_sort_idx on public.portfolio_items (creator_id, sort_order, created_at);
create index portfolio_items_category_idx on public.portfolio_items (category_id);
create trigger portfolio_items_set_updated_at before update on public.portfolio_items
  for each row execute function private.set_updated_at();
