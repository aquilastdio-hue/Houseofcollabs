-- 0045 - Creators no longer set their own engagement rate
--
-- The storefront showed two engagement rates for some creators: the real one
-- from the weekly Instagram fetch (creator_instagram_stats), and one they
-- typed into Profile -> Creator info, which nothing checked (several said
-- 100%). The field is gone from the creator's form and from every profile;
-- only the Instagram figure shows. This takes away the column grant too, so
-- the API can't be used to set it either.
--
-- Run AFTER the website update is live: until then the old form still sends
-- engagement_rate when a creator saves Creator info, and would be refused.
--
-- Existing typed values stay in creators.engagement_rate (nothing deleted);
-- they're no longer shown anywhere.

begin;

revoke update (engagement_rate) on public.creators from authenticated;

commit;
