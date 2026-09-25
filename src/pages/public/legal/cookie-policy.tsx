import { Link } from 'react-router'
import { site } from '@/config/site'
import { Callout, SupportEmail, type LegalBuilder } from './shared'

const STORAGE_ITEMS = [
  {
    name: 'house-of-collabs-auth',
    type: 'Local storage',
    purpose: 'Keeps you signed in. Holds the session tokens issued by our authentication provider, which refresh automatically.',
    duration: 'Until you log out, or the session expires',
  },
  {
    name: 'house-of-collabs:compare',
    type: 'Local storage',
    purpose: 'Remembers up to four creators you’ve added to compare (their profile ID, name and photo link).',
    duration: 'Until you remove them or clear your browser data',
  },
  {
    name: 'house-of-collabs:viewed:…',
    type: 'Session storage',
    purpose: 'Makes sure a visit to a creator’s storefront is counted only once per browsing session.',
    duration: 'Deleted when you close the tab',
  },
]

export const cookiePolicy: LegalBuilder = () => ({
  title: 'Cookie Policy',
  kind: 'Policy',
  summary: `${site.name} uses only essential browser storage — no advertising cookies and no third-party trackers.`,
  intro: (
    <p>
      This policy explains the small amount of information {site.name} stores in your browser and why. The short version: we only store what the
      service needs to work, and we don’t use cookies or trackers for advertising or cross-site profiling.
    </p>
  ),
  sections: [
    {
      id: 'short-version',
      title: 'The short version',
      body: (
        <ul>
          <li>We use essential browser storage to keep you signed in, remember your compare list and count storefront views fairly.</li>
          <li>We don’t use advertising cookies, social media pixels, cross-site trackers or third-party analytics scripts.</li>
          <li>Our fonts are bundled with the app and images come from our own storage, so loading a page doesn’t tell a font or ad network that you visited.</li>
          <li>Razorpay may use its own cookies when — and only when — you open its checkout to pay.</li>
        </ul>
      ),
    },
    {
      id: 'what-is-browser-storage',
      title: 'Cookies and browser storage, explained',
      body: (
        <>
          <p>
            Cookies are small text files a website asks your browser to keep. Local storage and session storage do a similar job: they let a site
            remember small pieces of information on your device. Session storage is cleared when you close the tab; local storage stays until it is
            removed.
          </p>
          <p>
            {site.name} relies on local and session storage rather than cookies for the few things it needs to remember. We treat them with the same
            care, and this policy covers all of them.
          </p>
        </>
      ),
    },
    {
      id: 'what-we-store',
      title: 'What we store and why',
      body: (
        <>
          <p>These are all the items {site.name} itself stores in your browser:</p>
          <ul>
            {STORAGE_ITEMS.map((item) => (
              <li key={item.name}>
                <strong>
                  <code>{item.name}</code>
                </strong>{' '}
                ({item.type}) — {item.purpose} <em>Kept: {item.duration.toLowerCase()}.</em>
              </li>
            ))}
          </ul>
          <p>
            All of these are strictly necessary: without them you couldn’t stay signed in, compare creators, or trust that storefront statistics are
            accurate.
          </p>
        </>
      ),
    },
    {
      id: 'what-we-dont-use',
      title: 'What we don’t use',
      body: (
        <>
          <p>{site.name} does not use:</p>
          <ul>
            <li>advertising or retargeting cookies;</li>
            <li>social media pixels or “like” buttons that report your visits to social networks;</li>
            <li>third-party analytics or session-recording tools; or</li>
            <li>device fingerprinting to recognise you across websites.</li>
          </ul>
          <p>
            To understand how the marketplace is used, we rely on records created inside {site.name} itself — such as searches and storefront views —
            which are covered by our <Link to="/privacy">privacy policy</Link>.
          </p>
        </>
      ),
    },
    {
      id: 'third-parties',
      title: 'Third-party services',
      body: (
        <>
          <ul>
            <li>
              <strong>Razorpay.</strong> Razorpay’s checkout loads only when you choose to pay for an order. It may set its own cookies to process the
              payment securely and prevent fraud. These are controlled by Razorpay and described in its privacy and cookie policies.
            </li>
            <li>
              <strong>Google sign-in.</strong> If you choose to sign in with Google, you are briefly redirected to Google, which may use its own cookies
              on its pages under its own policies.
            </li>
            <li>
              <strong>External links.</strong> Links to creators’ social profiles or other websites take you to services that have their own cookie
              practices.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'consent',
      title: 'Why you don’t see a cookie banner',
      body: (
        <>
          <p>
            Because we only store information that is strictly necessary to provide the service you’ve asked for, we don’t show a consent banner or
            ask you to accept optional cookies — there aren’t any.
          </p>
          <Callout title="Our commitment">
            <p>
              If we ever want to add optional cookies or analytics, we will update this policy first and ask for your consent before setting anything
              that isn’t essential.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: 'your-controls',
      title: 'How to control or clear storage',
      body: (
        <>
          <ul>
            <li>Logging out removes your session from the browser.</li>
            <li>You can remove creators from your compare list at any time, which updates what’s stored.</li>
            <li>
              Your browser settings let you delete site data or block storage for specific websites. If you block storage for {site.name}, you won’t be
              able to stay signed in.
            </li>
            <li>Private or incognito windows discard all storage when you close them.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'changes-and-contact',
      title: 'Changes and contact',
      body: (
        <p>
          We will update this page whenever we change what we store, and change the date at the top. Questions about cookies or browser storage can go
          to <SupportEmail />.
        </p>
      ),
    },
  ],
})
