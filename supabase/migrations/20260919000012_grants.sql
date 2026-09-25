-- =============================================================================
-- Spotlit · 0012 · explicit privileges
-- We do not rely on platform default grants. API roles get exactly the table,
-- column and function privileges listed here; RLS then filters rows.
-- =============================================================================

-- Clean slate for API roles --------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- New functions in `public` must be granted explicitly (secure by default).
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Public (anon + authenticated) read access
-- -----------------------------------------------------------------------------
grant select on
  public.categories,
  public.creator_types,
  public.order_status_transitions,
  public.platform_settings,
  public.creators,
  public.creator_categories,
  public.creator_social_accounts,
  public.creator_languages,
  public.creator_services,
  public.service_addons,
  public.portfolio_items,
  public.reviews
to anon, authenticated;

grant insert (name, email, company, topic, message) on public.contact_messages to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Authenticated access (RLS narrows every one of these)
-- -----------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, phone, email_notifications) on public.profiles to authenticated;

grant select on public.admin_users to authenticated;

grant insert, update, delete on public.categories, public.creator_types to authenticated;

grant select on public.brands to authenticated;
grant insert (profile_id, brand_name, brand_logo_url, brand_pronunciation, pronunciation_audio_url, website_url,
              instagram_url, description, industry, location, contact_email, contact_phone)
  on public.brands to authenticated;
grant update (brand_name, brand_logo_url, brand_pronunciation, pronunciation_audio_url, website_url,
              instagram_url, description, industry, location, contact_email, contact_phone)
  on public.brands to authenticated;

-- creators: status / verified / featured / counters / rating are NOT client-writable
grant insert (profile_id, display_name, slug, headline, bio, profile_image_url, cover_image_url, intro_video_url,
              gender, age, city, state, country, creator_type, engagement_rate, available, response_time, onboarding_step)
  on public.creators to authenticated;
grant update (display_name, slug, headline, bio, profile_image_url, cover_image_url, intro_video_url,
              gender, age, city, state, country, creator_type, engagement_rate, available, response_time, onboarding_step)
  on public.creators to authenticated;

grant insert, delete on public.creator_categories to authenticated;
grant update (is_primary) on public.creator_categories to authenticated;

grant insert (creator_id, platform, username, profile_url, followers_count) on public.creator_social_accounts to authenticated;
grant update (platform, username, profile_url, followers_count) on public.creator_social_accounts to authenticated;
grant delete on public.creator_social_accounts to authenticated;

grant insert (creator_id, language) on public.creator_languages to authenticated;
grant delete on public.creator_languages to authenticated;

grant insert (creator_id, title, description, price, delivery_days, revisions_included, includes, content_type,
              platform, requires_shipping, active, sort_order, archived_at)
  on public.creator_services to authenticated;
grant update (title, description, price, delivery_days, revisions_included, includes, content_type,
              platform, requires_shipping, active, sort_order, archived_at)
  on public.creator_services to authenticated;
grant delete on public.creator_services to authenticated;

grant insert (service_id, name, description, price, addon_type, extra_revisions, delivery_days_override, active, sort_order)
  on public.service_addons to authenticated;
grant update (name, description, price, addon_type, extra_revisions, delivery_days_override, active, sort_order)
  on public.service_addons to authenticated;
grant delete on public.service_addons to authenticated;

-- portfolio: is_hidden is admin-only
grant insert (creator_id, type, title, description, media_url, thumbnail_url, storage_path, category_id, platform,
              brand_name, width, height, duration_seconds, sort_order)
  on public.portfolio_items to authenticated;
grant update (title, description, media_url, thumbnail_url, storage_path, category_id, platform, brand_name,
              width, height, duration_seconds, sort_order)
  on public.portfolio_items to authenticated;
grant delete on public.portfolio_items to authenticated;

-- briefs: status / creator assignment only via send_brief / respond_to_brief
grant select on public.briefs to authenticated;
grant insert (brand_id, title, campaign_objective, product_name, product_description, product_url, category_id,
              content_type, deliverables, target_audience, tone, reference_links, talking_points, do_not_say,
              deadline, budget, usage_rights, platform)
  on public.briefs to authenticated;
grant update (title, campaign_objective, product_name, product_description, product_url, category_id,
              content_type, deliverables, target_audience, tone, reference_links, talking_points, do_not_say,
              deadline, budget, usage_rights, platform)
  on public.briefs to authenticated;
grant delete on public.briefs to authenticated;

grant select, delete on public.brief_attachments to authenticated;
grant insert (brief_id, storage_path, file_name, mime_type, size_bytes, uploaded_by) on public.brief_attachments to authenticated;

-- orders & children: read-only
grant select on
  public.orders,
  public.order_items,
  public.order_status_history,
  public.order_revisions,
  public.order_deliverables,
  public.shipping_details
