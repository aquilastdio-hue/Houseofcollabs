-- =============================================================================
-- End-to-end marketplace flow + RLS isolation.
-- Users are impersonated exactly like PostgREST does it: request.jwt.claims +
-- SET LOCAL ROLE authenticated|anon|service_role. Everything is rolled back.
-- =============================================================================
-- @include 00_helpers.sql.inc

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: sign-ups go through the real auth.users trigger
-- ---------------------------------------------------------------------------
select set_config('t.brand_uid', pg_temp.new_user('brand@test.dev', 'brand', 'Brand Owner')::text, true);
select set_config('t.creator_uid', pg_temp.new_user('creator@test.dev', 'creator', 'Casey Creator')::text, true);
select set_config('t.other_uid', pg_temp.new_user('other@test.dev', 'brand', 'Other Brand')::text, true);
select set_config('t.sneaky_uid', pg_temp.new_user('sneaky@test.dev', 'admin', 'Sneaky')::text, true);
select set_config('t.admin_uid', pg_temp.new_user('admin@test.dev', 'brand', 'Admin Person')::text, true);
select private.grant_admin('admin@test.dev');

select pg_temp.check((select role from public.profiles where id = pg_temp.id('brand_uid')) = 'brand', 'brand role stored');
select pg_temp.check((select role from public.profiles where id = pg_temp.id('creator_uid')) = 'creator', 'creator role stored');
select pg_temp.check((select role from public.profiles where id = pg_temp.id('sneaky_uid')) is null, 'admin role from signup metadata is rejected');
select pg_temp.check((select role from public.profiles where id = pg_temp.id('admin_uid')) = 'admin', 'grant_admin sets role');

-- ---------------------------------------------------------------------------
-- Role escalation is impossible
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('sneaky_uid'));
set local role authenticated;
select pg_temp.expect_error($$ select public.set_initial_role('admin') $$, '%brand or a creator%');
select pg_temp.expect_error($$ update public.profiles set role = 'admin' where id = auth.uid() $$, '%permission denied%');
select pg_temp.expect_error($$ insert into public.admin_users (profile_id) values (auth.uid()) $$, '%permission denied%');
select public.set_initial_role('creator');
select pg_temp.expect_error($$ select public.set_initial_role('brand') $$, '%already set%');
select pg_temp.expect_error($$ select public.admin_dashboard_stats() $$, '%admin access required%');
update public.profiles set full_name = 'Renamed' where id = auth.uid();
reset role;
select pg_temp.check((select full_name from public.profiles where id = pg_temp.id('sneaky_uid')) = 'Renamed', 'own safe columns are editable');

-- ---------------------------------------------------------------------------
-- Creator onboarding
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
insert into public.creators (profile_id, display_name, headline, bio, city, state, gender, age, creator_type, profile_image_url)
values (auth.uid(), 'Casey Creator', 'Skincare stories that convert',
        'I make honest skincare videos for Indian skin, with real textures and results.',
        'New Delhi', 'Delhi', 'female', 26, 'micro_creator', '/demo/avatars/creator-01.svg');
select pg_temp.expect_error($$ update public.creators set verified = true where profile_id = auth.uid() $$, '%permission denied%');
select pg_temp.expect_error($$ update public.creators set status = 'published' where profile_id = auth.uid() $$, '%permission denied%');
select pg_temp.expect_error($$ update public.creators set rating = 5 where profile_id = auth.uid() $$, '%permission denied%');
select public.set_creator_categories(
  array[(select id from public.categories where slug = 'skincare'), (select id from public.categories where slug = 'beauty')],
  (select id from public.categories where slug = 'skincare'));
