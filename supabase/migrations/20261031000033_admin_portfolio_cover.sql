-- 0033 - Admin: make a post a creator's storefront image or profile picture
--
-- A creator's card on the marketplace shows their first visible portfolio
-- post (search_creators' portfolio_preview, ordered by sort_order). Creators
-- choose it with "Make storefront image" in their portfolio, which moves the post
-- to the front with the update they already have on sort_order. Admins can't
-- update another creator's posts, so they get this: the chosen post becomes
-- first and the rest keep their order behind it. A hidden post can't be the
-- cover; nobody but admins would see it.
--
-- "Make profile picture" points the creator's profile picture at a photo
-- post (creators set their own profile_image_url already). The post and the
-- picture then share one file; 0032 and the delete code keep a file that's
-- still in use.

begin;

create or replace function public.admin_set_portfolio_cover(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_item public.portfolio_items;
begin
  select * into v_item from public.portfolio_items where id = p_item_id;
  if not found then
    raise exception 'Portfolio item not found.' using errcode = 'P0002', hint = 'ITEM_NOT_FOUND';
  end if;
  if v_item.is_hidden then
    raise exception 'A hidden post can’t be the storefront image. Unhide it first.' using errcode = 'P0001', hint = 'ITEM_HIDDEN';
  end if;

  update public.portfolio_items p
  set sort_order = o.position
  from (
    select i.id, (row_number() over (order by (i.id = p_item_id) desc, i.sort_order, i.created_at) - 1)::int as position
    from public.portfolio_items i
    where i.creator_id = v_item.creator_id
  ) o
  where p.id = o.id and p.sort_order is distinct from o.position;

  perform private.audit('portfolio_cover_set', 'portfolio_item', p_item_id::text,
    jsonb_build_object('creator_id', v_item.creator_id), v_admin, 'admin');
end;
$$;

revoke execute on function public.admin_set_portfolio_cover(uuid) from public, anon;
grant execute on function public.admin_set_portfolio_cover(uuid) to authenticated;

create or replace function public.admin_set_profile_photo_from_post(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_item public.portfolio_items;
begin
  select * into v_item from public.portfolio_items where id = p_item_id;
  if not found then
    raise exception 'Portfolio item not found.' using errcode = 'P0002', hint = 'ITEM_NOT_FOUND';
  end if;
  if v_item.type <> 'image' then
    raise exception 'Only a photo can be a profile picture.' using errcode = 'P0001', hint = 'NOT_A_PHOTO';
  end if;
  if v_item.is_hidden then
    raise exception 'A hidden post can’t be the profile picture. Unhide it first.' using errcode = 'P0001', hint = 'ITEM_HIDDEN';
  end if;

  update public.creators set profile_image_url = v_item.media_url where id = v_item.creator_id;

  perform private.audit('profile_photo_set_from_post', 'portfolio_item', p_item_id::text,
    jsonb_build_object('creator_id', v_item.creator_id, 'media_url', v_item.media_url), v_admin, 'admin');
end;
$$;

revoke execute on function public.admin_set_profile_photo_from_post(uuid) from public, anon;
grant execute on function public.admin_set_profile_photo_from_post(uuid) to authenticated;

commit;
