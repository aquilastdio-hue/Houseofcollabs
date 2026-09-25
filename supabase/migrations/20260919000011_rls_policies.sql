-- =============================================================================
-- Spotlit · 0011 · Row Level Security
-- RLS is enabled on every table in `public`. Writes that change workflow state
-- are not granted to clients at all (see 0012 grants) — they go through RPCs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extra helpers
-- -----------------------------------------------------------------------------
create or replace function private.try_uuid(p_text text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- A brand that works with a creator can still see that creator's storefront
-- data on their orders/chats even if the creator is later unpublished.
create or replace function private.brand_has_creator_relationship(p_creator_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.orders o join public.brands b on b.id = o.brand_id
    where o.creator_id = p_creator_id and b.profile_id = (select auth.uid())
  )
  or exists (
    select 1 from public.conversations cv join public.brands b on b.id = cv.brand_id
    where cv.creator_id = p_creator_id and b.profile_id = (select auth.uid())
  );
$$;

create or replace function private.can_upload_order_file(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_order_id is not null
    and private.can_view_order(p_order_id)
    and exists (
      select 1 from public.orders o
      where o.id = p_order_id
        and o.status in ('accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
                         'revision_requested', 'revision_submitted', 'disputed')
    );
$$;

grant execute on function
  private.try_uuid(text),
  private.brand_has_creator_relationship(uuid),
  private.can_upload_order_file(uuid)
to anon, authenticated, service_role;

-- Public review feed with reviewer display info (brands are not publicly readable).
create or replace function public.get_creator_reviews(p_creator_id uuid, p_limit int default 10, p_offset int default 0)
returns table (
  id uuid,
  rating int,
  comment text,
  response text,
  responded_at timestamptz,
  created_at timestamptz,
  service_title text,
  brand_name text,
  brand_logo_url text,
  total_count bigint
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.rating, r.comment, r.response, r.responded_at, r.created_at,
         o.service_title, b.brand_name, b.brand_logo_url,
         count(*) over ()
  from public.reviews r
  join public.orders o on o.id = r.order_id
  join public.brands b on b.id = r.brand_id
  where r.creator_id = p_creator_id
    and r.reviewer_role = 'brand'
    and r.status = 'published'
    and (private.is_creator_public(p_creator_id) or private.owns_creator(p_creator_id) or private.is_admin())
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Contact form abuse guard: max 5 messages per email per hour.
create or replace function private.contact_messages_rate_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.contact_messages c
      where lower(c.email) = lower(new.email) and c.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many messages. Please try again later.' using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;
  new.status := 'new';
  new.profile_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

create trigger contact_messages_rate_limit
  before insert on public.contact_messages
  for each row execute function private.contact_messages_rate_limit();

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Identity & configuration
-- -----------------------------------------------------------------------------
create policy "Users read own profile; admins read all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Admins read admin roster" on public.admin_users
  for select to authenticated
  using ((select private.is_admin()));

create policy "Public settings are readable" on public.platform_settings
  for select to anon, authenticated
  using (is_public or (select private.is_admin()));

create policy "Active categories are public" on public.categories
  for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy "Admins insert categories" on public.categories
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update categories" on public.categories
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete categories" on public.categories
  for delete to authenticated using ((select private.is_admin()));

create policy "Active creator types are public" on public.creator_types
  for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy "Admins insert creator types" on public.creator_types
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update creator types" on public.creator_types
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete creator types" on public.creator_types
  for delete to authenticated using ((select private.is_admin()));

create policy "State machine is public" on public.order_status_transitions
  for select to anon, authenticated using (true);

-- -----------------------------------------------------------------------------
-- Brands
-- -----------------------------------------------------------------------------
create policy "Brands visible to owner, admins and related creators" on public.brands
  for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_admin()) or private.can_view_brand(id));

create policy "Brand users create their brand" on public.brands
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and (select private.user_role()) = 'brand'
    and (select private.is_active_user())
  );

create policy "Brand owners update their brand" on public.brands
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and (select private.is_active_user()));

