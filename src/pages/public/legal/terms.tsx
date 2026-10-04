import { Link } from 'react-router'
import { site } from '@/config/site'
import {
  autoApproveText,
  feeText,
  paymentWindowText,
  responseWindowText,
} from '@/components/marketing/platform-terms'
import { COMPANY, GrievanceContact, SupportEmail, type LegalBuilder } from './shared'

export const termsOfService: LegalBuilder = (t) => ({
  title: 'Terms of Service',
  kind: 'Terms',
  summary: `The agreement between you and ${site.name} for using the marketplace as a brand, a creator or a visitor.`,
  intro: (
    <p>
      These terms form a binding agreement between you and {COMPANY} (“{site.name}”, “we”, “us”). They explain how the marketplace works, what you
      can expect from us and what we expect from you. Please read them together with our <Link to="/privacy">privacy policy</Link>,{' '}
      <Link to="/refund-policy">refund policy</Link>, <Link to="/payout-policy">payout policy</Link> and the{' '}
      <Link to="/creator-guidelines">creator</Link> and <Link to="/brand-guidelines">brand</Link> guidelines, which are part of these terms.
    </p>
  ),
  sections: [
    {
      id: 'acceptance',
      title: 'Accepting these terms',
      body: (
        <>
          <p>
            By creating an account, placing an order, publishing a storefront or otherwise using {site.name}, you agree to these terms. If you use{' '}
            {site.name} on behalf of a company or agency, you confirm that you are authorised to accept these terms for it, and “you” includes that
            organisation.
          </p>
          <p>If you do not agree with these terms, please do not use {site.name}.</p>
        </>
      ),
    },
    {
      id: 'eligibility',
      title: 'Eligibility and accounts',
      body: (
        <>
          <ul>
            <li>
              You must be at least 18 years old and able to form a binding contract under the Indian Contract Act, 1872. A person under 18 may sell as a
              creator only through an account created and managed by a parent or lawful guardian, who accepts these terms on their behalf.
            </li>
            <li>Creators must be able to receive payouts to a UPI ID or bank account in India held in their own name, or their guardian’s.</li>
            <li>The information in your account must be accurate and kept up to date. One person or business may hold one account per role.</li>
            <li>
              You are responsible for keeping your login details safe and for all activity on your account. Tell us immediately at <SupportEmail /> if
              you suspect unauthorised access.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'our-role',
      title: `${site.name}’s role`,
      body: (
        <>
          <p>
            {site.name} is an online marketplace and an intermediary under the Information Technology Act, 2000. Creators are independent sellers who
            set their own services, prices and terms; they are not our employees or agents. When a creator accepts an order, the contract for the
            content is between the brand and the creator. {site.name} provides the platform, collects and holds payment, releases it according to these
            terms, and offers support when an order goes wrong.
          </p>
          <p>
            We review storefronts and act on reports, but we do not guarantee the results of any campaign, the performance of any content, or that a
            creator’s audience figures will remain the same over time.
          </p>
        </>
      ),
    },
    {
      id: 'storefronts-and-orders',
      title: 'Storefronts, services and orders',
      body: (
        <>
          <ul>
            <li>
              A storefront lists a creator’s services. Each service states its price, deliverables, delivery time, included revisions, whether the brand
              must ship a product, and any optional add-ons.
            </li>
            <li>
              A brand places an order by choosing a service and add-ons, adding a brief and paying at checkout. The order total is calculated by our
              servers from the storefront at that moment and cannot be changed afterwards.
            </li>
            <li>
              The creator has {responseWindowText(t)} to accept or decline a paid order. Acceptance creates the contract between brand and creator on the
              terms shown in the order.
            </li>
            <li>
              Work outside the ordered service — additional videos, extra rounds of changes, longer usage — needs a new order or an add-on. It cannot be
              added to an existing order by message.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'payments-and-fees',
      title: 'Prices, payments and fees',
      body: (
        <>
          <ul>
            <li>All prices on {site.name} are in Indian rupees (INR).</li>
            <li>
              Brands pay the order total shown at checkout through Razorpay, our payment processor. An unpaid checkout stays open for{' '}
              {paymentWindowText(t)} and is then cancelled automatically.
            </li>
            <li>
              {site.name} does not add a separate fee for brands at checkout. Creators pay a platform fee
              {t.feePercent != null ? ` of ${feeText(t)}` : ''} on the order total, deducted when their earning is recorded. The percentage is shown in
              the creator’s dashboard and is fixed on each order when the order is created.
            </li>
            <li>
              Payment is held by {site.name} until the order completes and is then released to the creator as described in the{' '}
              <Link to="/payout-policy">payout policy</Link>.
            </li>
            <li>
              Creators are responsible for their own taxes, including income tax and GST where applicable. Where the law requires us to deduct tax at
              source, we will do so and share the relevant details.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'delivery-and-approval',
      title: 'Delivery, revisions and approval',
      body: (
        <>
          <ul>
            <li>
              For services that need a product, the creator shares a delivery address in the order, the brand ships the product with tracking, and the
              creator confirms receipt. The delivery time starts when the product is received; otherwise it starts on acceptance.
            </li>
            <li>The creator delivers the content through the order page before the due date.</li>
            <li>
              The brand may request changes up to the number of revisions included in the order. Revision requests must stay within the original brief.
            </li>
            <li>
              Approval completes the order. If the brand neither approves nor requests a revision within {autoApproveText(t)} of a delivery, the order is
              approved automatically.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'cancellations-and-refunds',
      title: 'Cancellations and refunds',
      body: (
        <>
          <p>
            Brands can cancel a paid order for a full refund until the creator accepts it. Orders that a creator declines, or doesn’t accept in time, are
            cancelled and refunded in full. After acceptance, either party can ask us to step in while the work is active by contacting support; our
            team reviews the brief, messages and files and decides the outcome, which may include releasing the payment, a partial refund or a full
            refund.
          </p>
          <p>
            The complete rules are in our <Link to="/refund-policy">refund policy</Link>. Our decision on an order is final as far as the platform is
            concerned, but it doesn’t limit any rights you have under applicable law.
          </p>
        </>
      ),
    },
    {
      id: 'content-and-licences',
      title: 'Content ownership and licences',
      body: (
        <>
          <h3>What the creator keeps</h3>
          <p>
            Creators keep ownership of the content they create, including copyright, unless the brand and creator agree otherwise in writing on{' '}
            {site.name}.
          </p>
          <h3>What the brand receives</h3>
          <p>
            When an order is completed, the creator grants the brand a non-exclusive, worldwide, royalty-free licence to use, reproduce and publish the
            delivered content on the brand’s own organic channels — such as its social media accounts, website, email and marketplace listings — without
            a time limit.
          </p>
          <p>
            Using the content in paid advertising (including boosted posts, dark posts and creator whitelisting), on television, radio or outdoor
            media, or sublicensing it to third parties requires the creator’s permission — normally through a “Usage rights” add-on, or a written
            agreement recorded in the order — and is limited to the scope and period stated there.
          </p>
          <h3>Portfolio use</h3>
          <p>
            Creators may show completed work in their {site.name} portfolio and elsewhere unless the brief asked for confidentiality or the brand has
            not yet published the content.
          </p>
          <h3>What you give {site.name}</h3>
          <p>
            You grant {site.name} a non-exclusive, royalty-free licence to host, store, display and process content you upload, only as needed to run
            the marketplace — for example, to show a storefront, deliver files between the parties or resolve a problem with an order. We may feature public
            storefront content to promote {site.name}; creators can ask us to stop at any time.
          </p>
          <p>
            The same licence extends to <strong>Kaza Beauty</strong>, our affiliated platform. Content you upload to {site.name} may also be hosted and
            displayed there, and used to promote creators and services on it. Nothing else changes: the permission still covers only running and
            promoting our platforms, it is not a sale or transfer of your content, we do not sublicense it to anyone else, and you can ask us to stop
            featuring your content at any time by writing to <SupportEmail />.
          </p>
          <p>
            You confirm that you own or have permission to use everything you upload, including music, fonts, footage, trademarks and people’s
            likenesses.
          </p>
        </>
      ),
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      body: (
        <>
          <p>You must not:</p>
          <ul>
            <li>ask for or make payment outside {site.name} for work arranged through {site.name}, or share contact details to avoid the platform;</li>
            <li>post false, misleading, infringing, obscene, defamatory, hateful or unlawful content, or content prohibited by our guidelines;</li>
            <li>create fake reviews, inflate follower counts or engagement, or impersonate anyone;</li>
            <li>harass, threaten or discriminate against other users;</li>
            <li>upload malware, scrape the service, or interfere with its security or normal operation; or</li>
            <li>use {site.name} for anything that breaks Indian law, including the Information Technology Act, 2000 and consumer protection law.</li>
          </ul>
          <p>
            Anyone can report a user or content from the platform. We act on reports and lawful orders in line with the Information Technology
            (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.
          </p>
        </>
      ),
    },
    {
      id: 'advertising-rules',
      title: 'Advertising and disclosure rules',
      body: (
        <p>
          Content made through {site.name} is usually advertising. Brands and creators must follow the Advertising Standards Council of India (ASCI)
          Code and its Guidelines for Influencer Advertising in Digital Media, and the Central Consumer Protection Authority’s Guidelines for
          Prevention of Misleading Advertisements and Endorsements for Misleading Advertisements, 2022 — including clear disclosure of paid
          partnerships. The <Link to="/brand-guidelines">brand guidelines</Link> and <Link to="/creator-guidelines">creator guidelines</Link> explain
          what this means in practice.
        </p>
      ),
    },
    {
      id: 'suspension',
      title: 'Suspension and termination',
      body: (
        <>
          <p>
            You can close your account at any time from your settings or by writing to us, after any open orders and payouts are completed or
            resolved.
          </p>
          <p>
            We may warn you, hide your content, limit features, or suspend or close your account if you breach these terms or our guidelines, if
            required by law, or to protect other users. Where appropriate we will tell you why and give you a chance to respond. Earnings linked to
            suspected fraud or an open investigation may be held until it is resolved; legitimate earnings will be paid out.
          </p>
        </>
      ),
    },
    {
      id: 'liability',
      title: 'Disclaimers and limitation of liability',
      body: (
        <>
          <p>
            {site.name} is provided on an “as is” and “as available” basis. To the extent permitted by law, we do not give warranties about the
            content creators produce, the conduct of any user, or uninterrupted availability of the service.
          </p>
          <p>
            To the extent permitted by law, {site.name} is not liable for indirect or consequential losses, such as lost profits, revenue or goodwill.
            Our total liability for any claim relating to an order is limited to the higher of the platform fees we earned on that order or ₹5,000.
            Nothing in these terms limits liability that cannot be limited under Indian law, including for fraud.
          </p>
        </>
      ),
    },
    {
      id: 'indemnity',
      title: 'Indemnity',
      body: (
        <p>
          You agree to compensate {site.name} for losses, claims and reasonable legal costs arising from content you upload, your breach of these terms
          or our guidelines, or your violation of any law or third-party right — for example, a brand’s unsubstantiated product claim or a creator’s use
          of unlicensed music.
        </p>
      ),
    },
    {
      id: 'governing-law',
      title: 'Governing law and jurisdiction',
      body: (
        <p>
          These terms are governed by the laws of India. Subject to any rights you have under consumer protection law to approach a consumer
          commission, the courts at Bengaluru, Karnataka have exclusive jurisdiction over disputes arising from these terms. Before going to court,
          please contact us — most problems are solved faster that way.
        </p>
      ),
    },
    {
      id: 'changes-and-contact',
      title: 'Changes, notices and contact',
      body: (
        <>
          <p>
            We may update these terms from time to time. We will give notice of material changes by email or in the app before they take effect;
            continuing to use {site.name} afterwards means you accept the updated terms. Orders already placed continue under the terms that applied
            when they were created.
          </p>
          <p>
            Questions about these terms can go to <SupportEmail />. Complaints about content or conduct on the platform can be sent to our Grievance
            Officer, who acknowledges them within 24 hours and aims to resolve them within 15 days.
          </p>
          <GrievanceContact />
        </>
      ),
    },
  ],
})