select public.set_creator_languages(array['english', 'Hindi']);
insert into public.creator_social_accounts (creator_id, platform, username, profile_url, followers_count)
values (private.my_creator_id(), 'instagram', 'casey.creates', 'https://instagram.com/casey.creates', 42000);
select pg_temp.expect_error($$ update public.creator_social_accounts set verified = true $$, '%permission denied%');
insert into public.creator_services (creator_id, title, description, price, delivery_days, revisions_included, includes, content_type)
values (private.my_creator_id(), 'UGC Video', '30–45s vertical video', 2000, 5, 1, array['1 video', 'Raw files', '1 revision'], 'ugc_video');
select set_config('t.service_id', (select id::text from public.creator_services where title = 'UGC Video'), true);
insert into public.service_addons (service_id, name, price, addon_type, extra_revisions)
values (pg_temp.id('service_id'), 'Extra revision', 300, 'extra_revision', 1);
insert into public.service_addons (service_id, name, price, addon_type, delivery_days_override)
values (pg_temp.id('service_id'), '24-hour delivery', 1000, 'express_delivery', 1);
insert into public.portfolio_items (creator_id, type, title, media_url)
values (private.my_creator_id(), 'image', 'Serum texture shot', '/demo/portfolio/skincare-01.svg');
select pg_temp.expect_error($$ update public.portfolio_items set is_hidden = false $$, '%permission denied%');
select pg_temp.check((public.get_creator_completion() ->> 'can_publish')::boolean, 'required steps complete');
select public.publish_creator_profile();
select pg_temp.check((select status from public.creators where profile_id = auth.uid()) = 'pending_review', 'publish → pending review');
select public.complete_onboarding();
reset role;

select set_config('t.creator_id', (select id::text from public.creators where profile_id = pg_temp.id('creator_uid')), true);
select pg_temp.check((select starting_price from public.creators where id = pg_temp.id('creator_id')) = 2000, 'starting price maintained');
select pg_temp.check((select followers_count from public.creators where id = pg_temp.id('creator_id')) = 42000, 'followers maintained');
select pg_temp.check((select fastest_delivery_days from public.creators where id = pg_temp.id('creator_id')) = 5, 'delivery maintained');

-- Unpublished creators are invisible to the public
select pg_temp.claims(null, 'anon');
set local role anon;
select pg_temp.check(not exists (select 1 from public.creators where id = pg_temp.id('creator_id')), 'anon cannot see pending creators');
select pg_temp.check(not exists (select 1 from public.search_creators(p_limit => 60) where id = pg_temp.id('creator_id')), 'search hides pending creators');
select pg_temp.check(not exists (select 1 from public.creator_services where creator_id = pg_temp.id('creator_id')), 'anon cannot see pending services');
reset role;

-- Admin approves, verifies, features
select pg_temp.claims(pg_temp.id('admin_uid'));
set local role authenticated;
select pg_temp.check(exists (select 1 from public.admin_list_creators(p_status => 'pending_review', p_limit => 100) where id = pg_temp.id('creator_id')), 'admin sees pending creator');
select public.admin_set_creator_status(pg_temp.id('creator_id'), 'published', null);
select public.admin_set_creator_flags(pg_temp.id('creator_id'), true, true);
select pg_temp.check(exists (select 1 from public.admin_list_creators(p_limit => 100) where id = pg_temp.id('creator_id')), 'admin creator list');
reset role;
select pg_temp.check(exists (select 1 from public.notifications where user_id = pg_temp.id('creator_uid') and type = 'profile_approved'), 'creator told profile is live');
select pg_temp.check(exists (select 1 from public.notifications where user_id = pg_temp.id('creator_uid') and type = 'creator_verified'), 'creator told verified');

-- ---------------------------------------------------------------------------
-- Brand onboarding + discovery
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
insert into public.brands (profile_id, brand_name, industry, contact_email)
values (auth.uid(), 'Glow Theory', 'Skincare', 'team@glowtheory.test');
select pg_temp.check((select count(*) from public.wishlists where is_default) = 1, 'default wishlist created');
select pg_temp.expect_error($$ insert into public.creators (profile_id, display_name) values (auth.uid(), 'Imposter') $$, '%row-level security%');
select pg_temp.expect_error($$ insert into public.brands (profile_id, brand_name) values (auth.uid(), 'Second brand') $$, '%duplicate%');
select public.complete_onboarding();

select pg_temp.check(exists (select 1 from public.search_creators(
  p_category => 'skincare', p_city => 'delhi', p_gender => 'female', p_max_price => 5000, p_max_delivery_days => 5, p_limit => 60) where id = pg_temp.id('creator_id')),
  'smart-search style filters match');
