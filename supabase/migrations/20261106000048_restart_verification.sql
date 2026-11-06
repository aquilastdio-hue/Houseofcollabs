-- 0048 - Everyone verifies again with the new form
--
-- The owner asked for every verification request sent with the old form to be
-- removed, and for any creator verified before the new process to lose the
-- badge, so all creators verify again with PAN, bank account and UPI (0047).
-- No one is notified.
--
-- Run AFTER the website with the new form is live, so no new old-form
-- requests arrive afterwards. Requests already sent with the new form (they
-- have a row in private.creator_verification_secrets) are kept, and so is the
-- badge of a creator approved through one. The ID files uploaded with old
-- requests stay in the private verification-documents bucket; only the
-- request records go. The audit log keeps the history.

begin;

-- Badges first, while the old requests still say how each creator got verified.
update public.creators c
set verified = false
where c.verified
  and not exists (
    select 1
    from public.creator_verifications v
    join private.creator_verification_secrets s on s.verification_id = v.id
    where v.creator_id = c.id and v.status = 'approved'
  );

delete from public.creator_verifications v
where not exists (select 1 from private.creator_verification_secrets s where s.verification_id = v.id);

commit;
