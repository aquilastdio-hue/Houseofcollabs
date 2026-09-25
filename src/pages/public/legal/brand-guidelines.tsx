import { Link } from 'react-router'
import { site } from '@/config/site'
import { autoApproveText } from '@/components/marketing/platform-terms'
import { Callout, SupportEmail, type LegalBuilder } from './shared'

export const brandGuidelines: LegalBuilder = (t) => ({
  title: 'Brand Guidelines',
  kind: 'Guidelines',
  summary: `How brands brief creators, ship products, review work and advertise responsibly on ${site.name} — including ASCI disclosure norms and prohibited products.`,
  intro: (
    <p>
      Creators do their best work for brands that brief clearly, pay fairly and advertise honestly. These guidelines explain what we expect from
      every brand on {site.name}. They form part of our <Link to="/terms">terms of service</Link>.
    </p>
  ),
  sections: [
    {
      id: 'spirit',
      title: 'Working with creators',
      body: (
        <>
          <p>
            Creators on {site.name} are independent professionals running their own businesses. Treat them the way you would treat any supplier you
            respect: be clear about what you need, stick to what you ordered, and give feedback that helps rather than hurts.
          </p>
          <p>Everything below builds on that idea.</p>
        </>
      ),
    },
    {
      id: 'your-account',
      title: 'Your brand account',
      body: (
        <ul>
          <li>Use your real brand name, logo and website, and keep your contact details current.</li>
          <li>Only order for brands you’re authorised to represent. Agencies must have their client’s permission to share products, briefs and assets.</li>
          <li>Keep your login to people in your team who need it — you’re responsible for orders placed from your account.</li>
        </ul>
      ),
    },
    {
      id: 'briefs',
      title: 'Writing a good brief',
      body: (
        <>
          <p>A good brief is the single biggest predictor of a good result. Include:</p>
          <ul>
            <li>the goal of the content and where you plan to use it;</li>
            <li>the product, the key message and any claims the creator may make (with the evidence behind them);</li>
            <li>must-haves and must-avoids — shots, words, competitors, tone;</li>
            <li>references you like, and the format or aspect ratio you need; and</li>
            <li>anything about the product the creator should know, including whether it must be returned.</li>
          </ul>
          <p>
            Your brief must fit the service you ordered. Extra videos, longer edits or new concepts are a new order or an add-on — not a revision.
          </p>
        </>
      ),
    },
    {
      id: 'shipping-products',
      title: 'Shipping products',
      body: (
        <ul>
          <li>For services marked “needs your product”, ship promptly after the creator accepts and add the courier name and tracking number to the order.</li>
          <li>Send products that are genuine, safe, legal to sell in India and within their expiry date, with any usage or safety instructions.</li>
          <li>If you need the product back, say so in the brief before ordering and arrange the return shipment yourself.</li>
          <li>
            The creator’s address is shared only so you can deliver the product for that order. Don’t store it for other purposes, add it to mailing
            lists or share it with anyone else.
          </li>
        </ul>
      ),
    },
    {
      id: 'reviewing-work',
      title: 'Reviewing deliveries and revisions',
      body: (
        <>
          <ul>
            <li>Review each delivery promptly. If you don’t approve or request changes within {autoApproveText(t)}, the order is approved automatically.</li>
            <li>Revision requests should be specific and stay within the original brief and the number of rounds included.</li>
            <li>Approve when the work matches what you ordered — approval completes the order and releases the creator’s payment.</li>
            <li>If something has gone seriously wrong, open a dispute from the order instead of withholding approval indefinitely.</li>
          </ul>
          <p>After the order completes, leave an honest review. It helps other brands and rewards creators who deliver.</p>
        </>
      ),
    },
    {
      id: 'content-rules',
      title: 'Content rules and claims',
      body: (
        <>
          <ul>
            <li>
              Every claim you ask a creator to make must be truthful and backed by evidence you can produce on request — especially claims about health,
              results, ingredients, pricing or comparisons with competitors.
            </li>
            <li>Don’t ask creators to present results they haven’t experienced, to edit “before and after” images, or to use fake testimonials.</li>
            <li>Don’t ask for content that disparages competitors, uses others’ trademarks without permission, or copies another creator’s work.</li>
            <li>Content must follow the ASCI Code, including its guidelines on harmful gender stereotypes and on advertising to children.</li>
            <li>Creators may decline to make claims they cannot verify — that is their right, not a breach of the order.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'asci-disclosure',
      title: 'ASCI and CCPA disclosure norms',
      body: (
        <>
          <p>
            Content bought on {site.name} is advertising, wherever it appears. Brands share responsibility with creators for following the ASCI
            Guidelines for Influencer Advertising in Digital Media and the Central Consumer Protection Authority’s Guidelines for Prevention of
            Misleading Advertisements and Endorsements for Misleading Advertisements, 2022.
          </p>
          <ul>
            <li>
              Never ask a creator to hide or soften the fact that content is paid or gifted. Posts on a creator’s channels must carry a clear label such
              as “Ad”, “Sponsored”, “Collaboration” or “Partnership”, placed upfront.
            </li>
            <li>Allow the disclosure to appear on screen in videos, on every relevant story frame, and verbally where the audience may only be listening.</li>
            <li>
              When you run creator content in your own paid media, it must still be recognisable as advertising and must not suggest an independent,
              unpaid opinion.
            </li>
            <li>For health, wellness and financial products, make sure creators have the qualifications or registrations the guidelines require.</li>
          </ul>
          <Callout title="Why this matters">
            <p>
              Undisclosed endorsements can attract action from regulators against both the brand and the creator. Clear labels protect your brand’s
              credibility as much as the creator’s.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: 'prohibited',
      title: 'Prohibited products and campaigns',
      body: (
        <>
          <p>You can’t use {site.name} to promote:</p>
          <ul>
            <li>tobacco and nicotine products, including e-cigarettes and heated tobacco;</li>
            <li>alcohol, including surrogate advertising that uses another product to promote an alcohol brand;</li>
            <li>betting, gambling or real-money gaming;</li>
            <li>prescription-only medicines, or any product that claims to cure diseases listed under the Drugs and Magic Remedies (Objectionable Advertisements) Act, 1954;</li>
            <li>weapons, ammunition, explosives or items designed to cause harm;</li>
            <li>adult or sexually explicit products and services;</li>
            <li>counterfeit goods, replicas or products that infringe someone else’s intellectual property;</li>
            <li>pyramid schemes, “get rich quick” offers or unregistered investment schemes;</li>
            <li>crypto assets or other financial products, unless the campaign complies with every applicable law and advertising rule;</li>
            <li>political parties, candidates or election campaigns; and</li>
            <li>any product or service that is illegal in India or requires a licence you don’t hold — such as FSSAI registration for food.</li>
          </ul>
          <p>We may cancel and refund orders that break these rules and suspend the account involved.</p>
        </>
      ),
    },
    {
      id: 'payments-and-conduct',
      title: 'Payments and respectful conduct',
      body: (
        <ul>
          <li>Pay for all work through {site.name}. Offering or accepting payment outside the platform for work found here isn’t allowed.</li>
          <li>Don’t ask creators for personal information beyond what an order needs, or contact them outside {site.name} without their agreement.</li>
          <li>Harassment, threats, discriminatory remarks or pressure to exceed the agreed scope will lead to suspension.</li>
        </ul>
      ),
    },
    {
      id: 'using-content',
      title: 'Using the content you receive',
      body: (
        <>
          <p>
            Completed orders give you a licence to use the content on your brand’s own organic channels. Paid advertising, whitelisting and longer or
            wider usage require the creator’s “Usage rights” add-on or a written agreement in the order — see our{' '}
            <Link to="/terms">terms of service</Link> for the full licence.
          </p>
          <ul>
            <li>Don’t edit content in a way that changes its meaning or puts words in the creator’s mouth.</li>
            <li>Don’t use AI tools to alter a creator’s face, body or voice without their explicit consent.</li>
            <li>Credit or tag the creator where the platform allows and the creator asks you to.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'enforcement',
      title: 'Enforcement and questions',
      body: (
        <p>
          If a brand breaks these guidelines, we may warn the account, cancel affected orders, restrict features or suspend the account. Creators can
          report a brand to our team at any time. Questions about these guidelines can go to <SupportEmail />.
        </p>
      ),
    },
  ],
})
