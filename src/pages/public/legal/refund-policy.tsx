import { Link } from 'react-router'
import { site } from '@/config/site'
import { autoApproveText, paymentWindowText, responseWindowText } from '@/components/marketing/platform-terms'
import { Callout, SupportEmail, type LegalBuilder } from './shared'

export const refundPolicy: LegalBuilder = (t) => ({
  title: 'Refund Policy',
  kind: 'Policy',
  summary: `When brands get their money back on ${site.name}: cancellations, declined orders, order problems and how refunds are paid.`,
  intro: (
    <>
      <p>
        Every order on {site.name} is paid upfront and held until the brand approves the work. This policy explains when that payment is refunded,
        how order problems are decided and how long refunds take to reach you.
      </p>
      {(t.cancellationRules || t.refundRules) && (
        <Callout title="Current rules at a glance">
          {t.cancellationRules && <p>{t.cancellationRules}</p>}
          {t.refundRules && <p>{t.refundRules}</p>}
        </Callout>
      )}
    </>
  ),
  sections: [
    {
      id: 'how-payment-is-protected',
      title: 'How your payment is protected',
      body: (
        <p>
          When you check out, Razorpay processes your payment and {site.name} holds it. The creator’s share is released only when the order completes —
          after you approve the delivery, or automatically after {autoApproveText(t)} if you don’t respond. Until then, the rules below decide what
          happens to your money if the order doesn’t go ahead.
        </p>
      ),
    },
    {
      id: 'cancel-before-acceptance',
      title: 'Cancelling before the creator accepts',
      body: (
        <p>
          You can cancel a paid order from the order page at any time before the creator accepts it. You’ll receive a full refund of the amount you
          paid, including add-ons.
        </p>
      ),
    },
    {
      id: 'declined-or-unanswered',
      title: 'Declined or unanswered orders',
      body: (
        <ul>
          <li>If the creator declines your order, it is cancelled and fully refunded.</li>
          <li>If the creator doesn’t accept within {responseWindowText(t)}, the order is cancelled automatically and fully refunded.</li>
          <li>If we cancel an order — for example because a storefront breaks our guidelines — we refund it in full.</li>
        </ul>
      ),
    },
    {
      id: 'unpaid-checkouts',
      title: 'Unpaid or failed payments',
      body: (
        <>
          <p>
            An order isn’t confirmed until Razorpay confirms your payment and our servers verify it. Unpaid checkouts close automatically after{' '}
            {paymentWindowText(t)}.
          </p>
          <p>
            If money left your account but the order wasn’t confirmed, the payment is usually reversed automatically by Razorpay or your bank. If it
            hasn’t arrived within 7 business days, write to <SupportEmail /> with the payment reference and we’ll trace it.
          </p>
        </>
      ),
    },
    {
      id: 'after-acceptance',
      title: 'After the creator accepts',
      body: (
        <>
          <p>
            Once a creator accepts, they start planning, shooting and editing — so orders can no longer be cancelled from the order page. If plans change
            or something goes wrong:
          </p>
          <ul>
            <li>ask for a revision from the order page first — many issues are solved by one;</li>
            <li>if you both agree the order shouldn’t continue, contact our support team and we’ll help cancel it fairly; or</li>
            <li>if you can’t agree, contact our support team and we’ll review the order and decide.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'order-problems',
      title: 'Order problems and possible outcomes',
      body: (
        <>
          <p>
            Brands and creators can ask us to step in while an order is active — from acceptance until it is approved. Write to <SupportEmail /> with
            your order number. Common reasons include content not as described, a missed deadline, an unresponsive creator or brand, a product that was
            never shipped, and quality issues.
          </p>
          <p>Our team reviews the brief, the delivered files and the order history, may ask both sides for more information, and then decides one of these outcomes:</p>
          <ul>
            <li>
              <strong>Release to the creator</strong> — the work met the brief, and the order is completed.
            </li>
            <li>
              <strong>Resume the order</strong> — the order goes back to where it was, for example to allow a revision.
            </li>
            <li>
              <strong>Partial refund</strong> — part of the payment is refunded to the brand and the rest is paid to the creator, when work was partly
              delivered.
            </li>
            <li>
              <strong>Full refund</strong> — the whole amount is refunded to the brand.
            </li>
          </ul>
          <p>While we are reviewing an order, the creator’s earning for it stays on hold.</p>
        </>
      ),
    },
    {
      id: 'not-refundable',
      title: 'What isn’t normally refunded',
      body: (
        <>
          <ul>
            <li>Orders you have approved, or that were auto-approved — approval completes the order and releases payment to the creator.</li>
            <li>Changes of mind after delivery when the content matches the brief and the service description.</li>
            <li>Requests outside the brief or the ordered service, such as extra videos or new concepts.</li>
            <li>Costs you paid outside {site.name}, such as shipping a product to the creator.</li>
          </ul>
          <p>
            In exceptional cases — for example fraud, or content that infringes someone else’s rights — contact us even after completion and we will
            review what happened.
          </p>
        </>
      ),
    },
    {
      id: 'how-refunds-are-paid',
      title: 'How and when refunds are paid',
      body: (
        <>
          <p>
            Refunds go back to the original payment method through Razorpay. Once we initiate a refund, it usually reaches you within 5–10 business
            days, depending on your bank or payment method. We’ll notify you when the refund has been processed.
          </p>
          <p>
            A full refund cancels the creator’s earning for that order. If the creator was already paid out for an order that is later refunded, we
            may recover the amount from their future earnings in line with our <Link to="/payout-policy">payout policy</Link>.
          </p>
        </>
      ),
    },
    {
      id: 'contact',
      title: 'Questions and complaints',
      body: (
        <p>
          For help with a refund, write to <SupportEmail /> with your order number. If you’re unhappy with how a refund or an order review was handled, you can
          raise a grievance with our Grievance Officer as described in our <Link to="/terms">terms of service</Link>. This policy does not affect your
          rights under the Consumer Protection Act, 2019.
        </p>
      ),
    },
  ],
})