select pg_temp.check(not exists (select 1 from public.search_creators(p_max_price => 1500, p_limit => 60) where id = pg_temp.id('creator_id')), 'price ceiling excludes');
select pg_temp.check(not exists (select 1 from public.search_creators(p_max_delivery_days => 3, p_limit => 60) where id = pg_temp.id('creator_id')), 'delivery filter excludes');
select pg_temp.check(exists (select 1 from public.search_creators(p_query => 'skin', p_limit => 60) where id = pg_temp.id('creator_id')), 'prefix text search');
select pg_temp.check(exists (select 1 from public.search_creators(p_query => 'casey') where id = pg_temp.id('creator_id')), 'name search');
select pg_temp.check(exists (select 1 from public.search_creators(p_languages => array['hindi'], p_limit => 60) where id = pg_temp.id('creator_id')), 'language filter (case-insensitive)');
select pg_temp.check(not exists (select 1 from public.search_creators(p_languages => array['tamil'], p_limit => 60) where id = pg_temp.id('creator_id')), 'language filter excludes');
select pg_temp.check(not exists (select 1 from public.search_creators(p_min_followers => 50000, p_limit => 60) where id = pg_temp.id('creator_id')), 'followers filter');
select pg_temp.check(exists (select 1 from public.search_creators(p_verified_only => true, p_sort => 'price_asc', p_limit => 60) where id = pg_temp.id('creator_id')), 'verified + sort');
select pg_temp.check((select total_count from public.search_creators() limit 1) >= 1, 'total count returned');
select pg_temp.check((select jsonb_array_length(categories) from public.search_creators(p_query => 'casey') where id = pg_temp.id('creator_id')) = 2, 'categories embedded');
select public.record_profile_view(pg_temp.id('creator_id'));
select public.record_profile_view(pg_temp.id('creator_id'));
select public.record_search_event('skincare delhi', '{"category":"skincare"}'::jsonb, 1);

insert into public.wishlist_items (wishlist_id, creator_id)
select id, pg_temp.id('creator_id') from public.wishlists where is_default;
reset role;
select pg_temp.check((select wishlist_count from public.creators where id = pg_temp.id('creator_id')) = 1, 'wishlist count maintained');
select pg_temp.check((select profile_views from public.creators where id = pg_temp.id('creator_id')) = 1, 'profile view deduplicated');

-- ---------------------------------------------------------------------------
-- Order: server-side pricing, no client status writes
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select pg_temp.check((public.calculate_order_total(pg_temp.id('service_id'),
  array[(select id from public.service_addons where name = 'Extra revision' and service_id = pg_temp.id('service_id'))]) ->> 'total')::numeric = 2300, 'quote total');
select pg_temp.expect_error($$ select public.create_order(pg_temp.id('service_id'), array[gen_random_uuid()]) $$, '%add-ons%');
select set_config('t.order_id', (public.create_order(pg_temp.id('service_id'),
  array[(select id from public.service_addons where name = 'Extra revision' and service_id = pg_temp.id('service_id'))], null, 'Show the texture close-up')).id::text, true);
select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'payment_pending', 'awaiting payment');
select pg_temp.check((select total_amount from public.orders where id = pg_temp.id('order_id')) = 2300, 'total computed server-side');
select pg_temp.check((select platform_fee_amount from public.orders where id = pg_temp.id('order_id')) = 230, '10% platform fee');
select pg_temp.check((select creator_earning_amount from public.orders where id = pg_temp.id('order_id')) = 2070, 'creator net');
select pg_temp.check((select revisions_allowed from public.orders where id = pg_temp.id('order_id')) = 2, 'revisions: 1 included + 1 add-on');
select pg_temp.check((select count(*) from public.order_items where order_id = pg_temp.id('order_id')) = 2, 'order items');
select pg_temp.expect_error($$ update public.orders set status = 'completed' where id = pg_temp.id('order_id') $$, '%permission denied%');
select pg_temp.expect_error($$ insert into public.payments (order_id, amount) values (pg_temp.id('order_id'), 1) $$, '%permission denied%');
select pg_temp.expect_error($$ select public.confirm_order_payment('order_x', 'pay_x') $$, '%permission denied%');
select pg_temp.expect_error($$ select public.register_payment_attempt(pg_temp.id('order_id'), auth.uid(), 'o', 1) $$, '%permission denied%');
reset role;

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.check((select count(*) from public.orders) = 0, 'creator cannot see unpaid orders');
select pg_temp.expect_error($$ select public.accept_order(pg_temp.id('order_id')) $$, '%not found%');
reset role;

