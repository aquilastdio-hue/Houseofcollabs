-- =============================================================================
-- Physical-product shipping, briefs, disputes, refunds, cancellations, reports
-- and scheduled maintenance jobs.
-- =============================================================================
-- @include 00_helpers.sql.inc

begin;

select set_config('t.brand_uid', pg_temp.new_user('b2@test.dev', 'brand', 'Brand Two')::text, true);
select set_config('t.creator_uid', pg_temp.new_user('c2@test.dev', 'creator', 'Riya Reviews')::text, true);
select set_config('t.admin_uid', pg_temp.new_user('a2@test.dev', null, 'Ops Admin')::text, true);
select private.grant_admin('a2@test.dev');

-- Instant publishing (no approval) to exercise that setting path
update public.platform_settings set value = 'false' where key = 'require_creator_approval';

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
insert into public.creators (profile_id, display_name, bio, city, gender, age, creator_type, profile_image_url)
values (auth.uid(), 'Riya Reviews', 'Unboxings and honest reviews of gadgets and home products.', 'Pune', 'female', 29,
        'ugc_creator', '/demo/avatars/creator-02.svg');
select public.set_creator_categories(array[(select id from public.categories where slug = 'technology')]);
select public.set_creator_languages(array['English', 'Marathi']);
insert into public.creator_services (creator_id, title, price, delivery_days, revisions_included, content_type, requires_shipping)
values (private.my_creator_id(), 'Unboxing video', 3500, 7, 1, 'unboxing', true);
select public.publish_creator_profile();
select pg_temp.check((select status from public.creators where profile_id = auth.uid()) = 'published', 'published without review');
reset role;
select set_config('t.creator_id', (select id::text from public.creators where profile_id = pg_temp.id('creator_uid')), true);
select set_config('t.service_id', (select id::text from public.creator_services where creator_id = pg_temp.id('creator_id')), true);

-- ---------------------------------------------------------------------------
-- Briefs: draft → attachment → send → creator accepts
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
insert into public.brands (profile_id, brand_name) values (auth.uid(), 'Nimbus Audio');
insert into public.briefs (brand_id, title, campaign_objective, talking_points, do_not_say, budget)
values (private.my_brand_id(), 'Launch: Nimbus Buds', 'Drive awareness for the launch', array['40h battery', 'ANC'], array['cheap'], 4000);
select set_config('t.brief_id', (select id::text from public.briefs limit 1), true);
select pg_temp.expect_error($$ update public.briefs set status = 'accepted' $$, '%permission denied%');
insert into storage.objects (bucket_id, name, owner_id) values ('brief-attachments', pg_temp.id('brief_id') || '/moodboard.pdf', auth.uid()::text);
insert into public.brief_attachments (brief_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
values (pg_temp.id('brief_id'), pg_temp.id('brief_id') || '/moodboard.pdf', 'moodboard.pdf', 'application/pdf', 2048, auth.uid());
reset role;

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.check((select count(*) from public.briefs) = 0, 'creator cannot see draft brief');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'brief-attachments') = 0, 'creator cannot read draft brief files');
reset role;

select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select public.send_brief(pg_temp.id('brief_id'), pg_temp.id('creator_id'));
reset role;

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.check((select count(*) from public.briefs) = 1, 'creator sees sent brief');
select pg_temp.check((select count(*) from public.brief_attachments) = 1, 'creator sees brief attachment row');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'brief-attachments') = 1, 'creator can sign brief file');
select pg_temp.expect_error($$ insert into storage.objects (bucket_id, name) values ('brief-attachments', pg_temp.id('brief_id') || '/x.pdf') $$, '%row-level security%');
select public.respond_to_brief(pg_temp.id('brief_id'), true, 'Happy to do this!');
select pg_temp.expect_error($$ select public.respond_to_brief(pg_temp.id('brief_id'), false) $$, '%already been answered%');
select pg_temp.check((select count(*) from public.get_my_conversations()) = 1, 'brief opened a conversation');
reset role;

