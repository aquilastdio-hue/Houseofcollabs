import { Link } from 'react-router'
import { Instagram, Linkedin, Mail, Twitter } from 'lucide-react'
import { footerNav, site } from '@/config/site'
import { Logo } from '@/components/shared/logo'

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-night text-white">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="container-page relative py-16 sm:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Logo inverted />
            <p className="mt-5 text-white/70">
              The creator marketplace built for India’s brands — discover, brief, pay and receive content in one place.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {[
                { href: site.social.instagram, label: 'Instagram', Icon: Instagram },
                { href: site.social.linkedin, label: 'LinkedIn', Icon: Linkedin },
                { href: site.social.x, label: 'X', Icon: Twitter },
                { href: `mailto:${site.supportEmail}`, label: 'Email', Icon: Mail },
              ].map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                  aria-label={label}
                  className="focus-ring flex size-10 items-center justify-center rounded-full border border-night-line text-white/80 transition-colors hover:border-brand hover:text-brand"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {Object.entries(footerNav).map(([heading, links]) => (
              <div key={heading}>
                <h2 className="eyebrow text-white/50">{heading}</h2>
                <ul className="mt-4 space-y-3">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link to={l.href} className="focus-ring rounded text-sm text-white/80 transition-colors hover:text-brand">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-night-line pt-8 text-sm text-white/50 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {site.name} Technologies. All rights reserved.</p>
          <p>Made for creators and brands across India · Payments secured by Razorpay</p>
        </div>
      </div>
    </footer>
  )
}
