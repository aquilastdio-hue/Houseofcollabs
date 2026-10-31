-- 0031 - Admin: hide a creator's post from everyone, or delete it for good
--
-- Each post on Admin → Creators → a creator, and Admin → Content → Portfolio,
-- has a ⋮ menu with Hide and Delete.
--
-- HIDE now means hidden from everyone but admins. Until now a hidden post
-- still showed in the creator's own portfolio; it no longer does, so the
-- storefront, brands, search and the creator all stop seeing it. Unhide puts
-- it back. Creators still can't change `is_hidden` (0012).
--
-- DELETE erases the post: `admin_delete_portfolio_item` deletes the row and
-- records it in the audit log, and the app then removes its files (the photo
-- or video and its preview) from the creator-portfolio bucket. Storage only
-- let a creator remove files in their own folder, so admins get the same
-- right on that bucket. Nothing else references a post, so nothing breaks.

begin;

drop policy if exists "Visible portfolio of public creators is readable" on public.portfolio_items;
create policy "Visible portfolio of public creators is readable" on public.portfolio_items
  for select to anon, authenticated
  using (
    (select private.is_admin())
    or (not is_hidden and (
      private.is_creator_public(creator_id)
      or private.owns_creator(creator_id)
      or private.brand_has_creator_relationship(creator_id)
    ))
  );

create or replace function public.admin_delete_portfolio_item(p_item_id uuid)
returns public.portfolio_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_i public.portfolio_items;
begin
  delete from public.portfolio_items where id = p_item_id returning * into v_i;
  if not found then
    raise exception 'Portfolio item not found.' using errcode = 'P0002', hint = 'ITEM_NOT_FOUND';
  end if;
  perform private.audit('portfolio_deleted', 'portfolio_item', v_i.id::text,
    jsonb_build_object('creator_id', v_i.creator_id, 'type', v_i.type, 'media_url', v_i.media_url), v_admin, 'admin');
  return v_i;
end;
$$;

revoke execute on function public.admin_delete_portfolio_item(uuid) from public, anon;
grant execute on function public.admin_delete_portfolio_item(uuid) to authenticated;

-- Removing a file reads it first, so admins need both.
drop policy if exists "portfolio: admins can read" on storage.objects;
create policy "portfolio: admins can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'creator-portfolio' and (select private.is_admin()));

drop policy if exists "portfolio: admins can delete" on storage.objects;
create policy "portfolio: admins can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'creator-portfolio' and (select private.is_admin()));

commit;