-- -----------------------------------------------------------------------------
-- Creators + storefront children
-- -----------------------------------------------------------------------------
create policy "Published creators are public" on public.creators
  for select to anon, authenticated
  using (
    (status = 'published' and deleted_at is null and private.is_creator_public(id))
    or profile_id = (select auth.uid())
    or (select private.is_admin())
    or private.brand_has_creator_relationship(id)
  );

create policy "Creator users create their storefront" on public.creators
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and (select private.user_role()) = 'creator'
    and (select private.is_active_user())
    and status = 'draft'
  );

create policy "Creators update their storefront" on public.creators
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and (select private.is_active_user()));

-- Helper macro-like policies for creator-owned child tables
create policy "Creator categories are readable" on public.creator_categories
  for select to anon, authenticated
  using (private.is_creator_public(creator_id) or private.owns_creator(creator_id)
         or (select private.is_admin()) or private.brand_has_creator_relationship(creator_id));
create policy "Creators manage their categories" on public.creator_categories
  for insert to authenticated with check (private.owns_creator(creator_id) and (select private.is_active_user()));
create policy "Creators update their categories" on public.creator_categories
  for update to authenticated using (private.owns_creator(creator_id)) with check (private.owns_creator(creator_id));
create policy "Creators remove their categories" on public.creator_categories
  for delete to authenticated using (private.owns_creator(creator_id));

create policy "Creator socials are readable" on public.creator_social_accounts
  for select to anon, authenticated
  using (private.is_creator_public(creator_id) or private.owns_creator(creator_id)
         or (select private.is_admin()) or private.brand_has_creator_relationship(creator_id));
create policy "Creators add socials" on public.creator_social_accounts
  for insert to authenticated with check (private.owns_creator(creator_id) and (select private.is_active_user()));
create policy "Creators update socials" on public.creator_social_accounts
  for update to authenticated using (private.owns_creator(creator_id)) with check (private.owns_creator(creator_id));
create policy "Creators remove socials" on public.creator_social_accounts
  for delete to authenticated using (private.owns_creator(creator_id));

create policy "Creator languages are readable" on public.creator_languages
  for select to anon, authenticated
  using (private.is_creator_public(creator_id) or private.owns_creator(creator_id)
         or (select private.is_admin()) or private.brand_has_creator_relationship(creator_id));
create policy "Creators add languages" on public.creator_languages
  for insert to authenticated with check (private.owns_creator(creator_id) and (select private.is_active_user()));
create policy "Creators remove languages" on public.creator_languages
  for delete to authenticated using (private.owns_creator(creator_id));

create policy "Active services of public creators are readable" on public.creator_services
  for select to anon, authenticated
  using (
    (active and archived_at is null and private.is_creator_public(creator_id))
    or private.owns_creator(creator_id)
    or (select private.is_admin())
    or private.brand_has_creator_relationship(creator_id)
  );
create policy "Creators add services" on public.creator_services
  for insert to authenticated with check (private.owns_creator(creator_id) and (select private.is_active_user()));
create policy "Creators update services" on public.creator_services
  for update to authenticated using (private.owns_creator(creator_id))
  with check (private.owns_creator(creator_id) and (select private.is_active_user()));
create policy "Creators delete services" on public.creator_services
  for delete to authenticated using (private.owns_creator(creator_id));

create policy "Add-ons of public services are readable" on public.service_addons
  for select to anon, authenticated
  using ((active and private.is_service_public(service_id)) or private.owns_service(service_id) or (select private.is_admin()));
create policy "Creators add add-ons" on public.service_addons
  for insert to authenticated with check (private.owns_service(service_id) and (select private.is_active_user()));
create policy "Creators update add-ons" on public.service_addons
  for update to authenticated using (private.owns_service(service_id)) with check (private.owns_service(service_id));
create policy "Creators delete add-ons" on public.service_addons
  for delete to authenticated using (private.owns_service(service_id));