-- ---------------------------------------------------------------------------
-- Physical product order: address required, shipping, receipt
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select set_config('t.order_id', (public.create_order(pg_temp.id('service_id'), '{}', pg_temp.id('brief_id'), null)).id::text, true);
select pg_temp.check((select brief_snapshot ->> 'title' from public.orders where id = pg_temp.id('order_id')) = 'Launch: Nimbus Buds', 'brief snapshot stored');
reset role;

select pg_temp.claims(null, 'service_role');
set local role service_role;
select public.register_payment_attempt(pg_temp.id('order_id'), pg_temp.id('brand_uid'), 'order_SHIP1', 3500);
select public.mark_payment_failed('order_SHIP1', 'pay_FAIL1', 'BAD_REQUEST_ERROR', 'Card declined');
select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'payment_pending', 'failed attempt keeps order open');
select public.confirm_order_payment('order_SHIP1', 'pay_OK1', 'sig', 'card', 350000);
select public.mark_payment_failed('order_SHIP1', 'pay_LATE', 'X', 'late failure event');
reset role;
select pg_temp.check((select status from public.payments where provider_order_id = 'order_SHIP1') = 'captured', 'late failure cannot override capture');

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.expect_error($$ select public.accept_order(pg_temp.id('order_id')) $$, '%postal code%');
select public.accept_order(pg_temp.id('order_id'), '{"recipient_name":"Riya","phone":"+91 98765 43210","address":"12 MG Road","city":"Pune","state":"Maharashtra","postal_code":"411001"}');
select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'awaiting_shipment', 'awaiting shipment');
select pg_temp.expect_error($$ select public.start_order_work(pg_temp.id('order_id')) $$, '%cannot be started%');
select pg_temp.expect_error($$ select public.submit_deliverables(pg_temp.id('order_id'), '[{"external_url":"https://x.dev/a"}]') $$, '%cannot be submitted%');
reset role;
select pg_temp.check((select status from public.briefs where id = pg_temp.id('brief_id')) = 'accepted', 'brief accepted');

select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select pg_temp.check((select city from public.shipping_details where order_id = pg_temp.id('order_id')) = 'Pune', 'brand sees shipping address');
select pg_temp.expect_error($$ select public.mark_order_shipped(pg_temp.id('order_id'), '', '') $$, '%courier%');
select public.mark_order_shipped(pg_temp.id('order_id'), 'Blue Dart', 'BD123456789', 'https://track.example.com/BD123456789');
reset role;

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select public.mark_product_received(pg_temp.id('order_id'));
select public.start_order_work(pg_temp.id('order_id'));
select public.submit_deliverables(pg_temp.id('order_id'), '[{"external_url":"https://drive.example.com/unboxing"}]');
reset role;
select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'delivered', 'physical order delivered');
select pg_temp.check((select received_at is not null and shipped_at is not null from public.shipping_details where order_id = pg_temp.id('order_id')), 'shipping timestamps');

-- ---------------------------------------------------------------------------
-- Dispute → admin refund
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select pg_temp.expect_error($$ select public.open_dispute(pg_temp.id('order_id'), 'Wrong', 'short') $$, '%20 characters%');
select set_config('t.dispute_id', (public.open_dispute(pg_temp.id('order_id'), 'Content not as described',
  'The video does not mention ANC at all, which was a mandatory talking point.')).id::text, true);
select pg_temp.expect_error($$ select public.approve_order(pg_temp.id('order_id')) $$, '%no delivery waiting%');
reset role;
select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'disputed', 'order disputed');

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select public.add_dispute_message(pg_temp.id('dispute_id'), 'ANC is covered at 0:42 — sharing the timestamp.');
select pg_temp.check((select count(*) from public.dispute_messages) = 1, 'creator sees dispute thread');
reset role;

select pg_temp.claims(pg_temp.id('admin_uid'));
set local role authenticated;
select public.admin_update_dispute(pg_temp.id('dispute_id'), 'under_review', 'Reviewing both sides now.');
select pg_temp.expect_error($$ select public.admin_update_dispute(pg_temp.id('dispute_id'), 'resolved', null) $$, '%resolution actions%');
select pg_temp.check((select count(*) from public.dispute_messages where dispute_id = pg_temp.id('dispute_id')) = 2, 'admin note posted');
reset role;