-- Payment confirmation (what the Edge Functions do with the service role)
select pg_temp.claims(null, 'service_role');
set local role service_role;
select public.register_payment_attempt(pg_temp.id('order_id'), pg_temp.id('brand_uid'), 'order_TEST123', 2300, 'INR', null);
select pg_temp.expect_error($$ select public.confirm_order_payment('order_TEST123', 'pay_TEST', 'sig', 'upi', 999, null) $$, '%amount%');
select public.confirm_order_payment('order_TEST123', 'pay_TEST', 'sig', 'upi', 230000, '{}'::jsonb);
select public.confirm_order_payment('order_TEST123', 'pay_TEST', 'sig', 'upi', 230000, '{}'::jsonb); -- webhook replay is a no-op
reset role;
select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'creator_pending', 'order sent to creator');
select pg_temp.check((select status from public.payments where provider_order_id = 'order_TEST123') = 'captured', 'payment captured');
select pg_temp.check((select count(*) from public.order_status_history where order_id = pg_temp.id('order_id')) = 3, 'history rows after payment');
select pg_temp.check((select count(*) from public.notifications where user_id = pg_temp.id('creator_uid') and type = 'order_new') = 1, 'creator notified once');
select pg_temp.check(exists (select 1 from public.conversations where creator_id = pg_temp.id('creator_id')), 'conversation opened');

-- ---------------------------------------------------------------------------
-- Creator fulfils; brand reviews; revisions bounded; approval completes
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.check((select count(*) from public.orders) = 1, 'creator sees paid order');
select pg_temp.check((select count(*) from public.payments) = 0, 'creator cannot see payments');
select pg_temp.check((select count(*) from public.brands) = 1, 'creator sees the ordering brand');
select pg_temp.expect_error($$ select public.approve_order(pg_temp.id('order_id')) $$, '%not found%');
select pg_temp.expect_error($$ select public.start_order_work(pg_temp.id('order_id')) $$, '%cannot be started%');
select public.accept_order(pg_temp.id('order_id'));
select public.start_order_work(pg_temp.id('order_id'));
insert into storage.objects (bucket_id, name, owner, owner_id)
values ('order-deliverables', pg_temp.id('order_id') || '/final-cut.mp4', auth.uid(), auth.uid()::text);
select pg_temp.expect_error($$ insert into storage.objects (bucket_id, name) values ('order-deliverables', gen_random_uuid() || '/x.mp4') $$, '%row-level security%');
select pg_temp.expect_error($$ insert into storage.objects (bucket_id, name) values ('order-deliverables', pg_temp.id('order_id') || '/evil.exe') $$, '%row-level security%');
select pg_temp.expect_error($$ select public.submit_deliverables(pg_temp.id('order_id'), '[{"storage_path":"other/y.mp4"}]'::jsonb) $$, '%invalid file location%');
select pg_temp.expect_error($$ select public.submit_deliverables(pg_temp.id('order_id'), jsonb_build_array(jsonb_build_object('storage_path', pg_temp.id('order_id') || '/missing.mp4'))) $$, '%could not be found%');
select public.submit_deliverables(pg_temp.id('order_id'),
  jsonb_build_array(jsonb_build_object('storage_path', pg_temp.id('order_id') || '/final-cut.mp4',
                                       'file_name', 'final-cut.mp4', 'mime_type', 'video/mp4', 'size_bytes', 1024)),
  'First cut');
reset role;
select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'delivered', 'delivered');
select pg_temp.check((select due_at is not null from public.orders where id = pg_temp.id('order_id')), 'due date set');

select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'order-deliverables') = 1, 'brand may read the deliverable (signed URL)');
select pg_temp.check((select count(*) from public.order_deliverables where order_id = pg_temp.id('order_id')) = 1, 'deliverable listed');
select public.request_revision(pg_temp.id('order_id'), 'Brighter lighting please', 'Re-shoot the first five seconds');
reset role;

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select public.submit_deliverables(pg_temp.id('order_id'), '[{"external_url":"https://drive.example.com/v2"}]'::jsonb, 'Revision 1');
reset role;
select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'revision_submitted', 'revision submitted');

select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select public.request_revision(pg_temp.id('order_id'), 'One more tweak', null);
reset role;
select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select public.submit_deliverables(pg_temp.id('order_id'), '[{"external_url":"https://drive.example.com/v3"}]'::jsonb, 'Revision 2');
reset role;

