-- 0081 - Employees and the creators their referral codes brought in
--
-- The creator sign-up form asks for a referral code, and approval copies it
-- onto the creator (0062). Nothing said whose code it was, so "how many
-- creators did Rahul onboard?" had no answer. `employees` gives each person on
-- the team a code, and `admin_employee_referrals` counts the creators and the
-- waiting applications that typed it.
--
-- Codes are matched upper-cased and trimmed on both sides -- the form already
-- upper-cases what it stores -- so "rahul10 " on an application still counts
-- for RAHUL10. Codes that no employee owns (typos, or a code handed out before
-- it was entered here) come back as rows with no employee, so nothing typed on
-- the form goes uncounted.
--
-- Admin-only throughout: the table is behind RLS that only admins pass, and
-- the function checks `require_admin`.

begin;

-- ------------------------------------------------------------------- table --

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  -- Stored the way it is compared: upper-cased, no spaces. Letters, digits,
  -- - and _ only, so a code reads back exactly as it was handed out.
  referral_code text not null unique check (referral_code ~ '^[A-Z0-9_-]{2,40}$'),
  phone text check (phone is null or char_length(phone) <= 32),
  email text check (email is null or char_length(email) <= 254),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.employees is
  'Team members who hand out referral codes for the creator sign-up form. Admin-only.';
comment on column public.employees.referral_code is
  'Matched against creators.referral_code and applications.profile ->> referral_code, both upper-cased.';

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at before update on public.employees
  for each row execute function private.set_updated_at();

alter table public.employees enable row level security;

drop policy if exists "Admins read employees" on public.employees;
create policy "Admins read employees" on public.employees
  for select to authenticated using ((select private.is_admin()));
drop policy if exists "Admins insert employees" on public.employees;
create policy "Admins insert employees" on public.employees
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists "Admins update employees" on public.employees;
create policy "Admins update employees" on public.employees
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Admins delete employees" on public.employees;
create policy "Admins delete employees" on public.employees
  for delete to authenticated using ((select private.is_admin()));

-- Supabase's default privileges grant every new table to anon and
-- authenticated; this project grants explicitly instead (0012, 0031). RLS
-- already shuts anon out, but the table shouldn't be granted to it at all.
revoke all on public.employees from anon, authenticated;
grant select, insert, update, delete on public.employees to authenticated;

-- --------------------------------------------------------------- dashboard --

create or replace function public.admin_employee_referrals()
returns table (
  employee_id uuid,
  full_name text,
  referral_code text,
  phone text,
  email text,
  active boolean,
  added_at timestamptz,
  onboarded bigint,
  live bigint,
  onboarded_this_month bigint,
  onboarded_7d bigint,
  last_onboarded_at timestamptz,
  pending_applications bigint
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  perform private.require_admin();

  return query
  with by_code as (
    -- Onboarded = a creator account exists (approval created it) and has not
    -- been removed. "This month" is the calendar month in India.
    select upper(btrim(c.referral_code)) as code,
           count(*) as total,
           count(*) filter (where c.status = 'published') as published,
           count(*) filter (where c.created_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')) as this_month,
           count(*) filter (where c.created_at > now() - interval '7 days') as last_7d,
           max(c.created_at) as last_at
    from public.creators c
    where c.deleted_at is null
      and nullif(btrim(c.referral_code), '') is not null
    group by 1
  ),
  pending_by_code as (
    select upper(btrim(a.profile ->> 'referral_code')) as code, count(*) as n
    from public.applications a
    where a.role = 'creator'
      and a.status in ('new', 'reviewing')
      and nullif(btrim(a.profile ->> 'referral_code'), '') is not null
    group by 1
  ),
  all_codes as (
    select e.referral_code as code from public.employees e
    union
    select b.code from by_code b
    union
    select p.code from pending_by_code p
  )
  select e.id, e.full_name, k.code, e.phone, e.email, e.active, e.created_at,
         coalesce(b.total, 0), coalesce(b.published, 0), coalesce(b.this_month, 0), coalesce(b.last_7d, 0),
         b.last_at, coalesce(p.n, 0)
  from all_codes k
  left join public.employees e on e.referral_code = k.code
  left join by_code b on b.code = k.code
  left join pending_by_code p on p.code = k.code
  order by (e.id is null), coalesce(b.total, 0) desc, coalesce(p.n, 0) desc, e.full_name, k.code;
end;
$function$;

revoke execute on function public.admin_employee_referrals() from public, anon;
grant execute on function public.admin_employee_referrals() to authenticated;

commit;
