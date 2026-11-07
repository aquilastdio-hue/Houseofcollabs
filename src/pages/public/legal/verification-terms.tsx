import { Link } from 'react-router'
import { site } from '@/config/site'
import { COMPANY, Callout, GrievanceContact, SupportEmail, type LegalBuilder } from './shared'

/**
 * Sent with every verification request and stored with it (migration 0050).
 * Change it whenever these terms change: the database refuses an older one,
 * so creators always agree to the text they were shown.
 */
export const VERIFICATION_TERMS_VERSION = '2026-11-06'
export const VERIFICATION_TERMS_DATE = '6 November 2026'

export const verificationTerms: LegalBuilder = () => ({
  title: 'Creator Verification Terms',
  kind: 'Terms',
  updated: { label: VERIFICATION_TERMS_DATE, iso: VERIFICATION_TERMS_VERSION },
  summary: `What you agree to when you send ${site.name} your PAN, bank and UPI details to get the verified badge, and how we look after them.`,
  intro: (
    <p>
      These terms apply when you ask for the verified badge on {site.name}. They sit alongside our <Link to="/terms">Terms of Service</Link> and{' '}
      <Link to="/privacy">Privacy Policy</Link>, and they explain what we ask for, why, who can see it and what you can do about it. Version of{' '}
      {VERIFICATION_TERMS_DATE}.
    </p>
  ),
  sections: [
    {
      id: 'what-you-send',
      title: 'What you send us',
      body: (
        <ul>
          <li>Your full name, exactly as it appears on your PAN card.</li>
          <li>A link to your Instagram profile.</li>
          <li>Your PAN number and a PDF or photo of your PAN card.</li>
          <li>Your bank account number, IFSC and branch address.</li>
          <li>Your UPI ID.</li>
        </ul>
      ),
    },
    {
      id: 'your-promises',
      title: 'What you promise',
      body: (
        <ul>
          <li>Everything you send is true, current and complete.</li>
          <li>The PAN is yours, the bank account and UPI ID are in your own name, and you own or control the Instagram account you link.</li>
          <li>You won’t send anyone else’s documents or details, or documents that have been edited.</li>
          <li>You’ll tell us, by sending a new verification request, if any of these details change.</li>
        </ul>
      ),
    },
    {
      id: 'how-we-use',
      title: 'How we use your details',
      body: (
        <>
          <p>Only to:</p>
          <ul>
            <li>confirm who you are and that the Instagram account is yours, before giving you the verified badge;</li>
            <li>pay you, and prepare the invoices, settlement statements and tax records that go with your orders;</li>
            <li>meet our duties under Indian tax law, such as deducting and reporting TDS and GST TCS against your PAN;</li>
            <li>prevent fraud, and respond to lawful requests from authorities.</li>
          </ul>
          <Callout title="Your payouts don’t change">
            <p>
              We still pay you to the UPI ID or bank account on your Payouts page. The details you send here are kept as verification records, so
              keep both up to date.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: 'who-sees',
      title: 'Who can see them',
      body: (
        <ul>
          <li>Brands and visitors never see them. Nothing here appears on your storefront.</li>
          <li>
            Only authorised members of the {site.name} team can open them. Your full PAN, account number and UPI ID stay hidden even from them until
            they choose to view them, and every view is recorded.
          </li>
          <li>Your PAN card file is kept in private storage that has no public link.</li>
          <li>
            We share them only where we must: with banks and payment partners to pay you, and with tax and other authorities when the law requires.
            We never sell them.
          </li>
        </ul>
      ),
    },
    {
      id: 'how-long',
      title: 'How long we keep them',
      body: (
        <p>
          For as long as you have an account with us, and after that only as long as Indian tax, accounting and other laws require us to keep records
          of payments made to you.
        </p>
      ),
    },
    {
      id: 'the-badge',
      title: 'The verified badge',
      body: (
        <ul>
          <li>Our team reviews every request. We may ask you for more information, or decline a request, and we’ll tell you why.</li>
          <li>The badge shows that we have checked your identity. It is not a promise about your work or results.</li>
          <li>
            We may remove the badge if your details turn out to be wrong, if they change without you telling us, or if you break our{' '}
            <Link to="/creator-guidelines">Creator Guidelines</Link>. To get it back, you send a new request.
          </li>
        </ul>
      ),
    },
    {
      id: 'your-rights',
      title: 'Your rights',
      body: (
        <>
          <p>
            You can ask to see the details we hold, ask us to correct them, or withdraw your consent by writing to <SupportEmail />. Withdrawing consent
            removes the verified badge; records the law requires us to keep stay for as long as it requires. If you are unhappy with how we have
            handled your details, contact our Grievance Officer:
          </p>
          <GrievanceContact />
          <p>
            By ticking “I agree” you confirm you have read these terms and consent to {COMPANY} using your details as described above.
          </p>
        </>
      ),
    },
  ],
})