select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select pg_temp.expect_error($$ select public.request_revision(pg_temp.id('order_id'), 'Third time?', null) $$, '%used all%');
select pg_temp.expect_error($$ select public.submit_review(pg_temp.id('order_id'), 5, 'Great') $$, '%once the order is complete%');
select public.approve_order(pg_temp.id('order_id'));
select public.submit_review(pg_temp.id('order_id'), 5, 'Fantastic work and a fast turnaround.');
select pg_temp.expect_error($$ select public.submit_review(pg_temp.id('order_id'), 4, 'again') $$, '%already reviewed%');
reset role;

select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'completed', 'completed');
select pg_temp.check((select count(*) from public.order_revisions where order_id = pg_temp.id('order_id') and status = 'resolved') = 2, 'revisions resolved');
select pg_temp.check((select net_amount from public.creator_earnings where order_id = pg_temp.id('order_id')) = 2070, 'earning = total − fee');
select pg_temp.check((select status from public.creator_earnings where order_id = pg_temp.id('order_id')) = 'available', 'available immediately (hold 0)');
select pg_temp.check((select rating from public.creators where id = pg_temp.id('creator_id')) = 5, 'rating aggregated');
select pg_temp.check((select completed_orders from public.creators where id = pg_temp.id('creator_id')) = 1, 'completed orders counted');
select pg_temp.check((select count(*) from public.order_status_history where order_id = pg_temp.id('order_id')) = 12, 'full timeline recorded');

-- ---------------------------------------------------------------------------
-- Earnings → payout
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.check((public.get_earnings_summary() ->> 'available')::numeric = 2070, 'available balance');
select pg_temp.expect_error($$ select public.save_payout_method('bank_transfer', 'Casey', null, '12', 'BAD', null) $$, '%payout details%');
select public.save_payout_method('bank_transfer', 'Casey Creator', null, '1234 5678 9012', 'HDFC0001234', 'HDFC Bank');
select pg_temp.expect_error($$ select bank_account_number from public.payout_methods $$, '%permission denied%');
select pg_temp.check((select bank_account_last4 from public.payout_methods) = '9012', 'masked last four');
select pg_temp.expect_error($$ select public.create_payout_request(auth.uid()) $$, '%permission denied%');
select pg_temp.check((public.get_creator_dashboard_stats() ->> 'revenue_total')::numeric = 2070, 'dashboard revenue');
reset role;

select pg_temp.claims(null, 'service_role');
set local role service_role;
select set_config('t.payout_id', (public.create_payout_request(pg_temp.id('creator_uid'))).id::text, true);
select pg_temp.expect_error($$ select public.create_payout_request(pg_temp.id('creator_uid')) $$, '%already have a payout%');
select pg_temp.expect_error($$ select public.complete_payout(pg_temp.id('payout_id'), pg_temp.id('brand_uid'), 'paid', 'manual', 'UTR1') $$, '%admin access%');
select pg_temp.expect_error($$ select public.complete_payout(pg_temp.id('payout_id'), pg_temp.id('admin_uid'), 'paid', 'manual', null) $$, '%reference%');
select public.complete_payout(pg_temp.id('payout_id'), pg_temp.id('admin_uid'), 'paid', 'manual', 'UTR123456', 'Sent via NEFT');
reset role;
select pg_temp.check((select status from public.payout_requests where id = pg_temp.id('payout_id')) = 'paid', 'payout paid');
select pg_temp.check((select amount from public.payout_requests where id = pg_temp.id('payout_id')) = 2070, 'payout amount');
select pg_temp.check((select status from public.creator_earnings where order_id = pg_temp.id('order_id')) = 'paid', 'earning marked paid');
select pg_temp.check(exists (select 1 from public.notifications where user_id = pg_temp.id('creator_uid') and type = 'payout_processed'), 'payout notification');

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.check((select count(*) from public.payout_transactions) = 1, 'creator sees own payout transaction');
select pg_temp.check((public.get_earnings_summary() ->> 'paid')::numeric = 2070, 'summary shows paid');
reset role;

