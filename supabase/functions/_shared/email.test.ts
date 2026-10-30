import { afterEach, describe, expect, it, vi } from 'vitest'
import { getEmailProvider, messageHtml, parseSender, renderNotificationEmail } from './email'

describe('messageHtml', () => {
  it('turns blank lines into paragraphs and keeps single line breaks', () => {
    const html = messageHtml('Intro line.\n\n✅ 1. Log in\nCheck your profile.\n\nThanks ❤️')
    expect(html.match(/<p /g)).toHaveLength(3)
    expect(html).toContain('✅ 1. Log in<br>Check your profile.')
    expect(html).toContain('Thanks ❤️')
  })

  it('still escapes HTML in the message', () => {
    expect(messageHtml('<script>x</script>\nok')).toContain('&lt;script&gt;x&lt;/script&gt;<br>ok')
  })

  it('renders nothing for an empty message', () => {
    expect(messageHtml('  ')).toBe('')
    expect(messageHtml(null)).toBe('')
  })
})

describe('renderNotificationEmail', () => {
  it('greets by first name, links the button, and keeps the plain-text version intact', () => {
    const email = renderNotificationEmail({
      name: 'Riya Sharma',
      title: '📢 Important Update for All Creators!',
      message: 'Step one.\n\nStep two.',
      actionUrl: '/creator/profile',
      siteUrl: 'https://www.houseofcollabs.com',
      cta: 'Update my profile',
    })
    expect(email.subject).toBe('📢 Important Update for All Creators!')
    expect(email.html).toContain('Hi Riya,')
    expect(email.html).toContain('href="https://www.houseofcollabs.com/creator/profile"')
    expect(email.text).toContain('Step one.\n\nStep two.')
  })
})

describe('parseSender', () => {
  it('splits a display name from the address', () => {
    expect(parseSender('House of Collabs <hello@houseofcollabs.in>')).toEqual({ name: 'House of Collabs', email: 'hello@houseofcollabs.in' })
    expect(parseSender('"House of Collabs" <hello@houseofcollabs.in>')).toEqual({ name: 'House of Collabs', email: 'hello@houseofcollabs.in' })
  })

  it('takes a bare address as is', () => {
    expect(parseSender(' hello@houseofcollabs.in ')).toEqual({ email: 'hello@houseofcollabs.in' })
    expect(parseSender('<hello@houseofcollabs.in>')).toEqual({ email: 'hello@houseofcollabs.in' })
  })
})

describe('Brevo provider', () => {
  const message = { to: 'riya@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' }

  async function sentBody(env: Record<string, string>) {
    vi.stubGlobal('Deno', { env: { get: (k: string) => env[k] } })
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ messageId: 'm1' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const provider = getEmailProvider()
    expect(provider.name).toBe('brevo')
    expect(await provider.send(message)).toEqual({ id: 'm1' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    return JSON.parse(String(init.body))
  }

  afterEach(() => vi.unstubAllGlobals())

  it('sends from EMAIL_FROM and lets replies go to EMAIL_REPLY_TO', async () => {
    const body = await sentBody({
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'xkeysib-test',
      EMAIL_FROM: 'House of Collabs <hello@houseofcollabs.com>',
      EMAIL_REPLY_TO: 'infohouseofcollabs@gmail.com',
    })
    expect(body.sender).toEqual({ name: 'House of Collabs', email: 'hello@houseofcollabs.com' })
    expect(body.replyTo).toEqual({ email: 'infohouseofcollabs@gmail.com' })
    expect(body.to).toEqual([{ email: 'riya@example.com' }])
  })

  it('ignores stray spaces and line breaks in the secrets', async () => {
    const body = await sentBody({ EMAIL_PROVIDER: ' Brevo\n', BREVO_API_KEY: 'xkeysib-test\n', EMAIL_FROM: 'House of Collabs <hello@houseofcollabs.com>\n' })
    expect(body.sender).toEqual({ name: 'House of Collabs', email: 'hello@houseofcollabs.com' })
  })

  it('leaves reply-to out when EMAIL_REPLY_TO is not set', async () => {
    const body = await sentBody({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-test', EMAIL_FROM: 'hello@houseofcollabs.com' })
    expect(body.replyTo).toBeUndefined()
  })
})
