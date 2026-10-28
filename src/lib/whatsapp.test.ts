import { describe, expect, it } from 'vitest'
import { firstName, personalize, whatsappHref, whatsappNumber } from './whatsapp'

describe('whatsappNumber', () => {
  it.each([
    ['98765 43210', '919876543210'],
    ['09876543210', '919876543210'],
    ['+91 98765-43210', '919876543210'],
    ['+44 7700 900123', '447700900123'],
    ['12345', null],
  ])('%s → %s', (raw, expected) => {
    expect(whatsappNumber(raw)).toBe(expected)
  })
})

describe('whatsappHref', () => {
  it('opens the chat, with the message typed when given', () => {
    expect(whatsappHref('9876543210')).toBe('https://wa.me/919876543210')
    expect(whatsappHref('9876543210', 'Hi Riya & team!')).toBe('https://wa.me/919876543210?text=Hi%20Riya%20%26%20team!')
  })
})

describe('firstName', () => {
  it.each([
    ['Riya Sharma', 'Riya'],
    ['riya sharma', 'Riya'],
    ['RASHI SINGH', 'Rashi'],
    ['Mohd Saad', 'Saad'],
    ['Md. Imran Khan', 'Imran'],
    ['Dr Anjali Rao', 'Anjali'],
    ['Mohd', 'Mohd'],
    ['McKenzie Lee', 'McKenzie'],
    ['  ', ''],
  ])('%s → %s', (raw, expected) => {
    expect(firstName(raw)).toBe(expected)
  })
})

describe('personalize', () => {
  it('uses the first name', () => {
    expect(personalize('Hi {name}, new briefs are live!', 'Riya Sharma')).toBe('Hi Riya, new briefs are live!')
    expect(personalize('Hello {NAME}!', '  aisha  ')).toBe('Hello Aisha!')
    expect(personalize('Hi {name}', 'आयशा शर्मा')).toBe('Hi आयशा')
  })

  it('drops the placeholder cleanly when there is no name', () => {
    expect(personalize('Hi {name}, new briefs are live!', '')).toBe('Hi, new briefs are live!')
    expect(personalize('Hi {name}!', null)).toBe('Hi!')
  })

  it('leaves a message without the placeholder alone', () => {
    expect(personalize('New briefs are live.', 'Riya')).toBe('New briefs are live.')
  })
})