-- admin-order-action refund path: Razorpay refund → record_refund → resolve_dispute
select pg_temp.claims(null, 'service_role');
set local role service_role;
select public.record_refund((select id from public.payments where provider_order_id = 'order_SHIP1'),
  'rfnd_TEST1', 3500, 'processed', 'Dispute upheld', pg_temp.id('admin_uid'), null);
select public.record_refund((select id from public.payments where provider_order_id = 'order_SHIP1'),
  'rfnd_TEST1', 3500, 'processed', 'Webhook replay', null, null);
select public.resolve_dispute(pg_temp.id('dispute_id'), pg_temp.id('admin_uid'), 'refund_brand', 'Refunded: mandatory talking point missing.', 3500);
reset role;
select pg_temp.check((select status from public.orders where id = pg_temp.id('order_id')) = 'refunded', 'order refunded');
select pg_temp.check((select status from public.payments where provider_order_id = 'order_SHIP1') = 'refunded', 'payment refunded');
select pg_temp.check((select refunded_amount from public.payments where provider_order_id = 'order_SHIP1') = 3500, 'refund applied once');
select pg_temp.check((select status from public.disputes where id = pg_temp.id('dispute_id')) = 'refunded', 'dispute closed as refunded');
select pg_temp.check(not exists (select 1 from public.creator_earnings where order_id = pg_temp.id('order_id')), 'no earning for refunded order');

-- ---------------------------------------------------------------------------
-- Cancellation before acceptance → refund queue; creator decline
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select set_config('t.order2', (public.create_order(pg_temp.id('service_id'))).id::text, true);
select set_config('t.order3', (public.create_order(pg_temp.id('service_id'))).id::text, true);
select set_config('t.order4', (public.create_order(pg_temp.id('service_id'))).id::text, true);
reset role;
select pg_temp.claims(null, 'service_role');
set local role service_role;
select public.register_payment_attempt(pg_temp.id('order2'), pg_temp.id('brand_uid'), 'order_C2', 3500);
select public.confirm_order_payment('order_C2', 'pay_C2');
select public.register_payment_attempt(pg_temp.id('order3'), pg_temp.id('brand_uid'), 'order_C3', 3500);
select public.confirm_order_payment('order_C3', 'pay_C3');
reset role;

select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select public.cancel_order(pg_temp.id('order2'), 'Changed campaign plans');
select public.cancel_order(pg_temp.id('order4'), null);
reset role;
select pg_temp.check((select status::text || ':' || refund_required::text from public.orders where id = pg_temp.id('order2')) = 'cancelled:true', 'paid cancel needs refund');
select pg_temp.check((select status::text || ':' || refund_required::text from public.orders where id = pg_temp.id('order4')) = 'cancelled:false', 'unpaid cancel needs no refund');
select pg_temp.check(exists (select 1 from public.notifications n join public.admin_users a on a.profile_id = n.user_id where n.type = 'refund_required'), 'admins alerted to refund');

select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.expect_error($$ select public.decline_order(pg_temp.id('order3'), '  ') $$, '%why you are declining%');
select public.decline_order(pg_temp.id('order3'), 'Fully booked this month');
reset role;
select pg_temp.check((select status from public.orders where id = pg_temp.id('order3')) = 'cancelled', 'declined → cancelled');
select pg_temp.check(exists (select 1 from public.notifications where user_id = pg_temp.id('brand_uid') and title = 'Order declined'), 'brand told about decline');

select pg_temp.claims(null, 'service_role');
set local role service_role;
select public.record_refund((select id from public.payments where provider_order_id = 'order_C2'), 'rfnd_C2', 3500, 'pending', 'Cancelled', pg_temp.id('admin_uid'));
select pg_temp.check((select status from public.orders where id = pg_temp.id('order2')) = 'cancelled', 'pending refund leaves order cancelled');
select public.record_refund((select id from public.payments where provider_order_id = 'order_C2'), 'rfnd_C2', 3500, 'processed', null, null);
reset role;
select pg_temp.check((select status::text || ':' || refund_required::text from public.orders where id = pg_temp.id('order2')) = 'refunded:false', 'webhook completes refund');