to authenticated;

-- messaging
grant select on public.conversations, public.conversation_participants, public.messages to authenticated;
grant update (archived, muted) on public.conversation_participants to authenticated;
grant insert (id, conversation_id, sender_id, body, message_type, attachments) on public.messages to authenticated;
grant update (deleted_at) on public.messages to authenticated;

-- wishlists
grant select, delete on public.wishlists to authenticated;
grant insert (brand_id, name, description) on public.wishlists to authenticated;
grant update (name, description) on public.wishlists to authenticated;
grant select, delete on public.wishlist_items to authenticated;
grant insert (wishlist_id, creator_id, note) on public.wishlist_items to authenticated;
grant update (note) on public.wishlist_items to authenticated;

-- payments: signature + raw provider payloads are never exposed to clients
grant select (id, order_id, payer_id, amount, currency, provider, provider_order_id, provider_payment_id, status,
              method, error_code, error_description, refunded_amount, captured_at, created_at, updated_at)
  on public.payments to authenticated;
grant select (id, payment_id, order_id, amount, provider_refund_id, status, reason, created_at, updated_at)
  on public.payment_refunds to authenticated;
grant select on public.webhook_events to authenticated;

-- payouts: full bank account number is write-only (via save_payout_method)
grant select (id, creator_id, method_type, account_holder_name, upi_id, bank_account_last4, ifsc_code, bank_name,
              verified, created_at, updated_at)
  on public.payout_methods to authenticated;
grant select on public.payout_requests, public.creator_earnings, public.payout_transactions to authenticated;

grant select, delete on public.notifications to authenticated;
grant select on public.reports, public.disputes, public.dispute_messages to authenticated;
grant select on public.audit_logs, public.creator_profile_views, public.search_events to authenticated;
grant select on public.contact_messages to authenticated;

-- -----------------------------------------------------------------------------
-- Function EXECUTE grants
-- -----------------------------------------------------------------------------
-- Public (anon + authenticated)
grant execute on function
  public.search_creators,
  public.get_public_stats,
  public.get_creator_reviews,
  public.record_profile_view,
  public.calculate_platform_fee,
  public.calculate_creator_earnings,
  public.calculate_order_total
to anon, authenticated;

-- Signed-in users (each function validates role/ownership internally)
grant execute on function
  public.set_initial_role,
  public.complete_onboarding,
  public.get_creator_completion,
  public.publish_creator_profile,
  public.set_creator_categories,
  public.set_creator_languages,
  public.touch_last_seen,
  public.record_auth_event,
  public.record_search_event,
  public.get_creator_dashboard_stats,
  public.get_brand_dashboard_stats,
  public.send_brief,
  public.respond_to_brief,
  public.create_report,
  public.create_order,
  public.cancel_order,
  public.accept_order,
  public.decline_order,
  public.submit_shipping_address,
  public.mark_order_shipped,
  public.mark_product_received,
  public.start_order_work,
  public.submit_deliverables,
  public.request_revision,
  public.approve_order,
  public.open_dispute,
  public.add_dispute_message,
  public.submit_review,
  public.respond_to_review,
  public.start_conversation,
  public.get_my_conversations,
  public.mark_conversation_read,
  public.set_conversation_archived,
  public.mark_notification_read,
  public.mark_all_notifications_read,
  public.get_unread_counts,
  public.get_earnings_summary,
  public.save_payout_method,
  public.release_matured_earnings,
  -- admin functions verify private.is_admin() themselves
  public.admin_dashboard_stats,
  public.admin_timeseries,
  public.admin_list_creators,
  public.admin_set_creator_status,
  public.admin_set_creator_flags,
  public.admin_update_creator,
  public.admin_soft_delete_creator,
  public.admin_restore_creator,
  public.admin_list_brands,
  public.admin_update_brand,
  public.admin_set_user_status,
  public.admin_update_setting,
  public.admin_update_report,
  public.admin_moderate_review,
  public.admin_moderate_portfolio_item,
  public.admin_update_dispute,
  public.admin_update_contact_message,
  public.admin_broadcast_notification,
  public.admin_reveal_payout_method
to authenticated;

-- SERVICE ONLY (Edge Functions / cron). Explicitly re-revoked for clarity.
revoke execute on function
  public.register_payment_attempt,
  public.confirm_order_payment,
  public.mark_payment_failed,
  public.record_refund,
  public.create_payout_request,
  public.complete_payout,
  public.admin_transition_order,
  public.resolve_dispute,
  public.create_audit_log,
  public.expire_pending_payments,
  public.auto_cancel_unaccepted_orders,
  public.auto_approve_stale_deliveries
from public, anon, authenticated;