-- ---------------------------------------------------------------------------
-- Messaging (participants only)
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select set_config('t.conv_id', public.start_conversation(pg_temp.id('creator_id'))::text, true);
insert into public.messages (conversation_id, sender_id, body) values (pg_temp.id('conv_id'), auth.uid(), 'Loved the video!');
insert into public.messages (conversation_id, sender_id, body, attachments)
values (pg_temp.id('conv_id'), auth.uid(), null, jsonb_build_array(jsonb_build_object('path', pg_temp.id('conv_id') || '/brief.pdf', 'name', 'brief.pdf')));
select pg_temp.expect_error($$ insert into public.messages (conversation_id, sender_id, body) values (pg_temp.id('conv_id'), pg_temp.id('creator_uid'), 'spoof') $$, '%row-level security%');
select pg_temp.expect_error($$ insert into public.messages (conversation_id, sender_id, body, message_type) values (pg_temp.id('conv_id'), auth.uid(), 'x', 'system') $$, '%row-level security%');
select pg_temp.expect_error($$ insert into public.messages (conversation_id, sender_id, attachments) values (pg_temp.id('conv_id'), auth.uid(), '[{"path":"elsewhere/x.pdf"}]') $$, '%invalid attachment%');
insert into storage.objects (bucket_id, name, owner_id) values ('message-attachments', pg_temp.id('conv_id') || '/brief.pdf', auth.uid()::text);
reset role;

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.check((select unread_count from public.get_my_conversations()) = 2, 'creator has two unread');
select pg_temp.check((public.get_unread_counts() ->> 'messages')::int = 2, 'unread counter');
select pg_temp.check((select count(*) from public.notifications where type = 'message' and not read) = 1, 'message notifications coalesced');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'message-attachments') = 1, 'participant can read attachment');
select public.mark_conversation_read(pg_temp.id('conv_id'));
select pg_temp.check((select unread_count from public.get_my_conversations()) = 0, 'read state cleared');
select public.set_conversation_archived(pg_temp.id('conv_id'), true);
select pg_temp.check((select count(*) from public.get_my_conversations(true)) = 1, 'archived list');
reset role;

-- ---------------------------------------------------------------------------
-- Isolation: another brand sees nothing
-- ---------------------------------------------------------------------------
select set_config('t.victim_wishlist', (
  select w.id::text from public.wishlists w join public.brands b on b.id = w.brand_id
  where b.profile_id = pg_temp.id('brand_uid') and w.is_default), true);
