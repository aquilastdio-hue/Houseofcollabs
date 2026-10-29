-- 0024 - One email is a creator or a brand, never both
--
-- Every account is one email (0012), but nothing stopped that one account
-- from being both kinds. The brand sign-up form took a creator's email, turned
-- the account into a brand and left the creator storefront behind, so the
-- person showed up under Creators and under Brands and lost their creator
-- dashboard. Anyone could do that to any creator by typing their email in.
--
-- The rule now lives in the database, so every way in obeys it: the brand
-- sign-up function, admin approvals, and anything written by hand.
--
--   * a brand profile can't be added to an account that has a creator profile,
--     and the other way round;
--   * an account can't be switched between creator and brand while it holds
--     the other kind's profile;
--   * an application can't be sent with an email that already has a different
--     kind of account.
--
-- Accounts that already hold both (one today) are left exactly as they are,
-- and an admin can still switch their role to sort them out. This changes no
-- data.

begin;

create or replace function private.account_kind_conflict_message(p_has text)
returns text
language sql immutable set search_path = ''
as $$
  select format(
    'This email already has a %s account on House of Collabs. One email can be a creator or a brand, not both, so please use a different email.',
    p_has
  );
$$;

-- --------------------------------------------- creator and brand profiles ---
create or replace function private.enforce_one_account_kind()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select p.role into v_role from public.profiles p where p.id = new.profile_id;

  if tg_table_name = 'brands' then
    if v_role = 'creator' or exists (select 1 from public.creators c where c.profile_id = new.profile_id) then
      raise exception '%', private.account_kind_conflict_message('creator')
        using errcode = 'P0001', hint = 'EMAIL_HAS_CREATOR';
    end if;
  else
    if v_role = 'brand' or exists (select 1 from public.brands b where b.profile_id = new.profile_id) then
      raise exception '%', private.account_kind_conflict_message('brand')
        using errcode = 'P0001', hint = 'EMAIL_HAS_BRAND';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists brands_one_account_kind on public.brands;
create trigger brands_one_account_kind
  before insert or update of profile_id on public.brands
  for each row execute function private.enforce_one_account_kind();

drop trigger if exists creators_one_account_kind on public.creators;
create trigger creators_one_account_kind
  before insert or update of profile_id on public.creators
  for each row execute function private.enforce_one_account_kind();

-- ------------------------------------------------------------ role changes ---
-- An account that holds both profiles from before this rule may be switched
-- either way, so an admin can put it right.
create or replace function private.profiles_one_account_kind()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator boolean := exists (select 1 from public.creators c where c.profile_id = new.id);
  v_brand boolean := exists (select 1 from public.brands b where b.profile_id = new.id);
begin
  if new.role = 'brand' and v_creator and not v_brand then
    raise exception '%', private.account_kind_conflict_message('creator')
      using errcode = 'P0001', hint = 'EMAIL_HAS_CREATOR';
  elsif new.role = 'creator' and v_brand and not v_creator then
    raise exception '%', private.account_kind_conflict_message('brand')
      using errcode = 'P0001', hint = 'EMAIL_HAS_BRAND';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_one_account_kind on public.profiles;
create trigger profiles_one_account_kind
  before update of role on public.profiles
  for each row
  when (new.role is distinct from old.role)
  execute function private.profiles_one_account_kind();

-- ------------------------------------------------------------ applications ---
-- Runs after applications_before_insert (triggers fire in name order), so
-- "you have already applied" still wins for someone applying twice.
create or replace function private.applications_existing_account()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select p.role into v_role from public.profiles p where lower(p.email) = lower(btrim(new.email));
  if v_role is not null and v_role::text <> new.role::text then
    raise exception '%', private.account_kind_conflict_message(v_role::text)
      using errcode = 'P0001', hint = 'EMAIL_HAS_ACCOUNT';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_existing_account on public.applications;
create trigger applications_existing_account
  before insert on public.applications
  for each row execute function private.applications_existing_account();

-- ---------------------------------------------------------- form pre-check ---
-- Same as 0005 plus `email_registered`: the sign-up forms ask on the page that
-- collects the email, instead of failing at the very end. Still booleans only.
create or replace function public.check_application_duplicates(
  p_phone text default null,
  p_instagram text default null,
  p_email text default null
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'email_taken', exists (
      select 1 from public.applications a
      where lower(a.email) = lower(p_email)
        and a.status <> 'rejected'
    ),
    'email_registered', exists (
      select 1 from public.profiles p
      where lower(p.email) = lower(btrim(p_email))
        and p.role is not null
    ),
    'phone_taken', private.phone_is_registered(p_phone, p_email),
    'instagram_taken', private.instagram_is_registered(p_instagram, p_email)
  );
$$;

comment on function public.check_application_duplicates(text, text, text) is
  'Has this email, mobile number or Instagram account already been registered? Returns booleans only — never which account it belongs to. Excludes rejected applications for email re-application.';

revoke all on function public.check_application_duplicates(text, text, text) from public;
grant execute on function public.check_application_duplicates(text, text, text) to anon, authenticated;

revoke all on function private.account_kind_conflict_message(text) from public;
revoke all on function private.enforce_one_account_kind() from public;
revoke all on function private.profiles_one_account_kind() from public;
revoke all on function private.applications_existing_account() from public;

commit;
