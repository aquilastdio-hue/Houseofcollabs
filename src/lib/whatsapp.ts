/**
 * Click-to-chat links (wa.me). These open WhatsApp with a number and,
 * optionally, a message already typed; the person still presses send. No
 * WhatsApp provider or approved template is involved.
 */

/** wa.me wants the full international number; a bare 10-digit number is Indian. */
export function whatsappNumber(number: string): string | null {
  const d = number.replace(/\D/g, '')
  const intl = d.length === 10 ? `91${d}` : d.length === 11 && d.startsWith('0') ? `91${d.slice(1)}` : d
  return intl.length >= 10 && intl.length <= 15 ? intl : null
}

export function whatsappHref(number: string, text?: string): string {
  const base = `https://wa.me/${whatsappNumber(number) ?? number.replace(/\D/g, '')}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/** Titles and short forms that come before a name rather than being one. */
const PREFIXES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'mohd', 'md', 'smt', 'shri', 'sri'])

/**
 * The name to greet someone by: the first word of their name, past any
 * title ("Mohd Saad" → "Saad"), in normal case ("RASHI" → "Rashi",
 * "riya" → "Riya"). Mixed case is left alone, so "McKenzie" stays.
 */
export function firstName(fullName: string | null | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  const word = words.find((w, i) => !PREFIXES.has(w.toLowerCase().replace(/\.$/, '')) || i === words.length - 1) ?? ''
  if (!word) return ''
  const lower = word.toLocaleLowerCase('en-IN')
  const base = word === word.toLocaleUpperCase('en-IN') && word.length > 1 ? lower : word
  return base.charAt(0).toLocaleUpperCase('en-IN') + base.slice(1)
}

/** `{name}` becomes the person's first name; without a name, the greeting still reads. */
export function personalize(message: string, fullName: string | null | undefined): string {
  const first = firstName(fullName)
  return first ? message.replace(/\{name\}/gi, first) : message.replace(/ *\{name\}/gi, '')
}
