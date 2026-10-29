-- 0023 - Brands can save briefs again (quick brief at checkout, Briefs page)
--
-- Saving a brief reads the new row back (insert ... returning). The read-back
-- goes through the SELECT policy, which only asked private.can_view_brief(id).
-- That function looks the brief up by id, and inside the same insert it can't
-- see the row being written yet, so every brief a brand saved was refused with
-- "new row violates row-level security policy" and checkout stopped at "You
-- don't have permission to do that."
--
-- The owning brand is now recognised from the row itself (brand_id), which
-- works mid-insert. Who can see a brief is unchanged: the owning brand, the
-- assigned creator once it's sent, creators with an order on it, and admins.

begin;

drop policy if exists "Briefs visible to owning brand, assigned creator, admins" on public.briefs;
create policy "Briefs visible to owning brand, assigned creator, admins" on public.briefs
  for select to authenticated
  using (
    brand_id = (select private.my_brand_id())
    or private.can_view_brief(id)
    or (select private.is_admin())
  );

commit;