-- ---------------------------------------------------------------------------
-- Admin forced transitions + invalid transitions
-- ---------------------------------------------------------------------------
select pg_temp.claims(null, 'service_role');
set local role service_role;
select pg_temp.expect_error($$ select public.admin_transition_order(pg_temp.id('order3'), 'completed', pg_temp.id('admin_uid'), 'nope') $$, '%cannot move%');
select pg_temp.expect_error($$ select public.admin_transition_order(pg_temp.id('order3'), 'refunded', pg_temp.id('admin_uid'), '') $$, '%reason%');
reset role;
select pg_temp.expect_error($$ update public.orders set status = 'completed' where id = pg_temp.id('order3') $$, '%cannot move%');

-- ---------------------------------------------------------------------------
-- Scheduled jobs
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select set_config('t.order5', (public.create_order(pg_temp.id('service_id'))).id::text, true);
reset role;
update public.orders set created_at = now() - interval '2 days' where id = pg_temp.id('order5');
select pg_temp.check(public.expire_pending_payments() >= 1, 'stale checkout expired');
select pg_temp.check((select status from public.orders where id = pg_temp.id('order5')) = 'cancelled', 'expired → cancelled');
select pg_temp.check(exists (select 1 from public.notifications where user_id = pg_temp.id('brand_uid') and type = 'order_expired'), 'brand told checkout expired');

-- ---------------------------------------------------------------------------
-- Reports + admin moderation + settings validation
-- ---------------------------------------------------------------------------
select pg_temp.claims(pg_temp.id('brand_uid'));
set local role authenticated;
select set_config('t.report_id', (public.create_report('creator', pg_temp.id('creator_id'), 'Spam', 'Test report')).id::text, true);
select pg_temp.expect_error($$ select public.create_report('order', gen_random_uuid(), 'Fake order') $$, '%could not be found%');
select pg_temp.check((select count(*) from public.reports) = 1, 'reporter sees own report');
reset role;

select pg_temp.claims(pg_temp.id('admin_uid'));
set local role authenticated;
select public.admin_update_report(pg_temp.id('report_id'), 'dismissed', 'Not spam');
select pg_temp.expect_error($$ select public.admin_update_setting('platform_fee_percentage', '90') $$, '%out of range%');
select pg_temp.expect_error($$ select public.admin_update_setting('unknown_key', '1') $$, '%unknown setting%');
select public.admin_update_setting('platform_fee_percentage', '12.5');
select pg_temp.check(public.calculate_platform_fee(1000) = 125, 'fee follows settings');
select pg_temp.check((select count(*) from public.admin_timeseries(7)) = 7, 'timeseries rows');
select pg_temp.check(exists (select 1 from public.admin_list_brands(p_search => 'Nimbus Audio', p_limit => 100) where profile_id = pg_temp.id('brand_uid')), 'brand list');
select public.admin_set_user_status((select profile_id from public.creators where id = pg_temp.id('creator_id')), 'suspended', 'Test suspension');
select pg_temp.check(public.admin_broadcast_notification('brands', 'Diwali boost', 'Creators are filling up fast') >= 1, 'broadcast');
select pg_temp.check((select count(*) from public.audit_logs where action = 'user_suspended' and entity_id = pg_temp.id('creator_uid')::text) = 1, 'admin action audited');
reset role;

-- suspended creator disappears from search and cannot act
select pg_temp.claims(null, 'anon');
set local role anon;
select pg_temp.check(not exists (select 1 from public.search_creators(p_limit => 60) where id = pg_temp.id('creator_id')), 'suspended account hidden from search');
reset role;
select pg_temp.claims(pg_temp.id('creator_uid'));
set local role authenticated;
select pg_temp.expect_error($$ insert into public.creator_services (creator_id, title, price, delivery_days) values (private.my_creator_id(), 'New thing', 500, 3) $$, '%row-level security%');
reset role;

select pg_temp.check((select count(*) from public.audit_logs where action = 'refund_processed' and metadata ->> 'order_id' in (pg_temp.id('order_id')::text, pg_temp.id('order2')::text)) = 2, 'refunds audited');
select pg_temp.check((select count(*) from public.audit_logs where action = 'dispute_resolved' and entity_id = pg_temp.id('dispute_id')::text) = 1, 'dispute resolution audited');

rollback;