create policy "Visible portfolio of public creators is readable" on public.portfolio_items
  for select to anon, authenticated
  using (
    (not is_hidden and private.is_creator_public(creator_id))
    or private.owns_creator(creator_id)
    or (select private.is_admin())
    or (not is_hidden and private.brand_has_creator_relationship(creator_id))
  );
create policy "Creators add portfolio items" on public.portfolio_items
  for insert to authenticated with check (private.owns_creator(creator_id) and (select private.is_active_user()));
create policy "Creators update portfolio items" on public.portfolio_items
  for update to authenticated using (private.owns_creator(creator_id)) with check (private.owns_creator(creator_id));
create policy "Creators delete portfolio items" on public.portfolio_items
  for delete to authenticated using (private.owns_creator(creator_id));

-- -----------------------------------------------------------------------------
-- Briefs
-- -----------------------------------------------------------------------------
create policy "Briefs visible to owning brand, assigned creator, admins" on public.briefs
  for select to authenticated
  using (private.can_view_brief(id) or (select private.is_admin()));
create policy "Brands create briefs" on public.briefs
  for insert to authenticated
  with check (brand_id = (select private.my_brand_id()) and status = 'draft' and creator_id is null and (select private.is_active_user()));
create policy "Brands edit their open briefs" on public.briefs
  for update to authenticated
  using (brand_id = (select private.my_brand_id()) and status <> 'completed')
  with check (brand_id = (select private.my_brand_id()));
create policy "Brands delete draft briefs" on public.briefs
  for delete to authenticated
  using (brand_id = (select private.my_brand_id()) and status = 'draft');

create policy "Brief attachments follow brief visibility" on public.brief_attachments
  for select to authenticated
  using (private.can_view_brief(brief_id) or (select private.is_admin()));
create policy "Brands attach files to their briefs" on public.brief_attachments
  for insert to authenticated
  with check (private.owns_brief(brief_id) and uploaded_by = (select auth.uid()));
create policy "Brands remove brief attachments" on public.brief_attachments
  for delete to authenticated using (private.owns_brief(brief_id));

-- -----------------------------------------------------------------------------
-- Orders (read-only for clients)
-- -----------------------------------------------------------------------------
create policy "Order participants and admins read orders" on public.orders
  for select to authenticated using (private.can_view_order(id) or (select private.is_admin()));
create policy "Order participants read items" on public.order_items
  for select to authenticated using (private.can_view_order(order_id) or (select private.is_admin()));
create policy "Order participants read history" on public.order_status_history
  for select to authenticated using (private.can_view_order(order_id) or (select private.is_admin()));
create policy "Order participants read revisions" on public.order_revisions
  for select to authenticated using (private.can_view_order(order_id) or (select private.is_admin()));
create policy "Order participants read deliverables" on public.order_deliverables
  for select to authenticated using (private.can_view_order(order_id) or (select private.is_admin()));
create policy "Order participants read shipping" on public.shipping_details
  for select to authenticated using (private.can_view_order(order_id) or (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Messaging
-- -----------------------------------------------------------------------------
create policy "Participants read conversations" on public.conversations
  for select to authenticated using (private.is_conversation_participant(id) or (select private.is_admin()));

create policy "Participants read participants" on public.conversation_participants
  for select to authenticated using (private.is_conversation_participant(conversation_id) or (select private.is_admin()));
create policy "Participants update own membership" on public.conversation_participants
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "Participants read messages" on public.messages
  for select to authenticated using (private.is_conversation_participant(conversation_id) or (select private.is_admin()));
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and message_type in ('text', 'image', 'file')
    and private.is_conversation_participant(conversation_id)
    and (select private.is_active_user())
  );
create policy "Senders delete their messages" on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Wishlists
-- -----------------------------------------------------------------------------
create policy "Brands read own wishlists" on public.wishlists
  for select to authenticated using (brand_id = (select private.my_brand_id()) or (select private.is_admin()));
create policy "Brands create wishlists" on public.wishlists
  for insert to authenticated with check (brand_id = (select private.my_brand_id()) and (select private.is_active_user()));
create policy "Brands rename wishlists" on public.wishlists
  for update to authenticated using (brand_id = (select private.my_brand_id())) with check (brand_id = (select private.my_brand_id()));
create policy "Brands delete non-default wishlists" on public.wishlists
  for delete to authenticated using (brand_id = (select private.my_brand_id()) and not is_default);

create policy "Brands read own wishlist items" on public.wishlist_items
  for select to authenticated
  using (
    exists (select 1 from public.wishlists w where w.id = wishlist_id and w.brand_id = (select private.my_brand_id()))
    or (select private.is_admin())
  );
create policy "Brands add wishlist items" on public.wishlist_items
  for insert to authenticated
  with check (
    exists (select 1 from public.wishlists w where w.id = wishlist_id and w.brand_id = (select private.my_brand_id()))
    and private.is_creator_public(creator_id)
  );
create policy "Brands update wishlist items" on public.wishlist_items
  for update to authenticated
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.brand_id = (select private.my_brand_id())))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.brand_id = (select private.my_brand_id())));
create policy "Brands remove wishlist items" on public.wishlist_items
  for delete to authenticated
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.brand_id = (select private.my_brand_id())));

