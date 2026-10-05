-- 0061 · One phone number and one Instagram account per applicant
--
-- The sign-up forms let the same person register repeatedly with a different
-- email. This adds a duplicate check on the two things that actually identify a
-- person: their mobile number and their Instagram account.
--
-- Three decisions worth stating, because none is obvious from the code:
--
-- 1. `applications` is INSERT-only for `anon` and SELECT-only for admins, which
--    is right: the table holds phone numbers, and letting the browser read it
--    would turn the sign-up form into a directory of everyone who has applied.
--    So the check cannot be a client-side `select`. It is a SECURITY DEFINER
--    function that takes the two values and returns two booleans -- never a row,
--    never a name, never whose account it collides with.
--
-- 2. "Already registered" means all three places these values live, not just
--    `applications`: a creator who was approved and has since edited their
--    handle in the studio is registered even though the new handle never
--    appeared on an application.
--
-- 3. An applicant's own earlier rows never block them. Without this, a typo in
--    the first submission would lock someone out of their own phone number
--    forever. Matching is by email, which is what the existing rate limit on
--    this table already keys on.
--
-- Rejected applications do not block a re-application. Everything else does.
--
-- Nothing here touches existing rows. The five applications that already share
-- a normalised phone (`9876543210` and `9911141355`) are all seed or test data
-- and keep working exactly as they are -- the enforcement is on INSERT, so
-- history is not rewritten and no unique index has to be satisfied retroactively.

begin;

-- ------------------------------------------------------------ normalisation --
-- Both are IMMUTABLE so they can back functional indexes, and both are used by
-- the lookup *and* the trigger, so the browser's answer and the database's
-- verdict can never disagree about what counts as the same value.

create or replace function private.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path to ''
as $$
  -- Digits only, then drop an Indian country code or a trunk '0' so that
  -- '+91 98765 43210', '919876543210', '09876543210' and '9876543210' are one
  -- number. Anything else keeps all of its digits rather than being guessed at.
  select nullif(
    case
      when length(d.v) = 12 and left(d.v, 2) = '91' then right(d.v, 10)
      when length(d.v) = 11 and left(d.v, 1) = '0'  then right(d.v, 10)
      else d.v
    end, '')
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as v) d;
$$;

create or replace function private.normalize_instagram(p_handle text)
returns text
language sql
immutable
set search_path to ''
as $$
  -- '@JohnDoe', 'johndoe', 'JOHNDOE' and
  -- 'https://instagram.com/johndoe?igshid=...' all reduce to 'johndoe'.
  -- Real stored values include every one of those shapes.
  select nullif(
    regexp_replace(
      regexp_replace(
        split_part(
          split_part(
            case
              when lower(coalesce(p_handle, '')) ~ 'instagram[.]com/'
                then regexp_replace(lower(btrim(p_handle)), '^.*instagram[.]com/', '')
              else lower(btrim(coalesce(p_handle, '')))
            end,
          '?', 1),
        '/', 1),
      '^@+', ''),
    '[[:space:]]', '', 'g'), '');
$$;

comment on function private.normalize_phone(text) is
  'Comparable form of a mobile number: digits only, Indian country code and trunk prefix removed.';
comment on function private.normalize_instagram(text) is
  'Comparable form of an Instagram handle: lower-cased, @ and profile-URL wrapper removed.';

-- --------------------------------------------------------------- the lookup --
-- `p_except_email` is the applicant's own address, so their earlier attempts
-- never count against them.

create or replace function private.phone_is_registered(p_phone text, p_except_email text default null)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.normalize_phone(p_phone) is not null
     and (
       exists (
         select 1 from public.applications a
         where a.status <> 'rejected'
           and private.normalize_phone(a.phone) = private.normalize_phone(p_phone)
           and (p_except_email is null or lower(a.email) <> lower(p_except_email))
       )
       or exists (
         select 1 from public.profiles pr
         where private.normalize_phone(pr.phone) = private.normalize_phone(p_phone)
           and (p_except_email is null or lower(pr.email) <> lower(p_except_email))
       )
     );
$$;

create or replace function private.instagram_is_registered(p_handle text, p_except_email text default null)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.normalize_instagram(p_handle) is not null
     and (
       exists (
         select 1 from public.applications a
         where a.status <> 'rejected'
           and private.normalize_instagram(a.social_handle) = private.normalize_instagram(p_handle)
           and (p_except_email is null or lower(a.email) <> lower(p_except_email))
       )
       or exists (
         select 1 from public.creator_social_accounts sa
         join public.creators c on c.id = sa.creator_id
         join public.profiles pr on pr.id = c.profile_id
         where sa.platform = 'instagram'
           and private.normalize_instagram(sa.username) = private.normalize_instagram(p_handle)
           and (p_except_email is null or lower(pr.email) <> lower(p_except_email))
       )
     );
$$;

-- ---------------------------------------------------------- what the form calls --
-- Returns two booleans and nothing else. Callable by `anon` because the form is
-- filled in before anyone has an account.

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
    'phone_taken', private.phone_is_registered(p_phone, p_email),
    'instagram_taken', private.instagram_is_registered(p_instagram, p_email)
  );
$$;

comment on function public.check_application_duplicates(text, text, text) is
  'Has this mobile number or Instagram account already been registered? Returns booleans only — never which account it belongs to.';

revoke all on function public.check_application_duplicates(text, text, text) from public;
grant execute on function public.check_application_duplicates(text, text, text) to anon, authenticated;

-- ----------------------------------------------------- the actual enforcement --
-- The form check is a courtesy; this is what makes it true. Extends the guard
-- already on this table rather than adding a second one, so the rate limit and
-- the server-owned fields keep their existing behaviour.

create or replace function private.applications_before_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_phone_taken boolean;
  v_insta_taken boolean;
begin
  if (select count(*) from public.applications a
      where lower(a.email) = lower(new.email) and a.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'You have already applied. We will be in touch shortly.'
      using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;

  v_phone_taken := private.phone_is_registered(new.phone, new.email);
  v_insta_taken := private.instagram_is_registered(new.social_handle, new.email);

  if v_phone_taken and v_insta_taken then
    raise exception 'This mobile number and Instagram ID are already registered. Please use different details.'
      using errcode = 'P0001', hint = 'DUPLICATE_PHONE_AND_INSTAGRAM';
  elsif v_phone_taken then
    raise exception 'This mobile number is already registered. Please use a different mobile number.'
      using errcode = 'P0001', hint = 'DUPLICATE_PHONE';
  elsif v_insta_taken then
    raise exception 'This Instagram ID is already registered. Please use a different Instagram ID.'
      using errcode = 'P0001', hint = 'DUPLICATE_INSTAGRAM';
  end if;

  -- Never client-settable, whatever the request body says.
  new.status := 'new';
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_at := now();
  return new;
end;
$function$;

-- ------------------------------------------------------------------ indexes --
-- Both lookups run on every Continue click, so they get an index rather than a
-- sequential scan that grows with the applicant list.

create index if not exists applications_phone_norm_idx
  on public.applications (private.normalize_phone(phone))
  where phone is not null;

create index if not exists applications_social_handle_norm_idx
  on public.applications (private.normalize_instagram(social_handle))
  where social_handle is not null;

create index if not exists profiles_phone_norm_idx
  on public.profiles (private.normalize_phone(phone))
  where phone is not null;

create index if not exists creator_social_accounts_username_norm_idx
  on public.creator_social_accounts (private.normalize_instagram(username))
  where platform = 'instagram';

commit;
