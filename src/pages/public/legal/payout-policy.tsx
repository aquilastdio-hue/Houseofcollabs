import { Link } from 'react-router'
import { site } from '@/config/site'
import { formatINR } from '@/lib/format'
import { feeText, holdText, minPayoutText, splitEarning } from '@/components/marketing/platform-terms'
import { Callout, SupportEmail, type LegalBuilder } from './shared'

const EXAMPLE_ORDER = 2000

export const payoutPolicy: LegalBuilder = (t) => {
  const example = t.feePercent != null ? splitEarning(EXAMPLE_ORDER, t.feePercent) : null
  return {
    title: 'Payout Policy',
    kind: 'Policy',
    summary: `How creators earn on ${site.name}: platform fees, when earnings become available, payout methods, timelines and taxes.`,
    intro: (
      <p>
        This policy explains how money moves from a completed order to a creator’s bank account or UPI ID. It applies to every creator selling on{' '}
        {site.name} and forms part of our <Link to="/terms">terms of service</Link>.
      </p>
    ),
    sections: [
      {
        id: 'overview',
        title: 'How creator earnings work',
        body: (
          <ol>
            <li>A brand pays the full order total at checkout, and {site.name} holds it.</li>
            <li>When the order completes, we record your earning: the order total minus the platform fee.</li>
            <li>The earning becomes available to withdraw {holdText(t)}.</li>
            <li>You request a payout of your available balance to your UPI ID or bank account, and we send it.</li>
          </ol>
        ),
      },
      {
        id: 'platform-fee',
        title: 'Platform fee',
        body: (
          <>
            <p>
              {site.name} keeps a platform fee{t.feePercent != null ? ` of ${feeText(t)}` : ''} of each order total, including any add-ons the brand
              bought. There are no sign-up, listing or subscription fees, and brands don’t pay an extra fee on top of your price.
            </p>
            <p>
              The fee percentage is fixed on each order when the brand places it, so a later change never affects orders already in progress. Your
              dashboard shows the exact fee and earning for every order.
            </p>
            {example && (
              <Callout title="Example">
                <p>
                  On a {formatINR(EXAMPLE_ORDER)} order, the platform fee is {formatINR(example.fee)} and your earning is {formatINR(example.net)}.
                </p>
              </Callout>
            )}
          </>
        ),
      },
      {
        id: 'when-available',
        title: 'When earnings become available',
        body: (
          <ul>
            <li>An order completes when the brand approves your delivery, or when it is auto-approved at the end of the review window.</li>
            <li>Your earning is recorded at that moment and becomes available {holdText(t)}.</li>
            <li>Earnings for an order our team is reviewing stay on hold until that review is finished.</li>
            <li>If a review ends in a partial refund, you earn on the part of the order that was paid to you; a full refund cancels the earning.</li>
          </ul>
        ),
      },
      {
        id: 'payout-methods',
        title: 'Payout methods',
        body: (
          <>
            <p>You can be paid by:</p>
            <ul>
              <li>
                <strong>UPI</strong> — to a UPI ID in your name.
              </li>
              <li>
                <strong>Bank transfer</strong> — to a savings or current account in India, using the account number and IFSC. Once saved, only the
                last four digits of the account number are shown in the app.
              </li>
            </ul>
            <p>
              The account holder name should match your name (or your guardian’s, for guardian-managed accounts). Payout details can’t be changed while
              a payout is being processed, and we may ask you to verify them before sending money.
            </p>
          </>
        ),
      },
      {
        id: 'requesting-a-payout',
        title: 'Requesting a payout',
        body: (
          <ul>
            <li>Request a payout from your Payouts page. Each request covers your full available balance.</li>
            <li>The minimum payout is {minPayoutText(t, 'shown on your Payouts page')}. Smaller balances roll over until they reach it.</li>
            <li>You can have one payout request in progress at a time.</li>
          </ul>
        ),
      },
      {
        id: 'processing',
        title: 'Processing and references',
        body: (
          <>
            <p>
              Our team processes payout requests on business days. You can follow each request as it moves from pending to processing to paid. Once the
              money is sent, we add the transfer reference — such as a UTR number — to your payout history, and notify you.
            </p>
            <p>Bank holidays, verification checks or incorrect details can delay a payout. We’ll tell you if anything is holding yours up.</p>
          </>
        ),
      },
      {
        id: 'failed-payouts',
        title: 'Failed or rejected payouts',
        body: (
          <p>
            If a transfer fails — for example because of an incorrect UPI ID, a closed account or a name mismatch — or if we can’t approve a request,
            the amount returns to your available balance and we tell you why. Update your details and request again.
          </p>
        ),
      },
      {
        id: 'taxes',
        title: 'Taxes',
        body: (
          <>
            <p>
              As an independent seller, you are responsible for declaring your earnings and paying your own taxes, including income tax and GST if you
              are required to register for it. Your Earnings page lists every order, fee and payout to help with your records.
            </p>
            <p>
              Where Indian tax law requires {site.name} to deduct tax at source from payouts, we will deduct it, show it on your statement and issue
              the relevant certificate. We may ask for your PAN to do this correctly.
            </p>
          </>
        ),
      },
      {
        id: 'holds-and-recovery',
        title: 'Holds, reversals and recovery',
        body: (
          <ul>
            <li>We may hold earnings or payouts while we investigate suspected fraud, a serious breach of our guidelines, or a legal request.</li>
            <li>If an order is refunded after you were paid — for example after an exceptional review — we may deduct that amount from your future earnings.</li>
            <li>Legitimate earnings are always paid out once a review is complete, including if your account is closed.</li>
          </ul>
        ),
      },
      {
        id: 'contact',
        title: 'Questions about payouts',
        body: (
          <p>
            For help with a payout, write to <SupportEmail /> and include the payout date or amount. If you believe a payout decision was wrong, you can
            also raise a grievance as described in our <Link to="/terms">terms of service</Link>.
          </p>
        ),
      },
    ],
  }
}