select pg_temp.claims(pg_temp.id('other_uid'));
set local role authenticated;
insert into public.brands (profile_id, brand_name) values (auth.uid(), 'Other Co');
select pg_temp.check((select count(*) from public.orders) = 0, 'other brand: no orders');
select pg_temp.check((select count(*) from public.order_status_history) = 0, 'other brand: no history');
select pg_temp.check((select count(*) from public.messages) = 0, 'other brand: no messages');
select pg_temp.check((select count(*) from public.conversations) = 0, 'other brand: no conversations');
select pg_temp.check((select count(*) from public.payments) = 0, 'other brand: no payments');
select pg_temp.check((select count(*) from public.wishlist_items) = 0, 'other brand: no foreign wishlist items');
select pg_temp.check((select count(*) from public.profiles) = 1, 'other brand: only own profile');
select pg_temp.check((select count(*) from public.brands) = 1, 'other brand: only itself');
-- Every user now gets a welcome notification of their own, so assert the
-- isolation property directly rather than an empty table.
select pg_temp.check((select count(*) from public.notifications where user_id <> auth.uid()) = 0, 'other brand: no foreign notifications');
select pg_temp.check((select count(*) from public.notifications where type = 'welcome') = 1, 'other brand: got its own welcome');
select pg_temp.check((select count(*) from public.creator_earnings) = 0, 'other brand: no earnings');
select pg_temp.check((select count(*) from storage.objects) = 0, 'other brand: no private files');
select pg_temp.check((select count(*) from public.audit_logs) = 0, 'other brand: no audit access');
select pg_temp.check((select count(*) from public.get_my_conversations()) = 0, 'other brand: empty inbox');
select pg_temp.expect_error($$ select public.cancel_order(pg_temp.id('order_id')) $$, '%not found%');
select pg_temp.expect_error($$ select public.mark_order_shipped(pg_temp.id('order_id'), 'x', 'y') $$, '%not found%');
select pg_temp.expect_error($$ insert into public.messages (conversation_id, sender_id, body) values (pg_temp.id('conv_id'), auth.uid(), 'hi') $$, '%row-level security%');
select pg_temp.check((select count(*) from public.wishlists) = 1, 'other brand: only its own default wishlist');
select pg_temp.expect_error($$ insert into public.wishlist_items (wishlist_id, creator_id) values (pg_temp.id('victim_wishlist'), pg_temp.id('creator_id')) $$, '%row-level security%');
delete from public.wishlists where id = pg_temp.id('victim_wishlist');
update public.creators set bio = 'hacked' where id = pg_temp.id('creator_id');
reset role;
select pg_temp.check(exists (select 1 from public.wishlists where id = pg_temp.id('victim_wishlist')), 'foreign wishlist not deletable');
select pg_temp.check((select bio from public.creators where id = pg_temp.id('creator_id')) <> 'hacked', 'foreign creator not editable');

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
select pg_temp.claims(null, 'anon');
set local role anon;
select pg_temp.check(exists (select 1 from public.creators where id = pg_temp.id('creator_id')), 'anon sees published creator');
select pg_temp.check((select count(*) from public.creator_services where creator_id = pg_temp.id('creator_id')) = 1, 'anon sees active services');
select pg_temp.check((select count(*) from public.service_addons where service_id = pg_temp.id('service_id')) = 2, 'anon sees add-ons');
select pg_temp.check((select count(*) from public.reviews where creator_id = pg_temp.id('creator_id')) = 1, 'anon sees published review');
select pg_temp.check((select brand_name from public.get_creator_reviews(pg_temp.id('creator_id')) limit 1) = 'Glow Theory', 'public review feed has brand name');
select pg_temp.check((public.get_public_stats() ->> 'creators')::int >= 1, 'public stats');
select pg_temp.check((select count(*) from public.platform_settings) > 0, 'public settings readable');
select pg_temp.expect_error($$ select count(*) from public.profiles $$, '%permission denied%');
select pg_temp.expect_error($$ select count(*) from public.orders $$, '%permission denied%');
select pg_temp.expect_error($$ select count(*) from public.brands $$, '%permission denied%');
select pg_temp.expect_error($$ select public.create_order(pg_temp.id('service_id')) $$, '%permission denied%');
select pg_temp.expect_error($$ select public.get_my_conversations() $$, '%permission denied%');
insert into public.contact_messages (name, email, message) values ('Visitor', 'visitor@test.dev', 'Hello, I would like to know more.');
reset role;

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
select pg_temp.check((select count(*) from public.audit_logs where action = 'order_created' and entity_id = pg_temp.id('order_id')::text) = 1, 'audit: order_created');
select pg_temp.check((select count(*) from public.audit_logs where action = 'payment_created' and metadata ->> 'order_id' = pg_temp.id('order_id')::text) = 1, 'audit: payment_created');
select pg_temp.check((select count(*) from public.audit_logs where action = 'payment_completed' and metadata ->> 'order_id' = pg_temp.id('order_id')::text) = 1, 'audit: payment_completed');
select pg_temp.check((select count(*) from public.audit_logs where action = 'order_status_changed' and entity_id = pg_temp.id('order_id')::text) = 11, 'audit: status changes');
select pg_temp.check((select count(*) from public.audit_logs where action = 'deliverable_uploaded' and entity_id = pg_temp.id('order_id')::text) = 3, 'audit: deliverables');
select pg_temp.check((select count(*) from public.audit_logs where action = 'revision_requested' and entity_id = pg_temp.id('order_id')::text) = 2, 'audit: revisions');
select pg_temp.check((select count(*) from public.audit_logs where action = 'order_completed' and entity_id = pg_temp.id('order_id')::text) = 1, 'audit: order_completed');
select pg_temp.check((select count(*) from public.audit_logs where action = 'payout_requested' and entity_id = pg_temp.id('payout_id')::text) = 1, 'audit: payout_requested');
select pg_temp.check((select count(*) from public.audit_logs where action = 'payout_processed' and entity_id = pg_temp.id('payout_id')::text) = 1, 'audit: payout_processed');
select pg_temp.check((select count(*) from public.audit_logs where action = 'creator_approved' and entity_id = pg_temp.id('creator_id')::text) = 1, 'audit: creator_approved');
select pg_temp.check((select count(*) from public.audit_logs where action = 'message_sent' and entity_id = pg_temp.id('conv_id')::text) = 2, 'audit: message_sent');
select pg_temp.check((select count(*) from public.audit_logs where action = 'profile_created' and entity_id in (
  pg_temp.id('brand_uid')::text, pg_temp.id('creator_uid')::text, pg_temp.id('other_uid')::text, pg_temp.id('sneaky_uid')::text, pg_temp.id('admin_uid')::text)) = 5, 'audit: profile_created');

rollback;
