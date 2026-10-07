-- =============================================================================
-- Spotlit · 0015 · reference data required in every environment
-- (categories, creator types, platform settings — not demo users)
-- =============================================================================

insert into public.categories (name, slug, description, icon, color, sort_order) values
  ('Beauty', 'beauty', 'Makeup looks, tutorials, swatches and honest product reviews.', 'sparkles', 'rose', 1),
  ('Fashion', 'fashion', 'Styling, try-on hauls, lookbooks and outfit edits.', 'shirt', 'lilac', 2),
  ('Fitness', 'fitness', 'Workouts, nutrition routines and active-wear in motion.', 'dumbbell', 'mint', 3),
  ('Lifestyle', 'lifestyle', 'Everyday routines, home, wellness and day-in-the-life stories.', 'sun', 'sand', 4),
  ('Food', 'food', 'Recipes, restaurant reviews, taste tests and kitchen content.', 'utensils', 'peach', 5),
  ('Travel', 'travel', 'Destinations, stays, itineraries and travel essentials.', 'plane', 'sky', 6),
  ('Technology', 'technology', 'Unboxings, gadget reviews, apps and how-tos.', 'cpu', 'sky', 7),
  ('Gaming', 'gaming', 'Gameplay, streams, reviews and gaming gear.', 'gamepad-2', 'lilac', 8),
  ('Parenting', 'parenting', 'Family life, baby products and parenting tips.', 'baby', 'peach', 9),
  ('Education', 'education', 'Explainers, study tips, courses and edtech.', 'graduation-cap', 'mint', 10),
  ('Skincare', 'skincare', 'Routines, ingredients deep-dives and before/afters.', 'droplets', 'rose', 11),
  ('Couple', 'couple', 'Relatable couple content, gifting and shared experiences.', 'heart', 'rose', 12),
  ('UGC', 'ugc', 'Authentic user-generated videos for ads and product pages.', 'smartphone', 'lime', 13),
  ('Photography', 'photography', 'Product shoots, flat lays and editorial photography.', 'camera', 'sand', 14),
  ('Finance', 'finance', 'Money tips, investing basics and fintech walkthroughs.', 'wallet', 'mint', 15)
on conflict (slug) do nothing;

insert into public.creator_types (slug, name, description, min_followers, max_followers, sort_order) values
  ('ugc_creator', 'UGC Creator', 'Makes ad-ready content for brand channels; audience size not required.', null, null, 1),
  ('nano_creator', 'Nano Creator', 'Close-knit, highly engaged communities.', 1000, 10000, 2),
  ('micro_creator', 'Micro Creator', 'Focused niche audiences with strong trust.', 10000, 100000, 3),
  ('influencer', 'Influencer', 'Large audiences with broad reach.', 100000, null, 4),
  ('professional_creator', 'Professional Creator', 'Studios, photographers and production-grade creators.', null, null, 5)
on conflict (slug) do nothing;

insert into public.platform_settings (key, value, description, is_public) values
  ('platform_fee_percentage', '10', 'Percentage of each order kept by the platform (deducted from the creator payout).', true),
  ('minimum_payout_amount', '500', 'Minimum available balance (INR) required to request a payout.', true),
  ('require_creator_approval', 'true', 'When true, new creator profiles are reviewed by an admin before going live.', true),
  ('max_revisions', '5', 'Upper bound on revisions per order, including add-ons.', true),
  ('earning_hold_days', '0', 'Days after completion before earnings become withdrawable (use 7+ in production).', true),
  ('creator_response_hours', '72', 'Hours a creator has to accept a paid order before it is auto-cancelled.', true),
  ('auto_approve_days', '7', 'Days after delivery before an unreviewed order is auto-approved.', true),
  ('payment_expiry_hours', '24', 'Hours an unpaid checkout stays open.', true),
  ('cancellation_rules', '"Brands can cancel for a full refund until the creator accepts. After acceptance, cancellations go through support or a dispute."', 'Shown at checkout and in the refund policy.', true),
  ('refund_rules', '"Full refunds for declined or unaccepted orders. Disputes are reviewed within 3 business days; partial refunds may apply when work was partly delivered."', 'Shown in the refund policy.', true),
  ('support_email', '"support@spotlit.example"', 'Public support contact.', true)
on conflict (key) do nothing;
