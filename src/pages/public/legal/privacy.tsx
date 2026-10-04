import { Link } from 'react-router'
import { site } from '@/config/site'
import { COMPANY, GrievanceContact, SupportEmail, type LegalBuilder } from './shared'

export const privacyPolicy: LegalBuilder = () => ({
  title: 'Privacy Policy',
  kind: 'Policy',
  summary: `How ${site.name} collects, uses, shares and protects personal data, and the rights you have under Indian law.`,
  intro: (
    <p>
      This policy explains what personal data {COMPANY} (“{site.name}”, “we”, “us”) collects when you use our website and apps, why we collect it,
      who we share it with and the choices you have. We have written it to comply with the Digital Personal Data Protection Act, 2023 (the “DPDP
      Act”), the Information Technology Act, 2000 and the rules made under them.
    </p>
  ),
  sections: [
    {
      id: 'who-we-are',
      title: 'Who we are and what this policy covers',
      body: (
        <>
          <p>
            {site.name} is an online marketplace that connects brands with independent content creators in India. For the personal data described
            here, {COMPANY}, {site.address}, is the Data Fiduciary — the organisation that decides why and how your data is processed.
          </p>
          <p>
            This policy applies to everyone who visits {site.name} or uses it as a brand, a creator or a guest. It does not cover websites or services
            run by others that we link to, such as a creator’s social media profile or Razorpay’s payment pages; their own policies apply there.
          </p>
        </>
      ),
    },
    {
      id: 'data-we-collect',
      title: 'Personal data we collect',
      body: (
        <>
          <h3>Information you give us</h3>
          <ul>
            <li>
              <strong>Account details:</strong> your name, email address, password (stored only as a secure hash by our authentication provider),
              phone number if you add one, profile photo and whether you joined as a brand or a creator.
            </li>
            <li>
              <strong>Brand details:</strong> brand name, logo, website and social links, industry, location, contact email and phone, and an
              optional audio clip showing how to pronounce your brand name.
            </li>
            <li>
              <strong>Creator details:</strong> display name, bio, city and state, gender and age (if you choose to share them), categories,
              languages, linked social accounts and follower counts, portfolio items, services, prices and add-ons.
            </li>
            <li>
              <strong>Order and project data:</strong> briefs, attachments, messages, delivered files, revision requests, reviews and anything you
              send us about a problem with an order.
            </li>
            <li>
              <strong>Shipping details:</strong> when a service needs a physical product, the creator’s delivery name, phone number and address for
              that order.
            </li>
            <li>
              <strong>Payout details (creators):</strong> account holder name and either a UPI ID or a bank account number with IFSC. After you save
              a bank account, the app only ever shows its last four digits.
            </li>
            <li>
              <strong>Support messages:</strong> anything you send through our contact form or by email.
            </li>
          </ul>
          <h3>Information created as you use {site.name}</h3>
          <ul>
            <li>Order history, status changes, payment and payout records, earnings and notifications.</li>
            <li>Searches brands run in the marketplace and views of creator storefronts, used to show creators aggregate profile statistics.</li>
            <li>Technical data such as your browser type, device, IP address and timestamps, which our infrastructure records to keep the service secure and working.</li>
          </ul>
          <h3>Information from third parties</h3>
          <ul>
            <li>If you sign in with Google, we receive your name, email address and profile picture from Google.</li>
            <li>
              When you pay, Razorpay tells us whether the payment succeeded, the amount, the payment method type and transaction references. We never
              receive or store your full card number, UPI PIN or net-banking password.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'how-we-use',
      title: 'How we use your personal data',
      body: (
        <>
          <p>We use personal data only for specific, clearly defined purposes:</p>
          <ul>
            <li>to create and secure your account and let you sign in;</li>
            <li>to publish creator storefronts and help brands search, compare and shortlist creators;</li>
            <li>to process orders, payments, refunds, earnings and payouts;</li>
            <li>to deliver messages, files and notifications between the people on an order;</li>
            <li>to review storefronts, verify creators, investigate reports and resolve problems with orders;</li>
            <li>to detect and prevent fraud, abuse, security incidents and off-platform payment requests;</li>
            <li>to answer support requests and send service emails you can’t opt out of, such as payment receipts and security alerts;</li>
            <li>to understand how the product is used in aggregate so we can improve search and fix problems; and</li>
            <li>to meet our obligations under tax, accounting and other applicable laws.</li>
          </ul>
          <p>
            We do not sell your personal data, and we do not use it for third-party advertising. You can switch off optional email notifications in
            your account settings at any time.
          </p>
        </>
      ),
    },
    {
      id: 'consent',
      title: 'Consent and legitimate uses',
      body: (
        <>
          <p>
            We process your personal data on the basis of the consent you give when you create an account, submit a form or place an order, and — where
            the DPDP Act allows — for legitimate uses such as complying with the law, responding to legal claims, or when you have voluntarily provided
            data for a specified purpose.
          </p>
          <p>
            You can withdraw consent at any time by deleting information from your profile, changing your settings or writing to us. Withdrawing consent
            does not affect processing that happened before, and some data must still be kept where the law requires it — for example, records of
            completed payments. If you withdraw consent that an active order depends on, we may be unable to complete that order.
          </p>
        </>
      ),
    },
    {
      id: 'sharing',
      title: 'Who we share data with',
      body: (
        <>
          <ul>
            <li>
              <strong>Other users, as part of an order.</strong> Brands see a creator’s storefront and the details a creator shares in an order. Creators
              see the brand’s name, profile, brief and messages. When a service needs a product, the creator’s shipping details are shared with that
              brand so it can send the product.
            </li>
            <li>
              <strong>Supabase</strong>, our infrastructure provider, which hosts our database, authentication and file storage on our behalf.
            </li>
            <li>
              <strong>Razorpay</strong>, our payment processor, which handles payments and refunds. Razorpay processes payment data under its own
              privacy policy and applicable Reserve Bank of India rules.
            </li>
            <li>
              <strong>Service providers</strong> that help us send emails and notifications, bound by contracts to use the data only to provide their
              service to us.
            </li>
            <li>
              <strong>Authorities and advisers</strong>, when required by law, a court order or a lawful request from a government agency, or when needed
              to protect the rights, safety and property of our users or {site.name}.
            </li>
            <li>
              <strong>A successor business</strong>, if {site.name} is involved in a merger, acquisition or sale of assets, subject to this policy.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'public-information',
      title: `What is public on ${site.name}`,
      body: (
        <>
          <p>
            A published creator storefront is public: anyone can see the display name, photo, cover image, bio, city and state, categories, languages,
            linked social accounts and follower counts, services, prices, add-ons, portfolio items that aren’t hidden, and reviews. Brand names and
            ratings may appear alongside reviews.
          </p>
          <p>
            Private information — email addresses, phone numbers, shipping addresses, payout details, briefs, messages and delivered files — is never
            shown publicly. Access to it is restricted at the database level so that only the people on an order and authorised {site.name} staff can
            see it.
          </p>
        </>
      ),
    },
    {
      id: 'storage-security',
      title: 'Where data is stored and how we protect it',
      body: (
        <>
          <p>
            Your data is stored with Supabase. Depending on the hosting region, it may be processed on servers outside India. We transfer personal data
            outside India only as permitted under the DPDP Act and any restrictions notified by the Government of India.
          </p>
          <p>Safeguards we use include:</p>
          <ul>
            <li>encryption in transit (HTTPS/TLS) for all traffic between your device and our services;</li>
            <li>row-level security rules in our database, so each user can only read and change the records they are allowed to;</li>
            <li>private file storage with short-lived signed links for briefs, deliverables and other order files;</li>
            <li>verification of every payment on our servers, never just in the browser; and</li>
            <li>audit logs of sensitive administrative actions and restricted staff access.</li>
          </ul>
          <p>
            No system is perfectly secure. If a personal data breach occurs, we will notify affected users and the Data Protection Board of India as
            required by law.
          </p>
        </>
      ),
    },
    {
      id: 'retention',
      title: 'How long we keep data',
      body: (
        <>
          <p>
            We keep personal data for as long as your account is active and as long as needed for the purposes above. When you delete your account, we
            delete or anonymise your personal data within a reasonable period, except for:
          </p>
          <ul>
            <li>order, payment, refund and payout records we must keep under tax, accounting and other laws;</li>
            <li>information needed to resolve an open dispute, enforce our terms or defend legal claims; and</li>
            <li>reviews and messages that form part of another user’s order history, which we may keep in de-identified form.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'your-rights',
      title: 'Your rights',
      body: (
        <>
          <p>Under the DPDP Act, you have the right to:</p>
          <ul>
            <li>get a summary of the personal data we process about you and the processing activities involved;</li>
            <li>know the identities of other Data Fiduciaries and Data Processors with whom your data has been shared;</li>
            <li>have inaccurate or incomplete data corrected, completed or updated;</li>
            <li>have your personal data erased when it is no longer needed, unless the law requires us to keep it;</li>
            <li>have your grievances redressed by us; and</li>
            <li>nominate another person to exercise your rights in the event of your death or incapacity.</li>
          </ul>
          <p>
            You can update most information directly in your account settings. For anything else, email <SupportEmail /> from the address linked to your
            account. We may need to verify your identity before acting on a request. If you are not satisfied with our response, you may complain to the
            Data Protection Board of India.
          </p>
        </>
      ),
    },
    {
      id: 'children',
      title: 'Children and guardians',
      body: (
        <p>
          {site.name} accounts are meant for people aged 18 and over. If you are under 18, a parent or lawful guardian must create and manage the account
          and give verifiable consent to our processing of your personal data, as the DPDP Act requires. We do not track, profile or target
          advertising at children. If we learn that we hold a child’s data without such consent, we will delete it.
        </p>
      ),
    },
    {
      id: 'cookies',
      title: 'Cookies and browser storage',
      body: (
        <p>
          We use only essential browser storage — for example, to keep you signed in and to remember creators you’re comparing. We don’t use
          advertising cookies or third-party trackers. The <Link to="/cookie-policy">cookie policy</Link> lists exactly what we store.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      body: (
        <p>
          We may update this policy as the product or the law changes. The date at the top shows when it was last revised. If a change materially
          affects how we use your personal data, we will tell you by email or in the app before it takes effect and, where required, ask for your
          consent again.
        </p>
      ),
    },
    {
      id: 'grievance-officer',
      title: 'Contact and Grievance Officer',
      body: (
        <>
          <p>
            For questions about this policy or to exercise your rights, write to <SupportEmail />. In line with the Information Technology
            (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the DPDP Act, you can also contact our Grievance Officer. We
            acknowledge complaints within 24 hours and aim to resolve them within 15 days.
          </p>
          <GrievanceContact />
        </>
      ),
    },
  ],
})
