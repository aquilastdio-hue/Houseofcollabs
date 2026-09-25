// Email abstraction. Application code depends only on `EmailProvider`; the
// concrete provider is chosen by the EMAIL_PROVIDER secret.

export type EmailMessage = { to: string; subject: string; html: string; text: string }

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<{ id?: string }>
}

/** Default: logs instead of sending (safe for local/dev). */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console'
  async send(message: EmailMessage) {
    console.log(`[email:console] to=${message.to} subject="${message.subject}"`)
    return {}
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend'
  constructor(
    private apiKey: string,
    private from: string,
  ) {}
  async send(message: EmailMessage) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    })
    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`)
    const body = (await res.json()) as { id?: string }
    return { id: body.id }
  }
}

export function getEmailProvider(): EmailProvider {
  const provider = (Deno.env.get('EMAIL_PROVIDER') ?? 'console').toLowerCase()
  const from = Deno.env.get('EMAIL_FROM') ?? 'House of Collabs <notifications@houseofcollabs.example>'
  if (provider === 'resend') {
    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) throw new Error('EMAIL_PROVIDER=resend requires RESEND_API_KEY')
    return new ResendEmailProvider(key, from)
  }
  return new ConsoleEmailProvider()
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * Branded, dependency-free transactional email.
 *
 * Table-based layout with inline styles — the only thing that renders reliably
 * across Gmail, Outlook and Apple Mail. `max-width` plus a fluid table keeps it
 * readable on phones without a media query.
 */
export function renderNotificationEmail(input: {
  name?: string | null
  title: string
  message?: string | null
  actionUrl?: string | null
  siteUrl: string
  /** Button label. Omit to hide the button entirely. */
  cta?: string | null
  /** Inbox preview line shown after the subject. */
  preheader?: string | null
  subject?: string
  /** Where "choose which emails you get" points. Brands and creators differ. */
  prefsPath?: string
}) {
  const site = input.siteUrl.replace(/\/$/, '')
  const prefs = `${site}${input.prefsPath ?? '/creator/settings/security'}`
  const url = input.actionUrl ? (input.actionUrl.startsWith('http') ? input.actionUrl : `${site}${input.actionUrl}`) : null
  const greeting = input.name ? `Hi ${input.name.split(' ')[0]},` : 'Hi,'
  const subject = input.subject ?? input.title
  const showCta = Boolean(url && input.cta)

  const text = [
    greeting,
    '',
    input.title,
    input.message ?? '',
    '',
    showCta ? `${input.cta}: ${url}` : `Open House of Collabs: ${site}`,
    '',
    '—',
    'House of Collabs',
    `Manage which emails you receive: ${prefs}`,
  ]
    .filter((line, i, a) => !(line === '' && a[i - 1] === ''))
    .join('\n')

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;color:#111111;-webkit-font-smoothing:antialiased">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f7fa">
  <tr><td align="center" style="padding:32px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%">

      <!-- gradient header -->
      <tr><td style="background:#e1306c;background-image:linear-gradient(135deg,#e1306c 0%,#c13584 52%,#833ab4 100%);border-radius:20px 20px 0 0;padding:26px 32px">
        <span style="font-size:19px;font-weight:700;letter-spacing:-0.4px;color:#ffffff">House of Collabs</span>
      </td></tr>

      <!-- body -->
      <tr><td style="background:#ffffff;border-left:1px solid #e7e4ee;border-right:1px solid #e7e4ee;padding:32px">
        <p style="margin:0;font-size:15px;color:#6b6478">${escapeHtml(greeting)}</p>
        <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.4px;color:#111111">${escapeHtml(input.title)}</h1>
        ${input.message ? `<p style="margin:12px 0 0;font-size:15px;line-height:1.65;color:#3a3446">${escapeHtml(input.message)}</p>` : ''}
        ${
          showCta
            ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px"><tr><td style="border-radius:999px;background:#e1306c;background-image:linear-gradient(135deg,#e1306c 0%,#c13584 100%)">
                 <a href="${escapeHtml(url!)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(input.cta!)}</a>
               </td></tr></table>`
            : ''
        }
      </td></tr>

      <!-- footer -->
      <tr><td style="background:#ffffff;border:1px solid #e7e4ee;border-top:0;border-radius:0 0 20px 20px;padding:22px 32px 26px">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#9c95a8">
          You’re receiving this because you have an account on House of Collabs.<br>
          <a href="${escapeHtml(prefs)}" style="color:#c13584;text-decoration:underline">Choose which emails you get</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`

  return { subject, html, text }
}
