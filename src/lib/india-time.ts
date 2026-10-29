/**
 * India time (IST, UTC+05:30, no daylight saving). Email campaigns run on it
 * whatever the admin's computer is set to.
 */

const IST = 'Asia/Kolkata'

/** "29 Oct, 10:00 am" in India time (the year only when it isn't this year). */
export function istDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

/** '10:00' or '10:00:00' → "10:00 am". */
export function istTimeLabel(hhmm: string | null | undefined) {
  if (!hhmm) return '—'
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }).format(Date.UTC(2000, 0, 1, h, m))
}

/** An instant as its India date ('yyyy-MM-dd') and time ('HH:MM'). */
export function istParts(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: IST,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/** An India date and time as an ISO timestamp. */
export function istToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`).toISOString()
}
