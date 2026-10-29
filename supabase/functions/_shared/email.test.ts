import { describe, expect, it } from 'vitest'
import { messageHtml, parseSender, renderNotificationEmail } from './email'

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
