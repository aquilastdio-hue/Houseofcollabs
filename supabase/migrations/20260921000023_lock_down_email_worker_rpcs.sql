-- =============================================================================
-- House of Collabs · 0023 · close the email worker RPCs to end users
-- =============================================================================
-- Migration 0020 ended with:
--
--   revoke execute on function public.claim_pending_emails, public.record_email_result
--     from anon, authenticated;
--
-- That is not enough. Postgres grants EXECUTE on every new function to the
-- PUBLIC pseudo-role, and `anon`/`authenticated` inherit it. Revoking from the
-- two named roles left the PUBLIC grant untouched, so the functions stayed
-- callable: verified live, an ordinary creator JWT got 200 from
-- claim_pending_emails and 204 from record_email_result.
--
-- Impact if left: any signed-in user could claim the whole retry queue (moving
-- rows to `processing` so the real worker skips them) or mark deliveries as
-- sent/failed. No email content leaks — the row carries only a subject — but
-- the pipeline could be stalled, and a delivery could be marked sent when it
-- never was.
--
-- Two independent fixes, because the grant alone is easy to undo by accident:
--   1. revoke from PUBLIC as well;
--   2. refuse the call in the function body unless it came from the service
--      role (or from inside the database, e.g. psql or pg_cron).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Guard
-- -----------------------------------------------------------------------------
/**
 * True only for the service role. PostgREST sets `request.jwt.claims` from the
 * verified JWT on every API request, so an end user cannot forge it; when the
 * setting is absent the call came from inside the database (pg_cron, psql, a
 * migration) and is trusted.
 */
create or replace function private.is_service_role()
returns boolean
language plpgsql stable
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
begin
  if v_claims is null or v_claims = '' then
    return true;
  end if;
  return coalesce(v_claims::jsonb ->> 'role', '') = 'service_role';
exception when others then
  -- Unparseable claims are not a service-role call.
  return false;
end;
$$;

comment on function private.is_service_role() is
  'True for service-role API calls and for in-database callers (cron, psql).';

create or replace function private.require_service_role()
returns void
language plpgsql stable
as $$
begin
  if not private.is_service_role() then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. The two worker functions, re-created with the guard
-- -----------------------------------------------------------------------------
create or replace function public.claim_pending_emails(p_limit int default 20)
returns setof public.email_deliveries
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_service_role();
  return query
  update public.email_deliveries d
  set status = 'processing', attempts = d.attempts + 1
  where d.id in (
    select x.id from public.email_deliveries x
    where x.status in ('pending', 'failed')
      and x.attempts < x.max_attempts
      and x.next_attempt_at <= now()
    order by x.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  returning d.*;
end;
$$;

create or replace function public.record_email_result(
  p_id uuid,
  p_status text,
  p_provider text default null,
  p_message_id text default null,
  p_error text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_service_role();
  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception 'Unknown email status: %', p_status using errcode = 'P0001';
  end if;
  update public.email_deliveries
  set status = case
        when p_status = 'failed' and attempts >= max_attempts then 'failed'
        else p_status
      end,
      provider = coalesce(p_provider, provider),
      provider_message_id = coalesce(p_message_id, provider_message_id),
      last_error = case when p_status = 'failed' then left(p_error, 2000) else null end,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      -- 2^attempts minutes: 2, 4, 8, 16, 32.
      next_attempt_at = case when p_status = 'failed'
        then now() + (power(2, least(attempts, 5)) * interval '1 minute')
        else next_attempt_at end
  where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Grants. PUBLIC first — that is the one that was being inherited.
-- -----------------------------------------------------------------------------
revoke execute on function public.claim_pending_emails(int) from public, anon, authenticated;
revoke execute on function public.record_email_result(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_pending_emails(int) to service_role;
grant execute on function public.record_email_result(uuid, text, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 4. Audit: any other SECURITY DEFINER function in `public` that an end user can
--    execute and that never checks who is calling. Reported, not changed —
--    most public RPCs are meant to be callable and guard themselves.
-- -----------------------------------------------------------------------------
do $$
declare
  v_list text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
  into v_list
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and p.prosrc !~ 'require_admin|require_service_role|is_admin|auth\.uid\(\)';
  if v_list is null then
    raise notice 'SECURITY DEFINER audit: no unguarded caller-executable functions in public.';
  else
    raise notice 'SECURITY DEFINER audit: review these — %', v_list;
  end if;
end;
$$;