-- -----------------------------------------------------------------------------
-- Money (read-only; sensitive columns excluded by column grants)
-- -----------------------------------------------------------------------------
create policy "Payers and admins read payments" on public.payments
  for select to authenticated
  using (
    payer_id = (select auth.uid())
    or exists (select 1 from public.orders o where o.id = order_id and o.brand_id = (select private.my_brand_id()))
    or (select private.is_admin())
  );
create policy "Brands and admins read refunds" on public.payment_refunds
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.brand_id = (select private.my_brand_id()))
    or (select private.is_admin())
  );
create policy "Admins read webhook events" on public.webhook_events
  for select to authenticated using ((select private.is_admin()));

create policy "Creators read own payout method" on public.payout_methods
  for select to authenticated using (private.owns_creator(creator_id) or (select private.is_admin()));
create policy "Creators read own payout requests" on public.payout_requests
  for select to authenticated using (private.owns_creator(creator_id) or (select private.is_admin()));
create policy "Creators read own earnings" on public.creator_earnings
  for select to authenticated using (private.owns_creator(creator_id) or (select private.is_admin()));
create policy "Creators read own payout transactions" on public.payout_transactions
  for select to authenticated
  using (
    exists (select 1 from public.payout_requests pr where pr.id = payout_request_id and private.owns_creator(pr.creator_id))
    or (select private.is_admin())
  );

-- -----------------------------------------------------------------------------
-- Reviews, notifications, trust & safety
-- -----------------------------------------------------------------------------
create policy "Published reviews are public" on public.reviews
  for select to anon, authenticated
  using (
    (status = 'published' and private.is_creator_public(creator_id))
    or reviewer_id = (select auth.uid())
    or private.owns_creator(creator_id)
    or brand_id = (select private.my_brand_id())
    or (select private.is_admin())
  );

create policy "Users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users delete own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Reporters and admins read reports" on public.reports
  for select to authenticated using (reported_by = (select auth.uid()) or (select private.is_admin()));

create policy "Order participants read disputes" on public.disputes
  for select to authenticated using (private.is_order_participant(order_id) or (select private.is_admin()));
create policy "Dispute participants read dispute messages" on public.dispute_messages
  for select to authenticated using (private.is_dispute_participant(dispute_id) or (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Audit + analytics + contact
-- -----------------------------------------------------------------------------
create policy "Admins read audit logs" on public.audit_logs
  for select to authenticated using ((select private.is_admin()));

create policy "Creators read their profile views" on public.creator_profile_views
  for select to authenticated using (private.owns_creator(creator_id) or (select private.is_admin()));

create policy "Users read own searches" on public.search_events
  for select to authenticated using (profile_id = (select auth.uid()) or (select private.is_admin()));

create policy "Anyone can send a contact message" on public.contact_messages
  for insert to anon, authenticated with check (status = 'new');
create policy "Admins read contact messages" on public.contact_messages
  for select to authenticated using ((select private.is_admin()));
