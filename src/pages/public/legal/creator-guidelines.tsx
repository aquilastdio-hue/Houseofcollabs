import { Link } from 'react-router'
import { site } from '@/config/site'
import { feeText, responseWindowText } from '@/components/marketing/platform-terms'
import { Callout, SupportEmail, type LegalBuilder } from './shared'

export const creatorGuidelines: LegalBuilder = (t) => ({
  title: 'Creator Guidelines',
  kind: 'Guidelines',
  summary: `What ${site.name} expects from creators: honest storefronts, clear services, reliable delivery and properly disclosed advertising.`,
  intro: (
    <p>
      Brands choose creators on {site.name} because storefronts are honest and orders are delivered as promised. These guidelines explain how to keep
      it that way. They sit alongside our <Link to="/terms">terms of service</Link>; breaking them can lead to hidden services, suspension or removal.
    </p>
  ),
  sections: [
    {
      id: 'spirit',
      title: 'The spirit of these guidelines',
      body: (
        <>
          <p>Three ideas sit behind every rule on this page:</p>
          <ul>
            <li>
              <strong>Be who you say you are.</strong> Brands pay for your voice, your audience and your craft — so all three must be real.
            </li>
            <li>
              <strong>Deliver what you listed.</strong> Your storefront is a promise. Price, timeline and deliverables should match what actually
              happens.
            </li>
            <li>
              <strong>Respect the audience.</strong> Paid content must be clearly disclosed and must not mislead the people who trust you.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'eligibility',
      title: `Who can sell on ${site.name}`,
      body: (
        <ul>
          <li>Individual creators, creator duos and small studios who make content brands can use.</li>
          <li>You must be 18 or over, or sell through an account created and managed by your parent or lawful guardian.</li>
          <li>You need a UPI ID or bank account in India for payouts, held in your name or your guardian’s.</li>
          <li>One storefront per person or studio. Don’t create duplicate storefronts to appear more often in search.</li>
        </ul>
      ),
    },
    {
      id: 'honest-storefront',
      title: 'Building an honest storefront',
      body: (
        <>
          <ul>
            <li>Use a real, recent photo of yourself (or your studio’s logo) and your real city.</li>
            <li>List only languages you can confidently create in.</li>
            <li>Keep follower counts accurate and up to date. Never buy followers, likes or views, or list accounts you don’t own.</li>
            <li>
              Show only work you made. If a past project was covered by a confidentiality agreement or hasn’t been published yet, ask the brand before
              adding it to your portfolio.
            </li>
            <li>Don’t include phone numbers, email addresses or payment details in your bio, services or portfolio.</li>
          </ul>
          {t.requireApproval !== false && (
            <Callout title="Storefront review">
              <p>
                New storefronts are reviewed by our team before they appear in search. We may ask you to change details that don’t meet these
                guidelines.
              </p>
            </Callout>
          )}
        </>
      ),
    },
    {
      id: 'services-and-pricing',
      title: 'Services, pricing and add-ons',
      body: (
        <ul>
          <li>Describe exactly what the brand gets: number of videos or photos, length, format, aspect ratio and where it will be posted, if anywhere.</li>
          <li>Set a delivery time you can meet even in a busy week. Faster delivery can be offered as an add-on.</li>
          <li>State how many revision rounds are included, and honour them.</li>
          <li>Tick “needs your product” for any service that requires the brand to ship something to you.</li>
          <li>
            Price usage rights explicitly. If a brand may run your content as paid ads or for a longer period, offer a “Usage rights” add-on that says
            how long and where.
          </li>
          <li>No hidden conditions — anything that affects the price must be on the service or an add-on, not revealed after an order is placed.</li>
        </ul>
      ),
    },
    {
      id: 'handling-orders',
      title: 'Accepting and handling orders',
      body: (
        <ul>
          <li>
            Accept or decline each paid order within {responseWindowText(t)}. Orders left unanswered are cancelled automatically and the brand is
            refunded.
          </li>
          <li>Only accept orders you can deliver on time and within the brief. If something in the brief doesn’t work for you, decline politely with a reason.</li>
          <li>Keep all communication about an order in {site.name} messages, so there’s a clear record if anything goes wrong.</li>
          <li>For product-based services, add an accurate delivery address when you accept and confirm receipt as soon as the product arrives.</li>
          <li>Follow the brief’s instructions about the product — including whether it needs to be returned — as agreed before you accepted.</li>
        </ul>
      ),
    },
    {
      id: 'quality-and-delivery',
      title: 'Delivering great work',
      body: (
        <ul>
          <li>Deliver by the due date, in the format promised, through the order page.</li>
          <li>Make original content. Don’t reuse work made for another brand or copy someone else’s concept, script or edit.</li>
          <li>Use music, fonts, footage and effects you’re licensed to use for commercial purposes.</li>
          <li>Get consent from anyone who appears in your content, and never feature a child without their parent’s permission.</li>
          <li>Tell the brand if you used AI to generate or significantly alter any part of the content, and never create synthetic likenesses of real people without their consent.</li>
          <li>Treat revision requests within the brief as part of the job, and respond to feedback professionally.</li>
        </ul>
      ),
    },
    {
      id: 'ad-disclosure',
      title: 'Disclosing paid content',
      body: (
        <>
          <p>
            If you publish content from a {site.name} order on your own channels, it is advertising. The ASCI Guidelines for Influencer Advertising in
            Digital Media and the Central Consumer Protection Authority’s guidelines on endorsements require you to disclose it clearly:
          </p>
          <ul>
            <li>Use a clear label such as “Ad”, “Advertisement”, “Sponsored”, “Collaboration” or “Partnership”, and the platform’s paid-partnership tool where available.</li>
            <li>Place the label upfront where the audience will see it immediately — not hidden among hashtags or behind “more”.</li>
            <li>
              In videos, show the label on screen for long enough to be noticed (ASCI suggests at least three seconds for very short videos, and
              longer for longer ones) and mention it out loud where the audience may only be listening.
            </li>
            <li>In stories and multi-frame posts, show the label on every frame that features the brand.</li>
            <li>For live streams, disclose at the start and end, and whenever the brand is discussed.</li>
            <li>A gifted product counts as a material connection too — say so, even if you weren’t paid.</li>
          </ul>
          <p>
            Only review products you have actually used, and never make claims you can’t stand behind. Health, wellness and financial topics need
            particular care: share qualifications where the guidelines require them, and don’t give investment advice unless you are registered to do
            so.
          </p>
        </>
      ),
    },
    {
      id: 'not-allowed',
      title: 'Content and conduct that isn’t allowed',
      body: (
        <>
          <ul>
            <li>Hate speech, harassment, threats or content that demeans people for who they are.</li>
            <li>Sexually explicit material, or any content that sexualises minors.</li>
            <li>Dangerous stunts, self-harm, or instructions for illegal activity.</li>
            <li>Misleading claims, fake testimonials, fake reviews or manipulated “before and after” results.</li>
            <li>Content promoting products or services listed as prohibited in our <Link to="/brand-guidelines">brand guidelines</Link>.</li>
            <li>Asking brands for personal favours, gifts beyond the order, or payment outside {site.name}.</li>
          </ul>
          <p>If a brand asks you to make content that breaks these rules, decline the order and report it to us.</p>
        </>
      ),
    },
    {
      id: 'payments',
      title: 'Payments, fees and off-platform deals',
      body: (
        <>
          <p>
            Brands pay {site.name} when they order. When the order completes, {site.name} keeps a platform fee
            {t.feePercent != null ? ` of ${feeText(t)}` : ''} and the rest becomes your earning, which you can withdraw as described in the{' '}
            <Link to="/payout-policy">payout policy</Link>.
          </p>
          <p>
            Never ask a brand you met on {site.name} to pay you directly, and don’t accept such offers. Off-platform payments bypass the protections that
            keep both of you safe and can lead to suspension.
          </p>
        </>
      ),
    },
    {
      id: 'reviews',
      title: 'Reviews and reputation',
      body: (
        <ul>
          <li>Brands can review you after an order completes. Don’t offer discounts or extras in exchange for a positive review, or pressure a brand to change one.</li>
          <li>You can reply publicly to a review once. Keep it factual and professional — future brands will read it.</li>
          <li>If a review contains personal information or breaks our rules, report it and we’ll take a look.</li>
        </ul>
      ),
    },
    {
      id: 'enforcement',
      title: 'Enforcement and appeals',
      body: (
        <>
          <p>
            Depending on how serious a problem is, we may send a warning, hide a service or portfolio item, remove your storefront from search, or
            suspend your account. In cases of suspected fraud, related earnings may be held while we investigate.
          </p>
          <p>
            If you think we got something wrong, reply to our message or write to <SupportEmail /> with the details, and our team will review the
            decision again.
          </p>
        </>
      ),
    },
  ],
})
