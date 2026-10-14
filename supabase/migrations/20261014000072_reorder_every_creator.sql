-- 0072 - Creator ranking is one list, so a drag saves every creator
--
-- The admin lists no longer split into pages: Creator ranking shows every
-- creator at once, and a drag sends the whole visible order (0048), which is
-- now every creator. The 200-id guard would start refusing drags as soon as
-- the marketplace passed 200 creators, so it is raised to 10,000 -- still a
-- bound on the array a single call can push, just not one the real list hits.
--
-- Same body as 0048 otherwise; CREATE OR REPLACE keeps the existing grant.

begin;

create or replace function public.admin_reorder_creators(p_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int := coalesce(array_length(p_ids, 1), 0);
begin
  perform private.require_admin();
  if v_count = 0 then return; end if;
  if v_count > 10000 then
    raise exception 'Too many creators in one reorder.' using errcode = 'P0001', hint = 'TOO_MANY';
  end if;
  if exists (
    select 1 from unnest(p_ids) x(id)
    where not exists (select 1 from public.creators c where c.id = x.id)
  ) then
    raise exception 'Unknown creator in the order.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  insert into public.creator_rankings (creator_id, sort_order, updated_by)
  select x.id, x.ord, auth.uid()
  from unnest(p_ids) with ordinality as x(id, ord)
  on conflict (creator_id) do update
    set sort_order = excluded.sort_order, updated_by = excluded.updated_by, updated_at = now();

  perform private.audit('creators_reordered', 'creator', null,
    jsonb_build_object('count', v_count), auth.uid(), 'admin');
end;
$$;

commit;
