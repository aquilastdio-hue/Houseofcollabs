-- =============================================================================
-- Spotlit · 0001 · extensions, schemas, enum types
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- `private` holds SECURITY DEFINER helpers and trigger functions. It is NOT part
-- of the Data API (PostgREST only exposes `public`), so nothing in here can be
-- invoked directly by clients.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Functions created in `private` are not executable by PUBLIC unless granted.
alter default privileges in schema private revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('brand', 'creator', 'admin');
create type public.account_status as enum ('active', 'suspended', 'deleted');
create type public.creator_status as enum ('draft', 'pending_review', 'published', 'rejected', 'suspended');
create type public.gender_type as enum ('female', 'male', 'non_binary', 'prefer_not_to_say');
create type public.social_platform as enum ('instagram', 'youtube', 'tiktok', 'facebook', 'other');
create type public.portfolio_item_type as enum ('image', 'video', 'link');
create type public.addon_type as enum (
  'extra_revision', 'express_delivery', 'raw_footage', 'extra_content', 'usage_rights', 'custom'
);
create type public.brief_status as enum ('draft', 'sent', 'accepted', 'rejected', 'completed');
create type public.order_status as enum (
  'draft', 'payment_pending', 'order_placed', 'creator_pending', 'accepted',
  'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
  'revision_requested', 'revision_submitted', 'approved', 'completed',
  'cancelled', 'disputed', 'refunded'
);
create type public.actor_role as enum ('brand', 'creator', 'admin', 'system');
create type public.payment_status as enum (
  'created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'
);
create type public.refund_status as enum ('pending', 'processed', 'failed');
create type public.earning_status as enum ('pending', 'available', 'paid', 'held', 'refunded');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed', 'rejected');
create type public.payout_txn_status as enum ('initiated', 'processing', 'success', 'failed', 'reversed');
create type public.payout_method_type as enum ('upi', 'bank_transfer');
create type public.revision_status as enum ('requested', 'submitted', 'resolved', 'cancelled');
create type public.dispute_status as enum (
  'created', 'under_review', 'waiting_for_brand', 'waiting_for_creator', 'resolved', 'refunded', 'rejected'
);
create type public.report_target as enum ('creator', 'brand', 'message', 'portfolio', 'review', 'order');
create type public.report_status as enum ('open', 'under_review', 'resolved', 'dismissed');
create type public.conversation_type as enum ('direct', 'order');
create type public.message_type as enum ('text', 'image', 'file', 'system');
