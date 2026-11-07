-- 0049 - The verified badge comes only from approving a request
--
-- admin_set_creator_flags (Admin -> creator -> Moderation -> Badges) could
-- give the verified badge directly. Now it can only take it away; the badge
-- is given by approving the creator's verification request (PAN, bank, UPI:
-- migration 0047). Taking it away closes the approved request, so the
-- creator can send a new one. Featuring is unchanged.

begin;

-- Featured on or off, and the verified badge off. The badge itself is given
-- only by approving a request (admin_review_creator_verification). Taking it
-- away closes the approved request, so the creator can send a new one.
CREATE OR REPLACE FUNCTION public.admin_set_creator_flags(p_creator_id uuid, p_verified boolean DEFAULT NULL::boolean, p_featured boolean DEFAULT NULL::boolean)
 RETURNS public.creators
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_admin uuid := private.require_admin();
  v_old public.creators;
  v_c public.creators;
begin
  select * into v_old from public.creators where id = p_creator_id for update;
  if not found then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;
  if p_verified and not v_old.verified then
    raise exception 'The verified badge comes only from approving the creator''s verification request.' using errcode = 'P0001', hint = 'VERIFY_BY_REQUEST';
  end if;

  update public.creators
  set verified = coalesce(p_verified, verified),
      featured = coalesce(p_featured, featured)
  where id = p_creator_id returning * into v_c;

  if v_old.verified and not v_c.verified then
    update public.creator_verifications
    set status = 'rejected', reviewed_by = v_admin, reviewed_at = now(),
        review_note = 'Your verified badge was removed. Send a new verification request to get it back.'
    where creator_id = v_c.id and status = 'approved';
  end if;
  if v_c.verified is distinct from v_old.verified then
    perform private.audit('creator_unverified', 'creator', v_c.id::text, '{}'::jsonb, v_admin, 'admin');
  end if;
  if v_c.featured is distinct from v_old.featured then
    perform private.audit(case when v_c.featured then 'creator_featured' else 'creator_unfeatured' end,
      'creator', v_c.id::text, '{}'::jsonb, v_admin, 'admin');
  end if;
  return v_c;
end;
$function$;

commit;
