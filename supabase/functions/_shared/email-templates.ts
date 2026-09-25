// Per-notification-type email copy.
//
// The database owns the *event* (notifications.type, title, message, action_url);
// this file owns how that event reads as an email — subject line, preheader,
// call-to-action label and whether it is worth emailing at all.
//
// Anything not listed falls back to the notification's own title, so a new
// event type still emails sensibly without a code change here.

export type TemplateSpec = {
  /** Subject line. `{title}` is replaced with the notification title. */
  subject: string
  /** Short line shown in the inbox preview, after the subject. */
  preheader?: string
  /** Label for the button. Omitted when the notification has no action_url. */
  cta?: string
  /** In-app only — never emailed regardless of preferences. */
  inAppOnly?: boolean
}

export const TEMPLATES: Record<string, TemplateSpec> = {
  // ---- Account / onboarding ------------------------------------------------
  welcome: { subject: 'Welcome to House of Collabs', preheader: 'Let’s get your account set up.', cta: 'Get started' },
  onboarding_completed: { subject: 'Your account is ready', preheader: 'Everything is set up.', cta: 'Open my dashboard' },
  profile_submitted: { subject: 'Profile submitted for review', preheader: 'We’ll let you know as soon as it’s approved.', cta: 'View my profile' },
  profile_approved: { subject: 'Your profile is live', preheader: 'Brands can now find and book you.', cta: 'View my storefront' },
  profile_rejected: { subject: 'Your profile needs changes', preheader: 'A few things to fix before it goes live.', cta: 'Update my profile' },
  creator_verified: { subject: 'You’re verified', preheader: 'Your verified badge is now on your storefront.', cta: 'View my storefront' },
  verification_submitted: { subject: 'Verification submitted', preheader: 'We’re checking your details.', cta: 'View my profile' },
  verification_rejected: { subject: 'Verification wasn’t approved', preheader: 'Here’s what to fix before trying again.', cta: 'Try again' },
  verification_more_info: { subject: 'We need a bit more to verify you', preheader: 'One more thing and you’re done.', cta: 'Add the details' },
  account_suspended: { subject: 'Your account has been suspended', cta: 'Contact support' },
  account_reactivated: { subject: 'Your account is active again', cta: 'Open my dashboard' },
  profile_suspended: { subject: 'Your profile has been suspended', cta: 'Contact support' },

  // ---- Orders --------------------------------------------------------------
  order_new: { subject: 'New order: {title}', preheader: 'A brand just ordered from you.', cta: 'View order' },
  order_accepted: { subject: 'Order accepted', preheader: 'Work is about to begin.', cta: 'View order' },
  order_in_progress: { subject: 'Work has started', cta: 'View order' },
  content_delivered: { subject: 'Your order is ready for review', preheader: 'Take a look and approve or request changes.', cta: 'Review delivery' },
  revision_requested: { subject: 'Revision requested', preheader: 'The brand asked for some changes.', cta: 'View request' },
  revision_submitted: { subject: 'Revision submitted', preheader: 'The updated work is ready for review.', cta: 'Review delivery' },
  order_approved: { subject: 'Your work has been approved', preheader: 'Nice one — payment is on its way.', cta: 'View order' },
  order_completed: { subject: 'Order completed', cta: 'View order' },
  order_cancelled: { subject: 'Order cancelled', cta: 'View order' },
  order_expired: { subject: 'Order expired', preheader: 'It wasn’t accepted in time.', cta: 'View order' },
  shipment_required: { subject: 'A product needs shipping', cta: 'Add tracking' },
  shipment_update: { subject: 'Shipping update', cta: 'View order' },
  review_received: { subject: 'You received a review', cta: 'Read review' },

  // ---- Money ---------------------------------------------------------------
  payment_received: { subject: 'Payment received', preheader: 'Your order is confirmed.', cta: 'View order' },
  payment_failed: { subject: 'Payment failed', preheader: 'Your order is still waiting for payment.', cta: 'Retry payment' },
  refund_processed: { subject: 'Refund processed', cta: 'View order' },
  earnings_available: { subject: 'Your earnings are available', preheader: 'You can withdraw them now.', cta: 'View earnings' },
  payout_requested: { subject: 'Withdrawal requested', preheader: 'We’re processing it.', cta: 'Track payout' },
  payout_processed: { subject: 'Withdrawal sent', preheader: 'The money is on its way to your account.', cta: 'View payout' },
  payout_failed: { subject: 'Withdrawal failed', preheader: 'Please check your payout details.', cta: 'Update payout details' },

  // ---- Campaigns (briefs) --------------------------------------------------
  brief_received: { subject: 'New campaign brief: {title}', preheader: 'A brand wants to work with you.', cta: 'View brief' },

  // ---- Platform ------------------------------------------------------------
  announcement: { subject: '{title}', cta: 'Open House of Collabs' },
  dispute_opened: { subject: 'A dispute was opened', cta: 'View dispute' },

  // ---- In-app only: too chatty for email -----------------------------------
  message: { subject: '', inAppOnly: true },
  dispute_message: { subject: '', inAppOnly: true },
}

export function templateFor(type: string): TemplateSpec {
  return TEMPLATES[type] ?? { subject: '{title}', cta: 'Open House of Collabs' }
}
