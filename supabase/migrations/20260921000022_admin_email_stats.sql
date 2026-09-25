-- =============================================================================
-- House of Collabs · 0022 · email delivery rollup for the admin email log
-- =============================================================================
-- The log itself is a plain RLS-guarded select on public.email_deliveries; this
-- is only the header summary, which would otherwise be six round trips.
-- =============================================================================

create or replace function public.admin_email_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'total',      (select count(*) from public.email_deliveries),
    'sent',       (select count(*) from public.email_deliveries where status = 'sent'),
    'pending',    (select count(*) from public.email_deliveries where status in ('pending', 'processing')),
    'failed',     (select count(*) from public.email_deliveries where status = 'failed'),
    'skipped',    (select count(*) from public.email_deliveries where status = 'skipped'),
    -- Waiting on the retry worker right now: still has attempts left and is due.
    'retryable',  (select count(*) from public.email_deliveries
                   where status in ('pending', 'failed') and attempts < max_attempts and next_attempt_at <= now()),
    -- Out of attempts — these need a human, the worker will not pick them up.
    'exhausted',  (select count(*) from public.email_deliveries where status = 'failed' and attempts >= max_attempts),
    'sent_24h',   (select count(*) from public.email_deliveries where status = 'sent' and sent_at > now() - interval '24 hours'),
    'failed_24h', (select count(*) from public.email_deliveries where status = 'failed' and created_at > now() - interval '24 hours'),
    'by_category',(select coalesce(jsonb_object_agg(c.category, c.n), '{}'::jsonb)
                   from (select category, count(*)::int as n from public.email_deliveries group by 1) c),
    -- Which provider actually delivered the most recent email. 'console' here
    -- means nothing left the server: EMAIL_PROVIDER is still unset.
    'provider',   (select provider from public.email_deliveries
                   where provider is not null order by sent_at desc nulls last limit 1),
    'last_sent_at', (select max(sent_at) from public.email_deliveries)
  );
end;
$$;

comment on function public.admin_email_stats() is
  'Admin-only counters for the email delivery log.';

revoke execute on function public.admin_email_stats() from anon;
grant execute on function public.admin_email_stats() to authenticated;
