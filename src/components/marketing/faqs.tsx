import { site } from '@/config/site'
import type { FaqItem } from '@/components/shared/faq'
import {
  autoApproveText,
  feeText,
  holdText,
  minPayoutText,
  responseWindowText,
  type PlatformTerms,
} from './platform-terms'
import { TextLink } from './primitives'

function creatorFeeSentence(t: PlatformTerms) {
  return t.feePercent != null
    ? `Creators pay a ${feeText(t)} platform fee on each completed order, deducted before the earning reaches their balance.`
    : 'Creators pay a small platform fee on each completed order, deducted before the earning reaches their balance.'
}

function payoutSentence(t: PlatformTerms) {
  return t.minPayout != null
    ? `Once their available balance reaches ${minPayoutText(t)}, they can request a payout to their UPI ID or bank account.`
    : 'Once their available balance reaches the minimum payout amount, they can request a payout to their UPI ID or bank account.'
}

export function homeFaqs(t: PlatformTerms): FaqItem[] {
  return [
    {
      q: `How much does ${site.name} cost?`,
      a: (
        <>
          Browsing and creating an account are free. Brands pay the price listed on a creator’s service plus any add-ons they choose — no platform
          fee is added at checkout. {creatorFeeSentence(t)}
        </>
      ),
    },
    {
      q: 'Who sets the prices?',
      a: 'Creators do. Each service has a fixed price, a delivery time, a set number of revisions and optional add-ons, all visible on the storefront before you order. There’s no negotiation step and no surprise quote.',
    },
    {
      q: 'How do payments and refunds work?',
      a: (
        <>
          Brands pay at checkout through Razorpay, using methods such as UPI, cards and net banking. The payment is held until the brand approves
          the delivery. If a creator declines an order or doesn’t accept it in time, the brand is refunded in full. The details are in our{' '}
          <TextLink to="/refund-policy">refund policy</TextLink>.
        </>
      ),
    },
    {
      q: 'What if the content needs changes?',
      a: 'Every service includes a set number of revisions. Brands request changes from the order page with clear notes, and the creator delivers an updated version. Creators can also offer extra revisions as a paid add-on.',
    },
    {
      q: 'Do brands need to ship their product to the creator?',
      a: 'Only for services marked as needing your product. When the creator accepts, they add a delivery address inside the order; you ship it with tracking and they confirm when it arrives. The delivery time starts counting from that point.',
    },
    {
      q: 'When do creators get paid?',
      a: (
        <>
          When the brand approves a delivery — or it’s auto-approved after {autoApproveText(t)} without a response — the order completes and the
          creator’s earning is recorded. It becomes available {holdText(t)}. {payoutSentence(t)}
        </>
      ),
    },
    {
      q: 'How are creators vetted?',
      a:
        t.requireApproval === false
          ? 'Every storefront needs a complete profile and at least one service before it can be published. Verified creators carry a badge, and brands review creators after each completed order.'
          : 'Our team reviews new storefronts before they appear in search. Verified creators carry a badge, and brands can review creators after each completed order — so reputations are built on real work.',
    },
    {
      q: 'Who owns the content, and can it be used in ads?',
      a: (
        <>
          Once an order is completed, the brand can use the delivered content on its own organic channels. Paid advertising, whitelisting or longer
          usage needs the creator’s permission — which is exactly what the “Usage rights” add-on is for. Our{' '}
          <TextLink to="/terms">terms of service</TextLink> explain the default licence in full.
        </>
      ),
    },
    {
      q: 'Can brands check fit with a creator before ordering?',
      a: `Yes. With a free brand account you can send a creator a brief describing the work, and they can accept or decline it. ${site.name} has no private messaging — every collaboration runs through briefs and orders, so the scope and the price are always on the record.`,
    },
  ]
}

