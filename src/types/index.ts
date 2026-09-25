import type { Database, Enums, Tables, TablesInsert, TablesUpdate, Json } from './database.types'

export type { Database, Enums, Tables, TablesInsert, TablesUpdate, Json }

type Fn<Name extends keyof Database['public']['Functions']> = Database['public']['Functions'][Name]

// ---- Enums -----------------------------------------------------------------
export type UserRole = Enums<'user_role'>
export type AccountStatus = Enums<'account_status'>
export type CreatorStatus = Enums<'creator_status'>
export type Gender = Enums<'gender_type'>
export type SocialPlatform = Enums<'social_platform'>
export type PortfolioItemType = Enums<'portfolio_item_type'>
export type AddonType = Enums<'addon_type'>
export type BriefStatus = Enums<'brief_status'>
export type OrderStatus = Enums<'order_status'>
export type ActorRole = Enums<'actor_role'>
export type PaymentStatus = Enums<'payment_status'>
export type EarningStatus = Enums<'earning_status'>
export type PayoutStatus = Enums<'payout_status'>
export type PayoutMethodType = Enums<'payout_method_type'>
export type RevisionStatus = Enums<'revision_status'>
export type DisputeStatus = Enums<'dispute_status'>
export type ReportTarget = Enums<'report_target'>
export type ReportStatus = Enums<'report_status'>
export type MessageType = Enums<'message_type'>

// ---- Rows ------------------------------------------------------------------
export type Profile = Tables<'profiles'>
export type Brand = Tables<'brands'>
export type Creator = Tables<'creators'>
export type Category = Tables<'categories'>
export type CreatorTypeRow = Tables<'creator_types'>
export type CreatorService = Tables<'creator_services'>
export type ServiceAddon = Tables<'service_addons'>
export type PortfolioItem = Tables<'portfolio_items'>
export type SocialAccount = Tables<'creator_social_accounts'>
export type CreatorLanguage = Tables<'creator_languages'>
export type Brief = Tables<'briefs'>
export type BriefAttachment = Tables<'brief_attachments'>
export type Order = Tables<'orders'>
export type OrderItem = Tables<'order_items'>
export type OrderStatusHistory = Tables<'order_status_history'>
export type OrderDeliverable = Tables<'order_deliverables'>
export type OrderRevision = Tables<'order_revisions'>
export type ShippingDetails = Tables<'shipping_details'>
export type Conversation = Tables<'conversations'>
export type ConversationParticipant = Tables<'conversation_participants'>
export type Message = Tables<'messages'>
export type Wishlist = Tables<'wishlists'>
export type WishlistItem = Tables<'wishlist_items'>
export type CreatorEarning = Tables<'creator_earnings'>
export type PayoutRequest = Tables<'payout_requests'>
export type PayoutTransaction = Tables<'payout_transactions'>
export type Review = Tables<'reviews'>
export type Notification = Tables<'notifications'>
export type Report = Tables<'reports'>
export type Dispute = Tables<'disputes'>
export type DisputeMessage = Tables<'dispute_messages'>
export type AuditLog = Tables<'audit_logs'>
export type PlatformSetting = Tables<'platform_settings'>
export type ContactMessage = Tables<'contact_messages'>
export type PaymentRefund = Tables<'payment_refunds'>

/** Client-visible payment columns (signature/raw payloads are not granted). */
export type Payment = Omit<Tables<'payments'>, 'signature' | 'raw_response'>
/** Client-visible payout method (full account number is write-only). */
export type PayoutMethod = Omit<Tables<'payout_methods'>, 'bank_account_number'>

// ---- RPC result rows ---------------------------------------------------------
export type CreatorCard = Fn<'search_creators'>['Returns'][number]
export type ConversationSummary = Fn<'get_my_conversations'>['Returns'][number]
export type PublicReview = Fn<'get_creator_reviews'>['Returns'][number]
export type AdminCreatorRow = Fn<'admin_list_creators'>['Returns'][number]
export type AdminBrandRow = Fn<'admin_list_brands'>['Returns'][number]
export type AdminTimeseriesRow = Fn<'admin_timeseries'>['Returns'][number]

export type CategoryRef = { id: string; name: string; slug: string; is_primary?: boolean }
export type PortfolioPreview = { id: string; type: PortfolioItemType; media_url: string; thumbnail_url: string | null; title: string | null }

/** File reference stored in jsonb attachment arrays (messages, revisions, disputes). */
export type Attachment = { path: string; name: string; mime?: string; size?: number }

// ---- JSON-returning RPCs -----------------------------------------------------
export type CompletionItem = { key: string; label: string; required: boolean; done: boolean }
export type CreatorCompletion = { percent: number; items: CompletionItem[]; can_publish: boolean; status: CreatorStatus }

export type OrderQuote = {
  service_id: string
  subtotal: number
  addons_total: number
  total: number
  currency: string
  platform_fee_percent: number
  platform_fee: number
  creator_earning: number
  delivery_days: number
  revisions: number
  requires_shipping: boolean
}

export type EarningsSummary = {
  total_earned: number
  gross_total: number
  fees_total: number
  pending: number
  held: number
  available: number
  in_payout: number
  paid: number
  refunded: number
  earning_count: number
  next_available_at: string | null
  minimum_payout: number
  platform_fee_percent: number
  has_payout_method: boolean
  open_payout_request: (Omit<PayoutRequest, 'payout_method_snapshot'>) | null
}

export type CreatorDashboardStats = {
  status: CreatorStatus
  profile_views_total: number
  profile_views_30d: number
  profile_views_prev_30d: number
  wishlist_adds: number
  conversations: number
  unread_messages: number
  orders_total: number
  orders_pending_acceptance: number
  orders_active: number
  pending_deliveries: number
  completed_orders: number
  conversion_rate: number
  revenue_total: number
  revenue_30d: number
  new_opportunities: number
  rating: number
  review_count: number
  views_by_day: { day: string; views: number }[]
}

export type BrandDashboardStats = {
  creator_searches_30d: number
  creator_profile_views_30d: number
  orders_total: number
  orders_active: number
  completed_orders: number
  spend_total: number
  spend_30d: number
  active_campaigns: number
  pending_actions: {
    payment_pending: number
    awaiting_shipment: number
    awaiting_review: number
    draft_briefs: number
    reviews_due: number
  }
  unread_messages: number
  wishlisted_creators: number
}

export type AdminDashboardStats = {
  gmv: number
  net_gmv: number
  gmv_30d: number
  platform_revenue: number
  orders_total: number
  orders_30d: number
  avg_order_value: number
  creators_total: number
  creators_published: number
  creators_pending_review: number
  brands_total: number
  active_collaborations: number
  completed_orders: number
  pending_payouts_count: number
  pending_payouts_amount: number
  refunds_count: number
  refunds_amount: number
  refunds_required: number
  disputes_open: number
  reports_open: number
  orders_by_status: Partial<Record<OrderStatus, number>>
}

export type PublicStats = {
  creators: number
  cities: number
  categories: number
  completed_orders: number
  avg_rating: number | null
  avg_starting_price: number | null
}

export type UnreadCounts = { notifications: number; messages: number }

export type ShippingAddressInput = {
  recipient_name: string
  phone: string
  address: string
  city: string
  state?: string
  postal_code: string
}

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number }