export function brandFaqs(t: PlatformTerms): FaqItem[] {
  return [
    {
      q: 'Do I need an account to browse creators?',
      a: 'No. Anyone can search, filter and view storefronts. You’ll need a free brand account to send briefs, save shortlists and place orders.',
    },
    {
      q: `What can I order on ${site.name}?`,
      a: 'UGC videos for ads and product pages, Instagram reels and stories, YouTube videos and Shorts, product reviews, unboxings, tutorials and product photography — each sold by the creator as a fixed-price service.',
    },
    {
      q: 'What exactly is included in the price?',
      a: `Whatever the service lists: the deliverables, the delivery time and the number of revisions. Add-ons such as raw footage, faster delivery, extra content or ad usage rights are priced separately and shown before you pay. ${site.name} doesn’t add a fee on top at checkout.`,
    },
    {
      q: 'What if the creator doesn’t accept my order?',
      a: `Creators have ${responseWindowText(t)} to accept a paid order. If they decline, or the window passes without a response, the order is cancelled and you’re refunded in full to your original payment method.`,
    },
    {
      q: 'Can I cancel an order?',
      a: (
        <>
          Yes, for a full refund, up until the creator accepts it. After acceptance the creator has started planning your content, so cancellations
          go through our support team. See the <TextLink to="/refund-policy">refund policy</TextLink> for every scenario.
        </>
      ),
    },
    {
      q: 'What if the content isn’t what I asked for?',
      a: 'Start with a revision — most issues are solved there. If something is seriously wrong, like a missed deadline or content that ignores the brief, contact our support team. We review both sides and can release the payment, refund part of it or refund it in full.',
    },
    {
      q: 'Can we run the content as paid ads?',
      a: 'By default you can publish delivered content on your own organic channels. For paid ads, boosting, whitelisting or extended usage, choose the creator’s “Usage rights” add-on or agree the terms with them in writing before you order.',
    },
    {
      q: 'Do you work with agencies?',
      a: 'Yes. Agencies can create a brand account and order on behalf of their clients, as long as they’re authorised to share the client’s products, briefs and brand assets with creators.',
    },
  ]
}

export function creatorFaqs(t: PlatformTerms): FaqItem[] {
  return [
    {
      q: `Who can join ${site.name} as a creator?`,
      a: 'Anyone in India who makes content brands can use — UGC creators, micro-influencers, established influencers, photographers and small studios. You need to be 18 or older (or have a parent or guardian manage your account) and be able to receive payouts in India.',
    },
    {
      q: 'Do I need a big following?',
      a: 'No. UGC is made for brands to publish on their own channels and ads, so the quality of your content matters more than your audience size. If you do have an audience, your social accounts and follower counts appear on your storefront.',
    },
    {
      q: 'How does my storefront go live?',
      a:
        t.requireApproval === false
          ? 'Fill in the essentials — profile photo, bio, city, categories, languages and at least one service — and publish. Your storefront appears in search as soon as it’s live. Adding a few portfolio pieces helps brands say yes faster.'
          : 'Fill in the essentials — profile photo, bio, city, categories, languages and at least one service — then submit your storefront. Our team reviews it before it appears in search and tells you if anything needs fixing.',
    },
    {
      q: `How much does ${site.name} charge creators?`,
      a:
        t.feePercent != null
          ? `Joining is free. When an order completes, ${site.name} keeps a ${feeText(t)} platform fee and the rest becomes your earning. There are no listing fees or monthly plans.`
          : `Joining is free. When an order completes, ${site.name} keeps a small platform fee and the rest becomes your earning. There are no listing fees or monthly plans.`,
    },
    {
      q: 'When can I withdraw my earnings?',
      a: `Your earning is recorded when the brand approves the delivery and becomes available ${holdText(t)}. You can request a payout once your available balance reaches ${minPayoutText(t, 'the minimum payout amount')}.`,
    },
    {
      q: 'How do payouts work?',
      a: (
        <>
          Add a UPI ID or a bank account on your Payouts page, then request a payout for your full available balance. Our team processes it and you’ll
          see the transfer reference once it’s sent. The <TextLink to="/payout-policy">payout policy</TextLink> covers timelines and taxes.
        </>
      ),
    },
    {
      q: 'Can a brand ask for unlimited changes?',
      a: `No. Each service includes a fixed number of revisions, and brands can only request changes within that number plus any extra revisions they’ve bought. If a brand doesn’t review your delivery, the order is auto-approved after ${autoApproveText(t)}.`,
    },
    {
      q: 'What about services that need the brand’s product?',
      a: 'Mark the service as needing a product. When you accept an order, you share a delivery address inside the order, the brand ships with tracking, and you confirm when it arrives. Your delivery time starts from that moment, not before.',
    },
  ]
}
